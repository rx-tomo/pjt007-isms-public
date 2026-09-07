import { NextRequest, NextResponse } from 'next/server'
import {
  createPdfExport,
  createDocxExport,
  createExcelExport,
  createAttachmentContentDisposition,
  formatDocumentDate,
  PdfExportUnavailableError,
  sanitizeDocumentFileName,
  type DocumentExportModel
} from '@/lib/utils/exporters/documentExport'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { logExportEvent } from '@/lib/server/logging/exportEvents'
import {
  projectDocumentStoragePath,
  projectDocumentTags,
} from '@/lib/server/documents/documentOutputProjection'
import { getDb } from '@/lib/db/drizzle/client'
import { documentVersions, documentFolders } from '@/lib/db/drizzle/schema/documents'
import { approvalRequests } from '@/lib/db/drizzle/schema/approvals'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema/users'
import { getStorageProvider } from '@/lib/storage'
import { eq, and, asc, inArray } from 'drizzle-orm'
import {
  getPracticalDocumentFixture,
  type PracticalDocumentFixture
} from '@/lib/fixtures/practicalDocumentFixtures'

export const runtime = 'nodejs'

const WORD_FORMATS = new Set(['word', 'doc', 'docx'])
const EXCEL_FORMATS = new Set(['excel', 'xls', 'xlsx'])
const TEXT_MIME_TYPES = new Set([
  'text/markdown',
  'text/plain',
  'application/markdown'
])
const MAX_EXPORT_BODY_BYTES = 1024 * 1024
const PDF_EXPORTS_PER_MINUTE = 5
const pdfExportWindows = new Map<string, { startedAt: number; count: number }>()

