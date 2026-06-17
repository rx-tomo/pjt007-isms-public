/**
 * Audit Plan Repository Interface
 *
 * Handles all audit-related data operations including:
 * - Audit Plans CRUD
 * - Audit Team Members
 * - ISO27001 Requirements
 * - Audit Checklists
 * - Nonconformities
 * - Corrective Actions
 * - Audit Evidence
 * - Audit Reports
 * - Audit Statistics
 */

import type { Database } from '@/types/database.types'
import type { IOrganizationScopedRepository, QueryOptions } from './IBaseRepository'

// Database Row Types
type AuditPlanRow = Database['public']['Tables']['audit_plans']['Row']
type AuditPlanInsert = Database['public']['Tables']['audit_plans']['Insert']
type AuditPlanUpdate = Database['public']['Tables']['audit_plans']['Update']
type AuditChecklistRow = Database['public']['Tables']['audit_checklists']['Row']
type AuditChecklistInsert = Database['public']['Tables']['audit_checklists']['Insert']
type AuditChecklistUpdate = Database['public']['Tables']['audit_checklists']['Update']
type NonconformityRow = Database['public']['Tables']['nonconformities']['Row']
type NonconformityInsert = Database['public']['Tables']['nonconformities']['Insert']
type NonconformityUpdate = Database['public']['Tables']['nonconformities']['Update']
type CorrectiveActionRow = Database['public']['Tables']['corrective_actions']['Row']
type CorrectiveActionInsert = Database['public']['Tables']['corrective_actions']['Insert']
type CorrectiveActionUpdate = Database['public']['Tables']['corrective_actions']['Update']
type AuditTeamMemberRow = Database['public']['Tables']['audit_team_members']['Row']
type AuditTeamMemberInsert = Database['public']['Tables']['audit_team_members']['Insert']
type AuditReportRow = Database['public']['Tables']['audit_reports']['Row']
type AuditReportInsert = Database['public']['Tables']['audit_reports']['Insert']
type AuditReportUpdate = Database['public']['Tables']['audit_reports']['Update']
type AuditEvidenceRow = Database['public']['Tables']['audit_evidence']['Row']
type AuditEvidenceInsert = Database['public']['Tables']['audit_evidence']['Insert']
type ISO27001RequirementRow = Database['public']['Tables']['iso27001_requirements']['Row']
type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']

// Re-export database types
export type {
  AuditPlanRow,
  AuditPlanInsert,
  AuditPlanUpdate,
  AuditChecklistRow,
  AuditChecklistInsert,
  AuditChecklistUpdate,
  NonconformityRow,
  NonconformityInsert,
  NonconformityUpdate,
  CorrectiveActionRow,
  CorrectiveActionInsert,
  CorrectiveActionUpdate,
  AuditTeamMemberRow,
  AuditTeamMemberInsert,
  AuditReportRow,
  AuditReportInsert,
  AuditReportUpdate,
  AuditEvidenceRow,
  AuditEvidenceInsert,
  ISO27001RequirementRow
}

// =====================================================
// Domain Types (used by Service layer)
// =====================================================

