import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships, documents, auditLogs } from '@/lib/db/drizzle/schema'
import { DocumentService } from '@/lib/services/document'
import { StorageQuotaService } from '@/lib/services/storageQuota'
import { and, eq } from 'drizzle-orm'

interface CreateDocumentPayload {
  document?: {
    organization_id: string
    title: string
    description?: string | null
    category?: string | null
    folder_id?: string | null
    tags?: string | null
    file_name?: string | null
    file_path?: string | null
    file_size?: number | null
    mime_type?: string | null
    retention_delete_at?: string | null
    approved_at?: string | null
    approved_by?: string | null
    status: string
  }
  userId?: string
}

async function assertOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  return profile?.organizationId === organizationId || Boolean(membership)
}

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
  const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const documentService = new DocumentService()

  try {
    if (action === 'folders') {
      const parentId = searchParams.get('parentId') ?? undefined
      const data = await documentService.getFolders(organizationId, parentId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'documents') {
      const folderId = searchParams.get('folderId') ?? undefined
      const departmentId = searchParams.get('departmentId') ?? undefined
      const includeNoDepartment = searchParams.get('includeNoDepartment') === 'true'
      const data = await documentService.getDocuments(organizationId, folderId, {
        departmentId,
        includeNoDepartment,
      })
      const enriched = await documentService.enrichDocumentsWithApprovalProgress(organizationId, data)
      return applyCookies(NextResponse.json(enriched))
    }

    if (action === 'documentsScoped') {
      const folderId = searchParams.get('folderId') ?? undefined
      const requestingUserId = searchParams.get('requestingUserId') ?? user.id
      const data = await documentService.getDocumentsScoped(organizationId, requestingUserId, folderId)
      const enriched = await documentService.enrichDocumentsWithApprovalProgress(organizationId, data)
      return applyCookies(NextResponse.json(enriched))
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
  } catch (error) {
    console.error('Document API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load document data' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  let payload: CreateDocumentPayload

  try {
    payload = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }))
  }

  const { document: doc } = payload
  const userId = user.id

  if (!doc) {
    return applyCookies(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
  }

  if (!doc.organization_id || !doc.title?.trim()) {
    return applyCookies(NextResponse.json({ error: 'Invalid document payload' }, { status: 400 }))
  }

  if (!doc.status || !['draft', 'in_review', 'approved', 'obsolete'].includes(doc.status)) {
    return applyCookies(NextResponse.json({ error: 'Invalid status' }, { status: 400 }))
  }

  const db = getDb()

  // Verify user belongs to the target organization
  const [profile] = await db
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!profile?.organizationId || profile.organizationId !== doc.organization_id) {
    return applyCookies(NextResponse.json({ error: 'Organization mismatch' }, { status: 403 }))
  }

  const docId = crypto.randomUUID()
  const now = new Date().toISOString()

  try {
    await db.insert(documents).values({
      id: docId,
      organizationId: doc.organization_id,
      title: doc.title,
      description: doc.description ?? null,
      category: doc.category ?? null,
      folderId: doc.folder_id ?? null,
      tags: doc.tags ?? null,
      fileName: doc.file_name ?? null,
      filePath: doc.file_path ?? null,
      fileSize: doc.file_size ?? null,
      mimeType: doc.mime_type ?? null,
      retentionDeleteAt: doc.retention_delete_at ?? null,
      approvedAt: doc.approved_at ?? null,
      approvedBy: doc.approved_by ?? null,
      status: doc.status,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    console.error('Document creation failed', err)
    return applyCookies(NextResponse.json({ error: 'Failed to create document' }, { status: 500 }))
  }

  // Read back created document
  const [data] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1)

  if (!data) {
    return applyCookies(NextResponse.json({ error: 'Failed to create document' }, { status: 500 }))
  }

  // Map Drizzle row back to snake_case for API compat
  const result = {
    id: data.id,
    organization_id: data.organizationId,
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    folder_id: data.folderId,
    tags: data.tags,
    file_name: data.fileName,
    file_path: data.filePath,
    file_size: data.fileSize,
    mime_type: data.mimeType,
    retention_delete_at: data.retentionDeleteAt,
    approved_at: data.approvedAt,
    approved_by: data.approvedBy,
    created_by: data.createdBy,
    updated_by: data.updatedBy,
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  }

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: data.organizationId ?? '',
      userId: userId,
      action: 'document.created',
      resourceType: 'document',
      resourceId: data.id,
      changes: JSON.stringify({
        title: data.title,
        status: data.status,
        folder_id: data.folderId ?? null
      }),
      createdAt: now,
    })
  } catch (auditError) {
    console.error('Failed to record audit log for document creation', auditError)
  }

  return applyCookies(NextResponse.json({ data: result }))
}