function consumePdfExportAllowance(userId: string) {
  const now = Date.now()
  for (const [key, window] of pdfExportWindows) {
    if (now - window.startedAt >= 60_000) pdfExportWindows.delete(key)
  }
  const current = pdfExportWindows.get(userId)
  if (!current || now - current.startedAt >= 60_000) {
    pdfExportWindows.set(userId, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= PDF_EXPORTS_PER_MINUTE) return false
  current.count += 1
  return true
}

async function readDocumentBody(
  filePath: string | null,
  mimeType: string | null,
  fileSize: number | null,
  fallback: PracticalDocumentFixture | null,
  organizationId: string,
  documentId: string
) {
  if (!filePath) return fallback?.body ?? null
  if (!projectDocumentStoragePath(filePath, organizationId, documentId)) {
    return fallback?.body ?? null
  }
  const baseMimeType = mimeType?.toLowerCase().split(';')[0]?.trim()
  if (baseMimeType && !TEXT_MIME_TYPES.has(baseMimeType)) return fallback?.body ?? null
  if (fileSize && fileSize > MAX_EXPORT_BODY_BYTES) return fallback?.body ?? null

  const storage = getStorageProvider()
  const { data, error } = await storage.download('documents', filePath)
  if (error || !data) {
    console.warn('Document export body read skipped', {
      reason: error ? 'storage_download_failed' : 'missing_blob'
    })
    return fallback?.body ?? null
  }
  if (data.size > MAX_EXPORT_BODY_BYTES) return fallback?.body ?? null

  return data.text()
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const formatParam = request.nextUrl.searchParams.get('format')?.toLowerCase() ?? 'pdf'
  const format = WORD_FORMATS.has(formatParam)
    ? 'word'
    : formatParam === 'pdf'
      ? 'pdf'
      : EXCEL_FORMATS.has(formatParam)
        ? 'excel'
        : null

  if (!format) {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  }
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const docId = params.id
  const db = getDb()
  const service = new DocumentTenantMutationService()
  const organizationId = await service.getOrganizationId(docId)
  const authorization = organizationId
    ? await authorizeTenantAction(db, user.id, organizationId, 'documents.read')
    : null
  if (
    !organizationId
    || !authorization?.ok
  ) {
    const status = authorization && !authorization.ok
      ? tenantActionDenialStatus(authorization)
      : 404
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }
  const document = await service.getDocument(authorization.context, docId)
  if (!document) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const json = (body: unknown, init?: ResponseInit) => applyCookies(NextResponse.json(body, init))
  const logEvent = (
    status: 'success' | 'denied' | 'error',
    context?: Record<string, unknown>,
    metadata?: { format?: string; documentId?: string | null }
  ) => logExportEvent({
    userId: user.id,
    organizationId,
    documentId: metadata?.documentId ?? document.id,
    format: metadata?.format ?? format,
    status,
    context,
  })

  const [approvalsResult, versionsResult, folderResult] = await Promise.all([
    db
      .select({
        stepNumber: approvalRequests.stepNumber,
        status: approvalRequests.status,
        approverId: approvalRequests.approverId,
        updatedAt: approvalRequests.updatedAt,
      })
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.resourceType, 'document'),
        eq(approvalRequests.resourceId, document.id),
        eq(approvalRequests.organizationId, organizationId)
      ))
      .orderBy(asc(approvalRequests.stepNumber)),
    db
      .select({
        versionNumber: documentVersions.versionNumber,
        createdAt: documentVersions.createdAt,
        createdBy: documentVersions.createdBy,
        changes: documentVersions.description,
      })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, document.id))
      .orderBy(asc(documentVersions.versionNumber)),
    document.folder_id
      ? db
          .select({ id: documentFolders.id, name: documentFolders.name })
          .from(documentFolders)
          .where(and(
            eq(documentFolders.id, document.folder_id),
            eq(documentFolders.organizationId, organizationId)
          ))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : Promise.resolve(null)
  ])

  const approvals = approvalsResult
  const versions = versionsResult
  const folderName = folderResult?.name ?? null
  const exportedAt = new Date().toISOString()
  const latestVersionNumber = versions.length > 0
    ? versions[versions.length - 1].versionNumber
    : document.version_number ?? 1

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)
  const organizationName = org?.name ?? 'Unknown organization'

  const exportContext = {
    version: latestVersionNumber,
    exportedAt,
    organization: organizationName
  }

  const userIds = new Set<string>()
  userIds.add(document.created_by)
  if (document.updated_by) userIds.add(document.updated_by)
  if (document.approved_by) userIds.add(document.approved_by)
  approvals.forEach(approval => {
    if (approval.approverId) userIds.add(approval.approverId)
  })
  versions.forEach(version => {
    userIds.add(version.createdBy)
  })

  const userProfileRows = userIds.size > 0
    ? await db
        .select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email })
        .from(userProfiles)
        .innerJoin(userMemberships, and(
          eq(userMemberships.userId, userProfiles.id),
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.status, 'active')
        ))
        .where(inArray(userProfiles.id, Array.from(userIds)))
    : []

  const users = new Map<string, { name: string; email: string | null }>()
  userProfileRows.forEach(profileRecord => {
    users.set(profileRecord.id, {
      name: profileRecord.fullName || profileRecord.email,
      email: profileRecord.email || null
    })
  })

  // Parse tags from JSON string
  const tagsList = projectDocumentTags(document.tags)

  const createdBy = users.get(document.created_by)
  const updatedBy = document.updated_by ? users.get(document.updated_by) : null
  let approvedByName: string | null = null
  if (document.approved_by) {
    const approvedBy = users.get(document.approved_by)
    if (approvedBy) {
      approvedByName = approvedBy.name
    }
  }

  const approvalItems = approvals.map(approval => {
    const approver = approval.approverId ? users.get(approval.approverId) : null
    const approverName = approver?.name ?? '\u2014'
    const status = approval.status ?? 'pending'
    const updatedAt = approval.updatedAt ? formatDocumentDate(approval.updatedAt) : '\u2014'
    return {
      label: `承認段階 ${approval.stepNumber ?? '\u2014'}: ${status}`,
      detail: `${approverName} / ${updatedAt}`
    }
  })

  const versionItems = versions.map(version => {
    const author = users.get(version.createdBy)
    const authorName = author?.name ?? '\u2014'
    return {
      label: `v${version.versionNumber}`,
      detail: `${formatDocumentDate(version.createdAt ?? '')} / 作成者: ${authorName}${version.changes ? ` / ${version.changes}` : ''}`
    }
  })

  const bodyMarkdown = await readDocumentBody(
    document.file_path,
    document.mime_type,
    document.file_size,
    getPracticalDocumentFixture(document.id),
    organizationId,
    document.id
  )
  const exportModel: DocumentExportModel = {
    title: document.title,
    description: document.description,
    bodyMarkdown,
    metadata: {
      organization: organizationName,
      version: latestVersionNumber,
      exportedAt,
      status: document.status ?? 'unknown',
      category: document.category,
      folder: folderName,
      createdAt: formatDocumentDate(document.created_at ?? ''),
      createdBy: createdBy?.name ?? null,
      updatedAt: document.updated_at ? formatDocumentDate(document.updated_at) : null,
      updatedBy: updatedBy?.name ?? null,
      approvedBy: approvedByName,
      tags: tagsList
    },
    approvals: approvalItems,
    versions: versionItems
  }

  const safeTitle = sanitizeDocumentFileName(document.title || 'document')

  if (format === 'word') {
    const docxBuffer = await createDocxExport(exportModel)
    await logEvent('success', exportContext, { format, documentId: document.id })
    const response = new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': createAttachmentContentDisposition(`${safeTitle}.docx`, 'document.docx')
      }
    })

    return applyCookies(response)
  }

  if (format === 'excel') {
    const excelBuffer = createExcelExport(exportModel)
    await logEvent('success', exportContext, { format, documentId: document.id })
    const response = new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': createAttachmentContentDisposition(`${safeTitle}.xls`, 'document.xls')
      }
    })

    return applyCookies(response)
  }

  let pdfBuffer: Buffer
  if (!consumePdfExportAllowance(user.id)) {
    await logEvent(
      'denied',
      { ...exportContext, reason: 'pdf_rate_limit_exceeded' },
      { format, documentId: document.id }
    )
    return json({
      error: 'Too many PDF export requests. Please use Word or try again later.',
      errorCode: 'PDF_EXPORT_RATE_LIMITED'
    }, { status: 429 })
  }

  try {
    pdfBuffer = await createPdfExport(exportModel)
  } catch (pdfError) {
    if (!(pdfError instanceof PdfExportUnavailableError)) {
      throw pdfError
    }

    await logEvent(
      'error',
      { ...exportContext, reason: 'pdf_renderer_unavailable' },
      { format, documentId: document.id }
    )
    return json({
      error: 'PDF export is unavailable in this demo environment.',
      errorCode: pdfError.code
    }, { status: 503 })
  }

  await logEvent('success', exportContext, { format, documentId: document.id })
  const response = new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': createAttachmentContentDisposition(`${safeTitle}.pdf`, 'document.pdf')
    }
  })

  return applyCookies(response)
}
