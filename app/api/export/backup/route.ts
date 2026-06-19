import { NextRequest, NextResponse } from 'next/server'
import { toCsv } from '@/lib/utils/exporters/csv'
import { createZipBuffer, type ZipFileEntry } from '@/lib/utils/exporters/zip'
import { getDb } from '@/lib/db/drizzle/client'
import {
  documents,
  documentVersions,
  documentApprovals,
  risks,
  tasks,
  taskAttachments,
  educationPlans,
  educationRecords,
} from '@/lib/db/drizzle/schema'
import { informationAssets } from '@/lib/db/drizzle/schema/risks'
import {
  auditPlans,
  auditChecklists,
  auditEvidence,
  auditReports,
  nonconformities,
  correctiveActions,
  followUpRecords,
} from '@/lib/db/drizzle/schema/audit'
import { managementReviews, managementReviewActions } from '@/lib/db/drizzle/schema/management-reviews'
import { eq, inArray } from 'drizzle-orm'
import { logExportEvent } from '@/lib/server/logging/exportEvents'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getStorageProvider } from '@/lib/storage'

export const runtime = 'nodejs'

type BackupFileCandidate = {
  bucket: string
  source: 'document' | 'document_version' | 'task_attachment' | 'audit_evidence'
  id: string
  fileName: string | null
  filePath: string | null
}

type BackupFileManifestRow = {
  source: string
  id: string
  bucket: string
  file_name: string
  file_path: string
  zip_path: string
  status: string
  reason: string
  retrievable: string
  deletion_scope: string
  deletion_exception_reason: string
  responsibility_boundary: string
}

function safeZipSegment(value: string | null | undefined, fallback: string): string {
  const cleaned = (value ?? fallback)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')

  return cleaned || fallback
}

function isSafeStoragePath(filePath: string | null | undefined): filePath is string {
  if (!filePath) return false
  if (filePath.startsWith('/') || filePath.includes('\\')) return false
  return !filePath.split('/').some(segment => segment === '..')
}

function buildBackupReadme(params: {
  organizationId: string
  generatedAt: string
  csvFiles: string[]
  fileCandidates: number
  fileEntries: number
  missingFiles: number
}): string {
  return [
    '# Riscala AI for ISMS Backup Export',
    '',
    `Generated at: ${params.generatedAt}`,
    `Organization ID: ${params.organizationId}`,
    '',
    '## まず確認するファイル',
    '',
    '- `metadata.json`: 各CSVと同梱ファイルの件数を確認できます。',
    '- `backup_files_manifest.csv`: 添付・証跡ファイルがZIPへ同梱されたか、未取得だったかを確認できます。',
    '- `files/`: 取得できた文書、タスク添付、監査証跡ファイルの実体が入ります。',
    '',
    '## 主なCSV',
    '',
    ...params.csvFiles.map(file => `- \`${file}\``),
    '',
    '## ファイル同梱状況',
    '',
    `- 同梱候補: ${params.fileCandidates}`,
    `- 同梱済み: ${params.fileEntries}`,
    `- 未取得/スキップ: ${params.missingFiles}`,
    '',
    '## 注意',
    '',
    '- このZIPは組織データのバックアップ確認用です。',
    '- 未取得/スキップのファイルは `backup_files_manifest.csv` の `status` と `reason` を確認してください。',
    '- 契約終了時の正式な保持、削除、復元の扱いはサービス提供条件に従ってください。',
    '',
  ].join('\n')
}

