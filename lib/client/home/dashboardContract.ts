export type IsmsPhase = 'initial' | 'surveillance'

export interface HomeUser {
  id: string
  name?: string | null
  full_name: string | null
  email: string
  role: string
  effective_role: string
  effective_organization_id: string | null
}

export interface HomeOrganization {
  id: string
  name: string
  name_en?: string | null
  employee_count_range?: string | null
  industry?: string | null
  iso_certification_status?: string | null
  subscription_plan?: string | null
  subscription_status?: string | null
  isms_phase?: string | null
  isms_phase_set_at?: string | null
  trial_ends_at?: string | null
  updated_at?: string | null
}

export interface HomeDashboardStats {
  userCount: number
  documentCount: number
  pendingReviewDocumentCount: number
  activeTaskCount: number
  overdueTaskCount: number
  activeRiskCount: number
  inProgressAuditCount: number
  taskStatusBreakdown: Record<string, number>
  riskStatusBreakdown: Record<string, number>
  documentStatusBreakdown: Record<string, number>
}

export interface HomeSubscription {
  status?: string | null
  current_period_end?: string | null
  trial_end?: string | null
  pricing_plan?: { name?: string | null } | null
  [key: string]: unknown
}

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

export interface OnboardingStep {
  id: OnboardingStepId
  status: 'not_started' | 'in_progress' | 'completed'
  completed: boolean
  completedAt: string | null
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
  meta: { profileComplete: boolean; hasScope: boolean }
}

export interface OnboardingProgress {
  trialEndsAt: string | null
  phase: OnboardingPhaseSummary
  phaseHistory: Array<{
    id: string
    phase: IsmsPhase
    source: 'wizard' | 'settings' | 'system'
    changedBy?: { id: string; name: string | null; email: string | null } | null
    recordedAt: string
  }>
  periods: {
    current: OnboardingProgressPeriod
    previous: OnboardingProgressPeriod | null
  }
}

export type NotificationType = 'task_reminder' | 'document_approval' | 'audit_schedule' | 'risk_alert' | 'system' | 'info'

export interface Notification {
  id: string
  organization_id: string
  user_id: string | null
  title: string
  message: string
  type: NotificationType
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'unread' | 'read' | 'archived'
  link?: string
  metadata?: unknown
  created_at: string
  read_at?: string
  archived_at?: string
}

export interface ActivityLogEntry {
  id: string
  organization_id: string | null
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  changes: unknown
  ip_address?: string | null
  user_agent?: string | null
  scope: string
  created_at: string | null
  actor?: { id?: string | null; full_name?: string | null; email?: string | null } | null
  resource_label?: string | null
}

export interface ApproverDashboardMetrics {
  pendingCount: number
  dueSoonCount: number
  escalationCount: number
  historyCount: number
  dueSoonHours: number
  escalationHours: number
  historyWindowDays: number
  lastRefreshedAt: string
}

export interface EducationFollowUpItem {
  id: string
  title: string
  status: string
  end_date: string | null
  total_records: number
  passed_records: number
  pending_records: number
  active_user_count: number
  is_overdue: boolean
  needs_follow_up: boolean
}

export interface EducationFollowUpSummary {
  total_plans: number
  active_user_count: number
  needs_follow_up_count: number
  overdue_count: number
  pending_record_count: number
  items: EducationFollowUpItem[]
}

export interface MyTrainingItem {
  id: string
  title: string
  status: string
  end_date: string | null
  result: string
  progress: number
  record_id: string | null
}

export interface MyTrainingSummary {
  total: number
  incomplete_count: number
  items: MyTrainingItem[]
}

export interface ManagementReviewSummary {
  scheduled_count: number
  in_progress_count: number
  pending_count: number
}

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

export type HomeRoleDashboard =
  | { role: 'user'; tasks: RoleDashboardTask[]; documents: RoleDashboardDocument[]; training: RoleDashboardTraining[] }
  | { role: 'approver'; metrics: ApproverDashboardMetrics }
  | { role: 'auditor'; audits: RoleDashboardAudit[]; findings: { majorOpenCount: number; minorOpenCount: number } }
  | {
      role: 'org_admin' | 'system_operator'
      metrics: { activeUserCount: number; pendingApprovalCount: number; openRiskCount: number; overdueTaskCount: number }
      activities: RoleDashboardActivity[]
    }

export interface HomeDashboard {
  user: HomeUser
  organization: HomeOrganization
  stats: HomeDashboardStats
  subscription: HomeSubscription | null
  onboarding: OnboardingProgress | null
  roleDashboard: HomeRoleDashboard | null
  activity: ActivityLogEntry[]
  notifications: Notification[]
  unreadNotificationCount: number
  educationFollowUp: EducationFollowUpSummary | null
  managementReviewSummary: ManagementReviewSummary | null
  myTraining: MyTrainingSummary | null
}
