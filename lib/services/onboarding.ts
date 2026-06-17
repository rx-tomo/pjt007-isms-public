import { getDb } from '@/lib/db/drizzle/client'
import {
  organizations,
  organizationIsmsScopes,
  organizationDepartments,
  documents,
  userProfiles,
  projectRoles,
  projectAssignments,
  risks,
  tasks,
  auditPlans,
  organizationPhaseHistory,
} from '@/lib/db/drizzle/schema'
import { eq, desc } from 'drizzle-orm'

export type IsmsPhase = 'initial' | 'surveillance'
export type PhaseHistorySource = 'wizard' | 'settings' | 'system'

export type OnboardingStepId =
  | 'profile'
  | 'team'
  | 'structure'
  | 'departments'
  | 'scope'
  | 'documents'
  | 'tasks'
  | 'risks'
  | 'phase_scope_review'
  | 'phase_risk_cycle'
  | 'phase_task_followup'
  | 'phase_audit_readiness'
  | 'phase_management_review'

export type OnboardingStepStatus = 'not_started' | 'in_progress' | 'completed'

export interface OnboardingStep {
  id: OnboardingStepId
  status: OnboardingStepStatus
  completed: boolean
  completedAt: string | null
}

export interface OnboardingCounts {
  activeUsers: number
  structureAssignments: number
  structureRequiredRoles: number
  structureSatisfiedRoles: number
  departmentCount: number
  documentCount: number
  riskCount: number
  taskCount: number
  scopeItemCount: number
  auditPlansTotal: number
  auditPlansInProgress: number
  auditPlansCompleted: number
  correctiveTasksOpen: number
}

export interface PhaseHistoryEntry {
  id: string
  phase: IsmsPhase
  source: PhaseHistorySource
  changedBy?: { id: string; name: string | null; email: string | null } | null
  recordedAt: string
}

export interface OnboardingPhaseSummary {
  current: IsmsPhase | null
  effective: IsmsPhase
  alert: 'missing' | null
  setAt: string | null
}

export interface OnboardingProgressPeriod {
  fiscalYear: string
  label: string
  counts: OnboardingCounts
  steps: OnboardingStep[]
  totalSteps: number
  completedSteps: number
  completionRate: number
  meta: {
    profileComplete: boolean
    hasScope: boolean
  }
}

export interface OnboardingProgress {
  trialEndsAt: string | null
  phase: OnboardingPhaseSummary
  phaseHistory: PhaseHistoryEntry[]
  periods: {
    current: OnboardingProgressPeriod
    previous: OnboardingProgressPeriod | null
  }
}

// Internal row types
interface OrganizationRow {
  id: string
  name: string
  nameEn: string | null
  subscriptionPlan: string | null
  subscriptionStatus: string | null
  createdAt: string | null
  employeeCountRange: string | null
  industry: string | null
  isoCertificationStatus: string | null
  trialEndsAt: string | null
  ismsPhase: string | null
  ismsPhaseSetAt: string | null
  updatedAt: string | null
}

type ScopeRow = typeof organizationIsmsScopes.$inferSelect | null
type DepartmentRow = { id: string; createdAt: string | null; updatedAt: string | null }
type DocumentRow = { id: string; createdAt: string | null; updatedAt: string | null }
type UserProfileRow = { id: string; createdAt: string | null; isActive: boolean | null }
type ProjectRoleRow = { id: string; isRequired: boolean | null }
type ProjectAssignmentRow = { roleId: string | null; createdAt: string | null }
type RiskRow = { id: string; createdAt: string | null; assessmentPeriod: string | null }
type TaskRow = { id: string; status: string | null; createdAt: string | null; updatedAt: string | null; completedAt: string | null }
type AuditPlanRow = {
  id: string
  status: string | null
  plannedStartDate: string | null
  actualStartDate: string | null
  auditPeriod: string | null
  updatedAt: string | null
}

interface FiscalYearPeriod {
  fiscalYear: string
  label: string
  start: Date
  end: Date
}

