import { NextRequest, NextResponse } from 'next/server'
import {
  createPdfExport,
  createDocxExport,
  createExcelExport,
  formatDocumentDate,
  PdfExportUnavailableError,
  sanitizeDocumentFileName,
  type DocumentExportModel
} from '@/lib/utils/exporters/documentExport'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { documents, documentVersions, documentFolders } from '@/lib/db/drizzle/schema/documents'
import { approvalRequests } from '@/lib/db/drizzle/schema/approvals'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
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
  fallback: PracticalDocumentFixture | null
) {
  if (!filePath) return fallback?.body ?? null
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

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'approver', 'system_operator'],
    actionName: 'service_role.document_export',
    logContext: { documentId: params.id }
  })

  if (error) {
    return error
  }

  if (!guard) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { profile, wrapResponse, json, logEvent } = guard
  const docId = params.id
  const db = getDb()

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1)

  if (!document) {
    await logEvent('error', { reason: 'document_not_found' }, { format, documentId: docId })
    return json({ error: 'Document not found' }, { status: 404 })
  }

  if (!profile.organization_id || document.organizationId !== profile.organization_id) {
    await logEvent(
      'denied',
      {
        reason: 'cross_tenant_request',
        requestedOrganizationId: document.organizationId,
        resolvedOrganizationId: profile.organization_id
      },
      { format, documentId: document.id }
    )
    return json({ error: 'Forbidden' }, { status: 403 })
  }

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
        eq(approvalRequests.resourceId, document.id)
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
    document.folderId
      ? db
          .select({ id: documentFolders.id, name: documentFolders.name })
          .from(documentFolders)
          .where(eq(documentFolders.id, document.folderId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : Promise.resolve(null)
  ])

  const approvals = approvalsResult
  const versions = versionsResult
  const folderName = folderResult?.name ?? null
  const exportedAt = new Date().toISOString()
  const latestVersionNumber = versions.length > 0 ? versions[versions.length - 1].versionNumber : 1

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, document.organizationId))
    .limit(1)
  const organizationName = org?.name ?? 'Unknown organization'

  const exportContext = {
    version: latestVersionNumber,
    exportedAt,
    organization: organizationName
  }

  const userIds = new Set<string>()
  userIds.add(document.createdBy)
  if (document.updatedBy) userIds.add(document.updatedBy)
  if (document.approvedBy) userIds.add(document.approvedBy)
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
  let tagsList: string[] = []
  if (document.tags) {
    try {
      const parsed = JSON.parse(document.tags)
      if (Array.isArray(parsed)) tagsList = parsed
    } catch {
      // ignore parse error
    }
  }

  const createdBy = users.get(document.createdBy)
  const updatedBy = document.updatedBy ? users.get(document.updatedBy) : null
  let approvedByName: string | null = null
  if (document.approvedBy) {
    const approvedBy = users.get(document.approvedBy)
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
      label: `Step ${approval.stepNumber ?? '\u2014'}: ${status}`,
      detail: `${approverName}, ${updatedAt}`
    }
  })

  const versionItems = versions.map(version => {
    const author = users.get(version.createdBy)
    const authorName = author?.name ?? version.createdBy
    return {
      label: `v${version.versionNumber}`,
      detail: `${formatDocumentDate(version.createdAt ?? '')} by ${authorName}${version.changes ? ` - ${version.changes}` : ''}`
    }
  })

  const bodyMarkdown = await readDocumentBody(
    document.filePath,
    document.mimeType,
    document.fileSize,
    getPracticalDocumentFixture(document.id)
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
      createdAt: formatDocumentDate(document.createdAt ?? ''),
      createdBy: createdBy?.name ?? null,
      updatedAt: document.updatedAt ? formatDocumentDate(document.updatedAt) : null,
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
        'Content-Disposition': `attachment; filename="${safeTitle}.docx"`
      }
    })

    return wrapResponse(response)
  }

  if (format === 'excel') {
    const excelBuffer = createExcelExport(exportModel)
    await logEvent('success', exportContext, { format, documentId: document.id })
    const response = new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="${safeTitle}.xls"`
      }
    })

    return wrapResponse(response)
  }

  let pdfBuffer: Buffer
  if (!consumePdfExportAllowance(profile.id)) {
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
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`
    }
  })

  return wrapResponse(response)
}
