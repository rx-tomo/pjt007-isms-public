/**
 * Audit Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IAuditPlanRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 */
import { getDb } from '@/lib/db/drizzle/client'
import {
  userProfiles,
  auditUnits,
  auditTeamMembers,
  auditEvidence,
  auditReports,
  followUpRecords,
  auditChecklists,
  auditPlans,
  correctiveActions,
  nonconformities,
} from '@/lib/db/drizzle/schema'
import { eq, and, desc, asc } from 'drizzle-orm'
import { ApprovalService, type ApprovalResourceType } from '@/lib/services/approval'
import { NotificationService } from '@/lib/services/notification'
import { StorageQuotaService } from '@/lib/services/storageQuota'
import { getAuditPlanRepository, getAuditLogRepository, getAuthProvider } from '@/lib/container'
import { getStorageProvider } from '@/lib/storage'
import type { IAuditPlanRepository } from '@/lib/db/repositories/interfaces/IAuditPlanRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { Json } from '@/types/database.types'

// Re-export helper from auditProgress service
export {
  deriveAuditFollowUpStatus
} from '@/lib/services/auditProgress'

export type {
  AuditType,
  AuditStatus,
  AuditApprovalStatus,
  TeamRole,
  ChecklistStatus,
  AuditResult,
  NonconformityType,
  NonconformityStatus,
  CorrectiveActionStatus,
  AuditFollowUpStatus,
  AuditUnit,
  AuditPlanProgressSummary,
  AuditPlan,
  AuditPlanWithRelations,
  AuditTeamMember,
  ISO27001Requirement,
  AuditChecklist,
  Nonconformity,
  CorrectiveAction,
  AuditReport,
  AuditReportListItem,
  AuditEvidence,
  AuditDashboardNextAction
} from '@/lib/db/repositories/interfaces/IAuditPlanRepository'

import type {
  AuditType,
  AuditStatus,
  AuditApprovalStatus,
  TeamRole,
  ChecklistStatus,
  NonconformityType,
  NonconformityStatus,
  AuditPlan,
  AuditPlanWithRelations,
  AuditTeamMember,
  ISO27001Requirement,
  AuditChecklist,
  Nonconformity,
  CorrectiveAction,
  AuditReport,
  AuditReportListItem,
  AuditEvidence,
  AuditStatistics,
  AuditFollowUpStatus,
  AuditUnit
} from '@/lib/db/repositories/interfaces/IAuditPlanRepository'

export class AuditService {
  private storageQuota: StorageQuotaService
  private approvalService: ApprovalService
  private repositoryPromise: Promise<IAuditPlanRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null

  constructor() {
    this.storageQuota = new StorageQuotaService()
    this.approvalService = new ApprovalService()
  }