interface BaseData {
  organization: OrganizationRow | null
  scope: ScopeRow
  departments: DepartmentRow[]
  documents: DocumentRow[]
  users: UserProfileRow[]
  projectRoles: ProjectRoleRow[]
  projectAssignments: ProjectAssignmentRow[]
  risks: RiskRow[]
  tasks: TaskRow[]
  auditPlans: AuditPlanRow[]
  phaseHistory: PhaseHistoryEntry[]
}

interface StepBuildResult {
  steps: OnboardingStep[]
  meta: {
    profileComplete: boolean
    hasScope: boolean
  }
}

const INITIAL_STEPS: OnboardingStepId[] = [
  'profile',
  'team',
  'structure',
  'departments',
  'scope',
  'documents',
  'tasks',
  'risks'
]

const SURVEILLANCE_STEPS: OnboardingStepId[] = [
  'phase_scope_review',
  'phase_risk_cycle',
  'phase_task_followup',
  'phase_audit_readiness',
  'phase_management_review'
]

const STEP_TARGETS: Partial<Record<OnboardingStepId, number>> = {
  profile: 1,
  team: 2,
  structure: 1,
  departments: 1,
  scope: 1,
  documents: 1,
  tasks: 1,
  risks: 1,
  phase_scope_review: 1,
  phase_risk_cycle: 1,
  phase_task_followup: 1,
  phase_audit_readiness: 1,
  phase_management_review: 1
}

const CORRECTIVE_STATUSES = ['in_progress', 'review'] as const
const FISCAL_YEAR_START_MONTH = 3 // April (0-indexed)

