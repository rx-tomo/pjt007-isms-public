import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { getStorageProvider } from '@/lib/storage'
import { isDocumentStoragePath } from '@/lib/storage/documentFilePolicy'

function parseFilePaths(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(path => typeof path === 'string')
      ? parsed
      : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const input = body as Record<string, unknown>
  if (
    Object.keys(input).some(key => !['organizationId', 'limit'].includes(key))
    || typeof input.organizationId !== 'string'
    || (input.limit !== undefined && !Number.isInteger(input.limit))
  ) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    input.organizationId,
    'documents.update'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }

  const service = new DocumentTenantMutationService()
  const stalePendingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const operations = await service.claimStorageCleanupOperations(
    authorization.context,
    stalePendingBefore,
    typeof input.limit === 'number' ? input.limit : 20,
    { userId: user.id, userAgent: request.headers.get('user-agent') }
  )
  const storage = getStorageProvider()
  let cleaned = 0
  let pending = 0
  for (const operation of operations) {
    if (!operation.leaseToken) {
      pending += 1
      continue
    }
    const paths = parseFilePaths(operation.filePaths)
    const valid = paths?.every(path => isDocumentStoragePath(
      path,
      operation.organizationId,
      operation.documentId
    )) === true
    const cleanup = valid
      ? await storage.remove('documents', paths ?? [])
      : { error: new Error('invalid_storage_path') }
    const recorded = await service.markStorageCleanupOutcome(
      authorization.context,
      operation.id,
      operation.leaseToken,
      {
        success: !cleanup.error,
        errorMessage: cleanup.error
          ? (valid ? 'storage_remove_failed' : 'invalid_storage_path')
          : null,
      }
    )
    if (cleanup.error || !recorded) pending += 1
    else cleaned += 1
  }
  return applyCookies(NextResponse.json({
    data: { processed: operations.length, cleaned, pending },
  }))
}