async function buildBackupFileEntries(candidates: BackupFileCandidate[]): Promise<{
  entries: ZipFileEntry[]
  manifestRows: BackupFileManifestRow[]
}> {
  const storage = getStorageProvider()
  const entries: ZipFileEntry[] = []
  const manifestRows: BackupFileManifestRow[] = []

  for (const candidate of candidates) {
    const fileName = safeZipSegment(candidate.fileName, `${candidate.id}.bin`)
    const zipPath = `files/${candidate.source}/${safeZipSegment(candidate.id, 'unknown')}/${fileName}`
    const baseRow = {
      source: candidate.source,
      id: candidate.id,
      bucket: candidate.bucket,
      file_name: candidate.fileName ?? '',
      file_path: candidate.filePath ?? '',
      zip_path: zipPath,
    }

    if (!isSafeStoragePath(candidate.filePath)) {
      manifestRows.push({
        ...baseRow,
        status: 'skipped',
        reason: 'missing_or_unsafe_storage_path',
        retrievable: 'false',
        deletion_scope: 'not_exported',
        deletion_exception_reason: 'source_path_missing_or_unsafe',
        responsibility_boundary: 'file_not_confirmed_under_isms_pilot_storage',
      })
      continue
    }

    const { data, error } = await storage.download(candidate.bucket, candidate.filePath)
    if (error || !data) {
      manifestRows.push({
        ...baseRow,
        status: 'missing',
        reason: error?.message ?? 'file_not_found',
        retrievable: 'false',
        deletion_scope: 'storage_reference_only',
        deletion_exception_reason: 'file_unavailable_at_export_time',
        responsibility_boundary: 'storage_provider_or_external_system_may_need_separate_review',
      })
      continue
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    entries.push({ name: zipPath, content: buffer })
    manifestRows.push({
      ...baseRow,
      status: 'included',
      reason: '',
      retrievable: 'true',
      deletion_scope: 'isms_pilot_managed_file',
      deletion_exception_reason: '',
      responsibility_boundary: 'isms_pilot_managed_storage',
    })
  }

  return { entries, manifestRows }
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'organization_backup.export',
    logContext: { organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  try {
    const [
      documentsData,
      risksData,
      tasksData,
      informationAssetsData,
      educationPlansData,
      auditPlansData,
      followUpRecordsData,
      managementReviewsData,
    ] = await Promise.all([
      db.select({
        id: documents.id,
        title: documents.title,
        status: documents.status,
        category: documents.category,
        folder_id: documents.folderId,
        file_name: documents.fileName,
        file_path: documents.filePath,
        file_size: documents.fileSize,
        mime_type: documents.mimeType,
        created_at: documents.createdAt,
        updated_at: documents.updatedAt,
        created_by: documents.createdBy,
        updated_by: documents.updatedBy,
      }).from(documents).where(eq(documents.organizationId, organizationId)),

      db.select({
        id: risks.id,
        title: risks.title,
        status: risks.status,
        risk_score: risks.riskScore,
        impact_level: risks.impactLevel,
        likelihood_level: risks.likelihoodLevel,
        owner_id: risks.ownerId,
        category_id: risks.categoryId,
        identified_date: risks.identifiedDate,
        updated_at: risks.updatedAt,
      }).from(risks).where(eq(risks.organizationId, organizationId)),

      db.select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        assignee_id: tasks.assigneeId,
        due_date: tasks.dueDate,
        created_at: tasks.createdAt,
        updated_at: tasks.updatedAt,
      }).from(tasks).where(eq(tasks.organizationId, organizationId)),

      db.select({
        id: informationAssets.id,
        name: informationAssets.name,
        asset_type: informationAssets.assetType,
        classification: informationAssets.classification,
        criticality: informationAssets.criticality,
        owner_id: informationAssets.ownerId,
        location: informationAssets.location,
        status: informationAssets.status,
        description: informationAssets.description,
        created_at: informationAssets.createdAt,
        updated_at: informationAssets.updatedAt,
      }).from(informationAssets).where(eq(informationAssets.organizationId, organizationId)),

      db.select({
        id: educationPlans.id,
        title: educationPlans.title,
        status: educationPlans.status,
        target_audience: educationPlans.targetAudience,
        start_date: educationPlans.startDate,
        end_date: educationPlans.endDate,
        description: educationPlans.description,
        created_by: educationPlans.createdBy,
        created_at: educationPlans.createdAt,
        updated_at: educationPlans.updatedAt,
      }).from(educationPlans).where(eq(educationPlans.organizationId, organizationId)),

      db.select({
        id: auditPlans.id,
        title: auditPlans.title,
        audit_type: auditPlans.auditType,
        standard: auditPlans.standard,
        status: auditPlans.status,
        audit_period: auditPlans.auditPeriod,
        planned_start_date: auditPlans.plannedStartDate,
        planned_end_date: auditPlans.plannedEndDate,
        actual_start_date: auditPlans.actualStartDate,
        actual_end_date: auditPlans.actualEndDate,
        lead_auditor_id: auditPlans.leadAuditorId,
        audited_unit_id: auditPlans.auditedUnitId,
        auditor_signature: auditPlans.auditorSignature,
        auditor_signed_at: auditPlans.auditorSignedAt,
        created_at: auditPlans.createdAt,
        updated_at: auditPlans.updatedAt,
      }).from(auditPlans).where(eq(auditPlans.organizationId, organizationId)),

      db.select({
        id: followUpRecords.id,
        audit_plan_id: followUpRecords.auditPlanId,
        nonconformity_id: followUpRecords.nonconformityId,
        title: followUpRecords.title,
        description: followUpRecords.description,
        assigned_to: followUpRecords.assignedTo,
        status: followUpRecords.status,
        due_date: followUpRecords.dueDate,
        completed_at: followUpRecords.completedAt,
        verified_at: followUpRecords.verifiedAt,
        verified_by: followUpRecords.verifiedBy,
        created_by: followUpRecords.createdBy,
        created_at: followUpRecords.createdAt,
        updated_at: followUpRecords.updatedAt,
      }).from(followUpRecords).where(eq(followUpRecords.organizationId, organizationId)),

      db.select({
        id: managementReviews.id,
        title: managementReviews.title,
        review_date: managementReviews.reviewDate,
        status: managementReviews.status,
        agenda: managementReviews.agenda,
        participants: managementReviews.participants,
        location: managementReviews.location,
        minutes: managementReviews.minutes,
        conclusions: managementReviews.conclusions,
        created_by: managementReviews.createdBy,
        created_at: managementReviews.createdAt,
        updated_at: managementReviews.updatedAt,
      }).from(managementReviews).where(eq(managementReviews.organizationId, organizationId)),
    ])

    const documentIds = documentsData.map(document => document.id)
    const taskIds = tasksData.map(task => task.id)
    const educationPlanIds = educationPlansData.map(plan => plan.id)
    const educationRecordsData = educationPlanIds.length > 0
      ? await db.select({
          id: educationRecords.id,
          plan_id: educationRecords.planId,
          attendee_id: educationRecords.attendeeId,
          attended_at: educationRecords.attendedAt,
          completed_at: educationRecords.completedAt,
          score: educationRecords.score,
          result: educationRecords.result,
          feedback: educationRecords.feedback,
          created_at: educationRecords.createdAt,
          updated_at: educationRecords.updatedAt,
        }).from(educationRecords).where(inArray(educationRecords.planId, educationPlanIds))
      : []

    const [documentVersionsData, documentApprovalsData, taskAttachmentsData] = await Promise.all([
      documentIds.length > 0
        ? db.select({
            id: documentVersions.id,
            document_id: documentVersions.documentId,
            version_number: documentVersions.versionNumber,
            title: documentVersions.title,
            description: documentVersions.description,
            file_name: documentVersions.fileName,
            file_path: documentVersions.filePath,
            file_size: documentVersions.fileSize,
            changes: documentVersions.changes,
            created_by: documentVersions.createdBy,
            created_at: documentVersions.createdAt,
          }).from(documentVersions).where(inArray(documentVersions.documentId, documentIds))
        : [],
      documentIds.length > 0
        ? db.select({
            id: documentApprovals.id,
            document_id: documentApprovals.documentId,
            step: documentApprovals.step,
            approver_id: documentApprovals.approverId,
            status: documentApprovals.status,
            comment: documentApprovals.comment,
            acted_at: documentApprovals.actedAt,
            created_by: documentApprovals.createdBy,
            created_at: documentApprovals.createdAt,
          }).from(documentApprovals).where(inArray(documentApprovals.documentId, documentIds))
        : [],
      taskIds.length > 0
        ? db.select({
            id: taskAttachments.id,
            task_id: taskAttachments.taskId,
            file_name: taskAttachments.fileName,
            file_path: taskAttachments.filePath,
            file_size: taskAttachments.fileSize,
            mime_type: taskAttachments.mimeType,
            uploaded_by: taskAttachments.uploadedBy,
            uploaded_at: taskAttachments.uploadedAt,
          }).from(taskAttachments).where(inArray(taskAttachments.taskId, taskIds))
        : [],
    ])

    const auditPlanIds = auditPlansData.map(plan => plan.id)
    const managementReviewIds = managementReviewsData.map(review => review.id)

    const [auditReportsData, auditEvidenceData, nonconformitiesData, managementReviewActionsData] = await Promise.all([
      auditPlanIds.length > 0
        ? db.select({
            id: auditReports.id,
            audit_plan_id: auditReports.auditPlanId,
            executive_summary: auditReports.executiveSummary,
            scope: auditReports.scope,
            methodology: auditReports.methodology,
            conclusion: auditReports.conclusion,
            report_date: auditReports.reportDate,
            approval_status: auditReports.approvalStatus,
            approved_by: auditReports.approvedBy,
            approved_at: auditReports.approvedAt,
            rejection_reason: auditReports.rejectionReason,
            created_at: auditReports.createdAt,
            updated_at: auditReports.updatedAt,
          }).from(auditReports).where(inArray(auditReports.auditPlanId, auditPlanIds))
        : [],
      auditPlanIds.length > 0
        ? db.select({
            id: auditEvidence.id,
            audit_checklist_id: auditEvidence.auditChecklistId,
            audit_plan_id: auditChecklists.auditPlanId,
            file_name: auditEvidence.fileName,
            file_path: auditEvidence.filePath,
            file_size: auditEvidence.fileSize,
            mime_type: auditEvidence.mimeType,
            description: auditEvidence.description,
            uploaded_by: auditEvidence.uploadedBy,
            uploaded_at: auditEvidence.uploadedAt,
          })
            .from(auditEvidence)
            .innerJoin(auditChecklists, eq(auditEvidence.auditChecklistId, auditChecklists.id))
            .where(inArray(auditChecklists.auditPlanId, auditPlanIds))
        : [],
      auditPlanIds.length > 0
        ? db.select({
            id: nonconformities.id,
            audit_checklist_id: nonconformities.auditChecklistId,
            audit_plan_id: auditChecklists.auditPlanId,
            nc_number: nonconformities.ncNumber,
            type: nonconformities.type,
            description: nonconformities.description,
            root_cause: nonconformities.rootCause,
            corrective_action: nonconformities.correctiveAction,
            preventive_action: nonconformities.preventiveAction,
            responsible_id: nonconformities.responsibleId,
            due_date: nonconformities.dueDate,
            status: nonconformities.status,
            resolution_date: nonconformities.resolutionDate,
            verification_date: nonconformities.verificationDate,
            verified_by: nonconformities.verifiedBy,
            created_at: nonconformities.createdAt,
            updated_at: nonconformities.updatedAt,
          })
            .from(nonconformities)
            .innerJoin(auditChecklists, eq(nonconformities.auditChecklistId, auditChecklists.id))
            .where(inArray(auditChecklists.auditPlanId, auditPlanIds))
        : [],
      managementReviewIds.length > 0
        ? db.select({
            id: managementReviewActions.id,
            review_id: managementReviewActions.reviewId,
            review_item_id: managementReviewActions.reviewItemId,
            title: managementReviewActions.title,
            description: managementReviewActions.description,
            assignee_id: managementReviewActions.assigneeId,
            due_date: managementReviewActions.dueDate,
            status: managementReviewActions.status,
            completed_at: managementReviewActions.completedAt,
            created_at: managementReviewActions.createdAt,
            updated_at: managementReviewActions.updatedAt,
          }).from(managementReviewActions).where(inArray(managementReviewActions.reviewId, managementReviewIds))
        : [],
    ])

    const nonconformityIds = nonconformitiesData.map(row => row.id)
    const correctiveActionsData = nonconformityIds.length > 0
      ? await db.select({
          id: correctiveActions.id,
          nonconformity_id: correctiveActions.nonconformityId,
          action_description: correctiveActions.actionDescription,
          responsible_id: correctiveActions.responsibleId,
          planned_date: correctiveActions.plannedDate,
          completion_date: correctiveActions.completionDate,
          status: correctiveActions.status,
          effectiveness_review: correctiveActions.effectivenessReview,
          reviewed_by: correctiveActions.reviewedBy,
          reviewed_at: correctiveActions.reviewedAt,
          created_at: correctiveActions.createdAt,
          updated_at: correctiveActions.updatedAt,
        }).from(correctiveActions).where(inArray(correctiveActions.nonconformityId, nonconformityIds))
      : []

    const documentsCsv = toCsv(
      ['id', 'title', 'status', 'category', 'folder_id', 'file_name', 'file_path', 'file_size', 'mime_type', 'created_at', 'updated_at', 'created_by', 'updated_by'],
      documentsData.map(d => [
        d.id, d.title, d.status, d.category, d.folder_id, d.file_name, d.file_path, d.file_size, d.mime_type, d.created_at, d.updated_at, d.created_by, d.updated_by
      ])
    )

    const documentVersionsCsv = toCsv(
      ['id', 'document_id', 'version_number', 'title', 'description', 'file_name', 'file_path', 'file_size', 'changes', 'created_by', 'created_at'],
      documentVersionsData.map(version => [
        version.id,
        version.document_id,
        version.version_number,
        version.title,
        version.description,
        version.file_name,
        version.file_path,
        version.file_size,
        version.changes,
        version.created_by,
        version.created_at,
      ])
    )

    const documentApprovalsCsv = toCsv(
      ['id', 'document_id', 'step', 'approver_id', 'status', 'comment', 'acted_at', 'created_by', 'created_at'],
      documentApprovalsData.map(approval => [
        approval.id,
        approval.document_id,
        approval.step,
        approval.approver_id,
        approval.status,
        approval.comment,
        approval.acted_at,
        approval.created_by,
        approval.created_at,
      ])
    )

    const risksCsv = toCsv(
      ['id', 'title', 'status', 'risk_score', 'impact_level', 'likelihood_level', 'owner_id', 'category_id', 'identified_date', 'updated_at'],
      risksData.map(r => [
        r.id, r.title, r.status, r.risk_score, r.impact_level, r.likelihood_level, r.owner_id, r.category_id, r.identified_date, r.updated_at
      ])
    )

    const tasksCsv = toCsv(
      ['id', 'title', 'status', 'priority', 'assignee_id', 'due_date', 'created_at', 'updated_at'],
      tasksData.map(t => [
        t.id, t.title, t.status, t.priority, t.assignee_id, t.due_date, t.created_at, t.updated_at
      ])
    )

    const taskAttachmentsCsv = toCsv(
      ['id', 'task_id', 'file_name', 'file_path', 'file_size', 'mime_type', 'uploaded_by', 'uploaded_at'],
      taskAttachmentsData.map(attachment => [
        attachment.id,
        attachment.task_id,
        attachment.file_name,
        attachment.file_path,
        attachment.file_size,
        attachment.mime_type,
        attachment.uploaded_by,
        attachment.uploaded_at,
      ])
    )

    const informationAssetsCsv = toCsv(
      [
        'id',
        'name',
        'asset_type',
        'classification',
        'criticality',
        'owner_id',
        'location',
        'status',
        'description',
        'created_at',
        'updated_at',
      ],
      informationAssetsData.map(asset => [
        asset.id,
        asset.name,
        asset.asset_type,
        asset.classification,
        asset.criticality,
        asset.owner_id,
        asset.location,
        asset.status,
        asset.description,
        asset.created_at,
        asset.updated_at,
      ])
    )

    const educationPlansCsv = toCsv(
      ['id', 'title', 'status', 'target_audience', 'start_date', 'end_date', 'description', 'created_by', 'created_at', 'updated_at'],
      educationPlansData.map(plan => [
        plan.id,
        plan.title,
        plan.status,
        plan.target_audience,
        plan.start_date,
        plan.end_date,
        plan.description,
        plan.created_by,
        plan.created_at,
        plan.updated_at,
      ])
    )

    const educationRecordsCsv = toCsv(
      ['id', 'plan_id', 'attendee_id', 'attended_at', 'completed_at', 'score', 'result', 'feedback', 'created_at', 'updated_at'],
      educationRecordsData.map(record => [
        record.id,
        record.plan_id,
        record.attendee_id,
        record.attended_at,
        record.completed_at,
        record.score,
        record.result,
        record.feedback,
        record.created_at,
        record.updated_at,
      ])
    )

    const auditPlansCsv = toCsv(
      [
        'id',
        'title',
        'audit_type',
        'standard',
        'status',
        'audit_period',
        'planned_start_date',
        'planned_end_date',
        'actual_start_date',
        'actual_end_date',
        'lead_auditor_id',
        'audited_unit_id',
        'auditor_signature',
        'auditor_signed_at',
        'created_at',
        'updated_at',
      ],
      auditPlansData.map(plan => [
        plan.id,
        plan.title,
        plan.audit_type,
        plan.standard,
        plan.status,
        plan.audit_period,
        plan.planned_start_date,
        plan.planned_end_date,
        plan.actual_start_date,
        plan.actual_end_date,
        plan.lead_auditor_id,
        plan.audited_unit_id,
        plan.auditor_signature,
        plan.auditor_signed_at,
        plan.created_at,
        plan.updated_at,
      ])
    )

    const auditReportsCsv = toCsv(
      [
        'id',
        'audit_plan_id',
        'executive_summary',
        'scope',
        'methodology',
        'conclusion',
        'report_date',
        'approval_status',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'created_at',
        'updated_at',
      ],
      auditReportsData.map(report => [
        report.id,
        report.audit_plan_id,
        report.executive_summary,
        report.scope,
        report.methodology,
        report.conclusion,
        report.report_date,
        report.approval_status,
        report.approved_by,
        report.approved_at,
        report.rejection_reason,
        report.created_at,
        report.updated_at,
      ])
    )

    const auditEvidenceCsv = toCsv(
      [
        'id',
        'audit_checklist_id',
        'audit_plan_id',
        'file_name',
        'file_path',
        'file_size',
        'mime_type',
        'description',
        'uploaded_by',
        'uploaded_at',
      ],
      auditEvidenceData.map(evidence => [
        evidence.id,
        evidence.audit_checklist_id,
        evidence.audit_plan_id,
        evidence.file_name,
        evidence.file_path,
        evidence.file_size,
        evidence.mime_type,
        evidence.description,
        evidence.uploaded_by,
        evidence.uploaded_at,
      ])
    )

    const nonconformitiesCsv = toCsv(
      [
        'id',
        'audit_checklist_id',
        'audit_plan_id',
        'nc_number',
        'type',
        'description',
        'root_cause',
        'corrective_action',
        'preventive_action',
        'responsible_id',
        'due_date',
        'status',
        'resolution_date',
        'verification_date',
        'verified_by',
        'created_at',
        'updated_at',
      ],
      nonconformitiesData.map(nc => [
        nc.id,
        nc.audit_checklist_id,
        nc.audit_plan_id,
        nc.nc_number,
        nc.type,
        nc.description,
        nc.root_cause,
        nc.corrective_action,
        nc.preventive_action,
        nc.responsible_id,
        nc.due_date,
        nc.status,
        nc.resolution_date,
        nc.verification_date,
        nc.verified_by,
        nc.created_at,
        nc.updated_at,
      ])
    )

    const correctiveActionsCsv = toCsv(
      [
        'id',
        'nonconformity_id',
        'action_description',
        'responsible_id',
        'planned_date',
        'completion_date',
        'status',
        'effectiveness_review',
        'reviewed_by',
        'reviewed_at',
        'created_at',
        'updated_at',
      ],
      correctiveActionsData.map(action => [
        action.id,
        action.nonconformity_id,
        action.action_description,
        action.responsible_id,
        action.planned_date,
        action.completion_date,
        action.status,
        action.effectiveness_review,
        action.reviewed_by,
        action.reviewed_at,
        action.created_at,
        action.updated_at,
      ])
    )

    const followUpRecordsCsv = toCsv(
      [
        'id',
        'audit_plan_id',
        'nonconformity_id',
        'title',
        'description',
        'assigned_to',
        'status',
        'due_date',
        'completed_at',
        'verified_at',
        'verified_by',
        'created_by',
        'created_at',
        'updated_at',
      ],
      followUpRecordsData.map(record => [
        record.id,
        record.audit_plan_id,
        record.nonconformity_id,
        record.title,
        record.description,
        record.assigned_to,
        record.status,
        record.due_date,
        record.completed_at,
        record.verified_at,
        record.verified_by,
        record.created_by,
        record.created_at,
        record.updated_at,
      ])
    )

    const managementReviewsCsv = toCsv(
      ['id', 'title', 'review_date', 'status', 'agenda', 'participants', 'location', 'minutes', 'conclusions', 'created_by', 'created_at', 'updated_at'],
      managementReviewsData.map(review => [
        review.id,
        review.title,
        review.review_date,
        review.status,
        review.agenda,
        review.participants,
        review.location,
        review.minutes,
        review.conclusions,
        review.created_by,
        review.created_at,
        review.updated_at,
      ])
    )

    const managementReviewActionsCsv = toCsv(
      ['id', 'review_id', 'review_item_id', 'title', 'description', 'assignee_id', 'due_date', 'status', 'completed_at', 'created_at', 'updated_at'],
      managementReviewActionsData.map(action => [
        action.id,
        action.review_id,
        action.review_item_id,
        action.title,
        action.description,
        action.assignee_id,
        action.due_date,
        action.status,
        action.completed_at,
        action.created_at,
        action.updated_at,
      ])
    )

    const backupFileCandidates: BackupFileCandidate[] = [
      ...documentsData
        .filter(document => document.file_path)
        .map(document => ({
          bucket: 'documents',
          source: 'document' as const,
          id: document.id,
          fileName: document.file_name,
          filePath: document.file_path,
        })),
      ...documentVersionsData
        .filter(version => version.file_path)
        .map(version => ({
          bucket: 'documents',
          source: 'document_version' as const,
          id: version.id,
          fileName: version.file_name,
          filePath: version.file_path,
        })),
      ...taskAttachmentsData.map(attachment => ({
        bucket: 'task-attachments',
        source: 'task_attachment' as const,
        id: attachment.id,
        fileName: attachment.file_name,
        filePath: attachment.file_path,
      })),
      ...auditEvidenceData.map(evidence => ({
        bucket: 'audit-evidence',
        source: 'audit_evidence' as const,
        id: evidence.id,
        fileName: evidence.file_name,
        filePath: evidence.file_path,
      })),
    ]
    const { entries: backupFileEntries, manifestRows: backupFileManifestRows } = await buildBackupFileEntries(backupFileCandidates)

    const backupFilesManifestCsv = toCsv(
      [
        'source',
        'id',
        'bucket',
        'file_name',
        'file_path',
        'zip_path',
        'status',
        'reason',
        'retrievable',
        'deletion_scope',
        'deletion_exception_reason',
        'responsibility_boundary',
      ],
      backupFileManifestRows.map(row => [
        row.source,
        row.id,
        row.bucket,
        row.file_name,
        row.file_path,
        row.zip_path,
        row.status,
        row.reason,
        row.retrievable,
        row.deletion_scope,
        row.deletion_exception_reason,
        row.responsibility_boundary,
      ])
    )

    const generatedAt = new Date().toISOString()

    const metadata = JSON.stringify(
      {
        organization_id: organizationId,
        generated_at: generatedAt,
        counts: {
          documents: documentsData.length,
          document_versions: documentVersionsData.length,
          document_approvals: documentApprovalsData.length,
          risks: risksData.length,
          tasks: tasksData.length,
          task_attachments: taskAttachmentsData.length,
          information_assets: informationAssetsData.length,
          education_plans: educationPlansData.length,
          education_records: educationRecordsData.length,
          audit_plans: auditPlansData.length,
          audit_reports: auditReportsData.length,
          audit_evidence: auditEvidenceData.length,
          nonconformities: nonconformitiesData.length,
          corrective_actions: correctiveActionsData.length,
          follow_up_records: followUpRecordsData.length,
          management_reviews: managementReviewsData.length,
          management_review_actions: managementReviewActionsData.length,
          backup_file_candidates: backupFileCandidates.length,
          backup_file_entries: backupFileEntries.length,
          backup_file_missing: backupFileManifestRows.filter(row => row.status !== 'included').length,
          external_file_exceptions: backupFileManifestRows.filter(row => row.retrievable !== 'true').length
        }
      },
      null,
      2
    )

    const csvEntries: ZipFileEntry[] = [
      { name: 'documents.csv', content: documentsCsv },
      { name: 'document_versions.csv', content: documentVersionsCsv },
      { name: 'document_approvals.csv', content: documentApprovalsCsv },
      { name: 'risks.csv', content: risksCsv },
      { name: 'tasks.csv', content: tasksCsv },
      { name: 'task_attachments.csv', content: taskAttachmentsCsv },
      { name: 'information_assets.csv', content: informationAssetsCsv },
      { name: 'education_plans.csv', content: educationPlansCsv },
      { name: 'education_records.csv', content: educationRecordsCsv },
      { name: 'audit_plans.csv', content: auditPlansCsv },
      { name: 'audit_reports.csv', content: auditReportsCsv },
      { name: 'audit_evidence.csv', content: auditEvidenceCsv },
      { name: 'nonconformities.csv', content: nonconformitiesCsv },
      { name: 'corrective_actions.csv', content: correctiveActionsCsv },
      { name: 'follow_up_records.csv', content: followUpRecordsCsv },
      { name: 'management_reviews.csv', content: managementReviewsCsv },
      { name: 'management_review_actions.csv', content: managementReviewActionsCsv },
      { name: 'backup_files_manifest.csv', content: backupFilesManifestCsv },
    ]
    const readme = buildBackupReadme({
      organizationId,
      generatedAt,
      csvFiles: csvEntries.map(entry => entry.name),
      fileCandidates: backupFileCandidates.length,
      fileEntries: backupFileEntries.length,
      missingFiles: backupFileManifestRows.filter(row => row.status !== 'included').length,
    })

    const zipBuffer = createZipBuffer([
      { name: 'README.md', content: readme },
      ...csvEntries,
      { name: 'metadata.json', content: metadata },
      ...backupFileEntries
    ])

    await logExportEvent({
      userId: guard.userId,
      organizationId: organizationId,
      documentId: null,
      format: 'organization_backup_zip',
      status: 'success'
    })

    return guard.wrapResponse(new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="isms-backup-${generatedAt.replace(/[:.]/g, '-')}.zip"`
      }
    }))
  } catch (err) {
    console.error('Failed to load export data', err)
    await logExportEvent({
      userId: guard.userId,
      organizationId: organizationId,
      documentId: null,
      format: 'organization_backup_zip',
      status: 'error',
      context: { reason: 'failed_to_load_export_data' }
    })
    return guard.json({ error: 'Failed to load export data' }, { status: 500 })
  }
}
