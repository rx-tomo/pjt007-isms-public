import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'
import { getStorageProvider } from '@/lib/storage'
import { projectDocumentStoragePath } from '@/lib/server/documents/documentOutputProjection'

type Params = { id: string }

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { id } = await props.params
  const service = new DocumentTenantMutationService()
  const organizationId = await service.getOrganizationId(id)
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const authorization = await resolveTenantAuthorizationContext(getDb(), user.id, organizationId)
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const document = await service.getDocument(authorization.context, id)
  if (!document) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const versions = await service.getVersions(authorization.context, id)
  return applyCookies(NextResponse.json({
    data: versions.map(version => ({
      ...version,
      file_path: projectDocumentStoragePath(
        version.file_path,
        organizationId,
        id
      ) ? 'managed' : null,
      created_by: version.created_by || null,
    })),
  }))
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  return applyCookies(NextResponse.json(
    { error: 'Upload the document file to create a version' },
    { status: 400 }
  ))
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { id } = await props.params
  const versionId = request.nextUrl.searchParams.get('versionId')?.trim()
  const operationKey = request.headers.get('idempotency-key')?.trim()
  if (!versionId || !operationKey) {
    return applyCookies(NextResponse.json(
      { error: 'versionId and Idempotency-Key are required' },
      { status: 400 }
    ))
  }

  const service = new DocumentTenantMutationService()
  const organizationId = await service.getOrganizationId(id)
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const authorization = await resolveTenantAuthorizationContext(
    getDb(),
    user.id,
    organizationId
  )
  if (!authorization.ok || !await service.getDocument(authorization.context, id)) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const audit = { userId: user.id, userAgent: request.headers.get('user-agent') }
  try {
    const deleted = await service.deleteDocumentVersionWithStorage(
      authorization.context,
      id,
      versionId,
      operationKey,
      audit
    )
    if (deleted.filePaths.length === 0 || deleted.operation.status === 'cleaned') {
      return applyCookies(NextResponse.json({
        data: { id: versionId, cleanup_pending: false },
      }))
    }
    const claimed = await service.claimStorageCleanupOperation(
      authorization.context,
      deleted.operation.id,
      new Date().toISOString(),
      audit
    )
    if (!claimed?.leaseToken) {
      return applyCookies(NextResponse.json(
        { data: { id: versionId, cleanup_pending: true } },
        { status: 202 }
      ))
    }
    const cleanup = await getStorageProvider().remove('documents', deleted.filePaths)
    const persisted = await service.markStorageCleanupOutcome(
      authorization.context,
      deleted.operation.id,
      claimed.leaseToken,
      {
        success: !cleanup.error,
        errorMessage: cleanup.error ? 'storage_remove_failed' : null,
      }
    )
    const cleanupPending = Boolean(cleanup.error) || !persisted
    return applyCookies(NextResponse.json(
      { data: { id: versionId, cleanup_pending: cleanupPending } },
      { status: cleanupPending ? 202 : 200 }
    ))
  } catch (error) {
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Document version DELETE failed')
    return applyCookies(NextResponse.json(
      { error: 'Failed to delete document version' },
      { status: 500 }
    ))
  }
}
