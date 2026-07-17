import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'
import { getStorageProvider } from '@/lib/storage'
import { projectDocumentStoragePath } from '@/lib/server/documents/documentOutputProjection'

type Params = { id: string }

function projectDocumentResponse(
  document: Awaited<ReturnType<DocumentTenantMutationService['getDocument']>>,
  organizationId: string,
  documentId: string
) {
  if (!document) return null
  return {
    ...document,
    file_path: projectDocumentStoragePath(
      document.file_path,
      organizationId,
      documentId
    ) ? 'managed' : null,
    created_by: document.created_by || null,
    updated_by: document.updated_by || null,
    approved_by: document.approved_by || null,
    folder_id: document.folder_id || null,
  }
}

async function resolveDocumentAuthorization(userId: string, documentId: string) {
  const service = new DocumentTenantMutationService()
  const organizationId = await service.getOrganizationId(documentId)
  if (!organizationId) return null
  const authorization = await resolveTenantAuthorizationContext(getDb(), userId, organizationId)
  if (!authorization.ok) return null
  return { service, authorization: authorization.context }
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { id } = await props.params
  const resolved = await resolveDocumentAuthorization(user.id, id)
  if (!resolved) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const document = await resolved.service.getDocument(resolved.authorization, id)
  if (!document) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  return applyCookies(NextResponse.json({
    data: projectDocumentResponse(
      document,
      resolved.authorization.organizationId,
      id
    ),
  }))
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const value = await request.json().catch(() => null)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const { id } = await props.params
  const resolved = await resolveDocumentAuthorization(user.id, id)
  if (!resolved) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  try {
    const document = await resolved.service.updateDocument(
      resolved.authorization,
      id,
      value,
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    if (!document) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    const projected = await resolved.service.getDocument(resolved.authorization, id)
    if (!projected) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    return applyCookies(NextResponse.json({
      data: projectDocumentResponse(
        projected,
        resolved.authorization.organizationId,
        id
      ),
    }))
  } catch (error) {
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Document API PATCH failed')
    return applyCookies(NextResponse.json({ error: 'Failed to update document' }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { id } = await props.params
  const organizationId = request.headers.get('x-organization-id')?.trim()
  if (!organizationId || organizationId.length > 128 || /[\u0000-\u001f\u007f]/.test(organizationId)) {
    return applyCookies(NextResponse.json({ error: 'X-Organization-Id is required' }, { status: 400 }))
  }
  const authorization = await resolveTenantAuthorizationContext(
    getDb(),
    user.id,
    organizationId
  )
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const resolved = {
    service: new DocumentTenantMutationService(),
    authorization: authorization.context,
  }
  const operationKey = request.headers.get('idempotency-key')?.trim()
  if (!operationKey) {
    return applyCookies(NextResponse.json({ error: 'Idempotency-Key is required' }, { status: 400 }))
  }
  try {
    const deleted = await resolved.service.deleteDocumentWithStorage(
      resolved.authorization,
      id,
      operationKey,
      {
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
      }
    )
    if (deleted.filePaths.length === 0 || deleted.operation.status === 'cleaned') {
      return applyCookies(NextResponse.json({ data: { id, cleanup_pending: false } }))
    }
    const claimed = await resolved.service.claimStorageCleanupOperation(
      resolved.authorization,
      deleted.operation.id,
      new Date().toISOString(),
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    if (!claimed?.leaseToken) {
      return applyCookies(NextResponse.json(
        { data: { id, cleanup_pending: true } },
        { status: 202 }
      ))
    }
    const cleanup = await getStorageProvider().remove('documents', deleted.filePaths)
    const cleanupStatePersisted = await resolved.service.markStorageCleanupOutcome(
      resolved.authorization,
      deleted.operation.id,
      claimed.leaseToken,
      {
        success: !cleanup.error,
        errorMessage: cleanup.error ? 'storage_remove_failed' : null,
      }
    )
    const cleanupPending = Boolean(cleanup.error) || !cleanupStatePersisted
    return applyCookies(NextResponse.json(
      { data: { id, cleanup_pending: cleanupPending } },
      { status: cleanupPending ? 202 : 200 }
    ))
  } catch (error) {
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Document API DELETE failed')
    return applyCookies(NextResponse.json({ error: 'Failed to delete document' }, { status: 500 }))
  }
}
