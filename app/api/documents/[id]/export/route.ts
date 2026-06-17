import { NextRequest, NextResponse } from 'next/server'
import {
  createPdfExport,
  createDocxExport,
  createExcelExport,
  formatDocumentDate,
  sanitizeDocumentFileName
} from '@/lib/utils/exporters/documentExport'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { documents, documentVersions, documentFolders } from '@/lib/db/drizzle/schema/documents'
import { approvalRequests } from '@/lib/db/drizzle/schema/approvals'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and, asc, inArray } from 'drizzle-orm'

export const runtime = 'nodejs'

const WORD_FORMATS = new Set(['word', 'doc', 'docx'])
const EXCEL_FORMATS = new Set(['excel', 'xls', 'xlsx'])

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

  const metadataLines = [
    `Organization: ${organizationName}`,
    `Document Version: v${latestVersionNumber}`,
    `Exported At: ${exportedAt}`
  ]
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

  const sections: string[] = []
  sections.push(...metadataLines)
  sections.push('')
  sections.push(`Title: ${document.title}`)
  sections.push(`Status: ${document.status ?? 'unknown'}`)
  if (document.category) {
    sections.push(`Category: ${document.category}`)
  }
  if (folderName) {
    sections.push(`Folder: ${folderName}`)
  }
  sections.push(`Created At: ${formatDocumentDate(document.createdAt ?? '')}`)
  const createdBy = users.get(document.createdBy)
  if (createdBy) {
    sections.push(`Created By: ${createdBy.name}`)
  }
  if (document.updatedBy) {
    const updatedBy = users.get(document.updatedBy)
    sections.push(`Last Updated: ${formatDocumentDate(document.updatedAt ?? '')}${updatedBy ? ` by ${updatedBy.name}` : ''}`)
  }
  if (document.approvedBy) {
    const approvedBy = users.get(document.approvedBy)
    if (approvedBy) {
      sections.push(`Approved By: ${approvedBy.name}`)
    }
  }
  if (tagsList.length > 0) {
    sections.push(`Tags: ${tagsList.join(', ')}`)
  }
  sections.push('')
  sections.push('Description:')
  sections.push(document.description?.trim() || '(No description)')

  if (approvals.length > 0) {
    sections.push('')
    sections.push('Approval Flow:')
    approvals.forEach(approval => {
      const approver = approval.approverId ? users.get(approval.approverId) : null
      const approverName = approver?.name ?? '\u2014'
      const status = approval.status ?? 'pending'
      const updatedAt = approval.updatedAt ? formatDocumentDate(approval.updatedAt) : '\u2014'
      sections.push(`  Step ${approval.stepNumber ?? '\u2014'}: ${status} (${approverName}, ${updatedAt})`)
    })
  }

  if (versions.length > 0) {
    sections.push('')
    sections.push('Version History:')
    versions.forEach(version => {
      const author = users.get(version.createdBy)
      const authorName = author?.name ?? version.createdBy
      const changes = version.changes ? ` \u2013 ${version.changes}` : ''
      sections.push(`  v${version.versionNumber} (${formatDocumentDate(version.createdAt ?? '')} by ${authorName})${changes}`)
    })
  }

  const safeTitle = sanitizeDocumentFileName(document.title || 'document')
  await logEvent('success', exportContext, { format, documentId: document.id })

  if (format === 'word') {
    const docxBuffer = await createDocxExport(sections)
    const response = new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeTitle}.docx"`
      }
    })

    return wrapResponse(response)
  }

  if (format === 'excel') {
    const excelBuffer = createExcelExport(sections)
    const response = new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="${safeTitle}.xls"`
      }
    })

    return wrapResponse(response)
  }

  const pdfBuffer = createPdfExport(sections)
  const response = new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`
    }
  })

  return wrapResponse(response)
}
