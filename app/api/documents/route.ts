import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { DocumentService } from '@/lib/services/document'
import { StorageQuotaService } from '@/lib/services/storageQuota'
import { hydratePracticalDocumentFile } from '@/lib/fixtures/practicalDocumentFixtures'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'documents'
  const organizationId = searchParams.get('organizationId')

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const authorization = await authorizeTenantAction(
    db,
    user.id,
    organizationId,
    'documents.read'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }

  const documentService = new DocumentService()

  try {
    if (action === 'folders') {
      const parentId = searchParams.get('parentId') ?? undefined
      const data = await documentService.getFolders(organizationId, parentId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'documents' || action === 'documentsScoped') {
      const folderId = searchParams.get('folderId') ?? undefined
      const departmentId = searchParams.get('departmentId') ?? undefined
      const includeNoDepartment = searchParams.get('includeNoDepartment') === 'true'
      const data = await documentService.getDocumentsForDepartmentAccess(
        organizationId,
        authorization.context.departmentAccess,
        folderId,
        {
          departmentId,
          includeNoDepartment,
        }
      )
      const enriched = await documentService.enrichDocumentsWithApprovalProgress(
        organizationId,
        data.map(hydratePracticalDocumentFile)
      )
      return applyCookies(NextResponse.json(enriched.map(document => ({
        ...document,
        file_path: document.file_path ? 'managed' : null,
      }))))
    }

    if (action === 'storageUsage') {
      const totalBytes = await new StorageQuotaService().getOrganizationUsage(organizationId)
      return applyCookies(NextResponse.json({ totalBytes }))
    }

    if (action === 'approverMetrics') {
      const data = await documentService.getApproverDashboardMetrics(organizationId)
      return applyCookies(NextResponse.json({ data }))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch {
    console.error('Document API GET failed')
    return applyCookies(NextResponse.json({ error: 'Failed to load document data' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }))
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return applyCookies(NextResponse.json({ error: 'Invalid document payload' }, { status: 400 }))
  }
  const body = payload as Record<string, unknown>
  if (Object.keys(body).some(key => key !== 'document')) {
    return applyCookies(NextResponse.json({ error: 'Unsupported request field' }, { status: 400 }))
  }
  const doc = body.document
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return applyCookies(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
  }
  const organizationId = (doc as Record<string, unknown>).organization_id
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    return applyCookies(NextResponse.json({ error: 'Invalid document payload' }, { status: 400 }))
  }

  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    organizationId,
    'documents.create'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }
  try {
    const service = new DocumentTenantMutationService()
    const data = await service.createDocument(authorization.context, doc, {
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
    })
    return applyCookies(NextResponse.json({ data }))
  } catch (error) {
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Document creation failed')
    return applyCookies(NextResponse.json({ error: 'Failed to create document' }, { status: 500 }))
  }
}