  private async getRepository(): Promise<IAuditPlanRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getAuditPlanRepository()
    }
    return this.repositoryPromise
  }

  private async getAuditLog(): Promise<IAuditLogRepository> {
    if (!this.auditLogPromise) {
      this.auditLogPromise = getAuditLogRepository()
    }
    return this.auditLogPromise
  }

  private async getAuth(): Promise<IAuthProvider> {
    if (!this.authProviderPromise) {
      this.authProviderPromise = getAuthProvider()
    }
    return this.authProviderPromise
  }

  private async getCurrentUserId(): Promise<string | null> {
    const auth = await this.getAuth()
    const user = await auth.getUser()
    return user?.id ?? null
  }

  private async getCurrentOrganizationId(): Promise<string | null> {
    const auth = await this.getAuth()
    const user = await auth.getUser()
    if (!user) return null

    try {
      const db = getDb()
      const [row] = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1)

      return row?.organizationId ?? null
    } catch (err) {
      console.error('[AuditService] Failed to resolve current organization', err)
      return null
    }
  }

  private async logAuditEvent(params: {
    action: string
    resourceType: string
    resourceId?: string
    organizationId?: string | null
    changes?: Record<string, unknown> | null
  }): Promise<void> {
    if (!params.organizationId) return

    try {
      const [auditLog, userId] = await Promise.all([
        this.getAuditLog(),
        this.getCurrentUserId()
      ])

      await auditLog.log({
        organizationId: params.organizationId,
        userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        changes: params.changes as Json
      })
    } catch (err) {
      console.error('[AuditService] Failed to record audit log', err)
    }
  }

  private async mutateAuditApi<T>(method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<T> {
    const response = await fetch('/api/audit', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.error || '監査データの更新に失敗しました')
    }

    return response.json()
  }

  /**
   * Resolve the approver user ID for an audit-related resource type
   * using approval escalation rules first, then the ISMS structure roles.
   */
  private async resolveAuditApproverId(input: {
    organizationId: string
    resourceType: ApprovalResourceType
  }): Promise<string | null> {
    try {
      const userIds = await this.approvalService.resolveEscalationUserIds({
        organizationId: input.organizationId,
        resourceType: input.resourceType
      })
      if (userIds[0]) return userIds[0]
    } catch (error) {
      console.error('[AuditService] Failed to resolve audit approver', error)
    }

    try {
      const db = getDb()
      const baseWhere = and(
        eq(userProfiles.organizationId, input.organizationId),
        eq(userProfiles.isActive, true)
      )
      const fallbackCandidates = [
        eq(userProfiles.isCiso, true),
        eq(userProfiles.isSecurityManager, true),
        eq(userProfiles.role, 'approver'),
        eq(userProfiles.role, 'org_admin'),
      ]

      for (const condition of fallbackCandidates) {
        const [candidate] = await db
          .select({ id: userProfiles.id })
          .from(userProfiles)
          .where(and(baseWhere, condition))
          .orderBy(asc(userProfiles.fullName))
          .limit(1)

        if (candidate?.id) return candidate.id
      }
    } catch (error) {
      console.error('[AuditService] Failed to resolve fallback audit approver', error)
    }

    return null
  }

  async getAuditUnits(organizationId: string): Promise<AuditUnit[]> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        action: 'units',
        organizationId,
      })
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('監査対象ユニットの取得に失敗しました')
      }
      return response.json()
    }

    try {
      const db = getDb()
      const rows = await db
        .select()
        .from(auditUnits)
        .where(and(
          eq(auditUnits.organizationId, organizationId),
          eq(auditUnits.isActive, true)
        ))
        .orderBy(asc(auditUnits.name))

      return rows.map(row => ({
        id: row.id,
        organization_id: row.organizationId,
        name: row.name,
        unit_type: row.unitType as 'site' | 'process',
        description: row.description ?? null,
        is_active: row.isActive,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      })) as AuditUnit[]
    } catch (err) {
      console.error('[AuditService] Failed to load audit units', err)
      throw new Error('監査対象ユニットの取得に失敗しました')
    }
  }

  async createAuditUnit(input: {
    organization_id: string
    name: string
    unit_type: 'site' | 'process'
    description?: string | null
  }): Promise<AuditUnit> {
    try {
      const db = getDb()
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      await db.insert(auditUnits).values({
        id,
        organizationId: input.organization_id,
        name: input.name,
        unitType: input.unit_type,
        description: input.description ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })

      const [row] = await db
        .select()
        .from(auditUnits)
        .where(eq(auditUnits.id, id))
        .limit(1)

      if (!row) {
        throw new Error('監査対象ユニットの作成に失敗しました')
      }

      return {
        id: row.id,
        organization_id: row.organizationId,
        name: row.name,
        unit_type: row.unitType as 'site' | 'process',
        description: row.description ?? null,
        is_active: row.isActive,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      } as AuditUnit
    } catch (err) {
      console.error('[AuditService] Failed to create audit unit', err)
      throw new Error('監査対象ユニットの作成に失敗しました')
    }
  }

  // =====================================================
  // 監査計画管理
  // =====================================================

  async getAuditPlans(
    organizationId?: string,
    filters?: { status?: AuditStatus; period?: string | null }
  ): Promise<AuditPlanWithRelations[]> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ action: 'plans' })
      if (organizationId) params.set('organizationId', organizationId)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.period) params.set('period', filters.period)
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('監査計画の取得に失敗しました')
      }
      return response.json()
    }

    const repo = await this.getRepository()
    return repo.getAuditPlans(organizationId, filters)
  }

  async getAuditPeriods(organizationId: string): Promise<string[]> {
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/audit/periods', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('監査期間の取得に失敗しました')
      }
      const body = await response.json() as { periods?: string[] }
      return body.periods ?? []
    }

    const repo = await this.getRepository()
    return repo.getAuditPeriods(organizationId)
  }

  async getAuditPlanById(planId: string): Promise<AuditPlanWithRelations | null> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        action: 'plan',
        planId,
      })
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('監査計画の取得に失敗しました')
      }
      return response.json()
    }

    const repo = await this.getRepository()
    return repo.getAuditPlanById(planId)
  }

  async createAuditPlan(plan: Omit<AuditPlan, 'id' | 'created_at' | 'updated_at'>): Promise<AuditPlan> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<AuditPlan>('POST', {
        action: 'auditPlan',
        plan,
      })
    }

    const repo = await this.getRepository()
    const data = await repo.createAuditPlan(plan)

    await this.logAuditEvent({
      action: 'audit.plan.created',
      resourceType: 'audit_plan',
      resourceId: data.id,
      organizationId: data.organization_id,
      changes: {
        title: data.title,
        status: data.status,
        planned_start_date: data.planned_start_date,
        planned_end_date: data.planned_end_date
      }
    })

    return data
  }

  async updateAuditPlan(planId: string, updates: Partial<AuditPlan>): Promise<AuditPlan> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<AuditPlan>('PATCH', {
        resourceType: 'plan',
        id: planId,
        updates,
      })
    }

    const repo = await this.getRepository()

    // Get previous state for notification check
    const previousPlan = await repo.findById(planId)

    const data = await repo.updateAuditPlan(planId, updates)

    await this.logAuditEvent({
      action: 'audit.plan.updated',
      resourceType: 'audit_plan',
      resourceId: data.id,
      organizationId: data.organization_id,
      changes: updates as Record<string, unknown>
    })

    // Handle notifications for scheduling
    const scheduleDateRaw = data.planned_start_date ?? data.planned_end_date ?? null
    const prevStatus = previousPlan?.status ?? null
    const prevStartDate = previousPlan?.planned_start_date ?? null
    const becameScheduled = prevStatus !== 'scheduled' && data.status === 'scheduled'
    const dateChanged = data.status === 'scheduled' && prevStartDate !== data.planned_start_date
    const shouldNotifySchedule = data.status === 'scheduled' && scheduleDateRaw && (becameScheduled || dateChanged)

    if (shouldNotifySchedule) {
      const recipients = new Set<string>()

      if (data.lead_auditor_id) {
        recipients.add(data.lead_auditor_id)
      }

      try {
        const db = getDb()
        const teamMembers = await db
          .select({ userId: auditTeamMembers.userId })
          .from(auditTeamMembers)
          .where(eq(auditTeamMembers.auditPlanId, data.id))

        for (const member of teamMembers) {
          if (member?.userId) {
            recipients.add(member.userId)
          }
        }
      } catch (teamErr) {
        console.error('Failed to load audit team members for notifications', teamErr)
      }

      if (recipients.size) {
        const scheduleDate = scheduleDateRaw?.slice(0, 10) ?? scheduleDateRaw
        const results = await Promise.allSettled(
          Array.from(recipients).map(() =>
            NotificationService.createAuditScheduleNotification(
              data.organization_id,
              data.title,
              scheduleDate,
              data.id
            )
          )
        )

        results.forEach(result => {
          if (result.status === 'rejected') {
            console.error('Failed to enqueue audit schedule notification', result.reason)
          }
        })
      }
    }

    return data
  }

  async startAuditPlan(planId: string, actorId?: string | null): Promise<AuditPlan> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<AuditPlan>('POST', {
        action: 'startAuditPlan',
        planId,
      })
    }

    const repo = await this.getRepository()
    const plan = await repo.findById(planId)
    if (!plan) throw new Error('監査計画が見つかりません')
    if (plan.status !== 'scheduled') {
      throw new Error('承認済みで予定化された監査計画のみ開始できます')
    }

    const now = new Date().toISOString()
    const started = await repo.updateAuditPlan(planId, {
      status: 'in_progress',
      actual_start_date: now.slice(0, 10),
    })

    await this.logAuditEvent({
      action: 'audit.plan.started',
      resourceType: 'audit_plan',
      resourceId: planId,
      organizationId: plan.organization_id,
      changes: {
        previous_status: plan.status,
        status: 'in_progress',
        actual_start_date: started.actual_start_date,
        started_by: actorId ?? await this.getCurrentUserId()
      }
    })

    return started
  }

  async deleteAuditPlan(planId: string): Promise<void> {
    const repo = await this.getRepository()
    const plan = await repo.findById(planId)

    await repo.deleteAuditPlan(planId)

    if (plan) {
      await this.logAuditEvent({
        action: 'audit.plan.deleted',
        resourceType: 'audit_plan',
        resourceId: plan.id,
        organizationId: plan.organization_id,
        changes: { title: plan.title, status: plan.status }
      })
    }
  }

  // =====================================================
  // チーム管理
  // =====================================================

  async addTeamMember(planId: string, userId: string, role: TeamRole): Promise<AuditTeamMember> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<AuditTeamMember>('POST', {
        action: 'teamMember',
        planId,
        userId,
        role,
      })
    }

    const repo = await this.getRepository()
    const data = await repo.addTeamMember(planId, userId, role)

    const organizationId = await repo.resolvePlanOrganizationId(planId)

    await this.logAuditEvent({
      action: 'audit.team_member.added',
      resourceType: 'audit_team_member',
      resourceId: data.id,
      organizationId,
      changes: {
        audit_plan_id: planId,
        user_id: userId,
        role
      }
    })

    return data
  }

  async updateTeamMember(
    memberId: string,
    updates: Partial<Pick<AuditTeamMember, 'role'>>
  ): Promise<AuditTeamMember> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<AuditTeamMember>('POST', {
        action: 'updateTeamMember',
        memberId,
        role: updates.role,
      })
    }

    const repo = await this.getRepository()
    const data = await repo.updateTeamMember(memberId, updates)

    const organizationId = data.audit_plan_id
      ? await repo.resolvePlanOrganizationId(data.audit_plan_id)
      : null

    await this.logAuditEvent({
      action: 'audit.team_member.updated',
      resourceType: 'audit_team_member',
      resourceId: data.id,
      organizationId,
      changes: updates as Record<string, unknown>
    })

    return data
  }

  async removeTeamMember(memberId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.mutateAuditApi<{ ok: boolean }>('POST', {
        action: 'removeTeamMember',
        memberId,
      })
      return
    }

    const db = getDb()
    const [existing] = await db
      .select({
        id: auditTeamMembers.id,
        auditPlanId: auditTeamMembers.auditPlanId,
        userId: auditTeamMembers.userId,
      })
      .from(auditTeamMembers)
      .where(eq(auditTeamMembers.id, memberId))
      .limit(1)

    const repo = await this.getRepository()
    await repo.removeTeamMember(memberId)

    if (existing) {
      const organizationId = existing.auditPlanId
        ? await repo.resolvePlanOrganizationId(existing.auditPlanId)
        : null

      await this.logAuditEvent({
        action: 'audit.team_member.removed',
        resourceType: 'audit_team_member',
        resourceId: memberId,
        organizationId,
        changes: {
          audit_plan_id: existing.auditPlanId,
          user_id: existing.userId
        }
      })
    }
  }

  // =====================================================
  // ISO27001要求事項
  // =====================================================

  async getISO27001Requirements(): Promise<ISO27001Requirement[]> {
    const repo = await this.getRepository()
    return repo.getISO27001Requirements()
  }

  async updateRequirementApplicability(
    requirementId: string,
    isApplicable: boolean
  ): Promise<ISO27001Requirement> {
    const repo = await this.getRepository()
    const data = await repo.updateRequirementApplicability(requirementId, isApplicable)

    const organizationId = await this.getCurrentOrganizationId()
    await this.logAuditEvent({
      action: 'audit.requirement.applicability_updated',
      resourceType: 'iso27001_requirement',
      resourceId: requirementId,
      organizationId,
      changes: { is_applicable: isApplicable }
    })

    return data
  }

  async bulkCreateChecklists(
    planId: string,
    requirements: Array<Pick<ISO27001Requirement, 'id' | 'clause_number' | 'title' | 'description'>>
  ): Promise<AuditChecklist[]> {
    const repo = await this.getRepository()
    const created = await repo.bulkCreateChecklists(planId, requirements)

    if (created.length) {
      const organizationId = await repo.resolvePlanOrganizationId(planId)
      await this.logAuditEvent({
        action: 'audit.checklist.bulk_created',
        resourceType: 'audit_checklist',
        resourceId: planId,
        organizationId,
        changes: {
          createdCount: created.length,
          requirementIds: created.map(item => item.requirement_id).filter(Boolean)
        }
      })
    }

    return created
  }

  // =====================================================
  // チェックリスト管理
  // =====================================================

  async createAuditChecklist(checklist: Omit<AuditChecklist, 'id' | 'created_at' | 'updated_at'>): Promise<AuditChecklist> {
    const repo = await this.getRepository()
    const data = await repo.createAuditChecklist(checklist)

    const organizationId = await repo.resolvePlanOrganizationId(checklist.audit_plan_id)
    await this.logAuditEvent({
      action: 'audit.checklist.created',
      resourceType: 'audit_checklist',
      resourceId: data.id,
      organizationId,
      changes: {
        audit_plan_id: checklist.audit_plan_id,
        requirement_id: checklist.requirement_id
      }
    })

    return data
  }

  async updateChecklist(checklistId: string, updates: Partial<AuditChecklist>): Promise<AuditChecklist> {
    const repo = await this.getRepository()
    const data = await repo.updateChecklist(checklistId, updates)

    const organizationId = data.audit_plan_id
      ? await repo.resolvePlanOrganizationId(data.audit_plan_id)
      : null

    await this.logAuditEvent({
      action: 'audit.checklist.updated',
      resourceType: 'audit_checklist',
      resourceId: data.id,
      organizationId,
      changes: updates as Record<string, unknown>
    })

    return data
  }

  async getChecklistsByPlan(planId: string): Promise<AuditChecklist[]> {
    const repo = await this.getRepository()
    return repo.getChecklistsByPlan(planId)
  }

  // =====================================================
  // 不適合管理
  // =====================================================

  async createNonconformity(nonconformity: Omit<Nonconformity, 'id' | 'nc_number' | 'created_at' | 'updated_at'>): Promise<Nonconformity> {
    const repo = await this.getRepository()
    const data = await repo.createNonconformity(nonconformity)

    const context = await repo.resolveChecklistContext(nonconformity.audit_checklist_id)
    await this.logAuditEvent({
      action: 'audit.nonconformity.created',
      resourceType: 'nonconformity',
      resourceId: data.id,
      organizationId: context.organizationId,
      changes: {
        audit_checklist_id: nonconformity.audit_checklist_id,
        type: nonconformity.type,
        status: nonconformity.status
      }
    })

    return data
  }

  async updateNonconformity(ncId: string, updates: Partial<Nonconformity>): Promise<Nonconformity> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<Nonconformity>('PATCH', {
        resourceType: 'nonconformity',
        id: ncId,
        updates,
      })
    }

    const repo = await this.getRepository()
    const data = await repo.updateNonconformity(ncId, updates)

    const context = await repo.resolveNonconformityContext(ncId)
    await this.logAuditEvent({
      action: 'audit.nonconformity.updated',
      resourceType: 'nonconformity',
      resourceId: ncId,
      organizationId: context.organizationId,
      changes: updates as Record<string, unknown>
    })

    return data
  }

  async getNonconformities(filters?: {
    organizationId?: string
    status?: NonconformityStatus
    type?: NonconformityType
  }): Promise<Nonconformity[]> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ action: 'nonconformities' })
      if (filters?.organizationId) params.set('organizationId', filters.organizationId)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.type) params.set('type', filters.type)
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('不適合の取得に失敗しました')
      }
      return response.json()
    }

    const repo = await this.getRepository()
    return repo.getNonconformities(filters)
  }

  // =====================================================
  // 是正措置管理
  // =====================================================

  async createCorrectiveAction(action: Omit<CorrectiveAction, 'id' | 'created_at' | 'updated_at'>): Promise<CorrectiveAction> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<CorrectiveAction>('POST', {
        action: 'correctiveAction',
        correctiveAction: action,
      })
    }

    const repo = await this.getRepository()
    const data = await repo.createCorrectiveAction(action)

    const context = await repo.resolveNonconformityContext(action.nonconformity_id)
    await this.logAuditEvent({
      action: 'audit.corrective_action.created',
      resourceType: 'corrective_action',
      resourceId: data.id,
      organizationId: context.organizationId,
      changes: {
        nonconformity_id: action.nonconformity_id,
        status: action.status
      }
    })

    return data
  }

  async updateCorrectiveAction(actionId: string, updates: Partial<CorrectiveAction>): Promise<CorrectiveAction> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<CorrectiveAction>('PATCH', {
        resourceType: 'correctiveAction',
        id: actionId,
        updates,
      })
    }

    const repo = await this.getRepository()
    const data = await repo.updateCorrectiveAction(actionId, updates)

    const context = data.nonconformity_id
      ? await repo.resolveNonconformityContext(data.nonconformity_id)
      : { organizationId: null }

    await this.logAuditEvent({
      action: 'audit.corrective_action.updated',
      resourceType: 'corrective_action',
      resourceId: actionId,
      organizationId: context.organizationId,
      changes: updates as Record<string, unknown>
    })

    return data
  }

  private async resolveCorrectiveActionClosureContext(actionId: string): Promise<{
    organizationId: string
    nonconformityId: string
    actionStatus: string | null
    completionDate: string | null
  }> {
    const db = getDb()
    const [row] = await db
      .select({
        organizationId: auditPlans.organizationId,
        nonconformityId: correctiveActions.nonconformityId,
        actionStatus: correctiveActions.status,
        completionDate: correctiveActions.completionDate,
      })
      .from(correctiveActions)
      .innerJoin(nonconformities, eq(correctiveActions.nonconformityId, nonconformities.id))
      .innerJoin(auditChecklists, eq(nonconformities.auditChecklistId, auditChecklists.id))
      .innerJoin(auditPlans, eq(auditChecklists.auditPlanId, auditPlans.id))
      .where(eq(correctiveActions.id, actionId))
      .limit(1)

    if (!row?.organizationId || !row.nonconformityId) {
      throw new Error('是正処置の組織情報を解決できません')
    }

    return {
      organizationId: row.organizationId,
      nonconformityId: row.nonconformityId,
      actionStatus: row.actionStatus,
      completionDate: row.completionDate,
    }
  }

  async submitCorrectiveActionClosureApproval(actionId: string, requestedBy?: string | null): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.mutateAuditApi<{ ok: boolean }>('POST', {
        action: 'submitCorrectiveActionClosureApproval',
        actionId,
      })
      return
    }

    const context = await this.resolveCorrectiveActionClosureContext(actionId)
    if (context.actionStatus !== 'completed') {
      throw new Error('完了承認申請には、是正処置が完了状態である必要があります')
    }
    if (!context.completionDate) {
      throw new Error('完了承認申請には、完了日の入力が必要です')
    }

    const existingRequests = await this.approvalService.listRequests(context.organizationId, {
      status: 'pending',
      resourceType: 'nonconformity_closure'
    })
    if (existingRequests.some(request => request.resource_id === actionId)) {
      throw new Error('是正完了の承認申請は既に開始されています')
    }

    const userId = requestedBy ?? await this.getCurrentUserId()
    const approverId = await this.resolveAuditApproverId({
      organizationId: context.organizationId,
      resourceType: 'nonconformity_closure'
    })

    await this.approvalService.createRequest({
      organization_id: context.organizationId,
      resource_type: 'nonconformity_closure',
      resource_id: actionId,
      requested_by: userId,
      approver_id: approverId
    })

    await this.logAuditEvent({
      action: 'audit.corrective_action.closure_approval_requested',
      resourceType: 'corrective_action',
      resourceId: actionId,
      organizationId: context.organizationId,
      changes: {
        nonconformity_id: context.nonconformityId,
        approver_id: approverId
      }
    })
  }

  async approveCorrectiveActionClosure(input: {
    actionId: string
    actorId: string
    comment?: string
  }): Promise<void> {
    const context = await this.resolveCorrectiveActionClosureContext(input.actionId)
    const requests = await this.approvalService.listRequests(context.organizationId, {
      status: 'pending',
      resourceType: 'nonconformity_closure'
    })
    const targetRequest = requests.find(request => request.resource_id === input.actionId)
    if (!targetRequest) {
      throw new Error('承認対象の是正完了申請が見つかりません')
    }

    await this.approvalService.approveRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      comment: input.comment
    })

    const db = getDb()
    const now = new Date().toISOString()
    await db
      .update(correctiveActions)
      .set({
        status: 'verified',
        reviewedBy: input.actorId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(correctiveActions.id, input.actionId))

    await db
      .update(nonconformities)
      .set({
        status: 'verified',
        verificationDate: now.slice(0, 10),
        verifiedBy: input.actorId,
        updatedAt: now,
      })
      .where(eq(nonconformities.id, context.nonconformityId))

    await this.logAuditEvent({
      action: 'audit.corrective_action.closure_approved',
      resourceType: 'corrective_action',
      resourceId: input.actionId,
      organizationId: context.organizationId,
      changes: {
        nonconformity_id: context.nonconformityId,
        approved_by: input.actorId,
        comment: input.comment ?? null,
        status: 'verified'
      }
    })
    await this.logAuditEvent({
      action: 'audit.nonconformity.verified',
      resourceType: 'nonconformity',
      resourceId: context.nonconformityId,
      organizationId: context.organizationId,
      changes: {
        corrective_action_id: input.actionId,
        verified_by: input.actorId,
        status: 'verified'
      }
    })
  }

  async rejectCorrectiveActionClosure(input: {
    actionId: string
    actorId: string
    reason: string
  }): Promise<void> {
    const context = await this.resolveCorrectiveActionClosureContext(input.actionId)
    const requests = await this.approvalService.listRequests(context.organizationId, {
      status: 'pending',
      resourceType: 'nonconformity_closure'
    })
    const targetRequest = requests.find(request => request.resource_id === input.actionId)
    if (!targetRequest) {
      throw new Error('却下対象の是正完了申請が見つかりません')
    }

    await this.approvalService.rejectRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      reason: input.reason
    })

    await this.logAuditEvent({
      action: 'audit.corrective_action.closure_rejected',
      resourceType: 'corrective_action',
      resourceId: input.actionId,
      organizationId: context.organizationId,
      changes: {
        nonconformity_id: context.nonconformityId,
        rejected_by: input.actorId,
        reason: input.reason
      }
    })
  }

  // =====================================================
  // 監査証跡管理
  // =====================================================

  async uploadEvidence(
    checklistId: string,
    file: File,
    uploadedBy: string,
    description?: string
  ): Promise<AuditEvidence> {
    const repo = await this.getRepository()

    // Get context for storage and quota check
    const context = await repo.resolveChecklistContext(checklistId)

    if (!context.organizationId) {
      throw new Error('監査チェックリストの取得に失敗しました。画面を再読み込みしてからやり直してください。')
    }

    await this.storageQuota.ensureUploadAllowed(context.organizationId, file)

    const filePath = `${context.organizationId}/${checklistId}/${Date.now()}_${file.name}`

    // Upload to Storage
    const storage = getStorageProvider()
    const { error: uploadError } = await storage.upload('audit-evidence', filePath, file)

    if (uploadError) throw uploadError

    // Create evidence record
    const data = await repo.createEvidence({
      audit_checklist_id: checklistId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      description,
      uploaded_by: uploadedBy
    })

    await this.logAuditEvent({
      action: 'audit.evidence.uploaded',
      resourceType: 'audit_evidence',
      resourceId: data.id,
      organizationId: context.organizationId,
      changes: {
        audit_checklist_id: checklistId,
        file_name: file.name,
        file_path: filePath
      }
    })

    return data
  }

  async deleteEvidence(evidenceId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.mutateAuditApi<{ ok: boolean }>('POST', {
        action: 'deleteEvidence',
        evidenceId,
      })
      return
    }

    // Get evidence info before deletion
    const db = getDb()
    const [evidence] = await db
      .select({
        filePath: auditEvidence.filePath,
        fileName: auditEvidence.fileName,
        auditChecklistId: auditEvidence.auditChecklistId,
      })
      .from(auditEvidence)
      .where(eq(auditEvidence.id, evidenceId))
      .limit(1)

    if (!evidence) throw new Error('監査証跡が見つかりません')

    const repo = await this.getRepository()

    // Get organization context
    let organizationId: string | null = null
    if (evidence?.auditChecklistId) {
      const context = await repo.resolveChecklistContext(evidence.auditChecklistId)
      organizationId = context.organizationId
    }

    // Delete from Storage
    if (evidence?.filePath) {
      const storage = getStorageProvider()
      const { error: deleteStorageError } = await storage.remove('audit-evidence', [evidence.filePath])

      if (deleteStorageError) throw deleteStorageError
    }

    // Delete record
    await repo.deleteEvidence(evidenceId)

    await this.logAuditEvent({
      action: 'audit.evidence.deleted',
      resourceType: 'audit_evidence',
      resourceId: evidenceId,
      organizationId,
      changes: {
        audit_checklist_id: evidence?.auditChecklistId,
        file_name: evidence?.fileName
      }
    })
  }

  async getEvidenceUrl(filePath: string): Promise<string> {
    const storage = getStorageProvider()
    const { signedUrl, error } = await storage.getSignedUrl('audit-evidence', filePath, 60 * 60)

    if (error || !signedUrl) {
      console.error('Failed to create signed URL for audit evidence', error)
      throw error ?? new Error('Failed to create signed URL')
    }

    return signedUrl
  }

  // =====================================================
  // レポート管理
  // =====================================================

  async getAuditReportsList(
    organizationId: string,
    filters?: { status?: AuditStatus | ''; period?: string | null; search?: string; auditType?: AuditType | '' }
  ): Promise<AuditReportListItem[]> {
    const repo = await this.getRepository()
    return repo.getAuditReportsList(organizationId, filters)
  }

  async createAuditReport(report: Omit<AuditReport, 'id' | 'created_at' | 'updated_at'>): Promise<AuditReport> {
    const repo = await this.getRepository()
    const data = await repo.createAuditReport(report)

    const organizationId = report.audit_plan_id
      ? await repo.resolvePlanOrganizationId(report.audit_plan_id)
      : null
    await this.logAuditEvent({
      action: 'audit.report.created',
      resourceType: 'audit_report',
      resourceId: data.id,
      organizationId,
      changes: {
        audit_plan_id: report.audit_plan_id,
        report_date: report.report_date
      }
    })

    return data
  }

  async updateAuditReport(reportId: string, updates: Partial<AuditReport>): Promise<AuditReport> {
    const repo = await this.getRepository()
    let normalizedUpdates = { ...updates }
    const db = getDb()
    const [previousReport] = await db
      .select({ approvalStatus: auditReports.approvalStatus })
      .from(auditReports)
      .where(eq(auditReports.id, reportId))
      .limit(1)
    const contentFields: (keyof AuditReport)[] = [
      'executive_summary',
      'scope',
      'methodology',
      'positive_findings',
      'improvement_opportunities',
      'conclusion',
      'report_date',
    ]
    const revisesRejectedReport = previousReport?.approvalStatus === 'rejected'
      && normalizedUpdates.approval_status === undefined
      && contentFields.some(field => Object.prototype.hasOwnProperty.call(normalizedUpdates, field))

    if (revisesRejectedReport) {
      normalizedUpdates = {
        ...normalizedUpdates,
        approval_status: 'draft',
        rejection_reason: null,
        approved_by: null,
        approved_at: null,
      }
    }

    const data = await repo.updateAuditReport(reportId, normalizedUpdates)

    const organizationId = data.audit_plan_id
      ? await repo.resolvePlanOrganizationId(data.audit_plan_id)
      : null

    await this.logAuditEvent({
      action: 'audit.report.updated',
      resourceType: 'audit_report',
      resourceId: reportId,
      organizationId,
      changes: normalizedUpdates as Record<string, unknown>
    })

    if (revisesRejectedReport) {
      await this.logAuditEvent({
        action: 'audit.report.revised',
        resourceType: 'audit_report',
        resourceId: reportId,
        organizationId,
        changes: { previous_status: 'rejected', next_status: 'draft' }
      })
    }

    return data
  }

  // =====================================================
  // 承認ワークフロー連携
  // =====================================================

  /**
   * Submit an audit plan for approval.
   * Creates a pending approval_request for the audit plan.
   */
  async submitAuditPlanForApproval(planId: string, requestedBy?: string | null): Promise<void> {
    const repo = await this.getRepository()
    const plan = await repo.findById(planId)
    if (!plan) throw new Error('監査計画が見つかりません')

    const userId = requestedBy ?? await this.getCurrentUserId()
    const approverId = await this.resolveAuditApproverId({
      organizationId: plan.organization_id,
      resourceType: 'audit_plan'
    })

    const existingRequests = await this.approvalService.listRequests(plan.organization_id, {
      status: 'pending',
      resourceType: 'audit_plan'
    })
    if (existingRequests.some(request => request.resource_id === planId)) {
      throw new Error('監査計画の承認申請は既に開始されています')
    }

    await this.approvalService.createRequest({
      organization_id: plan.organization_id,
      resource_type: 'audit_plan',
      resource_id: plan.id,
      requested_by: userId,
      approver_id: approverId
    })

    await this.logAuditEvent({
      action: 'audit.plan.approval_requested',
      resourceType: 'audit_plan',
      resourceId: plan.id,
      organizationId: plan.organization_id,
      changes: { approver_id: approverId }
    })
  }

  /**
   * Approve an audit plan.
   * Updates approval_request status and transitions the plan to 'scheduled'.
   */
  async approveAuditPlan(input: {
    planId: string
    actorId: string
    comment?: string
  }): Promise<void> {
    const repo = await this.getRepository()
    const plan = await repo.findById(input.planId)
    if (!plan) throw new Error('監査計画が見つかりません')

    const requests = await this.approvalService.listRequests(plan.organization_id, {
      status: 'pending',
      resourceType: 'audit_plan'
    })
    const targetRequest = requests.find(r => r.resource_id === input.planId)
    if (!targetRequest) {
      throw new Error('承認対象の監査計画が見つかりません')
    }

    await this.approvalService.approveRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      comment: input.comment
    })

    // Transition audit plan status to scheduled upon approval
    await repo.updateAuditPlan(input.planId, { status: 'scheduled' })

    await this.logAuditEvent({
      action: 'audit.plan.approved',
      resourceType: 'audit_plan',
      resourceId: input.planId,
      organizationId: plan.organization_id,
      changes: { approved_by: input.actorId, status: 'scheduled' }
    })
  }

  /**
   * Reject an audit plan.
   * Updates approval_request status. Plan status remains unchanged.
   */
  async rejectAuditPlan(input: {
    planId: string
    actorId: string
    reason: string
  }): Promise<void> {
    const repo = await this.getRepository()
    const plan = await repo.findById(input.planId)
    if (!plan) throw new Error('監査計画が見つかりません')

    const requests = await this.approvalService.listRequests(plan.organization_id, {
      status: 'pending',
      resourceType: 'audit_plan'
    })
    const targetRequest = requests.find(r => r.resource_id === input.planId)
    if (!targetRequest) {
      throw new Error('却下対象の監査計画が見つかりません')
    }

    await this.approvalService.rejectRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      reason: input.reason
    })

    await this.logAuditEvent({
      action: 'audit.plan.rejected',
      resourceType: 'audit_plan',
      resourceId: input.planId,
      organizationId: plan.organization_id,
      changes: { rejected_by: input.actorId, reason: input.reason }
    })
  }

  /**
   * Submit an audit report for approval.
   * Sets the report approval_status to 'submitted' and creates an approval_request.
   */
  async submitAuditReportForApproval(reportId: string, requestedBy?: string | null): Promise<void> {
    const db = getDb()
    const [report] = await db
      .select({ id: auditReports.id, auditPlanId: auditReports.auditPlanId })
      .from(auditReports)
      .where(eq(auditReports.id, reportId))
      .limit(1)

    if (!report) throw new Error('監査報告書が見つかりません')

    const repo = await this.getRepository()
    const organizationId = report.auditPlanId
      ? await repo.resolvePlanOrganizationId(report.auditPlanId)
      : null

    if (!organizationId) throw new Error('組織IDの解決に失敗しました')

    const userId = requestedBy ?? await this.getCurrentUserId()
    const approverId = await this.resolveAuditApproverId({
      organizationId,
      resourceType: 'audit_report'
    })

    const existingRequests = await this.approvalService.listRequests(organizationId, {
      status: 'pending',
      resourceType: 'audit_report'
    })
    if (existingRequests.some(request => request.resource_id === reportId)) {
      throw new Error('監査報告書の承認申請は既に開始されています')
    }

    // Update report status to submitted
    await repo.updateAuditReport(reportId, { approval_status: 'submitted' })

    await this.approvalService.createRequest({
      organization_id: organizationId,
      resource_type: 'audit_report',
      resource_id: reportId,
      requested_by: userId,
      approver_id: approverId
    })

    await this.logAuditEvent({
      action: 'audit.report.approval_requested',
      resourceType: 'audit_report',
      resourceId: reportId,
      organizationId,
      changes: { approver_id: approverId }
    })
  }

  /**
   * Approve an audit report.
   * Updates approval_request status and sets report approval_status to 'approved'.
   */
  async approveAuditReport(input: {
    reportId: string
    actorId: string
    comment?: string
  }): Promise<void> {
    const db = getDb()
    const [report] = await db
      .select({ id: auditReports.id, auditPlanId: auditReports.auditPlanId })
      .from(auditReports)
      .where(eq(auditReports.id, input.reportId))
      .limit(1)

    if (!report) throw new Error('監査報告書が見つかりません')

    const repo = await this.getRepository()
    const organizationId = report.auditPlanId
      ? await repo.resolvePlanOrganizationId(report.auditPlanId)
      : null

    if (!organizationId) throw new Error('組織IDの解決に失敗しました')

    const requests = await this.approvalService.listRequests(organizationId, {
      status: 'pending',
      resourceType: 'audit_report'
    })
    const targetRequest = requests.find(r => r.resource_id === input.reportId)
    if (!targetRequest) {
      throw new Error('承認対象の監査報告書が見つかりません')
    }

    await this.approvalService.approveRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      comment: input.comment
    })

    await repo.updateAuditReport(input.reportId, {
      approval_status: 'approved',
      approved_by: input.actorId,
      approved_at: new Date().toISOString()
    })

    await this.logAuditEvent({
      action: 'audit.report.approved',
      resourceType: 'audit_report',
      resourceId: input.reportId,
      organizationId,
      changes: { approved_by: input.actorId }
    })
  }

  /**
   * Reject an audit report.
   * Updates approval_request status and sets report approval_status to 'rejected'.
   */
  async rejectAuditReport(input: {
    reportId: string
    actorId: string
    reason: string
  }): Promise<void> {
    const db = getDb()
    const [report] = await db
      .select({ id: auditReports.id, auditPlanId: auditReports.auditPlanId })
      .from(auditReports)
      .where(eq(auditReports.id, input.reportId))
      .limit(1)

    if (!report) throw new Error('監査報告書が見つかりません')

    const repo = await this.getRepository()
    const organizationId = report.auditPlanId
      ? await repo.resolvePlanOrganizationId(report.auditPlanId)
      : null

    if (!organizationId) throw new Error('組織IDの解決に失敗しました')

    const requests = await this.approvalService.listRequests(organizationId, {
      status: 'pending',
      resourceType: 'audit_report'
    })
    const targetRequest = requests.find(r => r.resource_id === input.reportId)
    if (!targetRequest) {
      throw new Error('却下対象の監査報告書が見つかりません')
    }

    await this.approvalService.rejectRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      reason: input.reason
    })

    await repo.updateAuditReport(input.reportId, {
      approval_status: 'rejected',
      rejection_reason: input.reason
    })

    await this.logAuditEvent({
      action: 'audit.report.rejected',
      resourceType: 'audit_report',
      resourceId: input.reportId,
      organizationId,
      changes: { rejected_by: input.actorId, reason: input.reason }
    })
  }

  // =====================================================
  // フォローアップ管理
  // =====================================================

  /**
   * 監査計画に紐づくフォローアップ一覧取得
   */
  async getFollowUpRecords(auditPlanId: string): Promise<FollowUpRecord[]> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        action: 'followUps',
        planId: auditPlanId,
      })
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('フォローアップ記録の取得に失敗しました')
      }
      return response.json()
    }

    try {
      const db = getDb()
      const rows = await db
        .select()
        .from(followUpRecords)
        .where(eq(followUpRecords.auditPlanId, auditPlanId))
        .orderBy(desc(followUpRecords.createdAt))

      // Enrich with assigned_user and verifier
      const result: FollowUpRecord[] = []
      for (const row of rows) {
        let assignedUser: { id: string; full_name: string | null; email: string } | null = null
        let verifier: { id: string; full_name: string | null; email: string } | null = null

        if (row.assignedTo) {
          const [u] = await db
            .select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email })
            .from(userProfiles)
            .where(eq(userProfiles.id, row.assignedTo))
            .limit(1)
          if (u) assignedUser = { id: u.id, full_name: u.fullName, email: u.email }
        }

        if (row.verifiedBy) {
          const [v] = await db
            .select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email })
            .from(userProfiles)
            .where(eq(userProfiles.id, row.verifiedBy))
            .limit(1)
          if (v) verifier = { id: v.id, full_name: v.fullName, email: v.email }
        }

        result.push({
          id: row.id,
          organization_id: row.organizationId,
          audit_plan_id: row.auditPlanId,
          nonconformity_id: row.nonconformityId ?? null,
          title: row.title,
          description: row.description ?? null,
          assigned_to: row.assignedTo ?? null,
          status: row.status as FollowUpRecord['status'],
          due_date: row.dueDate ?? null,
          completed_at: row.completedAt ?? null,
          verified_at: row.verifiedAt ?? null,
          verified_by: row.verifiedBy ?? null,
          created_by: row.createdBy,
          created_at: row.createdAt ?? '',
          updated_at: row.updatedAt ?? '',
          assigned_user: assignedUser,
          verifier,
        })
      }

      return result
    } catch (err) {
      console.error('[AuditService] Failed to load follow-up records', err)
      throw new Error('フォローアップ記録の取得に失敗しました')
    }
  }

  async getFollowUpRecordsByNonconformity(nonconformityId: string): Promise<FollowUpRecord[]> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        action: 'followUpsByNonconformity',
        nonconformityId,
      })
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('フォローアップ記録の取得に失敗しました')
      }
      return response.json()
    }

    const db = getDb()
    const rows = await db
      .select()
      .from(followUpRecords)
      .where(eq(followUpRecords.nonconformityId, nonconformityId))
      .orderBy(desc(followUpRecords.createdAt))

    const result: FollowUpRecord[] = []
    for (const row of rows) {
      let assignedUser: { id: string; full_name: string | null; email: string } | null = null
      let verifier: { id: string; full_name: string | null; email: string } | null = null

      if (row.assignedTo) {
        const [u] = await db
          .select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email })
          .from(userProfiles)
          .where(eq(userProfiles.id, row.assignedTo))
          .limit(1)
        if (u) assignedUser = { id: u.id, full_name: u.fullName, email: u.email }
      }

      if (row.verifiedBy) {
        const [v] = await db
          .select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email })
          .from(userProfiles)
          .where(eq(userProfiles.id, row.verifiedBy))
          .limit(1)
        if (v) verifier = { id: v.id, full_name: v.fullName, email: v.email }
      }

      result.push({
        id: row.id,
        organization_id: row.organizationId,
        audit_plan_id: row.auditPlanId,
        nonconformity_id: row.nonconformityId ?? null,
        title: row.title,
        description: row.description ?? null,
        assigned_to: row.assignedTo ?? null,
        status: row.status as FollowUpRecord['status'],
        due_date: row.dueDate ?? null,
        completed_at: row.completedAt ?? null,
        verified_at: row.verifiedAt ?? null,
        verified_by: row.verifiedBy ?? null,
        created_by: row.createdBy,
        created_at: row.createdAt ?? '',
        updated_at: row.updatedAt ?? '',
        assigned_user: assignedUser,
        verifier,
      })
    }

    return result
  }

  /**
   * フォローアップ記録作成
   */
  async createFollowUpRecord(input: {
    auditPlanId: string
    nonconformityId?: string
    title: string
    description?: string
    assignedTo?: string
    dueDate?: string
  }): Promise<FollowUpRecord> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<FollowUpRecord>('POST', {
        action: 'followUp',
        followUp: {
          audit_plan_id: input.auditPlanId,
          nonconformity_id: input.nonconformityId,
          title: input.title,
          description: input.description,
          assigned_to: input.assignedTo,
          due_date: input.dueDate,
        },
      })
    }

    const [userId, organizationId] = await Promise.all([
      this.getCurrentUserId(),
      this.getCurrentOrganizationId()
    ])

    if (!userId || !organizationId) {
      throw new Error('ユーザー情報または組織情報が取得できません')
    }

    try {
      const db = getDb()
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      await db.insert(followUpRecords).values({
        id,
        organizationId,
        auditPlanId: input.auditPlanId,
        nonconformityId: input.nonconformityId ?? null,
        title: input.title,
        description: input.description ?? null,
        assignedTo: input.assignedTo ?? null,
        status: 'open',
        dueDate: input.dueDate ?? null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })

      const [row] = await db
        .select()
        .from(followUpRecords)
        .where(eq(followUpRecords.id, id))
        .limit(1)

      if (!row) {
        throw new Error('フォローアップ記録の作成に失敗しました')
      }

      await this.logAuditEvent({
        action: 'audit.follow_up.created',
        resourceType: 'follow_up_record',
        resourceId: id,
        organizationId,
        changes: { title: input.title, audit_plan_id: input.auditPlanId }
      })

      if (input.assignedTo) {
        await NotificationService.createAuditFollowUpAssignment(
          organizationId,
          input.assignedTo,
          input.title,
          id,
          input.auditPlanId,
          input.nonconformityId ?? null,
          input.dueDate ?? null
        )
      }

      return {
        id: row.id,
        organization_id: row.organizationId,
        audit_plan_id: row.auditPlanId,
        nonconformity_id: row.nonconformityId ?? null,
        title: row.title,
        description: row.description ?? null,
        assigned_to: row.assignedTo ?? null,
        status: row.status as FollowUpRecord['status'],
        due_date: row.dueDate ?? null,
        completed_at: row.completedAt ?? null,
        verified_at: row.verifiedAt ?? null,
        verified_by: row.verifiedBy ?? null,
        created_by: row.createdBy,
        created_at: row.createdAt ?? '',
        updated_at: row.updatedAt ?? '',
      }
    } catch (err) {
      console.error('[AuditService] Failed to create follow-up record', err)
      throw err instanceof Error ? err : new Error('フォローアップ記録の作成に失敗しました')
    }
  }

  /**
   * フォローアップ記録更新
   */
  async updateFollowUpRecord(
    id: string,
    updates: Partial<{
      title: string
      description: string | null
      assignedTo: string | null
      status: string
      dueDate: string | null
    }>
  ): Promise<FollowUpRecord> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<FollowUpRecord>('PATCH', {
        resourceType: 'followUpRecord',
        id,
        updates,
      })
    }

    const db = getDb()
    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = { updatedAt: now }
    if (updates.title !== undefined) updatePayload.title = updates.title
    if (updates.description !== undefined) updatePayload.description = updates.description
    if (updates.assignedTo !== undefined) updatePayload.assignedTo = updates.assignedTo
    if (updates.status !== undefined) updatePayload.status = updates.status
    if (updates.dueDate !== undefined) updatePayload.dueDate = updates.dueDate

    await db
      .update(followUpRecords)
      .set(updatePayload)
      .where(eq(followUpRecords.id, id))

    const [row] = await db
      .select()
      .from(followUpRecords)
      .where(eq(followUpRecords.id, id))
      .limit(1)

    if (!row) {
      throw new Error('フォローアップ記録の更新に失敗しました')
    }

    const organizationId = row.organizationId ?? (await this.getCurrentOrganizationId())
    await this.logAuditEvent({
      action: 'audit.follow_up.updated',
      resourceType: 'follow_up_record',
      resourceId: id,
      organizationId,
      changes: updates as Record<string, unknown>
    })

    return {
      id: row.id,
      organization_id: row.organizationId,
      audit_plan_id: row.auditPlanId,
      nonconformity_id: row.nonconformityId ?? null,
      title: row.title,
      description: row.description ?? null,
      assigned_to: row.assignedTo ?? null,
      status: row.status as FollowUpRecord['status'],
      due_date: row.dueDate ?? null,
      completed_at: row.completedAt ?? null,
      verified_at: row.verifiedAt ?? null,
      verified_by: row.verifiedBy ?? null,
      created_by: row.createdBy,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  /**
   * フォローアップ記録を完了にする
   */
  async completeFollowUpRecord(id: string): Promise<FollowUpRecord> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<FollowUpRecord>('PATCH', {
        resourceType: 'followUpRecord',
        id,
        updates: { status: 'completed' },
      })
    }

    const db = getDb()
    const now = new Date().toISOString()

    await db
      .update(followUpRecords)
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where(eq(followUpRecords.id, id))

    const [row] = await db
      .select()
      .from(followUpRecords)
      .where(eq(followUpRecords.id, id))
      .limit(1)

    if (!row) {
      throw new Error('フォローアップ記録の完了処理に失敗しました')
    }

    const organizationId = row.organizationId ?? (await this.getCurrentOrganizationId())
    await this.logAuditEvent({
      action: 'audit.follow_up.completed',
      resourceType: 'follow_up_record',
      resourceId: id,
      organizationId,
      changes: { status: 'completed', completed_at: now }
    })

    return {
      id: row.id,
      organization_id: row.organizationId,
      audit_plan_id: row.auditPlanId,
      nonconformity_id: row.nonconformityId ?? null,
      title: row.title,
      description: row.description ?? null,
      assigned_to: row.assignedTo ?? null,
      status: row.status as FollowUpRecord['status'],
      due_date: row.dueDate ?? null,
      completed_at: row.completedAt ?? null,
      verified_at: row.verifiedAt ?? null,
      verified_by: row.verifiedBy ?? null,
      created_by: row.createdBy,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  /**
   * フォローアップ記録を検証済みにする
   */
  async verifyFollowUpRecord(id: string): Promise<FollowUpRecord> {
    if (typeof window !== 'undefined') {
      return this.mutateAuditApi<FollowUpRecord>('PATCH', {
        resourceType: 'followUpRecord',
        id,
        updates: { status: 'verified' },
      })
    }

    const db = getDb()
    const now = new Date().toISOString()
    const userId = await this.getCurrentUserId()

    await db
      .update(followUpRecords)
      .set({
        status: 'verified',
        verifiedAt: now,
        verifiedBy: userId,
        updatedAt: now,
      })
      .where(eq(followUpRecords.id, id))

    const [row] = await db
      .select()
      .from(followUpRecords)
      .where(eq(followUpRecords.id, id))
      .limit(1)

    if (!row) {
      throw new Error('フォローアップ記録の検証処理に失敗しました')
    }

    const organizationId = row.organizationId ?? (await this.getCurrentOrganizationId())
    await this.logAuditEvent({
      action: 'audit.follow_up.verified',
      resourceType: 'follow_up_record',
      resourceId: id,
      organizationId,
      changes: { status: 'verified', verified_at: now, verified_by: userId }
    })

    return {
      id: row.id,
      organization_id: row.organizationId,
      audit_plan_id: row.auditPlanId,
      nonconformity_id: row.nonconformityId ?? null,
      title: row.title,
      description: row.description ?? null,
      assigned_to: row.assignedTo ?? null,
      status: row.status as FollowUpRecord['status'],
      due_date: row.dueDate ?? null,
      completed_at: row.completedAt ?? null,
      verified_at: row.verifiedAt ?? null,
      verified_by: row.verifiedBy ?? null,
      created_by: row.createdBy,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  // =====================================================
  // 統計情報
  // =====================================================

  async getAuditStatistics(
    organizationId: string,
    filters?: { period?: string | null }
  ): Promise<AuditStatistics> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        action: 'statistics',
        organizationId,
      })
      if (filters?.period) params.set('period', filters.period)
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('監査統計の取得に失敗しました')
      }
      return response.json()
    }

    const repo = await this.getRepository()
    return repo.getAuditStatistics(organizationId, filters)
  }
}

/**
 * フォローアップ記録の型
 */
export interface FollowUpRecord {
  id: string
  organization_id: string
  audit_plan_id: string
  nonconformity_id: string | null
  title: string
  description: string | null
  assigned_to: string | null
  status: 'open' | 'in_progress' | 'completed' | 'verified' | 'closed'
  due_date: string | null
  completed_at: string | null
  verified_at: string | null
  verified_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  assigned_user?: { id: string; full_name: string | null; email: string } | null
  verifier?: { id: string; full_name: string | null; email: string } | null
}
