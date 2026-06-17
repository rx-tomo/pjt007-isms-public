/**
 * SQLite Audit Plan Repository
 *
 * Implements IAuditPlanRepository using Drizzle ORM with SQLite.
 * Handles all audit-related data operations with organization-scoped data isolation.
 *
 * This is the largest repository (~35 methods) covering:
 * - Audit Plan CRUD
 * - Team Member management
 * - ISO27001 Requirements
 * - Checklists (bulk create, update, query)
 * - Nonconformities & Corrective Actions
 * - Evidence management
 * - Reports
 * - Statistics & Dashboard
 * - Context resolution (for audit logging)
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - All org-scoped queries include organization_id filtering for multi-tenant isolation
 * - audit_period: computed at app layer (GENERATED ALWAYS AS in PostgreSQL)
 * - Relations loaded via explicit sub-queries (no nested select)
 *
 * @module lib/db/repositories/sqlite/SQLiteAuditPlanRepository
 */

import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  auditPlans,
  auditTeamMembers,
  auditChecklists,
  nonconformities,
  correctiveActions,
  auditEvidence,
  auditReports,
  auditUnits,
  iso27001Requirements,
  followUpRecords,
} from '@/lib/db/drizzle/schema/audit'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import type {
  IAuditPlanRepository,
  AuditPlan,
  AuditPlanWithRelations,
  AuditPlanFilters,
  AuditPlanProgressSummary,
  AuditTeamMember,
  TeamRole,
  ISO27001Requirement,
  AuditChecklist,
  ChecklistStatus,
  Nonconformity,
  NonconformityFilters,
  NonconformityStatus,
  CorrectiveAction,
  AuditEvidence,
  AuditReport,
  AuditReportListItem,
  AuditReportFilters,
  AuditStatistics,
  AuditStatus,
  AuditDashboardNextAction,
  AuditFollowUpStatus,
  NonconformityType,
  CorrectiveActionStatus,
  AuditUnit as IAuditUnit,
  AuditPlanInsert,
  AuditPlanUpdate,
} from '../interfaces/IAuditPlanRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

// =====================================================
// Helper: Fiscal period parsing & comparison
// =====================================================

const FISCAL_PERIOD_PATTERN = /^FY(\d{4})\s+Q([1-4])$/

function parseFiscalPeriodLabel(value: string): { year: number; quarter: number } {
  const match = FISCAL_PERIOD_PATTERN.exec(value)
  if (!match) return { year: 0, quarter: 0 }
  return { year: Number(match[1]), quarter: Number(match[2]) }
}

function compareFiscalPeriodsDesc(a: string, b: string): number {
  const pa = parseFiscalPeriodLabel(a)
  const pb = parseFiscalPeriodLabel(b)
  if (pa.year === pb.year) return pb.quarter - pa.quarter
  return pb.year - pa.year
}

// =====================================================
// Helper: Derive follow-up status
// =====================================================

const ACTIVE_NONCONFORMITY_STATUSES: ReadonlySet<NonconformityStatus> = new Set([
  'open',
  'in_progress',
  'resolved',
])

export function deriveAuditFollowUpStatus(
  auditStatus: AuditStatus,
  openNonconformities: number
): AuditFollowUpStatus {
  if (openNonconformities <= 0) return 'completed'
  return auditStatus === 'completed' ? 'reopened' : 'on_hold'
}

// =====================================================
// Repository Implementation
// =====================================================

