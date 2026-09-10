import { and, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  approvalRequests,
  auditChecklists,
  auditPlans,
  auditTeamMembers,
  documents,
  educationPlans,
  educationRecords,
  nonconformities,
  risks,
  tasks,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import type { UserRole } from '@/lib/db/drizzle/schema/users'
import { ApprovalService, type ApprovalQueueItem } from '@/lib/services/approval'
import { ActivityService } from '@/lib/services/activity'
import { enrichApprovalQueueItems } from '@/lib/server/approvalQueueContext'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'

const DAY_MS = 24 * 60 * 60 * 1000
export const APPROVAL_DUE_SOON_HOURS = 24
export const APPROVAL_HISTORY_WINDOW_DAYS = 7

export interface RoleDashboardTask {
  id: string
  title: string
  status: string
  priority: string
  dueAt: string | null
  progress: number
}

export interface RoleDashboardDocument {
  id: string
  title: string
  version: number
  status: string
  updatedAt: string | null
}

export interface RoleDashboardTraining {
  id: string
  title: string
  endAt: string | null
  result: string
  progress: number
}

export interface RoleDashboardAudit {
  id: string
  title: string
  status: string
  plannedStartAt: string | null
  plannedEndAt: string | null
  checklistTotal: number
  checklistCompleted: number
}

export interface RoleDashboardActivity {
  id: string
  action: string
  resourceType: string
  resourceLabel: string | null
  actorName: string | null
  createdAt: string | null
}

export interface ApproverRoleDashboardMetrics {
  pendingCount: number
  dueSoonCount: number
  escalationCount: number
  historyCount: number
  dueSoonHours: number
  escalationHours: number
  historyWindowDays: number
  lastRefreshedAt: string
}

export type HomeRoleDashboard =
  | {
      role: 'user'
      tasks: RoleDashboardTask[]
      documents: RoleDashboardDocument[]
      training: RoleDashboardTraining[]
    }
  | {
      role: 'approver'
      metrics: ApproverRoleDashboardMetrics
    }
  | {
      role: 'auditor'
      audits: RoleDashboardAudit[]
      findings: {
        majorOpenCount: number
        minorOpenCount: number
      }
    }
  | {
      role: 'org_admin' | 'system_operator'
      metrics: {
        activeUserCount: number
        pendingApprovalCount: number
        openRiskCount: number
        overdueTaskCount: number
      }
      activities: RoleDashboardActivity[]
    }

export function isApprovalDueSoon(dueAt: string | null, nowMs: number): boolean {
  if (!dueAt) return false
  const dueTime = new Date(dueAt).getTime()
  return Number.isFinite(dueTime)
    && dueTime >= nowMs
    && dueTime - nowMs <= APPROVAL_DUE_SOON_HOURS * 60 * 60 * 1000
}

export function buildApproverRoleDashboardMetrics(
  queue: ApprovalQueueItem[],
  now = new Date()
): ApproverRoleDashboardMetrics {
  const nowMs = now.getTime()
  const historyStart = nowMs - APPROVAL_HISTORY_WINDOW_DAYS * DAY_MS

  return {
    pendingCount: queue.filter(item => item.status === 'pending').length,
    dueSoonCount: queue.filter(item => (
      item.status === 'pending' && isApprovalDueSoon(item.due_at, nowMs)
    )).length,
    escalationCount: queue.filter(item => (
      item.status === 'pending' && Boolean(item.escalation_notified_at)
    )).length,
    historyCount: queue.filter(item => {
      if (item.status !== 'approved' && item.status !== 'rejected') return false
      const updatedAt = new Date(item.updated_at).getTime()
      return Number.isFinite(updatedAt) && updatedAt >= historyStart && updatedAt <= nowMs
    }).length,
    dueSoonHours: APPROVAL_DUE_SOON_HOURS,
    escalationHours: APPROVAL_DUE_SOON_HOURS,
    historyWindowDays: APPROVAL_HISTORY_WINDOW_DAYS,
    lastRefreshedAt: now.toISOString(),
  }
}

export async function listApprovedDocumentsForUserDashboard(
  db: ReturnType<typeof getDb>,
  authorization: Pick<TenantAuthorizationContext, 'organizationId' | 'departmentAccess'>
): Promise<RoleDashboardDocument[]> {
  const departmentCondition = authorization.departmentAccess.mode === 'scoped'
    ? and(
        isNotNull(userProfiles.id),
        or(
          authorization.departmentAccess.departmentIds.length > 0
            ? inArray(
                userProfiles.primaryDepartmentId,
                authorization.departmentAccess.departmentIds
              )
            : undefined,
          isNull(userProfiles.primaryDepartmentId)
        )
      )
    : undefined
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      version: documents.versionNumber,
      status: documents.status,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(
      userProfiles,
      and(
        eq(documents.createdBy, userProfiles.id),
        eq(userProfiles.organizationId, authorization.organizationId)
      )
    )
    .where(and(
      eq(documents.organizationId, authorization.organizationId),
      eq(documents.status, 'approved'),
      departmentCondition
    ))
    .orderBy(desc(documents.updatedAt))
    .limit(20)

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    version: row.version ?? 1,
    status: row.status ?? 'approved',
    updatedAt: row.updatedAt ?? null,
  }))
}