export type AuditType = 'internal' | 'external' | 'certification' | 'surveillance'
export type AuditStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type TeamRole = 'lead' | 'auditor' | 'observer'
export type ChecklistStatus = 'not_started' | 'in_progress' | 'completed'
export type AuditResult = 'conformity' | 'minor_nc' | 'major_nc' | 'observation' | 'not_applicable'
export type NonconformityType = 'major' | 'minor'
export type NonconformityStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'verified'
export type CorrectiveActionStatus = 'planned' | 'in_progress' | 'completed' | 'verified'
export type AuditFollowUpStatus = 'completed' | 'on_hold' | 'reopened'
export type AuditApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface AuditUnit {
  id: string
  organization_id: string
  name: string
  unit_type: 'site' | 'process'
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Audit Plan with resolved relationships
 */
export interface AuditPlan {
  id: string
  organization_id: string
  title: string
  description?: string | null
  audit_type?: AuditType | null
  standard: string | null
  planned_start_date?: string | null
  planned_end_date?: string | null
  actual_start_date?: string | null
  actual_end_date?: string | null
  lead_auditor_id?: string | null
  audited_unit_id?: string | null
  auditor_signature?: string | null
  auditor_signed_at?: string | null
  status: AuditStatus
  audit_period?: string | null
  created_at: string
  updated_at: string
}

export interface AuditPlanProgressSummary {
  totalChecklistItems: number
  completedChecklistItems: number
  inProgressChecklistItems: number
  notStartedChecklistItems: number
  completionRate: number
  openNonconformities: number
  totalNonconformities: number
  followUpStatus: AuditFollowUpStatus
}

export interface AuditPlanWithRelations extends AuditPlan {
  lead_auditor?: UserProfileRow | null
  audited_unit?: AuditUnit | null
  team_members?: AuditTeamMember[]
  checklists?: AuditChecklist[]
  report?: AuditReport | null
  progressSummary?: AuditPlanProgressSummary
}

export interface AuditTeamMember {
  id: string
  audit_plan_id: string
  user_id: string
  role: TeamRole
  assigned_at: string
  user?: UserProfileRow | null
}

export interface ISO27001Requirement {
  id: string
  clause_number: string
  title: string
  description?: string | null
  parent_id?: string | null
  is_applicable: boolean
  created_at: string
  children?: ISO27001Requirement[]
}

export interface AuditChecklist {
  id: string
  audit_plan_id: string
  requirement_id?: string | null
  check_item: string
  evidence_required?: string | null
  auditor_id?: string | null
  status: ChecklistStatus
  result?: AuditResult | null
  findings?: string | null
  evidence_provided?: string | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
  requirement?: ISO27001Requirement | null
  auditor?: UserProfileRow | null
  evidence?: AuditEvidence[]
  nonconformities?: Nonconformity[]
}

export interface Nonconformity {
  id: string
  audit_checklist_id: string
  nc_number: string
  type: NonconformityType
  description: string
  root_cause?: string | null
  corrective_action?: string | null
  preventive_action?: string | null
  responsible_id?: string | null
  due_date?: string | null
  status: NonconformityStatus
  resolution_date?: string | null
  verification_date?: string | null
  verified_by?: string | null
  created_at: string
  updated_at: string
  responsible?: UserProfileRow | null
  verifier?: UserProfileRow | null
  corrective_actions?: CorrectiveAction[]
}

export interface CorrectiveAction {
  id: string
  nonconformity_id: string
  action_description: string
  responsible_id?: string | null
  planned_date?: string | null
  completion_date?: string | null
  status: CorrectiveActionStatus
  effectiveness_review?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
  responsible?: UserProfileRow | null
  reviewer?: UserProfileRow | null
}

export interface AuditReport {
  id: string
  audit_plan_id: string | null
  executive_summary?: string | null
  scope?: string | null
  methodology?: string | null
  positive_findings?: string | null
  improvement_opportunities?: string | null
  conclusion?: string | null
  report_date?: string | null
  approval_status?: AuditApprovalStatus
  rejection_reason?: string | null
  approved_by?: string | null
  approved_at?: string | null
  created_at: string
  updated_at: string
  approver?: UserProfileRow | null
}

export interface AuditReportListItem {
  report: AuditReport
  plan: Pick<AuditPlan, 'id' | 'title' | 'status' | 'audit_period' | 'audit_type' | 'planned_start_date' | 'planned_end_date' | 'standard'> & {
    updated_at: string
    lead_auditor?: UserProfileRow | null
  }
}

export interface AuditEvidence {
  id: string
  audit_checklist_id: string
  file_name: string
  file_path: string
  file_size?: number | null
  mime_type?: string | null
  description?: string | null
  uploaded_by?: string | null
  uploaded_at: string
  uploader?: UserProfileRow | null
}

export interface AuditDashboardNextAction {
  id: string
  type: 'checklist' | 'nonconformity' | 'corrective_action'
  planId: string
  planTitle?: string
  remaining?: number
  total?: number
  nonconformityId?: string
  correctiveActionId?: string
  status?: NonconformityStatus | ChecklistStatus | CorrectiveActionStatus
  dueDate?: string
  priority: 'low' | 'medium' | 'high'
}

// =====================================================
// Filter Types
// =====================================================

export interface AuditPlanFilters {
  status?: AuditStatus
  period?: string | null
}

export interface AuditReportFilters {
  status?: AuditStatus | ''
  period?: string | null
  search?: string
  auditType?: AuditType | ''
}

export interface NonconformityFilters {
  organizationId?: string
  status?: NonconformityStatus
  type?: NonconformityType
}

// =====================================================
// Statistics Types
// =====================================================

export interface AuditStatistics {
  totalPlans: number
  plansByStatus: Record<AuditStatus, number>
  totalNonconformities: number
  ncByType: Record<NonconformityType, number>
  ncByStatus: Record<NonconformityStatus, number>
  upcomingAudits: AuditPlan[]
  checklistStatus: Record<ChecklistStatus, number>
  totalChecklistItems: number
  completedChecklistItems: number
  correctiveActionsByStatus: Record<CorrectiveActionStatus, number>
  openCorrectiveActions: number
  overdueNonconformities: number
  overdueCorrectiveActions: number
  nextActions: AuditDashboardNextAction[]
  followUpStatusCounts: Record<AuditFollowUpStatus, number>
  nonconformityStatusCounts: Record<NonconformityStatus, number>
}

// =====================================================
// Repository Interface
// =====================================================

/**
 * Audit Plan Repository Interface
 *
 * This interface defines all data operations for audit management.
 * Implementations can use different backends (libSQL/Turso, etc.)
 */
export interface IAuditPlanRepository extends IOrganizationScopedRepository<AuditPlan, AuditPlanInsert, AuditPlanUpdate> {
  // -------------------------
  // Audit Plan Operations
  // -------------------------

  /**
   * Get audit plans with relations
   */
  getAuditPlans(
    organizationId?: string,
    filters?: AuditPlanFilters
  ): Promise<AuditPlanWithRelations[]>

  /**
   * Get distinct audit periods for an organization
   */
  getAuditPeriods(organizationId: string): Promise<string[]>

  /**
   * Get audit plan by ID with all relations
   */
  getAuditPlanById(planId: string): Promise<AuditPlanWithRelations | null>

  /**
   * Create a new audit plan
   */
  createAuditPlan(plan: Omit<AuditPlan, 'id' | 'created_at' | 'updated_at'>): Promise<AuditPlan>

  /**
   * Update an audit plan
   */
  updateAuditPlan(planId: string, updates: Partial<AuditPlan>): Promise<AuditPlan>

  /**
   * Delete an audit plan
   */
  deleteAuditPlan(planId: string): Promise<void>

  // -------------------------
  // Team Member Operations
  // -------------------------

  /**
   * Add a team member to an audit plan
   */
  addTeamMember(planId: string, userId: string, role: TeamRole): Promise<AuditTeamMember>

  /**
   * Update a team member's role
   */
  updateTeamMember(memberId: string, updates: Partial<Pick<AuditTeamMember, 'role'>>): Promise<AuditTeamMember>

  /**
   * Remove a team member from an audit plan
   */
  removeTeamMember(memberId: string): Promise<void>

  // -------------------------
  // ISO27001 Requirement Operations
  // -------------------------

  /**
   * Get all ISO27001 requirements as a tree structure
   */
  getISO27001Requirements(): Promise<ISO27001Requirement[]>

  /**
   * Update requirement applicability
   */
  updateRequirementApplicability(requirementId: string, isApplicable: boolean): Promise<ISO27001Requirement>

  // -------------------------
  // Checklist Operations
  // -------------------------

  /**
   * Bulk create checklists from requirements
   */
  bulkCreateChecklists(
    planId: string,
    requirements: Array<Pick<ISO27001Requirement, 'id' | 'clause_number' | 'title' | 'description'>>
  ): Promise<AuditChecklist[]>

  /**
   * Create a single checklist item
   */
  createAuditChecklist(checklist: Omit<AuditChecklist, 'id' | 'created_at' | 'updated_at'>): Promise<AuditChecklist>

  /**
   * Update a checklist item
   */
  updateChecklist(checklistId: string, updates: Partial<AuditChecklist>): Promise<AuditChecklist>

  /**
   * Get checklists by plan ID
   */
  getChecklistsByPlan(planId: string): Promise<AuditChecklist[]>

  // -------------------------
  // Nonconformity Operations
  // -------------------------

  /**
   * Create a nonconformity
   */
  createNonconformity(nonconformity: Omit<Nonconformity, 'id' | 'nc_number' | 'created_at' | 'updated_at'>): Promise<Nonconformity>

  /**
   * Update a nonconformity
   */
  updateNonconformity(ncId: string, updates: Partial<Nonconformity>): Promise<Nonconformity>

  /**
   * Get nonconformities with filters
   */
  getNonconformities(filters?: NonconformityFilters): Promise<Nonconformity[]>

  // -------------------------
  // Corrective Action Operations
  // -------------------------

  /**
   * Create a corrective action
   */
  createCorrectiveAction(action: Omit<CorrectiveAction, 'id' | 'created_at' | 'updated_at'>): Promise<CorrectiveAction>

  /**
   * Update a corrective action
   */
  updateCorrectiveAction(actionId: string, updates: Partial<CorrectiveAction>): Promise<CorrectiveAction>

  // -------------------------
  // Evidence Operations
  // -------------------------

  /**
   * Create evidence record (after file upload)
   */
  createEvidence(evidence: Omit<AuditEvidence, 'id' | 'uploaded_at'>): Promise<AuditEvidence>

  /**
   * Delete evidence record
   */
  deleteEvidence(evidenceId: string): Promise<{ filePath: string | null }>

  // -------------------------
  // Report Operations
  // -------------------------

  /**
   * Get audit reports list
   */
  getAuditReportsList(organizationId: string, filters?: AuditReportFilters): Promise<AuditReportListItem[]>

  /**
   * Create an audit report
   */
  createAuditReport(report: Omit<AuditReport, 'id' | 'created_at' | 'updated_at'>): Promise<AuditReport>

  /**
   * Update an audit report
   */
  updateAuditReport(reportId: string, updates: Partial<AuditReport>): Promise<AuditReport>

  // -------------------------
  // Statistics Operations
  // -------------------------

  /**
   * Get comprehensive audit statistics
   */
  getAuditStatistics(organizationId: string, filters?: { period?: string | null }): Promise<AuditStatistics>

  // -------------------------
  // Context Resolution (for audit logging)
  // -------------------------

  /**
   * Get organization ID for a plan
   */
  resolvePlanOrganizationId(planId: string): Promise<string | null>

  /**
   * Get context (planId, organizationId) for a checklist
   */
  resolveChecklistContext(checklistId: string): Promise<{ planId: string | null; organizationId: string | null }>

  /**
   * Get context for a nonconformity
   */
  resolveNonconformityContext(nonconformityId: string): Promise<{
    checklistId: string | null
    planId: string | null
    organizationId: string | null
  }>
}