export class SQLiteAuditPlanRepository
  extends BaseSQLiteRepository
  implements IAuditPlanRepository
{
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  // =========================================
  // Private: userProfile mapper (Drizzle camelCase → snake_case)
  // =========================================

  private mapUserProfileRow(row: {
    id: string
    organizationId: string | null
    email: string
    fullName: string
    fullNameEn: string | null
    role: string
    department: string | null
    position: string | null
    phone: string | null
    isActive: boolean | null
    avatarUrl: string | null
    languagePreference: string | null
    primaryDepartmentId: string | null
    isCiso: boolean | null
    isSecurityManager: boolean | null
    isOrgAdmin: boolean | null
    isAuditCommittee: boolean | null
    isIsmsPromoter: boolean | null
    createdAt: string | null
    updatedAt: string | null
    lastLoginAt: string | null
  }) {
    return {
      id: row.id,
      organization_id: row.organizationId,
      email: row.email,
      full_name: row.fullName,
      full_name_en: row.fullNameEn,
      role: row.role as 'super_admin' | 'system_operator' | 'org_admin' | 'user' | 'auditor' | 'approver',
      department: row.department,
      position: row.position,
      phone: row.phone,
      is_active: row.isActive,
      avatar_url: row.avatarUrl,
      language_preference: row.languagePreference,
      primary_department_id: row.primaryDepartmentId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      last_login_at: row.lastLoginAt,
    }
  }

  // =========================================
  // Private: load a single user profile by ID
  // =========================================

  private async loadUserProfile(userId: string | null) {
    if (!userId) return null
    const rows = await this.db.select().from(userProfiles).where(eq(userProfiles.id, userId))
    if (rows.length === 0) return null
    return this.mapUserProfileRow(rows[0])
  }

  // =========================================
  // Private: mappers Drizzle row → interface entity
  // =========================================

  private mapAuditPlanRow(row: typeof auditPlans.$inferSelect): AuditPlan {
    return {
      id: row.id,
      organization_id: row.organizationId ?? '',
      title: row.title,
      description: row.description ?? null,
      audit_type: (row.auditType as AuditPlan['audit_type']) ?? null,
      standard: row.standard ?? null,
      planned_start_date: row.plannedStartDate ?? null,
      planned_end_date: row.plannedEndDate ?? null,
      actual_start_date: row.actualStartDate ?? null,
      actual_end_date: row.actualEndDate ?? null,
      lead_auditor_id: row.leadAuditorId ?? null,
      audited_unit_id: row.auditedUnitId ?? null,
      auditor_signature: row.auditorSignature ?? null,
      auditor_signed_at: row.auditorSignedAt ?? null,
      status: (row.status ?? 'planning') as AuditStatus,
      audit_period: row.auditPeriod ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  private mapTeamMemberRow(row: typeof auditTeamMembers.$inferSelect): AuditTeamMember {
    return {
      id: row.id,
      audit_plan_id: row.auditPlanId ?? '',
      user_id: row.userId ?? '',
      role: (row.role ?? 'auditor') as TeamRole,
      assigned_at: row.assignedAt ?? '',
    }
  }

  private mapChecklistRow(row: typeof auditChecklists.$inferSelect): AuditChecklist {
    return {
      id: row.id,
      audit_plan_id: row.auditPlanId ?? '',
      requirement_id: row.requirementId ?? null,
      check_item: row.checkItem,
      evidence_required: row.evidenceRequired ?? null,
      auditor_id: row.auditorId ?? null,
      status: (row.status ?? 'not_started') as ChecklistStatus,
      result: (row.result as AuditChecklist['result']) ?? null,
      findings: row.findings ?? null,
      evidence_provided: row.evidenceProvided ?? null,
      reviewed_at: row.reviewedAt ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  private mapNonconformityRow(row: typeof nonconformities.$inferSelect): Nonconformity {
    return {
      id: row.id,
      audit_checklist_id: row.auditChecklistId ?? '',
      nc_number: row.ncNumber,
      type: (row.type ?? 'minor') as Nonconformity['type'],
      description: row.description,
      root_cause: row.rootCause ?? null,
      corrective_action: row.correctiveAction ?? null,
      preventive_action: row.preventiveAction ?? null,
      responsible_id: row.responsibleId ?? null,
      due_date: row.dueDate ?? null,
      status: (row.status ?? 'open') as NonconformityStatus,
      resolution_date: row.resolutionDate ?? null,
      verification_date: row.verificationDate ?? null,
      verified_by: row.verifiedBy ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  private mapCorrectiveActionRow(row: typeof correctiveActions.$inferSelect): CorrectiveAction {
    return {
      id: row.id,
      nonconformity_id: row.nonconformityId ?? '',
      action_description: row.actionDescription,
      responsible_id: row.responsibleId ?? null,
      planned_date: row.plannedDate ?? null,
      completion_date: row.completionDate ?? null,
      status: (row.status ?? 'planned') as CorrectiveActionStatus,
      effectiveness_review: row.effectivenessReview ?? null,
      reviewed_by: row.reviewedBy ?? null,
      reviewed_at: row.reviewedAt ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  private mapEvidenceRow(row: typeof auditEvidence.$inferSelect): AuditEvidence {
    return {
      id: row.id,
      audit_checklist_id: row.auditChecklistId ?? '',
      file_name: row.fileName,
      file_path: row.filePath,
      file_size: row.fileSize ?? null,
      mime_type: row.mimeType ?? null,
      description: row.description ?? null,
      uploaded_by: row.uploadedBy ?? null,
      uploaded_at: row.uploadedAt ?? '',
    }
  }

  private mapReportRow(row: typeof auditReports.$inferSelect): AuditReport {
    return {
      id: row.id,
      audit_plan_id: row.auditPlanId ?? null,
      executive_summary: row.executiveSummary ?? null,
      scope: row.scope ?? null,
      methodology: row.methodology ?? null,
      positive_findings: row.positiveFindings ?? null,
      improvement_opportunities: row.improvementOpportunities ?? null,
      conclusion: row.conclusion ?? null,
      report_date: row.reportDate ?? null,
      approval_status: (row.approvalStatus ?? 'draft') as AuditReport['approval_status'],
      rejection_reason: row.rejectionReason ?? null,
      approved_by: row.approvedBy ?? null,
      approved_at: row.approvedAt ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  private mapAuditUnitRow(row: typeof auditUnits.$inferSelect): IAuditUnit {
    return {
      id: row.id,
      organization_id: row.organizationId,
      name: row.name,
      unit_type: row.unitType as 'site' | 'process',
      description: row.description ?? null,
      is_active: row.isActive,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapRequirementRow(row: typeof iso27001Requirements.$inferSelect): ISO27001Requirement {
    return {
      id: row.id,
      clause_number: row.clauseNumber,
      title: row.title,
      description: row.description ?? null,
      parent_id: row.parentId ?? null,
      is_applicable: row.isApplicable ?? true,
      created_at: row.createdAt ?? '',
    }
  }

  // =========================================
  // Base Repository Methods (IBaseRepository)
  // =========================================

  async findById(id: string): Promise<AuditPlan | null> {
    const rows = await this.db.select().from(auditPlans).where(eq(auditPlans.id, id))
    if (rows.length === 0) return null
    return this.mapAuditPlanRow(rows[0])
  }

  async findMany(filters?: Record<string, unknown>): Promise<AuditPlan[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db.select().from(auditPlans).orderBy(desc(auditPlans.createdAt))
      return rows.map(r => this.mapAuditPlanRow(r))
    }

    const conditions = Object.entries(filters)
      .map(([key, value]) => {
        const column = auditPlans[key as keyof typeof auditPlans.$inferSelect]
        if (column) return eq(column as never, value as never)
        return null
      })
      .filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db.select().from(auditPlans).orderBy(desc(auditPlans.createdAt))
      return rows.map(r => this.mapAuditPlanRow(r))
    }

    const rows = await this.db
      .select()
      .from(auditPlans)
      .where(conditions.length === 1 ? conditions[0]! : and(...(conditions as never[])))
      .orderBy(desc(auditPlans.createdAt))

    return rows.map(r => this.mapAuditPlanRow(r))
  }

  async create(data: AuditPlanInsert): Promise<AuditPlan> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id ?? null,
      title: data.title,
      description: data.description ?? null,
      auditType: data.audit_type ?? null,
      standard: data.standard ?? 'ISO27001',
      plannedStartDate: data.planned_start_date ?? null,
      plannedEndDate: data.planned_end_date ?? null,
      actualStartDate: data.actual_start_date ?? null,
      actualEndDate: data.actual_end_date ?? null,
      leadAuditorId: data.lead_auditor_id ?? null,
      status: data.status ?? 'planning',
      auditPeriod: data.audit_period ?? null,
      auditedUnitId: (data as Record<string, unknown>).audited_unit_id as string ?? null,
      auditorSignature: (data as Record<string, unknown>).auditor_signature as string ?? null,
      auditorSignedAt: (data as Record<string, unknown>).auditor_signed_at as string ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(auditPlans).values(row)
    this.logDataAccess('create audit plan', data.organization_id ?? '', { id })

    return this.mapAuditPlanRow(row as typeof auditPlans.$inferSelect)
  }

  async update(id: string, updates: AuditPlanUpdate): Promise<AuditPlan | null> {
    const now = new Date().toISOString()
    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.audit_type !== undefined) setPayload.auditType = updates.audit_type
    if (updates.standard !== undefined) setPayload.standard = updates.standard
    if (updates.planned_start_date !== undefined) setPayload.plannedStartDate = updates.planned_start_date
    if (updates.planned_end_date !== undefined) setPayload.plannedEndDate = updates.planned_end_date
    if (updates.actual_start_date !== undefined) setPayload.actualStartDate = updates.actual_start_date
    if (updates.actual_end_date !== undefined) setPayload.actualEndDate = updates.actual_end_date
    if (updates.lead_auditor_id !== undefined) setPayload.leadAuditorId = updates.lead_auditor_id
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.audit_period !== undefined) setPayload.auditPeriod = updates.audit_period
    const anyUpdates = updates as Record<string, unknown>
    if (anyUpdates.audited_unit_id !== undefined) setPayload.auditedUnitId = anyUpdates.audited_unit_id
    if (anyUpdates.auditor_signature !== undefined) setPayload.auditorSignature = anyUpdates.auditor_signature
    if (anyUpdates.auditor_signed_at !== undefined) setPayload.auditorSignedAt = anyUpdates.auditor_signed_at

    await this.db.update(auditPlans).set(setPayload).where(eq(auditPlans.id, id))

    const rows = await this.db.select().from(auditPlans).where(eq(auditPlans.id, id))
    if (rows.length === 0) return null
    return this.mapAuditPlanRow(rows[0])
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(auditPlans).where(eq(auditPlans.id, id))
  }

  async findByOrganizationId(organizationId: string): Promise<AuditPlan[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    const rows = await this.db
      .select()
      .from(auditPlans)
      .where(eq(auditPlans.organizationId, organizationId))
      .orderBy(desc(auditPlans.createdAt))

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length })
    return rows.map(r => this.mapAuditPlanRow(r))
  }

  // =========================================
  // Audit Plan Operations
  // =========================================

  async getAuditPlans(
    organizationId?: string,
    filters?: AuditPlanFilters
  ): Promise<AuditPlanWithRelations[]> {
    // Build conditions
    const conditions: ReturnType<typeof eq>[] = []

    if (organizationId) {
      this.requireOrganizationId(organizationId, 'getAuditPlans')
      conditions.push(eq(auditPlans.organizationId, organizationId))
    }
    if (filters?.status) {
      conditions.push(eq(auditPlans.status, filters.status) as never)
    }
    const normalizedPeriod = filters?.period?.trim()
    if (normalizedPeriod) {
      conditions.push(eq(auditPlans.auditPeriod, normalizedPeriod) as never)
    }

    const planRows =
      conditions.length > 0
        ? await this.db
            .select()
            .from(auditPlans)
            .where(and(...(conditions as never[])))
            .orderBy(desc(auditPlans.plannedStartDate))
        : await this.db.select().from(auditPlans).orderBy(desc(auditPlans.plannedStartDate))

    if (planRows.length === 0) return []

    const planIds = planRows.map(r => r.id)

    // Load team members for all plans
    const teamRows = await this.db
      .select()
      .from(auditTeamMembers)
      .where(inArray(auditTeamMembers.auditPlanId, planIds))

    // Load reports for all plans
    const reportRows = await this.db
      .select()
      .from(auditReports)
      .where(inArray(auditReports.auditPlanId, planIds))

    // Load checklists for progress summary
    const checklistRows = await this.db
      .select({
        id: auditChecklists.id,
        auditPlanId: auditChecklists.auditPlanId,
        status: auditChecklists.status,
      })
      .from(auditChecklists)
      .where(inArray(auditChecklists.auditPlanId, planIds))

    // Load nonconformities from checklists
    const checklistIds = checklistRows.map(r => r.id)
    const checklistToPlan = new Map<string, string>()
    checklistRows.forEach(r => {
      if (r.auditPlanId) checklistToPlan.set(r.id, r.auditPlanId)
    })

    let ncRows: Array<{ id: string; auditChecklistId: string | null; status: string | null }> = []
    if (checklistIds.length > 0) {
      ncRows = await this.db
        .select({
          id: nonconformities.id,
          auditChecklistId: nonconformities.auditChecklistId,
          status: nonconformities.status,
        })
        .from(nonconformities)
        .where(inArray(nonconformities.auditChecklistId, checklistIds))
    }

    // Compute checklist stats per plan
    const checklistStatsByPlan = new Map<
      string,
      { total: number; completed: number; inProgress: number; notStarted: number }
    >()

    checklistRows.forEach(row => {
      const planId = row.auditPlanId
      if (!planId) return
      const current = checklistStatsByPlan.get(planId) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      }
      current.total += 1
      if (row.status === 'completed') current.completed += 1
      else if (row.status === 'in_progress') current.inProgress += 1
      else current.notStarted += 1
      checklistStatsByPlan.set(planId, current)
    })

    // Compute NC stats per plan
    const ncStatsByPlan = new Map<string, { total: number; open: number }>()
    ncRows.forEach(nc => {
      const planId = nc.auditChecklistId ? checklistToPlan.get(nc.auditChecklistId) : undefined
      if (!planId) return
      const stats = ncStatsByPlan.get(planId) ?? { total: 0, open: 0 }
      stats.total += 1
      if (ACTIVE_NONCONFORMITY_STATUSES.has(nc.status as NonconformityStatus)) {
        stats.open += 1
      }
      ncStatsByPlan.set(planId, stats)
    })

    // Group team members and reports by plan
    const teamByPlan = new Map<string, AuditTeamMember[]>()
    teamRows.forEach(row => {
      const planId = row.auditPlanId ?? ''
      const list = teamByPlan.get(planId) ?? []
      list.push(this.mapTeamMemberRow(row))
      teamByPlan.set(planId, list)
    })

    const reportByPlan = new Map<string, AuditReport>()
    reportRows.forEach(row => {
      const planId = row.auditPlanId ?? ''
      if (!reportByPlan.has(planId)) {
        reportByPlan.set(planId, this.mapReportRow(row))
      }
    })

    // Build results
    const results: AuditPlanWithRelations[] = []

    for (const planRow of planRows) {
      const plan = this.mapAuditPlanRow(planRow)
      const leadAuditor = await this.loadUserProfile(planRow.leadAuditorId)

      // Load audited unit
      let auditedUnit: IAuditUnit | null = null
      if (planRow.auditedUnitId) {
        const unitRows = await this.db
          .select()
          .from(auditUnits)
          .where(eq(auditUnits.id, planRow.auditedUnitId))
        if (unitRows.length > 0) {
          auditedUnit = this.mapAuditUnitRow(unitRows[0])
        }
      }

      // Load user profiles for team members
      const members = teamByPlan.get(plan.id) ?? []
      const membersWithUser: AuditTeamMember[] = []
      for (const member of members) {
        const user = await this.loadUserProfile(member.user_id)
        membersWithUser.push({ ...member, user: user ?? null })
      }

      const checklistStats = checklistStatsByPlan.get(plan.id) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      }
      const ncStats = ncStatsByPlan.get(plan.id) ?? { total: 0, open: 0 }
      const completionRate = checklistStats.total
        ? Math.round((checklistStats.completed / checklistStats.total) * 100)
        : 0

      const progressSummary: AuditPlanProgressSummary = {
        totalChecklistItems: checklistStats.total,
        completedChecklistItems: checklistStats.completed,
        inProgressChecklistItems: checklistStats.inProgress,
        notStartedChecklistItems: checklistStats.notStarted,
        completionRate,
        openNonconformities: ncStats.open,
        totalNonconformities: ncStats.total,
        followUpStatus: deriveAuditFollowUpStatus(plan.status, ncStats.open),
      }

      results.push({
        ...plan,
        lead_auditor: leadAuditor ?? null,
        audited_unit: auditedUnit,
        team_members: membersWithUser,
        report: reportByPlan.get(plan.id) ?? null,
        progressSummary,
      })
    }

    return results
  }

  async getAuditPeriods(organizationId: string): Promise<string[]> {
    this.requireOrganizationId(organizationId, 'getAuditPeriods')

    const rows = await this.db
      .select({ auditPeriod: auditPlans.auditPeriod })
      .from(auditPlans)
      .where(eq(auditPlans.organizationId, organizationId))

    const unique = new Set<string>()
    rows.forEach(row => {
      if (row.auditPeriod) unique.add(row.auditPeriod)
    })

    return Array.from(unique).sort(compareFiscalPeriodsDesc)
  }

  async getAuditPlanById(planId: string): Promise<AuditPlanWithRelations | null> {
    const planRows = await this.db
      .select()
      .from(auditPlans)
      .where(eq(auditPlans.id, planId))

    if (planRows.length === 0) return null

    const planRow = planRows[0]
    const plan = this.mapAuditPlanRow(planRow)

    // Load lead auditor
    const leadAuditor = await this.loadUserProfile(planRow.leadAuditorId)

    // Load audited unit
    let auditedUnit: IAuditUnit | null = null
    if (planRow.auditedUnitId) {
      const unitRows = await this.db
        .select()
        .from(auditUnits)
        .where(eq(auditUnits.id, planRow.auditedUnitId))
      if (unitRows.length > 0) {
        auditedUnit = this.mapAuditUnitRow(unitRows[0])
      }
    }

    // Load team members with user profiles
    const teamRows = await this.db
      .select()
      .from(auditTeamMembers)
      .where(eq(auditTeamMembers.auditPlanId, planId))

    const teamMembers: AuditTeamMember[] = []
    for (const row of teamRows) {
      const member = this.mapTeamMemberRow(row)
      const user = await this.loadUserProfile(row.userId)
      teamMembers.push({ ...member, user: user ?? null })
    }

    // Load checklists with relations
    const checklistRowsRaw = await this.db
      .select()
      .from(auditChecklists)
      .where(eq(auditChecklists.auditPlanId, planId))
      .orderBy(asc(auditChecklists.createdAt))

    const checklists: AuditChecklist[] = []
    for (const clRow of checklistRowsRaw) {
      const cl = this.mapChecklistRow(clRow)

      // Load requirement
      let requirement: ISO27001Requirement | null = null
      if (clRow.requirementId) {
        const reqRows = await this.db
          .select()
          .from(iso27001Requirements)
          .where(eq(iso27001Requirements.id, clRow.requirementId))
        if (reqRows.length > 0) {
          requirement = this.mapRequirementRow(reqRows[0])
        }
      }

      // Load auditor
      const auditor = await this.loadUserProfile(clRow.auditorId)

      // Load evidence
      const evidenceRows = await this.db
        .select()
        .from(auditEvidence)
        .where(eq(auditEvidence.auditChecklistId, clRow.id))
      const evidence: AuditEvidence[] = []
      for (const evRow of evidenceRows) {
        const ev = this.mapEvidenceRow(evRow)
        const uploader = await this.loadUserProfile(evRow.uploadedBy)
        evidence.push({ ...ev, uploader: uploader ?? null })
      }

      // Load nonconformities
      const ncRowsForChecklist = await this.db
        .select()
        .from(nonconformities)
        .where(eq(nonconformities.auditChecklistId, clRow.id))

      const ncList: Nonconformity[] = ncRowsForChecklist.map(r => this.mapNonconformityRow(r))

      checklists.push({
        ...cl,
        requirement,
        auditor: auditor ?? null,
        evidence,
        nonconformities: ncList,
      })
    }

    // Load report
    const reportRows = await this.db
      .select()
      .from(auditReports)
      .where(eq(auditReports.auditPlanId, planId))

    const report = reportRows.length > 0 ? this.mapReportRow(reportRows[0]) : null

    return {
      ...plan,
      lead_auditor: leadAuditor ?? null,
      audited_unit: auditedUnit,
      team_members: teamMembers,
      checklists,
      report,
    }
  }

  async createAuditPlan(
    plan: Omit<AuditPlan, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AuditPlan> {
    this.requireOrganizationId(plan.organization_id, 'createAuditPlan')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: plan.organization_id,
      title: plan.title,
      description: plan.description ?? null,
      auditType: plan.audit_type ?? null,
      standard: plan.standard ?? 'ISO27001',
      plannedStartDate: plan.planned_start_date ?? null,
      plannedEndDate: plan.planned_end_date ?? null,
      actualStartDate: plan.actual_start_date ?? null,
      actualEndDate: plan.actual_end_date ?? null,
      leadAuditorId: plan.lead_auditor_id ?? null,
      status: plan.status ?? 'planning',
      auditPeriod: plan.audit_period ?? null,
      auditedUnitId: plan.audited_unit_id ?? null,
      auditorSignature: plan.auditor_signature ?? null,
      auditorSignedAt: plan.auditor_signed_at ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(auditPlans).values(row)
    this.logDataAccess('createAuditPlan', plan.organization_id, { id })

    return this.mapAuditPlanRow(row as typeof auditPlans.$inferSelect)
  }

  async updateAuditPlan(planId: string, updates: Partial<AuditPlan>): Promise<AuditPlan> {
    const now = new Date().toISOString()
    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.audit_type !== undefined) setPayload.auditType = updates.audit_type
    if (updates.standard !== undefined) setPayload.standard = updates.standard
    if (updates.planned_start_date !== undefined)
      setPayload.plannedStartDate = updates.planned_start_date
    if (updates.planned_end_date !== undefined)
      setPayload.plannedEndDate = updates.planned_end_date
    if (updates.actual_start_date !== undefined)
      setPayload.actualStartDate = updates.actual_start_date
    if (updates.actual_end_date !== undefined) setPayload.actualEndDate = updates.actual_end_date
    if (updates.lead_auditor_id !== undefined) setPayload.leadAuditorId = updates.lead_auditor_id
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.audit_period !== undefined) setPayload.auditPeriod = updates.audit_period
    if (updates.audited_unit_id !== undefined) setPayload.auditedUnitId = updates.audited_unit_id
    if (updates.auditor_signature !== undefined)
      setPayload.auditorSignature = updates.auditor_signature
    if (updates.auditor_signed_at !== undefined)
      setPayload.auditorSignedAt = updates.auditor_signed_at

    await this.db.update(auditPlans).set(setPayload).where(eq(auditPlans.id, planId))

    const rows = await this.db.select().from(auditPlans).where(eq(auditPlans.id, planId))
    if (rows.length === 0) throw new Error('監査計画の更新に失敗しました')

    return this.mapAuditPlanRow(rows[0])
  }

  async deleteAuditPlan(planId: string): Promise<void> {
    await this.db.delete(auditPlans).where(eq(auditPlans.id, planId))
  }

  // =========================================
  // Team Member Operations
  // =========================================

  async addTeamMember(planId: string, userId: string, role: TeamRole): Promise<AuditTeamMember> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      auditPlanId: planId,
      userId,
      role,
      assignedAt: now,
    }

    await this.db.insert(auditTeamMembers).values(row)

    const user = await this.loadUserProfile(userId)
    return {
      ...this.mapTeamMemberRow(row as typeof auditTeamMembers.$inferSelect),
      user: user ?? null,
    }
  }

  async updateTeamMember(
    memberId: string,
    updates: Partial<Pick<AuditTeamMember, 'role'>>
  ): Promise<AuditTeamMember> {
    const setPayload: Record<string, unknown> = {}
    if (updates.role !== undefined) setPayload.role = updates.role

    await this.db
      .update(auditTeamMembers)
      .set(setPayload)
      .where(eq(auditTeamMembers.id, memberId))

    const rows = await this.db
      .select()
      .from(auditTeamMembers)
      .where(eq(auditTeamMembers.id, memberId))

    if (rows.length === 0) throw new Error('チームメンバーの更新に失敗しました')

    const member = this.mapTeamMemberRow(rows[0])
    const user = await this.loadUserProfile(rows[0].userId)
    return { ...member, user: user ?? null }
  }

  async removeTeamMember(memberId: string): Promise<void> {
    await this.db.delete(auditTeamMembers).where(eq(auditTeamMembers.id, memberId))
  }

  // =========================================
  // ISO27001 Requirement Operations
  // =========================================

  async getISO27001Requirements(): Promise<ISO27001Requirement[]> {
    const rows = await this.db
      .select()
      .from(iso27001Requirements)
      .orderBy(asc(iso27001Requirements.clauseNumber))

    const requirements = rows.map(r => this.mapRequirementRow(r))

    // Build tree structure
    const tree: ISO27001Requirement[] = []
    const map = new Map<string, ISO27001Requirement>()

    requirements.forEach(req => {
      map.set(req.id, { ...req, children: [] })
    })

    requirements.forEach(req => {
      if (req.parent_id && map.has(req.parent_id)) {
        map.get(req.parent_id)!.children!.push(map.get(req.id)!)
      } else {
        tree.push(map.get(req.id)!)
      }
    })

    return tree
  }

  async updateRequirementApplicability(
    requirementId: string,
    isApplicable: boolean
  ): Promise<ISO27001Requirement> {
    await this.db
      .update(iso27001Requirements)
      .set({ isApplicable })
      .where(eq(iso27001Requirements.id, requirementId))

    const rows = await this.db
      .select()
      .from(iso27001Requirements)
      .where(eq(iso27001Requirements.id, requirementId))

    if (rows.length === 0) throw new Error('要件の更新に失敗しました')

    return this.mapRequirementRow(rows[0])
  }

  // =========================================
  // Checklist Operations
  // =========================================

  async bulkCreateChecklists(
    planId: string,
    requirements: Array<
      Pick<ISO27001Requirement, 'id' | 'clause_number' | 'title' | 'description'>
    >
  ): Promise<AuditChecklist[]> {
    if (!requirements.length) return []

    // Deduplicate
    const uniqueRequirements = requirements.filter(
      (req, index, self) => self.findIndex(c => c.id === req.id) === index
    )
    const requirementIds = uniqueRequirements.map(r => r.id)

    // Check for existing
    const existingRows = await this.db
      .select({ requirementId: auditChecklists.requirementId })
      .from(auditChecklists)
      .where(
        and(
          eq(auditChecklists.auditPlanId, planId),
          inArray(auditChecklists.requirementId, requirementIds)
        )
      )

    const existingIds = new Set(
      existingRows.map(r => r.requirementId).filter(Boolean) as string[]
    )

    const toCreate = uniqueRequirements.filter(r => !existingIds.has(r.id))
    if (toCreate.length === 0) return []

    const now = new Date().toISOString()
    const created: AuditChecklist[] = []

    for (const req of toCreate) {
      const id = crypto.randomUUID()
      const row = {
        id,
        auditPlanId: planId,
        requirementId: req.id,
        checkItem: `${req.clause_number ? `${req.clause_number} ` : ''}${req.title}`.trim(),
        evidenceRequired: req.description ?? null,
        auditorId: null,
        status: 'not_started' as const,
        result: null,
        findings: null,
        evidenceProvided: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      }

      await this.db.insert(auditChecklists).values(row)
      created.push(this.mapChecklistRow(row as typeof auditChecklists.$inferSelect))
    }

    return created
  }

  async createAuditChecklist(
    checklist: Omit<AuditChecklist, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AuditChecklist> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      auditPlanId: checklist.audit_plan_id,
      requirementId: checklist.requirement_id ?? null,
      checkItem: checklist.check_item,
      evidenceRequired: checklist.evidence_required ?? null,
      auditorId: checklist.auditor_id ?? null,
      status: checklist.status ?? 'not_started',
      result: checklist.result ?? null,
      findings: checklist.findings ?? null,
      evidenceProvided: checklist.evidence_provided ?? null,
      reviewedAt: checklist.reviewed_at ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(auditChecklists).values(row)
    return this.mapChecklistRow(row as typeof auditChecklists.$inferSelect)
  }

  async updateChecklist(
    checklistId: string,
    updates: Partial<AuditChecklist>
  ): Promise<AuditChecklist> {
    const now = new Date().toISOString()
    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.check_item !== undefined) setPayload.checkItem = updates.check_item
    if (updates.evidence_required !== undefined)
      setPayload.evidenceRequired = updates.evidence_required
    if (updates.auditor_id !== undefined) setPayload.auditorId = updates.auditor_id
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.result !== undefined) setPayload.result = updates.result
    if (updates.findings !== undefined) setPayload.findings = updates.findings
    if (updates.evidence_provided !== undefined)
      setPayload.evidenceProvided = updates.evidence_provided
    if (updates.reviewed_at !== undefined) setPayload.reviewedAt = updates.reviewed_at

    // Auto-set reviewed_at when status becomes completed
    if (updates.status === 'completed' && !updates.reviewed_at) {
      setPayload.reviewedAt = now
    }

    await this.db
      .update(auditChecklists)
      .set(setPayload)
      .where(eq(auditChecklists.id, checklistId))

    const rows = await this.db
      .select()
      .from(auditChecklists)
      .where(eq(auditChecklists.id, checklistId))

    if (rows.length === 0) throw new Error('チェックリストの更新に失敗しました')

    return this.mapChecklistRow(rows[0])
  }

  async getChecklistsByPlan(planId: string): Promise<AuditChecklist[]> {
    const rows = await this.db
      .select()
      .from(auditChecklists)
      .where(eq(auditChecklists.auditPlanId, planId))
      .orderBy(asc(auditChecklists.createdAt))

    const results: AuditChecklist[] = []

    for (const row of rows) {
      const cl = this.mapChecklistRow(row)

      // Load requirement
      let requirement: ISO27001Requirement | null = null
      if (row.requirementId) {
        const reqRows = await this.db
          .select()
          .from(iso27001Requirements)
          .where(eq(iso27001Requirements.id, row.requirementId))
        if (reqRows.length > 0) {
          requirement = this.mapRequirementRow(reqRows[0])
        }
      }

      // Load auditor
      const auditor = await this.loadUserProfile(row.auditorId)

      // Load evidence
      const evidenceRows = await this.db
        .select()
        .from(auditEvidence)
        .where(eq(auditEvidence.auditChecklistId, row.id))

      const evidence: AuditEvidence[] = []
      for (const evRow of evidenceRows) {
        const ev = this.mapEvidenceRow(evRow)
        const uploader = await this.loadUserProfile(evRow.uploadedBy)
        evidence.push({ ...ev, uploader: uploader ?? null })
      }

      // Load nonconformities
      const ncRowsList = await this.db
        .select()
        .from(nonconformities)
        .where(eq(nonconformities.auditChecklistId, row.id))

      const ncList: Nonconformity[] = ncRowsList.map(r => this.mapNonconformityRow(r))

      results.push({
        ...cl,
        requirement,
        auditor: auditor ?? null,
        evidence,
        nonconformities: ncList,
      })
    }

    return results
  }

  // =========================================
  // Nonconformity Operations
  // =========================================

  async createNonconformity(
    nonconformity: Omit<Nonconformity, 'id' | 'nc_number' | 'created_at' | 'updated_at'>
  ): Promise<Nonconformity> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Generate nc_number (e.g., NC-20260207-xxxx)
    const dateStr = now.slice(0, 10).replace(/-/g, '')
    const ncNumber = `NC-${dateStr}-${id.slice(0, 4).toUpperCase()}`

    const row = {
      id,
      auditChecklistId: nonconformity.audit_checklist_id,
      ncNumber,
      type: nonconformity.type,
      description: nonconformity.description,
      rootCause: nonconformity.root_cause ?? null,
      correctiveAction: nonconformity.corrective_action ?? null,
      preventiveAction: nonconformity.preventive_action ?? null,
      responsibleId: nonconformity.responsible_id ?? null,
      dueDate: nonconformity.due_date ?? null,
      status: nonconformity.status ?? 'open',
      resolutionDate: nonconformity.resolution_date ?? null,
      verificationDate: nonconformity.verification_date ?? null,
      verifiedBy: nonconformity.verified_by ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(nonconformities).values(row)
    return this.mapNonconformityRow(row as typeof nonconformities.$inferSelect)
  }

  async updateNonconformity(
    ncId: string,
    updates: Partial<Nonconformity>
  ): Promise<Nonconformity> {
    const now = new Date().toISOString()
    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.type !== undefined) setPayload.type = updates.type
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.root_cause !== undefined) setPayload.rootCause = updates.root_cause
    if (updates.corrective_action !== undefined)
      setPayload.correctiveAction = updates.corrective_action
    if (updates.preventive_action !== undefined)
      setPayload.preventiveAction = updates.preventive_action
    if (updates.responsible_id !== undefined) setPayload.responsibleId = updates.responsible_id
    if (updates.due_date !== undefined) setPayload.dueDate = updates.due_date
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.resolution_date !== undefined) setPayload.resolutionDate = updates.resolution_date
    if (updates.verification_date !== undefined)
      setPayload.verificationDate = updates.verification_date
    if (updates.verified_by !== undefined) setPayload.verifiedBy = updates.verified_by

    await this.db
      .update(nonconformities)
      .set(setPayload)
      .where(eq(nonconformities.id, ncId))

    const rows = await this.db
      .select()
      .from(nonconformities)
      .where(eq(nonconformities.id, ncId))

    if (rows.length === 0) throw new Error('不適合の更新に失敗しました')
    return this.mapNonconformityRow(rows[0])
  }

  async getNonconformities(filters?: NonconformityFilters): Promise<Nonconformity[]> {
    const conditions: ReturnType<typeof eq>[] = []

    if (filters?.status) {
      conditions.push(eq(nonconformities.status, filters.status) as never)
    }
    if (filters?.type) {
      conditions.push(eq(nonconformities.type, filters.type) as never)
    }

    const ncRows =
      conditions.length > 0
        ? await this.db
            .select()
            .from(nonconformities)
            .where(and(...(conditions as never[])))
            .orderBy(desc(nonconformities.createdAt))
        : await this.db
            .select()
            .from(nonconformities)
            .orderBy(desc(nonconformities.createdAt))

    const results: Nonconformity[] = []

    for (const ncRow of ncRows) {
      const nc = this.mapNonconformityRow(ncRow)

      // Load responsible
      const responsible = await this.loadUserProfile(ncRow.responsibleId)
      // Load verifier
      const verifier = await this.loadUserProfile(ncRow.verifiedBy)

      // Load corrective actions
      const caRows = await this.db
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.nonconformityId, ncRow.id))
        .orderBy(asc(correctiveActions.createdAt))

      const caList: CorrectiveAction[] = []
      for (const caRow of caRows) {
        const ca = this.mapCorrectiveActionRow(caRow)
        const caResponsible = await this.loadUserProfile(caRow.responsibleId)
        const reviewer = await this.loadUserProfile(caRow.reviewedBy)
        caList.push({ ...ca, responsible: caResponsible ?? null, reviewer: reviewer ?? null })
      }

      // Organization filter: resolve via checklist -> plan -> organization
      if (filters?.organizationId) {
        const context = await this.resolveNonconformityContext(ncRow.id)
        if (context.organizationId !== filters.organizationId) continue
      }

      results.push({
        ...nc,
        responsible: responsible ?? null,
        verifier: verifier ?? null,
        corrective_actions: caList,
      })
    }

    return results
  }

  // =========================================
  // Corrective Action Operations
  // =========================================

  async createCorrectiveAction(
    action: Omit<CorrectiveAction, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CorrectiveAction> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      nonconformityId: action.nonconformity_id,
      actionDescription: action.action_description,
      responsibleId: action.responsible_id ?? null,
      plannedDate: action.planned_date ?? null,
      completionDate: action.completion_date ?? null,
      status: action.status ?? 'planned',
      effectivenessReview: action.effectiveness_review ?? null,
      reviewedBy: action.reviewed_by ?? null,
      reviewedAt: action.reviewed_at ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(correctiveActions).values(row)

    const responsible = await this.loadUserProfile(action.responsible_id ?? null)
    const reviewer = await this.loadUserProfile(action.reviewed_by ?? null)

    return {
      ...this.mapCorrectiveActionRow(row as typeof correctiveActions.$inferSelect),
      responsible: responsible ?? null,
      reviewer: reviewer ?? null,
    }
  }

  async updateCorrectiveAction(
    actionId: string,
    updates: Partial<CorrectiveAction>
  ): Promise<CorrectiveAction> {
    const now = new Date().toISOString()
    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.action_description !== undefined)
      setPayload.actionDescription = updates.action_description
    if (updates.responsible_id !== undefined) setPayload.responsibleId = updates.responsible_id
    if (updates.planned_date !== undefined) setPayload.plannedDate = updates.planned_date
    if (updates.completion_date !== undefined) setPayload.completionDate = updates.completion_date
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.effectiveness_review !== undefined)
      setPayload.effectivenessReview = updates.effectiveness_review
    if (updates.reviewed_by !== undefined) setPayload.reviewedBy = updates.reviewed_by
    if (updates.reviewed_at !== undefined) setPayload.reviewedAt = updates.reviewed_at

    await this.db
      .update(correctiveActions)
      .set(setPayload)
      .where(eq(correctiveActions.id, actionId))

    const rows = await this.db
      .select()
      .from(correctiveActions)
      .where(eq(correctiveActions.id, actionId))

    if (rows.length === 0) throw new Error('是正処置の更新に失敗しました')

    const ca = this.mapCorrectiveActionRow(rows[0])
    const responsible = await this.loadUserProfile(rows[0].responsibleId)
    const reviewer = await this.loadUserProfile(rows[0].reviewedBy)

    return {
      ...ca,
      responsible: responsible ?? null,
      reviewer: reviewer ?? null,
    }
  }

  // =========================================
  // Evidence Operations
  // =========================================

  async createEvidence(
    evidence: Omit<AuditEvidence, 'id' | 'uploaded_at'>
  ): Promise<AuditEvidence> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      auditChecklistId: evidence.audit_checklist_id,
      fileName: evidence.file_name,
      filePath: evidence.file_path,
      fileSize: evidence.file_size ?? null,
      mimeType: evidence.mime_type ?? null,
      description: evidence.description ?? null,
      uploadedBy: evidence.uploaded_by ?? null,
      uploadedAt: now,
    }

    await this.db.insert(auditEvidence).values(row)

    const uploader = await this.loadUserProfile(evidence.uploaded_by ?? null)
    return {
      ...this.mapEvidenceRow(row as typeof auditEvidence.$inferSelect),
      uploader: uploader ?? null,
    }
  }

  async deleteEvidence(evidenceId: string): Promise<{ filePath: string | null }> {
    // Fetch file_path first
    const rows = await this.db
      .select({ filePath: auditEvidence.filePath })
      .from(auditEvidence)
      .where(eq(auditEvidence.id, evidenceId))

    const filePath = rows.length > 0 ? rows[0].filePath : null

    await this.db.delete(auditEvidence).where(eq(auditEvidence.id, evidenceId))

    return { filePath }
  }

  // =========================================
  // Report Operations
  // =========================================

  async getAuditReportsList(
    organizationId: string,
    filters?: AuditReportFilters
  ): Promise<AuditReportListItem[]> {
    this.requireOrganizationId(organizationId, 'getAuditReportsList')

    // Get plans for organization
    const planConditions: ReturnType<typeof eq>[] = [
      eq(auditPlans.organizationId, organizationId),
    ]

    if (filters?.status) {
      planConditions.push(eq(auditPlans.status, filters.status) as never)
    }
    if (filters?.period?.trim()) {
      planConditions.push(eq(auditPlans.auditPeriod, filters.period.trim()) as never)
    }
    if (filters?.auditType) {
      planConditions.push(eq(auditPlans.auditType, filters.auditType) as never)
    }

    const planRows = await this.db
      .select()
      .from(auditPlans)
      .where(and(...(planConditions as never[])))

    if (planRows.length === 0) return []

    const planIds = planRows.map(p => p.id)

    // Get reports for those plans
    const reportRows = await this.db
      .select()
      .from(auditReports)
      .where(inArray(auditReports.auditPlanId, planIds))
      .orderBy(desc(auditReports.updatedAt))

    const planMap = new Map(planRows.map(p => [p.id, p]))

    const results: AuditReportListItem[] = []

    for (const reportRow of reportRows) {
      const report = this.mapReportRow(reportRow)
      const planRow = planMap.get(reportRow.auditPlanId ?? '')
      if (!planRow) continue

      // Filter by search
      if (filters?.search?.trim()) {
        const search = filters.search.trim().toLowerCase()
        if (!planRow.title.toLowerCase().includes(search)) continue
      }

      const leadAuditor = await this.loadUserProfile(planRow.leadAuditorId)

      results.push({
        report,
        plan: {
          id: planRow.id,
          title: planRow.title,
          status: (planRow.status ?? 'planning') as AuditStatus,
          audit_period: planRow.auditPeriod ?? null,
          audit_type: planRow.auditType as AuditPlan['audit_type'],
          planned_start_date: planRow.plannedStartDate ?? null,
          planned_end_date: planRow.plannedEndDate ?? null,
          standard: planRow.standard ?? null,
          updated_at: planRow.updatedAt ?? '',
          lead_auditor: leadAuditor ?? null,
        },
      })
    }

    return results
  }

  async createAuditReport(
    report: Omit<AuditReport, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AuditReport> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Normalize approved_by
    let approvedBy = report.approved_by
    if (approvedBy !== undefined && approvedBy !== null) {
      const trimmed = String(approvedBy).trim()
      const lowered = trimmed.toLowerCase()
      if (!trimmed || lowered === 'null' || lowered === 'undefined') {
        approvedBy = null
      } else {
        approvedBy = trimmed
      }
    }

    const row = {
      id,
      auditPlanId: report.audit_plan_id ?? null,
      executiveSummary: report.executive_summary ?? null,
      scope: report.scope ?? null,
      methodology: report.methodology ?? null,
      positiveFindings: report.positive_findings ?? null,
      improvementOpportunities: report.improvement_opportunities ?? null,
      conclusion: report.conclusion ?? null,
      reportDate: report.report_date ?? null,
      approvalStatus: report.approval_status ?? 'draft',
      rejectionReason: report.rejection_reason ?? null,
      approvedBy: approvedBy ?? null,
      approvedAt: report.approved_at ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(auditReports).values(row)
    return this.mapReportRow(row as typeof auditReports.$inferSelect)
  }

  async updateAuditReport(
    reportId: string,
    updates: Partial<AuditReport>
  ): Promise<AuditReport> {
    const now = new Date().toISOString()
    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.executive_summary !== undefined)
      setPayload.executiveSummary = updates.executive_summary
    if (updates.scope !== undefined) setPayload.scope = updates.scope
    if (updates.methodology !== undefined) setPayload.methodology = updates.methodology
    if (updates.positive_findings !== undefined)
      setPayload.positiveFindings = updates.positive_findings
    if (updates.improvement_opportunities !== undefined)
      setPayload.improvementOpportunities = updates.improvement_opportunities
    if (updates.conclusion !== undefined) setPayload.conclusion = updates.conclusion
    if (updates.report_date !== undefined) setPayload.reportDate = updates.report_date
    if (updates.approval_status !== undefined) setPayload.approvalStatus = updates.approval_status
    if (updates.rejection_reason !== undefined)
      setPayload.rejectionReason = updates.rejection_reason

    // Normalize approved_by
    if (updates.approved_by !== undefined) {
      if (updates.approved_by === null) {
        setPayload.approvedBy = null
      } else {
        const trimmed = String(updates.approved_by).trim()
        const lowered = trimmed.toLowerCase()
        if (!trimmed || lowered === 'null' || lowered === 'undefined') {
          setPayload.approvedBy = null
        } else {
          setPayload.approvedBy = trimmed
        }
      }
    }

    if (updates.approved_at !== undefined) setPayload.approvedAt = updates.approved_at

    await this.db
      .update(auditReports)
      .set(setPayload)
      .where(eq(auditReports.id, reportId))

    const rows = await this.db
      .select()
      .from(auditReports)
      .where(eq(auditReports.id, reportId))

    if (rows.length === 0) throw new Error('レポートの更新に失敗しました')
    return this.mapReportRow(rows[0])
  }

  // =========================================
  // Statistics Operations
  // =========================================

  async getAuditStatistics(
    organizationId: string,
    filters?: { period?: string | null }
  ): Promise<AuditStatistics> {
    this.requireOrganizationId(organizationId, 'getAuditStatistics')

    const normalizedPeriod = filters?.period?.trim() ?? null

    // 1. Fetch plans
    const planConditions: ReturnType<typeof eq>[] = [
      eq(auditPlans.organizationId, organizationId),
    ]
    if (normalizedPeriod) {
      planConditions.push(eq(auditPlans.auditPeriod, normalizedPeriod) as never)
    }

    const filteredPlans = await this.db
      .select()
      .from(auditPlans)
      .where(and(...(planConditions as never[])))

    const planIds = filteredPlans.map(p => p.id)

    // 2. Fetch checklists
    let checklistRows: Array<{
      id: string
      auditPlanId: string | null
      status: string | null
    }> = []
    if (planIds.length > 0) {
      checklistRows = await this.db
        .select({
          id: auditChecklists.id,
          auditPlanId: auditChecklists.auditPlanId,
          status: auditChecklists.status,
        })
        .from(auditChecklists)
        .where(inArray(auditChecklists.auditPlanId, planIds))
    }

    const checklistStatus: Record<ChecklistStatus, number> = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
    }

    const planChecklistMap = new Map<
      string,
      { total: number; completed: number; inProgress: number; notStarted: number }
    >()
    const checklistToPlan = new Map<string, string>()

    checklistRows.forEach(item => {
      checklistStatus[item.status as ChecklistStatus]++
      const planId = item.auditPlanId ?? ''
      const current = planChecklistMap.get(planId) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      }
      current.total += 1
      if (item.status === 'completed') current.completed += 1
      else if (item.status === 'in_progress') current.inProgress += 1
      else current.notStarted += 1
      planChecklistMap.set(planId, current)
      checklistToPlan.set(item.id, planId)
    })

    // 3. Fetch nonconformities
    const checklistIds = checklistRows.map(c => c.id)
    let orgNonconformities: Array<{
      id: string
      auditChecklistId: string | null
      type: string | null
      status: string | null
      dueDate: string | null
    }> = []
    if (checklistIds.length > 0) {
      orgNonconformities = await this.db
        .select({
          id: nonconformities.id,
          auditChecklistId: nonconformities.auditChecklistId,
          type: nonconformities.type,
          status: nonconformities.status,
          dueDate: nonconformities.dueDate,
        })
        .from(nonconformities)
        .where(inArray(nonconformities.auditChecklistId, checklistIds))
    }

    const today = new Date()
    const planLookup = new Map(filteredPlans.map(p => [p.id, p]))
    const upcomingAudits = filteredPlans.filter(p => {
      if (p.status !== 'scheduled' || !p.plannedStartDate) return false
      return new Date(p.plannedStartDate) > today
    })

    const dueSoonThreshold = new Date()
    dueSoonThreshold.setDate(dueSoonThreshold.getDate() + 7)

    const stats: AuditStatistics = {
      totalPlans: filteredPlans.length,
      plansByStatus: { planning: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 },
      totalNonconformities: orgNonconformities.length,
      ncByType: { major: 0, minor: 0 },
      ncByStatus: { open: 0, in_progress: 0, resolved: 0, closed: 0, verified: 0 },
      upcomingAudits: upcomingAudits.map(p => this.mapAuditPlanRow(p)),
      checklistStatus,
      totalChecklistItems: checklistRows.length,
      completedChecklistItems: checklistStatus.completed,
      correctiveActionsByStatus: { planned: 0, in_progress: 0, completed: 0, verified: 0 },
      openCorrectiveActions: 0,
      overdueNonconformities: 0,
      overdueCorrectiveActions: 0,
      nextActions: [],
      followUpStatusCounts: { completed: 0, on_hold: 0, reopened: 0 },
      nonconformityStatusCounts: { open: 0, in_progress: 0, resolved: 0, closed: 0, verified: 0 },
    }

    filteredPlans.forEach(plan => {
      stats.plansByStatus[(plan.status ?? 'planning') as AuditStatus]++
    })

    const openNcByPlan = new Map<string, number>()
    const overdueNonconformities: typeof orgNonconformities = []
    const dueSoonNonconformities: typeof orgNonconformities = []

    orgNonconformities.forEach(nc => {
      stats.ncByType[(nc.type ?? 'minor') as NonconformityType]++
      stats.ncByStatus[(nc.status ?? 'open') as NonconformityStatus]++

      const planId = nc.auditChecklistId ? checklistToPlan.get(nc.auditChecklistId) : undefined
      if (planId && ACTIVE_NONCONFORMITY_STATUSES.has(nc.status as NonconformityStatus)) {
        openNcByPlan.set(planId, (openNcByPlan.get(planId) ?? 0) + 1)
      }

      if (nc.dueDate && planId) {
        const dueDate = new Date(nc.dueDate)
        const isClosed = ['resolved', 'closed', 'verified'].includes(nc.status ?? '')
        if (!isClosed && dueDate < today) {
          overdueNonconformities.push(nc)
        } else if (!isClosed && dueDate >= today && dueDate <= dueSoonThreshold) {
          dueSoonNonconformities.push(nc)
        }
      }
    })

    stats.overdueNonconformities = overdueNonconformities.length

    // 4. Fetch corrective actions
    const nonconformityIds = orgNonconformities.map(nc => nc.id)
    let caRows: Array<{
      id: string
      nonconformityId: string | null
      status: string | null
      plannedDate: string | null
    }> = []
    if (nonconformityIds.length > 0) {
      caRows = await this.db
        .select({
          id: correctiveActions.id,
          nonconformityId: correctiveActions.nonconformityId,
          status: correctiveActions.status,
          plannedDate: correctiveActions.plannedDate,
        })
        .from(correctiveActions)
        .where(inArray(correctiveActions.nonconformityId, nonconformityIds))
    }

    const overdueCorrectiveActions: typeof caRows = []
    const dueSoonCorrectiveActions: typeof caRows = []

    caRows.forEach(action => {
      stats.correctiveActionsByStatus[(action.status ?? 'planned') as CorrectiveActionStatus]++
      if (action.status !== 'completed' && action.status !== 'verified') {
        stats.openCorrectiveActions++
        if (action.plannedDate) {
          const planned = new Date(action.plannedDate)
          if (planned < today) {
            overdueCorrectiveActions.push(action)
          } else if (planned >= today && planned <= dueSoonThreshold) {
            dueSoonCorrectiveActions.push(action)
          }
        }
      }
    })

    stats.overdueCorrectiveActions = overdueCorrectiveActions.length

    // 5. Compute follow-up status counts
    const fallbackFollowUpCounts: Record<AuditFollowUpStatus, number> = {
      completed: 0,
      on_hold: 0,
      reopened: 0,
    }

    filteredPlans.forEach(plan => {
      const openCount = openNcByPlan.get(plan.id) ?? 0
      const followUpStatus = deriveAuditFollowUpStatus(
        (plan.status ?? 'planning') as AuditStatus,
        openCount
      )
      fallbackFollowUpCounts[followUpStatus]++
    })

    stats.followUpStatusCounts = fallbackFollowUpCounts
    stats.nonconformityStatusCounts = { ...stats.ncByStatus }

    // 6. Build next actions
    const priorityWeight: Record<'low' | 'medium' | 'high', number> = {
      high: 3,
      medium: 2,
      low: 1,
    }

    const nextActions: AuditDashboardNextAction[] = []

    planChecklistMap.forEach((value, planId) => {
      if (!value.total) return
      const remaining = value.total - value.completed
      if (remaining <= 0) return
      const plan = planLookup.get(planId)
      const priority =
        remaining >= Math.max(3, Math.ceil(value.total / 2)) ? 'high' : 'medium'

      nextActions.push({
        id: `checklist-${planId}`,
        type: 'checklist',
        planId,
        planTitle: plan?.title,
        remaining,
        total: value.total,
        dueDate: plan?.plannedEndDate ?? undefined,
        priority,
      })
    })

    const toAction = (
      nc: (typeof orgNonconformities)[number],
      priority: 'low' | 'medium' | 'high'
    ): AuditDashboardNextAction | null => {
      const planId = nc.auditChecklistId
        ? checklistToPlan.get(nc.auditChecklistId)
        : undefined
      if (!planId) return null
      const plan = planLookup.get(planId)
      return {
        id: `nc-${nc.id}`,
        type: 'nonconformity',
        planId,
        planTitle: plan?.title,
        nonconformityId: nc.id,
        status: nc.status as NonconformityStatus,
        dueDate: nc.dueDate ?? undefined,
        priority,
      }
    }

    overdueNonconformities
      .map(nc => toAction(nc, 'high'))
      .filter((a): a is AuditDashboardNextAction => Boolean(a))
      .forEach(a => nextActions.push(a))

    dueSoonNonconformities
      .map(nc => toAction(nc, 'medium'))
      .filter((a): a is AuditDashboardNextAction => Boolean(a))
      .forEach(a => nextActions.push(a))

    const toCorrectiveActionItem = (
      action: (typeof caRows)[number],
      priority: 'low' | 'medium' | 'high'
    ): AuditDashboardNextAction | null => {
      const nc = orgNonconformities.find(item => item.id === action.nonconformityId)
      if (!nc) return null
      const planId = nc.auditChecklistId
        ? checklistToPlan.get(nc.auditChecklistId)
        : undefined
      if (!planId) return null
      const plan = planLookup.get(planId)
      return {
        id: `corrective-${action.id}`,
        type: 'corrective_action',
        planId,
        planTitle: plan?.title,
        nonconformityId: nc.id,
        correctiveActionId: action.id,
        status: action.status as CorrectiveActionStatus,
        dueDate: action.plannedDate ?? undefined,
        priority,
      }
    }

    overdueCorrectiveActions
      .map(a => toCorrectiveActionItem(a, 'high'))
      .filter((a): a is AuditDashboardNextAction => Boolean(a))
      .forEach(a => nextActions.push(a))

    dueSoonCorrectiveActions
      .map(a => toCorrectiveActionItem(a, 'medium'))
      .filter((a): a is AuditDashboardNextAction => Boolean(a))
      .forEach(a => nextActions.push(a))

    const sortedActions = nextActions.sort((a, b) => {
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return a.id.localeCompare(b.id)
    })

    stats.nextActions = sortedActions.slice(0, 6)

    return stats
  }

  // =========================================
  // Context Resolution (for audit logging)
  // =========================================

  async resolvePlanOrganizationId(planId: string): Promise<string | null> {
    if (!planId) return null

    const rows = await this.db
      .select({ organizationId: auditPlans.organizationId })
      .from(auditPlans)
      .where(eq(auditPlans.id, planId))

    return rows.length > 0 ? rows[0].organizationId : null
  }

  async resolveChecklistContext(
    checklistId: string
  ): Promise<{ planId: string | null; organizationId: string | null }> {
    const rows = await this.db
      .select({
        auditPlanId: auditChecklists.auditPlanId,
      })
      .from(auditChecklists)
      .where(eq(auditChecklists.id, checklistId))

    if (rows.length === 0) return { planId: null, organizationId: null }

    const planId = rows[0].auditPlanId ?? null
    if (!planId) return { planId: null, organizationId: null }

    const organizationId = await this.resolvePlanOrganizationId(planId)
    return { planId, organizationId }
  }

  async resolveNonconformityContext(nonconformityId: string): Promise<{
    checklistId: string | null
    planId: string | null
    organizationId: string | null
  }> {
    const ncRows = await this.db
      .select({ auditChecklistId: nonconformities.auditChecklistId })
      .from(nonconformities)
      .where(eq(nonconformities.id, nonconformityId))

    if (ncRows.length === 0) return { checklistId: null, planId: null, organizationId: null }

    const checklistId = ncRows[0].auditChecklistId ?? null
    if (!checklistId) return { checklistId: null, planId: null, organizationId: null }

    const checklistContext = await this.resolveChecklistContext(checklistId)
    return {
      checklistId,
      planId: checklistContext.planId,
      organizationId: checklistContext.organizationId,
    }
  }
}