async function buildUserDashboard(
  authorization: TenantAuthorizationContext
): Promise<HomeRoleDashboard> {
  const db = getDb()
  const [taskRows, documentRows, trainingRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueDate,
        progress: tasks.progress,
      })
      .from(tasks)
      .where(and(
        eq(tasks.organizationId, authorization.organizationId),
        eq(tasks.assigneeId, authorization.userId)
      ))
      .orderBy(desc(tasks.updatedAt))
      .limit(20),
    listApprovedDocumentsForUserDashboard(db, authorization),
    db
      .select({
        id: educationPlans.id,
        title: educationPlans.title,
        endAt: educationPlans.endDate,
        result: educationRecords.result,
        score: educationRecords.score,
        completedAt: educationRecords.completedAt,
      })
      .from(educationRecords)
      .innerJoin(educationPlans, eq(educationRecords.planId, educationPlans.id))
      .where(and(
        eq(educationPlans.organizationId, authorization.organizationId),
        eq(educationRecords.attendeeId, authorization.userId)
      ))
      .orderBy(desc(educationPlans.endDate))
      .limit(20),
  ])

  return {
    role: 'user',
    tasks: taskRows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status ?? 'todo',
      priority: row.priority ?? 'medium',
      dueAt: row.dueAt ?? null,
      progress: row.progress ?? 0,
    })),
    documents: documentRows,
    training: trainingRows.map(row => ({
      id: row.id,
      title: row.title,
      endAt: row.endAt ?? null,
      result: row.result ?? 'pending',
      progress: row.completedAt || row.result === 'passed'
        ? 100
        : Math.min(Math.max(row.score ?? 0, 0), 100),
    })),
  }
}

async function buildApproverDashboard(
  authorization: TenantAuthorizationContext
): Promise<HomeRoleDashboard> {
  const requests = await new ApprovalService().listRequests(
    authorization.organizationId,
    { approverId: authorization.userId }
  )
  const queue = await enrichApprovalQueueItems(requests, authorization)

  return {
    role: 'approver',
    metrics: buildApproverRoleDashboardMetrics(queue),
  }
}

