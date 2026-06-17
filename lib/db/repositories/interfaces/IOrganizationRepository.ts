import type { Database } from '@/types/database.types'
import type { IBaseRepository, QueryOptions } from './IBaseRepository'
import type { IsmsPhase, PhaseHistoryEntry } from '@/lib/services/onboarding'

// Database types
type Organization = Database['public']['Tables']['organizations']['Row']
type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']
type OrganizationScopeRow = Database['public']['Tables']['organization_isms_scopes']['Row']
type DepartmentRow = Database['public']['Tables']['organization_departments']['Row']
type ProjectRoleRow = Database['public']['Tables']['project_roles']['Row']
type ProjectAssignmentRow = Database['public']['Tables']['project_assignments']['Row']

// Re-export for convenience
export type {
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  OrganizationScopeRow,
  DepartmentRow,
  ProjectRoleRow,
  ProjectAssignmentRow
}

/**
 * Payload types for create/update operations
 */
export interface ScopePayload {
  physical_locations: string[]
  it_systems: string[]
  departments: string[]
  processes: string[]
  exclusions: string[]
}

export interface DepartmentPayload {
  name: string
  name_en?: string
  parent_department_id?: string | null
  manager?: string
  description?: string
}

export interface ProjectRolePayload {
  key: string
  name: string
  name_en?: string | null
  description?: string | null
  responsibilities?: string[]
  display_order?: number
  is_required?: boolean
}

export interface ProjectAssignmentDetails extends ProjectAssignmentRow {
  user_profile?: {
    id: string
    full_name: string | null
    email: string
    role: string
  } | null
  organization_invitation?: {
    id: string
    email: string
    role: string
  } | null
}

/**
 * Organization Repository Interface
 *
 * Handles all organization-related data operations including:
 * - Organization CRUD
 * - ISMS scope management
 * - Departments
 * - Project roles and assignments
 */
export interface IOrganizationRepository extends IBaseRepository<Organization, OrganizationInsert, OrganizationUpdate> {
  // Organization operations
  findByUserId(userId: string): Promise<Organization | null>
  updateIsmsPhase(id: string, phase: IsmsPhase, source?: 'wizard' | 'settings'): Promise<Organization | null>
  getPhaseHistory(organizationId: string, limit?: number): Promise<PhaseHistoryEntry[]>

  // ISMS Scope operations
  getScope(organizationId: string): Promise<OrganizationScopeRow | null>
  upsertScope(organizationId: string, scope: ScopePayload): Promise<OrganizationScopeRow>

  // Department operations
  getDepartments(organizationId: string, options?: QueryOptions): Promise<DepartmentRow[]>
  createDepartment(organizationId: string, payload: DepartmentPayload): Promise<DepartmentRow>
  updateDepartment(organizationId: string, departmentId: string, payload: DepartmentPayload): Promise<DepartmentRow>
  deleteDepartment(organizationId: string, departmentId: string): Promise<void>

  // Project Role operations
  getProjectRoles(organizationId: string, options?: QueryOptions): Promise<ProjectRoleRow[]>
  createProjectRole(organizationId: string, payload: ProjectRolePayload): Promise<ProjectRoleRow>
  updateProjectRole(organizationId: string, roleId: string, payload: Partial<ProjectRolePayload>): Promise<ProjectRoleRow>
  deleteProjectRole(organizationId: string, roleId: string): Promise<void>
  bulkUpsertProjectRoles(organizationId: string, roles: ProjectRolePayload[]): Promise<{ success: boolean; inserted: number; skipped: number }>

  // Project Assignment operations
  getProjectAssignments(organizationId: string): Promise<ProjectAssignmentDetails[]>
  syncProjectAssignments(params: {
    organizationId: string
    roleIds: string[]
    userId?: string
    invitationId?: string
    note?: string | null
  }): Promise<void>
  setRoleAssignments(params: {
    organizationId: string
    roleId: string
    userIds: string[]
    invitationIds?: string[]
    note?: string | null
  }): Promise<void>

  // Stats
  getStats(organizationId: string): Promise<OrganizationStats>
}

export interface OrganizationStats {
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
