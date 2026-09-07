import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
  type TenantAction,
} from '@/lib/server/auth/actionPolicy'
import { parseLimitedFormData } from '@/lib/server/http/limitedFormData'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { StorageQuotaService } from '@/lib/services/storageQuota'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'
import { getStorageProvider } from '@/lib/storage'
import {
  createDocumentStoragePath,
  isDocumentStoragePath,
  validateDocumentFile,
  validateDocumentFileContent,
} from '@/lib/storage/documentFilePolicy'
import {
  getTaskAttachmentMaxFileSize,
  isTaskAttachmentSizeAllowed,
  TASK_ATTACHMENT_MULTIPART_OVERHEAD_BYTES,
} from '@/lib/storage/taskAttachmentPolicy'
import { createStorageDownloadHeaders } from '@/lib/storage/storageRoutePolicy'
import { getPracticalDocumentFixture } from '@/lib/fixtures/practicalDocumentFixtures'

type Params = { id: string }

async function resolveDocumentAuthorization(
  userId: string,
  documentId: string,
  action: TenantAction
) {
  const service = new DocumentTenantMutationService()
  const organizationId = await service.getOrganizationId(documentId)
  if (!organizationId) return { ok: false as const, status: 404 as const }
  const authorization = await authorizeTenantAction(
    getDb(),
    userId,
    organizationId,
    action
  )
  if (!authorization.ok) {
    return {
      ok: false as const,
      status: tenantActionDenialStatus(authorization),
    }
  }
  const document = await service.getDocument(authorization.context, documentId)
  if (!document) return { ok: false as const, status: 404 as const }
  return {
    ok: true as const,
    service,
    authorization: authorization.context,
    document,
  }
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { id } = await props.params
  const resolved = await resolveDocumentAuthorization(user.id, id, 'documents.read')
  if (!resolved.ok) {
    return applyCookies(NextResponse.json(
      { error: resolved.status === 403 ? 'Forbidden' : 'Not found' },
      { status: resolved.status }
    ))
  }
  const versionId = request.nextUrl.searchParams.get('versionId')?.trim()
  const version = versionId
    ? await resolved.service.getVersion(resolved.authorization, id, versionId)
    : null
  if (versionId && !version) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const filePath = version?.file_path ?? resolved.document.file_path
  const fileName = version?.file_name ?? resolved.document.file_name ?? 'document'
  if (!filePath) {
    const fixture = !versionId ? getPracticalDocumentFixture(id) : null
    if (!fixture) {
      return applyCookies(NextResponse.json({ error: 'File not found' }, { status: 404 }))
    }
    return applyCookies(new NextResponse(fixture.body, {
      headers: createStorageDownloadHeaders(fixture.virtualPath, fixture.fileName),
    }))
  }
  if (!isDocumentStoragePath(
    filePath,
    resolved.authorization.organizationId,
    id
  )) {
    return applyCookies(NextResponse.json({ error: 'File not found' }, { status: 404 }))
  }

  const storage = getStorageProvider()
  const { data, error } = await storage.download('documents', filePath)
  if (error || !data) {
    return applyCookies(NextResponse.json({ error: 'Failed to download document' }, { status: 500 }))
  }
  return applyCookies(new NextResponse(await data.arrayBuffer(), {
    headers: createStorageDownloadHeaders(filePath, fileName),
  }))
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { id } = await props.params
  const resolved = await resolveDocumentAuthorization(user.id, id, 'documents.update')
  if (!resolved.ok) {
    return applyCookies(NextResponse.json(
      { error: resolved.status === 403 ? 'Forbidden' : 'Not found' },
      { status: resolved.status }
    ))
  }
  const formDataResult = await parseLimitedFormData(
    request,
    getTaskAttachmentMaxFileSize() + TASK_ATTACHMENT_MULTIPART_OVERHEAD_BYTES
  )
  if (!formDataResult.ok) {
    const status = formDataResult.reason === 'too_large' ? 413 : 400
    return applyCookies(NextResponse.json(
      { error: status === 413 ? 'Document file is too large' : 'Invalid form data' },
      { status }
    ))
  }
  const file = formDataResult.formData.get('file')
  if (!(file instanceof File)) {
    return applyCookies(NextResponse.json({ error: 'file is required' }, { status: 400 }))
  }
  if (!isTaskAttachmentSizeAllowed(file.size)) {
    return applyCookies(NextResponse.json({ error: 'Document file is too large' }, { status: 413 }))
  }
  const validation = validateDocumentFile(file.name, file.type)
  if (!validation.ok) {
    return applyCookies(NextResponse.json({ error: 'Unsupported document file' }, { status: 400 }))
  }
  if (!await validateDocumentFileContent(file, validation.extension)) {
    return applyCookies(NextResponse.json({ error: 'Unsupported document file' }, { status: 400 }))
  }

  const titleValue = formDataResult.formData.get('title')
  const descriptionValue = formDataResult.formData.get('description')
  const changesValue = formDataResult.formData.get('changes')
  const modeValue = formDataResult.formData.get('mode')
  const mode = modeValue === null || modeValue === '' || modeValue === 'normal'
    ? 'normal'
    : modeValue === 'revision'
      ? 'revision'
      : null
  if (!mode) {
    return applyCookies(NextResponse.json({ error: 'Invalid document upload mode' }, { status: 400 }))
  }
  if (
    (mode === 'normal' && resolved.document.status !== 'draft')
    || (
      mode === 'revision'
      && resolved.document.status !== 'approved'
      && resolved.document.status !== 'obsolete'
    )
  ) {
    return applyCookies(NextResponse.json({ error: 'Document is not editable' }, { status: 409 }))
  }
  const title = typeof titleValue === 'string' && titleValue.trim()
    ? titleValue.trim()
    : resolved.document.title
  const description = typeof descriptionValue === 'string'
    ? descriptionValue.trim() || null
    : resolved.document.description
  const changes = typeof changesValue === 'string' ? changesValue.trim() || null : null
  const operationKey = request.headers.get('idempotency-key')?.trim()
  if (!operationKey) {
    return applyCookies(NextResponse.json({ error: 'Idempotency-Key is required' }, { status: 400 }))
  }
  const fileBytes = Buffer.from(await file.arrayBuffer())
  const requestFingerprint = createHash('sha256')
    .update(fileBytes)
    .update(JSON.stringify({
      name: validation.displayName,
      mimeType: validation.mimeType,
      title,
      description,
      changes,
      mode,
    }))
    .digest('hex')
  const filePath = createDocumentStoragePath(
    resolved.authorization.organizationId,
    id,
    validation.extension
  )
  const storage = getStorageProvider()
  let operationId: string | null = null
  try {
    const prepared = await resolved.service.prepareFileUpload(
      resolved.authorization,
      id,
      { operationKey, filePath, requestFingerprint, mode },
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    if (prepared.replay && prepared.operation.versionId) {
      const version = await resolved.service.getVersion(
        resolved.authorization,
        id,
        prepared.operation.versionId
      )
      if (!version) {
        throw new Error('Completed document upload result is unavailable')
      }
      return applyCookies(NextResponse.json({
        data: {
          document_id: id,
          file_name: version.file_name,
          file_size: version.file_size,
          mime_type: validation.mimeType,
          version_number: version.version_number,
        },
      }))
    }
    operationId = prepared.operation.id
    await new StorageQuotaService().ensureUploadAllowed(
      resolved.authorization.organizationId,
      file
    )
    const { error } = await storage.upload('documents', filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const result = await resolved.service.completeFileUpload(
      resolved.authorization,
      prepared.operation.id,
      id,
      {
        fileName: validation.displayName,
        filePath,
        fileSize: file.size,
        mimeType: validation.mimeType,
        title,
        description,
        changes,
        mode,
      },
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({
      data: {
        document_id: result.document.id,
        file_name: result.document.file_name,
        file_size: result.document.file_size,
        mime_type: result.document.mime_type,
        version_number: result.version.version_number,
      },
    }, { status: 201 }))
  } catch (error) {
    if (operationId) {
      try {
        const claimed = await resolved.service.claimStorageCleanupOperation(
          resolved.authorization,
          operationId,
          new Date().toISOString(),
          { userId: user.id, userAgent: request.headers.get('user-agent') }
        )
        if (claimed?.leaseToken) {
          const cleanup = await storage.remove('documents', [filePath])
          const persisted = await resolved.service.markStorageCleanupOutcome(
            resolved.authorization,
            operationId,
            claimed.leaseToken,
            {
              success: !cleanup.error,
              errorMessage: cleanup.error ? 'storage_remove_failed' : null,
            }
          )
          if (!persisted) console.error('Document upload cleanup lease expired')
          if (cleanup.error) console.error('Document upload compensation failed')
        }
      } catch {
        console.error('Document upload cleanup state update failed')
      }
    }
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Document file upload failed')
    return applyCookies(NextResponse.json({ error: 'Failed to upload document' }, { status: 500 }))
  }
}