async function buildAuditorDashboard(
  authorization: TenantAuthorizationContext
): Promise<HomeRoleDashboard> {
  const db = getDb()
  const teamRows = await db
    .select({ auditPlanId: auditTeamMembers.auditPlanId })
    .from(auditTeamMembers)
    .where(eq(auditTeamMembers.userId, authorization.userId))
  const teamPlanIds = teamRows
    .map(row => row.auditPlanId)
    .filter((id): id is string => Boolean(id))
  const planRows = await db
    .select({
      id: auditPlans.id,
      title: auditPlans.title,
      status: auditPlans.status,
      plannedStartAt: auditPlans.plannedStartDate,
      plannedEndAt: auditPlans.plannedEndDate,
    })
    .from(auditPlans)
    .where(and(
      eq(auditPlans.organizationId, authorization.organizationId),
      or(
        eq(auditPlans.leadAuditorId, authorization.userId),
        teamPlanIds.length > 0 ? inArray(auditPlans.id, teamPlanIds) : undefined
      )
    ))
    .orderBy(desc(auditPlans.plannedStartDate))
    .limit(20)
  const planIds = planRows.map(row => row.id)
  const checklistRows = planIds.length > 0
    ? await db
        .select({
          id: auditChecklists.id,
          auditPlanId: auditChecklists.auditPlanId,
          status: auditChecklists.status,
        })
        .from(auditChecklists)
        .where(inArray(auditChecklists.auditPlanId, planIds))
    : []
  const findingRows = planIds.length > 0
    ? await db
        .select({
          type: nonconformities.type,
          status: nonconformities.status,
        })
        .from(nonconformities)
        .innerJoin(auditChecklists, eq(nonconformities.auditChecklistId, auditChecklists.id))
        .where(inArray(auditChecklists.auditPlanId, planIds))
    : []

  return {
    role: 'auditor',
    audits: planRows.map(plan => {
      const checklist = checklistRows.filter(row => row.auditPlanId === plan.id)
      return {
        id: plan.id,
        title: plan.title,
        status: plan.status ?? 'planning',
        plannedStartAt: plan.plannedStartAt ?? null,
        plannedEndAt: plan.plannedEndAt ?? null,
        checklistTotal: checklist.length,
        checklistCompleted: checklist.filter(row => row.status === 'completed').length,
      }
    }),
    findings: {
      majorOpenCount: findingRows.filter(row => (
        row.type === 'major' && !['closed', 'verified'].includes(row.status ?? '')
      )).length,
      minorOpenCount: findingRows.filter(row => (
        row.type === 'minor' && !['closed', 'verified'].includes(row.status ?? '')
      )).length,
    },
  }
}

async function buildAdminDashboard(
  authorization: TenantAuthorizationContext,
  role: 'org_admin' | 'system_operator'
): Promise<HomeRoleDashboard> {
  const db = getDb()
  const now = new Date()
  const [activeUsers, pendingApprovals, riskRows, taskRows, activityRows] = await Promise.all([
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userMemberships.userId, userProfiles.id))
      .where(and(
        eq(userMemberships.organizationId, authorization.organizationId),
        eq(userMemberships.status, 'active'),
        eq(userProfiles.isActive, true)
      )),
    db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.organizationId, authorization.organizationId),
        eq(approvalRequests.status, 'pending')
      )),
    db
      .select({ status: risks.status })
      .from(risks)
      .where(eq(risks.organizationId, authorization.organizationId)),
    db
      .select({ status: tasks.status, dueAt: tasks.dueDate })
      .from(tasks)
      .where(eq(tasks.organizationId, authorization.organizationId)),
    new ActivityService().getRecentActivity({
      organizationId: authorization.organizationId,
      limit: 10,
    }),
  ])

  return {
    role,
    metrics: {
      activeUserCount: activeUsers.length,
      pendingApprovalCount: pendingApprovals.length,
      openRiskCount: riskRows.filter(row => row.status !== 'closed').length,
      overdueTaskCount: taskRows.filter(row => {
        if (!row.dueAt || ['done', 'cancelled'].includes(row.status ?? '')) return false
        const dueAt = new Date(row.dueAt).getTime()
        return Number.isFinite(dueAt) && dueAt < now.getTime()
      }).length,
    },
    activities: activityRows.map(row => ({
      id: row.id,
      action: row.action,
      resourceType: row.resource_type,
      resourceLabel: row.resource_label ?? null,
      actorName: row.actor?.full_name ?? row.actor?.email ?? null,
      createdAt: row.created_at,
    })),
  }
}

export async function buildHomeRoleDashboard(
  authorization: TenantAuthorizationContext
): Promise<HomeRoleDashboard> {
  const role = authorization.role as UserRole
  switch (role) {
    case 'user':
      return buildUserDashboard(authorization)
    case 'approver':
      return buildApproverDashboard(authorization)
    case 'auditor':
      return buildAuditorDashboard(authorization)
    case 'org_admin':
    case 'system_operator':
      return buildAdminDashboard(authorization, role)
    default:
      throw new Error('Unsupported tenant role')
  }
}