export class OnboardingService {
  async getProgress(organizationId: string): Promise<OnboardingProgress> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ organizationId })
      const response = await fetch(`/api/onboarding/progress?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? `API error ${response.status}`)
      }

      const payload = await response.json()
      return payload.data
    }

    const data = await this.fetchBaseData(organizationId)
    const phaseSummary = this.buildPhaseSummary(data.organization)

    const now = new Date()
    const currentPeriodInfo = getFiscalYearPeriod(getFiscalYearLabel(now))
    const previousPeriodInfo = getFiscalYearPeriod(currentPeriodInfo.year - 1)

    const currentPeriod = this.buildPeriodProgress({
      period: currentPeriodInfo,
      phase: phaseSummary.effective,
      data
    })

    const previousPeriod = this.buildPeriodProgress({
      period: previousPeriodInfo,
      phase: phaseSummary.effective,
      data
    })

    return {
      trialEndsAt: data.organization?.trialEndsAt ?? null,
      phase: phaseSummary,
      phaseHistory: data.phaseHistory,
      periods: {
        current: currentPeriod,
        previous: phaseSummary.effective === 'initial' ? null : previousPeriod
      }
    }
  }

  private async fetchBaseData(organizationId: string): Promise<BaseData> {
    const db = getDb()

    const [
      organizationRows,
      scopeRows,
      departmentRows,
      documentRows,
      userRows,
      projectRolesRows,
      projectAssignmentRows,
      riskRows,
      taskRows,
      auditPlanRows,
      phaseHistoryRows
    ] = await Promise.all([
      db.select({
        id: organizations.id,
        name: organizations.name,
        nameEn: organizations.nameEn,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        createdAt: organizations.createdAt,
        employeeCountRange: organizations.employeeCountRange,
        industry: organizations.industry,
        isoCertificationStatus: organizations.isoCertificationStatus,
        trialEndsAt: organizations.trialEndsAt,
        ismsPhase: organizations.ismsPhase,
        ismsPhaseSetAt: organizations.ismsPhaseSetAt,
        updatedAt: organizations.updatedAt,
      })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1),
      db.select()
        .from(organizationIsmsScopes)
        .where(eq(organizationIsmsScopes.organizationId, organizationId))
        .limit(1),
      db.select({
        id: organizationDepartments.id,
        createdAt: organizationDepartments.createdAt,
        updatedAt: organizationDepartments.updatedAt,
      })
        .from(organizationDepartments)
        .where(eq(organizationDepartments.organizationId, organizationId)),
      db.select({
        id: documents.id,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
        .from(documents)
        .where(eq(documents.organizationId, organizationId)),
      db.select({
        id: userProfiles.id,
        createdAt: userProfiles.createdAt,
        isActive: userProfiles.isActive,
      })
        .from(userProfiles)
        .where(eq(userProfiles.organizationId, organizationId)),
      db.select({
        id: projectRoles.id,
        isRequired: projectRoles.isRequired,
      })
        .from(projectRoles)
        .where(eq(projectRoles.organizationId, organizationId)),
      db.select({
        roleId: projectAssignments.roleId,
        createdAt: projectAssignments.createdAt,
      })
        .from(projectAssignments)
        .where(eq(projectAssignments.organizationId, organizationId)),
      db.select({
        id: risks.id,
        createdAt: risks.createdAt,
        assessmentPeriod: risks.assessmentPeriod,
      })
        .from(risks)
        .where(eq(risks.organizationId, organizationId)),
      db.select({
        id: tasks.id,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
      })
        .from(tasks)
        .where(eq(tasks.organizationId, organizationId)),
      db.select({
        id: auditPlans.id,
        status: auditPlans.status,
        plannedStartDate: auditPlans.plannedStartDate,
        actualStartDate: auditPlans.actualStartDate,
        auditPeriod: auditPlans.auditPeriod,
        updatedAt: auditPlans.updatedAt,
      })
        .from(auditPlans)
        .where(eq(auditPlans.organizationId, organizationId)),
      db.select({
        id: organizationPhaseHistory.id,
        phase: organizationPhaseHistory.phase,
        source: organizationPhaseHistory.source,
        recordedAt: organizationPhaseHistory.recordedAt,
        changedBy: organizationPhaseHistory.changedBy,
      })
        .from(organizationPhaseHistory)
        .where(eq(organizationPhaseHistory.organizationId, organizationId))
        .orderBy(desc(organizationPhaseHistory.recordedAt))
        .limit(20)
    ])

    // Resolve phase history changed_by users
    const changedByIds = phaseHistoryRows
      .map(row => row.changedBy)
      .filter((id): id is string => Boolean(id))

    let userMap = new Map<string, { id: string; fullName: string | null; email: string }>()
    if (changedByIds.length > 0) {
      const uniqueIds = [...new Set(changedByIds)]
      // Fetch in batches to avoid large IN clauses
      for (const uid of uniqueIds) {
        const rows = await db
          .select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email })
          .from(userProfiles)
          .where(eq(userProfiles.id, uid))
          .limit(1)
        if (rows[0]) {
          userMap.set(rows[0].id, rows[0])
        }
      }
    }

    const phaseHistory: PhaseHistoryEntry[] = phaseHistoryRows.map(entry => {
      const user = entry.changedBy ? userMap.get(entry.changedBy) : null
      return {
        id: entry.id,
        phase: (entry.phase as IsmsPhase) ?? 'initial',
        source: (entry.source as PhaseHistorySource) ?? 'system',
        changedBy: user
          ? { id: user.id, name: user.fullName, email: user.email }
          : entry.changedBy
          ? { id: entry.changedBy, name: null, email: null }
          : null,
        recordedAt: entry.recordedAt
      }
    })

    return {
      organization: organizationRows[0] ?? null,
      scope: scopeRows[0] ?? null,
      departments: departmentRows,
      documents: documentRows,
      users: userRows,
      projectRoles: projectRolesRows,
      projectAssignments: projectAssignmentRows,
      risks: riskRows,
      tasks: taskRows,
      auditPlans: auditPlanRows,
      phaseHistory
    }
  }

  private buildPhaseSummary(organization: OrganizationRow | null): OnboardingPhaseSummary {
    const currentPhase = (organization?.ismsPhase as IsmsPhase | null) ?? null
    const effectivePhase: IsmsPhase = currentPhase ?? 'initial'

    return {
      current: currentPhase,
      effective: effectivePhase,
      alert: currentPhase ? null : 'missing',
      setAt: organization?.ismsPhaseSetAt ?? null
    }
  }

  private buildPeriodProgress({
    period,
    phase,
    data
  }: {
    period: FiscalYearPeriod
    phase: IsmsPhase
    data: BaseData
  }): OnboardingProgressPeriod {
    const counts =
      phase === 'initial'
        ? this.buildInitialCounts(period, data)
        : this.buildSurveillanceCounts(period, data)

    const stepBuildResult =
      phase === 'initial'
        ? this.buildInitialSteps(period, data, counts)
        : this.buildSurveillanceSteps(period, data, counts)

    const completedSteps = stepBuildResult.steps.filter(step => step.completed).length
    const totalSteps = stepBuildResult.steps.length
    const completionRate = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100)

    return {
      fiscalYear: period.fiscalYear,
      label: period.label,
      counts,
      steps: stepBuildResult.steps,
      totalSteps,
      completedSteps,
      completionRate,
      meta: stepBuildResult.meta
    }
  }

  private buildInitialCounts(period: FiscalYearPeriod, data: BaseData): OnboardingCounts {
    const scopedItems = getScopeItemCount(data.scope)
    const scopeUpdatedAt = parseDate(data.scope?.updatedAt ?? null)
    const scopeComplete = scopedItems > 0 && (!scopeUpdatedAt || scopeUpdatedAt <= period.end)

    const activeUsers = data.users.filter(user => user.isActive && isOnOrBefore(user.createdAt, period.end)).length

    const requiredRoles = data.projectRoles.filter(role => role.isRequired)
    const assignmentsBeforePeriod = data.projectAssignments.filter(row => isOnOrBefore(row.createdAt, period.end))
    const assignmentsByRole = new Map<string, Date>()
    assignmentsBeforePeriod.forEach(assignment => {
      if (!assignment.roleId) {
        return
      }
      const createdAt = parseDate(assignment.createdAt)
      if (!createdAt || createdAt > period.end) {
        return
      }
      if (!assignmentsByRole.has(assignment.roleId)) {
        assignmentsByRole.set(assignment.roleId, createdAt)
      }
    })

    const satisfiedRoles = requiredRoles.filter(role => assignmentsByRole.has(role.id)).length
    const structureSatisfiedValue = requiredRoles.length > 0 ? satisfiedRoles : assignmentsBeforePeriod.length

    const departmentsUpToPeriod = data.departments.filter(row => isOnOrBefore(row.createdAt, period.end))
    const documentsUpToPeriod = data.documents.filter(row => isOnOrBefore(row.createdAt, period.end))
    const tasksUpToPeriod = data.tasks.filter(row => isOnOrBefore(row.createdAt, period.end))
    const risksUpToPeriod = data.risks.filter(row => isOnOrBefore(row.createdAt, period.end))

    const auditPlansUpToPeriod = data.auditPlans.filter(row => {
      const planned = parseDate(row.plannedStartDate)
      const createdAt = planned ?? parseDate(row.actualStartDate)
      if (!createdAt) {
        return true
      }
      return createdAt <= period.end
    })

    const correctiveTasks = tasksUpToPeriod.filter(task => CORRECTIVE_STATUSES.includes((task.status ?? '') as typeof CORRECTIVE_STATUSES[number]))

    const auditInProgress = auditPlansUpToPeriod.filter(plan => plan.status === 'in_progress').length
    const auditCompleted = auditPlansUpToPeriod.filter(plan => plan.status === 'completed').length

    return {
      activeUsers,
      structureAssignments: assignmentsBeforePeriod.length,
      structureRequiredRoles: requiredRoles.length,
      structureSatisfiedRoles: structureSatisfiedValue,
      departmentCount: departmentsUpToPeriod.length,
      documentCount: documentsUpToPeriod.length,
      riskCount: risksUpToPeriod.length,
      taskCount: tasksUpToPeriod.length,
      scopeItemCount: scopeComplete ? scopedItems : 0,
      auditPlansTotal: auditPlansUpToPeriod.length,
      auditPlansInProgress: auditInProgress,
      auditPlansCompleted: auditCompleted,
      correctiveTasksOpen: correctiveTasks.length
    }
  }

  private buildSurveillanceCounts(period: FiscalYearPeriod, data: BaseData): OnboardingCounts {
    const scopeUpdatedAt = parseDate(data.scope?.updatedAt ?? null)
    const scopeReviewed = Boolean(scopeUpdatedAt && scopeUpdatedAt >= period.start && scopeUpdatedAt <= period.end)
    const scopedItems = scopeReviewed ? getScopeItemCount(data.scope) : 0

    const departmentReviewed = data.departments.some(dept => {
      const updatedAt = parseDate(dept.updatedAt)
      return Boolean(updatedAt && updatedAt >= period.start && updatedAt <= period.end)
    })

    const risksInPeriod = data.risks.filter(risk => risk.assessmentPeriod?.startsWith(period.fiscalYear))
    const correctiveTasks = data.tasks.filter(task => {
      const updatedAt = parseDate(task.updatedAt)
      if (!updatedAt) {
        return false
      }
      return (
        updatedAt >= period.start &&
        updatedAt <= period.end &&
        CORRECTIVE_STATUSES.includes((task.status ?? '') as typeof CORRECTIVE_STATUSES[number])
      )
    })

    const auditPlansInPeriod = data.auditPlans.filter(plan => plan.auditPeriod?.startsWith(period.fiscalYear))

    const documentsInPeriod = data.documents.filter(doc => {
      const updatedAt = parseDate(doc.updatedAt)
      return Boolean(updatedAt && updatedAt >= period.start && updatedAt <= period.end)
    })

    return {
      activeUsers: data.users.filter(user => user.isActive).length,
      structureAssignments: data.projectAssignments.length,
      structureRequiredRoles: data.projectRoles.filter(role => role.isRequired).length,
      structureSatisfiedRoles: data.projectRoles.filter(role => role.isRequired).length,
      departmentCount: departmentReviewed ? data.departments.length : 0,
      documentCount: documentsInPeriod.length,
      riskCount: risksInPeriod.length,
      taskCount: correctiveTasks.length,
      scopeItemCount: scopeReviewed && departmentReviewed ? scopedItems : 0,
      auditPlansTotal: auditPlansInPeriod.length,
      auditPlansInProgress: auditPlansInPeriod.filter(plan => plan.status === 'in_progress').length,
      auditPlansCompleted: auditPlansInPeriod.filter(plan => plan.status === 'completed').length,
      correctiveTasksOpen: correctiveTasks.length
    }
  }

  private buildInitialSteps(
    period: FiscalYearPeriod,
    data: BaseData,
    counts: OnboardingCounts
  ): StepBuildResult {
    const organization = data.organization
    const profileFieldsFilled = [organization?.industry, organization?.employeeCountRange, organization?.isoCertificationStatus].filter(Boolean).length
    const profileCompleteAt = organization?.updatedAt ? new Date(organization.updatedAt) : null
    const profileCompleted = Boolean(profileCompleteAt && profileCompleteAt <= period.end && profileFieldsFilled === 3)

    const activeUserDates = data.users
      .filter(user => user.isActive && user.createdAt)
      .map(user => new Date(user.createdAt as string))
      .sort((a, b) => a.getTime() - b.getTime())
    const teamCompleted = counts.activeUsers >= (STEP_TARGETS.team ?? 2)
    const teamCompletedAt = teamCompleted && activeUserDates.length >= 2 ? activeUserDates[1] : null

    const assignmentDates = data.projectAssignments
      .filter(assignment => assignment.createdAt && isOnOrBefore(assignment.createdAt, period.end))
      .map(assignment => ({ roleId: assignment.roleId as string | null, date: new Date(assignment.createdAt as string) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const requiredRoleIds = data.projectRoles.filter(role => role.isRequired).map(role => role.id)
    const satisfiedDates = requiredRoleIds
      .map(roleId => assignmentDates.find(item => item.roleId === roleId)?.date)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())

    let structureCompleted = false
    let structureCompletedAt: Date | null = null

    if (requiredRoleIds.length > 0) {
      structureCompleted = satisfiedDates.length === requiredRoleIds.length
      structureCompletedAt = structureCompleted ? satisfiedDates[satisfiedDates.length - 1] : null
    } else {
      structureCompleted = assignmentDates.length > 0
      structureCompletedAt = structureCompleted ? assignmentDates[0]?.date ?? null : null
    }

    const departmentCreatedAt = data.departments
      .filter(row => row.createdAt && isOnOrBefore(row.createdAt, period.end))
      .map(row => new Date(row.createdAt as string))
      .sort((a, b) => a.getTime() - b.getTime())
    const departmentsCompleted = departmentCreatedAt.length > 0
    const departmentsCompletedAt = departmentsCompleted ? departmentCreatedAt[0] : null

    const scopeItemCount = getScopeItemCount(data.scope)
    const scopeUpdatedAt = parseDate(data.scope?.updatedAt ?? null)
    const scopeCompleted = scopeItemCount > 0 && (!scopeUpdatedAt || scopeUpdatedAt <= period.end)

    const documentCreatedAt = data.documents
      .filter(doc => doc.createdAt && isOnOrBefore(doc.createdAt, period.end))
      .map(doc => new Date(doc.createdAt as string))
      .sort((a, b) => a.getTime() - b.getTime())
    const documentsCompleted = documentCreatedAt.length > 0
    const documentsCompletedAt = documentsCompleted ? documentCreatedAt[0] : null

    const taskCreatedAt = data.tasks
      .filter(task => task.createdAt && isOnOrBefore(task.createdAt, period.end))
      .map(task => new Date(task.createdAt as string))
      .sort((a, b) => a.getTime() - b.getTime())
    const tasksCompleted = taskCreatedAt.length > 0
    const tasksCompletedAt = tasksCompleted ? taskCreatedAt[0] : null

    const riskCreatedAt = data.risks
      .filter(risk => risk.createdAt && isOnOrBefore(risk.createdAt, period.end))
      .map(risk => new Date(risk.createdAt as string))
      .sort((a, b) => a.getTime() - b.getTime())
    const risksCompleted = riskCreatedAt.length > 0
    const risksCompletedAt = risksCompleted ? riskCreatedAt[0] : null

    const steps: OnboardingStep[] = [
      buildStep('profile', profileCompleted, profileCompleted ? profileCompleteAt : null, profileFieldsFilled),
      buildStep('team', teamCompleted, teamCompletedAt, counts.activeUsers),
      buildStep('structure', structureCompleted, structureCompletedAt, counts.structureSatisfiedRoles),
      buildStep('departments', departmentsCompleted, departmentsCompletedAt, counts.departmentCount),
      buildStep('scope', scopeCompleted, scopeCompleted ? scopeUpdatedAt : null, scopeCompleted ? scopeItemCount : 0),
      buildStep('documents', documentsCompleted, documentsCompletedAt, counts.documentCount),
      buildStep('tasks', tasksCompleted, tasksCompletedAt, counts.taskCount),
      buildStep('risks', risksCompleted, risksCompletedAt, counts.riskCount)
    ]

    return {
      steps,
      meta: {
        profileComplete: profileCompleted,
        hasScope: scopeCompleted
      }
    }
  }

  private buildSurveillanceSteps(
    period: FiscalYearPeriod,
    data: BaseData,
    counts: OnboardingCounts
  ): StepBuildResult {
    const scopeUpdatedAt = parseDate(data.scope?.updatedAt ?? null)
    const scopeReviewed = Boolean(scopeUpdatedAt && scopeUpdatedAt >= period.start && scopeUpdatedAt <= period.end)
    const departmentReviewed = data.departments.some(dept => {
      const updatedAt = parseDate(dept.updatedAt)
      return Boolean(updatedAt && updatedAt >= period.start && updatedAt <= period.end)
    })
    const scopeCompleted = scopeReviewed && departmentReviewed
    const scopeCompletedAt = scopeCompleted ? scopeUpdatedAt : null

    const risksInPeriod = data.risks
      .filter(risk => risk.assessmentPeriod?.startsWith(period.fiscalYear) && risk.createdAt)
      .map(risk => new Date(risk.createdAt as string))
      .sort((a, b) => a.getTime() - b.getTime())
    const riskCycleCompleted = risksInPeriod.length > 0
    const riskCycleCompletedAt = riskCycleCompleted ? risksInPeriod[0] : null

    const correctiveTasks = data.tasks.filter(task => {
      const updatedAt = parseDate(task.updatedAt)
      if (!updatedAt) {
        return false
      }
      return (
        updatedAt >= period.start &&
        updatedAt <= period.end &&
        CORRECTIVE_STATUSES.includes((task.status ?? '') as typeof CORRECTIVE_STATUSES[number])
      )
    })
    const taskFollowUpCompleted = correctiveTasks.length > 0
    const taskFollowUpCompletedAt = taskFollowUpCompleted
      ? correctiveTasks
          .map(task => parseDate(task.updatedAt)!)
          .sort((a, b) => b.getTime() - a.getTime())[0]
      : null

    const auditPlansInPeriod = data.auditPlans.filter(plan => plan.auditPeriod?.startsWith(period.fiscalYear))
    const auditActivityCompleted =
      auditPlansInPeriod.filter(plan => plan.status === 'in_progress' || plan.status === 'completed').length > 0
    const auditCompletedAt = auditActivityCompleted
      ? auditPlansInPeriod
          .map(plan => parseDate(plan.actualStartDate) ?? parseDate(plan.plannedStartDate))
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => a.getTime() - b.getTime())[0]
      : null

    const documentsUpdated = data.documents
      .map(doc => parseDate(doc.updatedAt))
      .filter((value): value is Date => Boolean(value && value >= period.start && value <= period.end))
      .sort((a, b) => a.getTime() - b.getTime())
    const managementReviewCompleted = documentsUpdated.length > 0
    const managementReviewCompletedAt = managementReviewCompleted ? documentsUpdated[documentsUpdated.length - 1] : null

    const steps: OnboardingStep[] = [
      buildStep('phase_scope_review', scopeCompleted, scopeCompletedAt, counts.scopeItemCount),
      buildStep('phase_risk_cycle', riskCycleCompleted, riskCycleCompletedAt, counts.riskCount),
      buildStep('phase_task_followup', taskFollowUpCompleted, taskFollowUpCompletedAt, counts.correctiveTasksOpen),
      buildStep(
        'phase_audit_readiness',
        auditActivityCompleted,
        auditCompletedAt,
        counts.auditPlansInProgress + counts.auditPlansCompleted
      ),
      buildStep('phase_management_review', managementReviewCompleted, managementReviewCompletedAt, counts.documentCount)
    ]

    return {
      steps,
      meta: {
        profileComplete: true,
        hasScope: scopeCompleted
      }
    }
  }
}

function buildStep(
  id: OnboardingStepId,
  completed: boolean,
  completedAtDate: Date | null,
  progressValue: number
): OnboardingStep {
  let status: OnboardingStepStatus = 'not_started'
  if (completed) {
    status = 'completed'
  } else if (progressValue > 0) {
    status = 'in_progress'
  }

  return {
    id,
    completed,
    status,
    completedAt: completed && completedAtDate ? completedAtDate.toISOString() : null
  }
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isOnOrBefore(value: string | null | undefined, end: Date): boolean {
  const date = parseDate(value)
  if (!date) {
    return false
  }
  return date <= end
}

function getScopeItemCount(scope: ScopeRow): number {
  if (!scope) {
    return 0
  }
  // Drizzle stores JSON arrays as TEXT strings
  const parseJsonLength = (val: string | null | undefined): number => {
    if (!val) return 0
    try {
      const arr = JSON.parse(val)
      return Array.isArray(arr) ? arr.length : 0
    } catch {
      return 0
    }
  }
  return [
    parseJsonLength(scope.physicalLocations),
    parseJsonLength(scope.itSystems),
    parseJsonLength(scope.departments),
    parseJsonLength(scope.processes),
    parseJsonLength(scope.exclusions),
  ].reduce((acc, value) => acc + value, 0)
}

function getFiscalYearLabel(date: Date): number {
  const month = date.getUTCMonth()
  const year = date.getUTCFullYear()
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1
}

function getFiscalYearPeriod(year: number): FiscalYearPeriod & { year: number } {
  const start = new Date(Date.UTC(year, FISCAL_YEAR_START_MONTH, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year + 1, FISCAL_YEAR_START_MONTH - 1, 31, 23, 59, 59, 999))
  return {
    year,
    fiscalYear: `FY${year}`,
    label: `FY${year}`,
    start,
    end
  }
}
