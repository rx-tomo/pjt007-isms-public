/**
 * SQLite Organization Repository
 *
 * Implements IOrganizationRepository using Drizzle ORM with SQLite.
 * SECURITY: All queries enforce organization_id scoping.
 */

import { desc, eq, and } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  auditPlans,
  documents,
  organizations,
  organizationIsmsScopes,
  organizationDepartments,
  organizationPhaseHistory,
  projectRoles,
  projectAssignments,
  risks,
  tasks,
  userProfiles,
  organizationInvitations
} from '@/lib/db/drizzle/schema'
import type { IsmsPhase, PhaseHistoryEntry, PhaseHistorySource } from '@/lib/services/onboarding'
import type {
  IOrganizationRepository,
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  OrganizationScopeRow,
  DepartmentRow,
  ProjectRoleRow,
  ScopePayload,
  DepartmentPayload,
  ProjectRolePayload,
  ProjectAssignmentDetails,
  OrganizationStats
} from '../interfaces/IOrganizationRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import { parseJsonArray, stringifyJsonArray } from '@/lib/db/drizzle/schema/organizations'

export class SQLiteOrganizationRepository extends BaseSQLiteRepository implements IOrganizationRepository {
  constructor() {
    super()
  }

  async findById(id: string): Promise<Organization | null> {
    this.logDataAccess('findById', id)

    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1)

    return result[0] ? this.mapToOrganization(result[0]) : null
  }

  async findMany(filters?: Record<string, unknown>): Promise<Organization[]> {
    let query = this.db.select().from(organizations)

    if (filters?.id) {
      query = query.where(eq(organizations.id, filters.id as string)) as typeof query
    }

    const results = await query
    return results.map(row => this.mapToOrganization(row))
  }

  async create(data: OrganizationInsert): Promise<Organization> {
    const result = await this.db
      .insert(organizations)
      .values({
        id: data.id ?? crypto.randomUUID(),
        name: data.name,
        nameEn: data.name_en ?? null,
        subscriptionPlan: data.subscription_plan ?? 'trial',
        subscriptionStatus: data.subscription_status ?? 'active',
        employeeCountRange: data.employee_count_range ?? null,
        industry: data.industry ?? null,
        isoCertificationStatus: data.iso_certification_status ?? null,
        trialEndsAt: data.trial_ends_at ?? null,
        ismsPhase: data.isms_phase ?? null,
        ismsPhaseSetAt: data.isms_phase_set_at ?? null
      })
      .returning()

    return this.mapToOrganization(result[0])
  }

  async update(id: string, updates: OrganizationUpdate): Promise<Organization | null> {
    this.logDataAccess('update', id)

    const result = await this.db
      .update(organizations)
      .set({
        name: updates.name,
        nameEn: updates.name_en,
        subscriptionPlan: updates.subscription_plan,
        subscriptionStatus: updates.subscription_status,
        employeeCountRange: updates.employee_count_range,
        industry: updates.industry,
        isoCertificationStatus: updates.iso_certification_status,
        trialEndsAt: updates.trial_ends_at,
        ismsPhase: updates.isms_phase,
        ismsPhaseSetAt: updates.isms_phase_set_at,
        updatedAt: new Date().toISOString()
      })
      .where(eq(organizations.id, id))
      .returning()

    return result[0] ? this.mapToOrganization(result[0]) : null
  }

  async delete(id: string): Promise<void> {
    this.logDataAccess('delete', id)
    await this.db.delete(organizations).where(eq(organizations.id, id))
  }

  async findByUserId(userId: string): Promise<Organization | null> {
    this.logDataAccess('findByUserId', userId)
    const result = await this.db
      .select({ org: organizations })
      .from(userProfiles)
      .innerJoin(organizations, eq(userProfiles.organizationId, organizations.id))
      .where(eq(userProfiles.id, userId))
      .limit(1)
    return result[0] ? this.mapToOrganization(result[0].org) : null
  }

  async updateIsmsPhase(id: string, phase: IsmsPhase, source: 'wizard' | 'settings' = 'settings'): Promise<Organization | null> {
    const recordedAt = new Date().toISOString()
    const result = await this.update(id, {
      isms_phase: phase,
      isms_phase_set_at: recordedAt
    })

    if (result) {
      await this.db.insert(organizationPhaseHistory).values({
        id: crypto.randomUUID(),
        organizationId: id,
        phase,
        source,
        changedBy: null,
        notes: null,
        recordedAt
      })
    }

    return result
  }

  async getPhaseHistory(organizationId: string, limit = 20): Promise<PhaseHistoryEntry[]> {
    this.requireOrganizationId(organizationId, 'getPhaseHistory')
    this.logDataAccess('getPhaseHistory', organizationId)

    const normalizedLimit = Math.min(Math.max(limit, 1), 100)
    const rows = await this.db
      .select()
      .from(organizationPhaseHistory)
      .where(eq(organizationPhaseHistory.organizationId, organizationId))
      .orderBy(desc(organizationPhaseHistory.recordedAt))
      .limit(normalizedLimit)

    return rows.map(row => ({
      id: row.id,
      phase: this.normalizeIsmsPhase(row.phase),
      source: this.normalizePhaseHistorySource(row.source),
      changedBy: row.changedBy ? { id: row.changedBy, name: null, email: null } : null,
      recordedAt: row.recordedAt
    }))
  }

  async getScope(organizationId: string): Promise<OrganizationScopeRow | null> {
    this.requireOrganizationId(organizationId, 'getScope')
    this.logDataAccess('getScope', organizationId)

    const result = await this.db
      .select()
      .from(organizationIsmsScopes)
      .where(eq(organizationIsmsScopes.organizationId, organizationId))
      .limit(1)

    if (!result[0]) return null

    return this.mapToScopeRow(result[0])
  }

  async upsertScope(organizationId: string, scope: ScopePayload): Promise<OrganizationScopeRow> {
    this.requireOrganizationId(organizationId, 'upsertScope')
    this.logDataAccess('upsertScope', organizationId)

    const existing = await this.getScope(organizationId)

    if (existing) {
      const result = await this.db
        .update(organizationIsmsScopes)
        .set({
          physicalLocations: stringifyJsonArray(scope.physical_locations),
          itSystems: stringifyJsonArray(scope.it_systems),
          departments: stringifyJsonArray(scope.departments),
          processes: stringifyJsonArray(scope.processes),
          exclusions: stringifyJsonArray(scope.exclusions),
          updatedAt: new Date().toISOString()
        })
        .where(eq(organizationIsmsScopes.organizationId, organizationId))
        .returning()

      return this.mapToScopeRow(result[0])
    } else {
      const result = await this.db
        .insert(organizationIsmsScopes)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          physicalLocations: stringifyJsonArray(scope.physical_locations),
          itSystems: stringifyJsonArray(scope.it_systems),
          departments: stringifyJsonArray(scope.departments),
          processes: stringifyJsonArray(scope.processes),
          exclusions: stringifyJsonArray(scope.exclusions)
        })
        .returning()

      return this.mapToScopeRow(result[0])
    }
  }

  async getDepartments(organizationId: string, _options?: QueryOptions): Promise<DepartmentRow[]> {
    this.requireOrganizationId(organizationId, 'getDepartments')
    this.logDataAccess('getDepartments', organizationId)

    const result = await this.db
      .select()
      .from(organizationDepartments)
      .where(eq(organizationDepartments.organizationId, organizationId))

    return result.map(this.mapToDepartmentRow)
  }

  async createDepartment(organizationId: string, payload: DepartmentPayload): Promise<DepartmentRow> {
    this.requireOrganizationId(organizationId, 'createDepartment')
    this.logDataAccess('createDepartment', organizationId)

    const result = await this.db
      .insert(organizationDepartments)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        name: payload.name,
        nameEn: payload.name_en ?? null,
        parentDepartmentId: payload.parent_department_id ?? null,
        manager: payload.manager ?? null,
        description: payload.description ?? null,
        memberCount: 0
      })
      .returning()

    return this.mapToDepartmentRow(result[0])
  }

  async updateDepartment(organizationId: string, departmentId: string, payload: DepartmentPayload): Promise<DepartmentRow> {
    this.requireOrganizationId(organizationId, 'updateDepartment')
    this.logDataAccess('updateDepartment', organizationId, { departmentId })

    const result = await this.db
      .update(organizationDepartments)
      .set({
        name: payload.name,
        nameEn: payload.name_en,
        parentDepartmentId: payload.parent_department_id,
        manager: payload.manager,
        description: payload.description,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(organizationDepartments.organizationId, organizationId),
        eq(organizationDepartments.id, departmentId)
      ))
      .returning()

    return this.mapToDepartmentRow(result[0])
  }

  async deleteDepartment(organizationId: string, departmentId: string): Promise<void> {
    this.requireOrganizationId(organizationId, 'deleteDepartment')
    this.logDataAccess('deleteDepartment', organizationId, { departmentId })

    await this.db
      .delete(organizationDepartments)
      .where(and(
        eq(organizationDepartments.organizationId, organizationId),
        eq(organizationDepartments.id, departmentId)
      ))
  }

  async getProjectRoles(organizationId: string, _options?: QueryOptions): Promise<ProjectRoleRow[]> {
    this.requireOrganizationId(organizationId, 'getProjectRoles')
    this.logDataAccess('getProjectRoles', organizationId)

    const result = await this.db
      .select()
      .from(projectRoles)
      .where(eq(projectRoles.organizationId, organizationId))

    return result.map(this.mapToProjectRoleRow)
  }

  async createProjectRole(organizationId: string, payload: ProjectRolePayload): Promise<ProjectRoleRow> {
    this.requireOrganizationId(organizationId, 'createProjectRole')
    this.logDataAccess('createProjectRole', organizationId)

    const result = await this.db
      .insert(projectRoles)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        key: payload.key,
        name: payload.name,
        nameEn: payload.name_en ?? null,
        description: payload.description ?? null,
        responsibilities: payload.responsibilities ? stringifyJsonArray(payload.responsibilities) : null,
        displayOrder: payload.display_order ?? 0,
        isRequired: payload.is_required ?? false
      })
      .returning()

    return this.mapToProjectRoleRow(result[0])
  }

  async updateProjectRole(organizationId: string, roleId: string, payload: Partial<ProjectRolePayload>): Promise<ProjectRoleRow> {
    this.requireOrganizationId(organizationId, 'updateProjectRole')
    this.logDataAccess('updateProjectRole', organizationId, { roleId })

    const result = await this.db
      .update(projectRoles)
      .set({
        key: payload.key,
        name: payload.name,
        nameEn: payload.name_en,
        description: payload.description,
        responsibilities: payload.responsibilities ? stringifyJsonArray(payload.responsibilities) : undefined,
        displayOrder: payload.display_order,
        isRequired: payload.is_required,
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(projectRoles.organizationId, organizationId),
        eq(projectRoles.id, roleId)
      ))
      .returning()

    return this.mapToProjectRoleRow(result[0])
  }

  async deleteProjectRole(organizationId: string, roleId: string): Promise<void> {
    this.requireOrganizationId(organizationId, 'deleteProjectRole')
    this.logDataAccess('deleteProjectRole', organizationId, { roleId })

    await this.db
      .delete(projectRoles)
      .where(and(
        eq(projectRoles.organizationId, organizationId),
        eq(projectRoles.id, roleId)
      ))
  }

  async bulkUpsertProjectRoles(organizationId: string, roles: ProjectRolePayload[]): Promise<{ success: boolean; inserted: number; skipped: number }> {
    this.requireOrganizationId(organizationId, 'bulkUpsertProjectRoles')
    this.logDataAccess('bulkUpsertProjectRoles', organizationId, { count: roles.length })

    let inserted = 0
    let skipped = 0

    for (const role of roles) {
      try {
        // Check if exists by key
        const existing = await this.db
          .select()
          .from(projectRoles)
          .where(and(
            eq(projectRoles.organizationId, organizationId),
            eq(projectRoles.key, role.key)
          ))
          .limit(1)

        if (existing[0]) {
          skipped++
        } else {
          await this.createProjectRole(organizationId, role)
          inserted++
        }
      } catch (error) {
        this.logError('bulkUpsertProjectRoles', error, { role: role.key })
        skipped++
      }
    }

    return { success: true, inserted, skipped }
  }

  async getProjectAssignments(organizationId: string): Promise<ProjectAssignmentDetails[]> {
    this.requireOrganizationId(organizationId, 'getProjectAssignments')
    this.logDataAccess('getProjectAssignments', organizationId)

    const result = await this.db
      .select({
        assignment: projectAssignments,
        user: {
          id: userProfiles.id,
          fullName: userProfiles.fullName,
          email: userProfiles.email,
          role: userProfiles.role,
        },
        invitation: {
          id: organizationInvitations.id,
          email: organizationInvitations.email,
          role: organizationInvitations.role,
        },
      })
      .from(projectAssignments)
      .leftJoin(userProfiles, eq(projectAssignments.userId, userProfiles.id))
      .leftJoin(organizationInvitations, eq(projectAssignments.invitationId, organizationInvitations.id))
      .where(eq(projectAssignments.organizationId, organizationId))

    return result.map(row => {
      const assignment = row.assignment
      return {
        id: assignment.id,
        organization_id: assignment.organizationId,
        role_id: assignment.roleId,
        user_id: assignment.userId,
        invitation_id: assignment.invitationId,
        assigned_by: assignment.assignedBy,
        note: assignment.note,
        created_at: assignment.createdAt,
        updated_at: assignment.updatedAt,
        user_profile: row.user?.id
          ? {
              id: row.user.id,
              full_name: row.user.fullName,
              email: row.user.email,
              role: row.user.role,
            }
          : null,
        organization_invitation: row.invitation?.id
          ? {
              id: row.invitation.id,
              email: row.invitation.email,
              role: row.invitation.role,
            }
          : null,
      }
    })
  }

  async syncProjectAssignments(params: {
    organizationId: string
    roleIds: string[]
    userId?: string
    invitationId?: string
    note?: string | null
  }): Promise<void> {
    this.requireOrganizationId(params.organizationId, 'syncProjectAssignments')
    this.logDataAccess('syncProjectAssignments', params.organizationId)

    // Delete existing assignments for this user/invitation
    if (params.userId) {
      await this.db
        .delete(projectAssignments)
        .where(and(
          eq(projectAssignments.organizationId, params.organizationId),
          eq(projectAssignments.userId, params.userId)
        ))
    }
    if (params.invitationId) {
      await this.db
        .delete(projectAssignments)
        .where(and(
          eq(projectAssignments.organizationId, params.organizationId),
          eq(projectAssignments.invitationId, params.invitationId)
        ))
    }

    // Insert new assignments
    for (const roleId of params.roleIds) {
      await this.db.insert(projectAssignments).values({
        id: crypto.randomUUID(),
        organizationId: params.organizationId,
        roleId,
        userId: params.userId ?? null,
        invitationId: params.invitationId ?? null,
        note: params.note ?? null
      })
    }
  }

  async setRoleAssignments(params: {
    organizationId: string
    roleId: string
    userIds: string[]
    invitationIds?: string[]
    note?: string | null
  }): Promise<void> {
    this.requireOrganizationId(params.organizationId, 'setRoleAssignments')
    this.logDataAccess('setRoleAssignments', params.organizationId, { roleId: params.roleId })

    // Delete existing assignments for this role
    await this.db
      .delete(projectAssignments)
      .where(and(
        eq(projectAssignments.organizationId, params.organizationId),
        eq(projectAssignments.roleId, params.roleId)
      ))

    // Insert new user assignments
    for (const userId of params.userIds) {
      await this.db.insert(projectAssignments).values({
        id: crypto.randomUUID(),
        organizationId: params.organizationId,
        roleId: params.roleId,
        userId,
        invitationId: null,
        note: params.note ?? null
      })
    }

    // Insert invitation assignments
    for (const invitationId of params.invitationIds ?? []) {
      await this.db.insert(projectAssignments).values({
        id: crypto.randomUUID(),
        organizationId: params.organizationId,
        roleId: params.roleId,
        userId: null,
        invitationId,
        note: params.note ?? null
      })
    }
  }

  async getStats(organizationId: string): Promise<OrganizationStats> {
    this.requireOrganizationId(organizationId, 'getStats')
    this.logDataAccess('getStats', organizationId)

    const today = new Date().toISOString().slice(0, 10)
    const [
      userRows,
      documentRows,
      taskRows,
      riskRows,
      auditPlanRows
    ] = await Promise.all([
      this.db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(eq(userProfiles.organizationId, organizationId)),
      this.db
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.organizationId, organizationId)),
      this.db
        .select({ status: tasks.status, dueDate: tasks.dueDate })
        .from(tasks)
        .where(eq(tasks.organizationId, organizationId)),
      this.db
        .select({ status: risks.status })
        .from(risks)
        .where(eq(risks.organizationId, organizationId)),
      this.db
        .select({ status: auditPlans.status })
        .from(auditPlans)
        .where(eq(auditPlans.organizationId, organizationId))
    ])

    const taskStatusBreakdown = countByStatus(taskRows.map(row => row.status ?? 'todo'))
    const documentStatusBreakdown = countByStatus(documentRows.map(row => row.status ?? 'draft'))
    const riskStatusBreakdown = countByStatus(riskRows.map(row => row.status ?? 'identified'))

    return {
      userCount: userRows.length,
      documentCount: documentRows.length,
      pendingReviewDocumentCount: documentRows.filter(row => row.status === 'in_review').length,
      activeTaskCount: taskRows.filter(row => !['done', 'cancelled'].includes(row.status ?? '')).length,
      overdueTaskCount: taskRows.filter(row => (
        !['done', 'cancelled'].includes(row.status ?? '') &&
        Boolean(row.dueDate) &&
        row.dueDate! < today
      )).length,
      activeRiskCount: riskRows.filter(row => row.status !== 'closed').length,
      inProgressAuditCount: auditPlanRows.filter(row => ['scheduled', 'in_progress'].includes(row.status ?? '')).length,
      taskStatusBreakdown,
      riskStatusBreakdown,
      documentStatusBreakdown
    }
  }

  // =========================================
  // Mapping helpers
  // =========================================

  private mapToOrganization(row: typeof organizations.$inferSelect): Organization {
    return {
      id: row.id,
      name: row.name,
      name_en: row.nameEn,
      subscription_plan: row.subscriptionPlan,
      subscription_status: row.subscriptionStatus,
      employee_count_range: row.employeeCountRange,
      industry: row.industry,
      iso_certification_status: row.isoCertificationStatus,
      trial_ends_at: row.trialEndsAt,
      isms_phase: row.ismsPhase,
      isms_phase_set_at: row.ismsPhaseSetAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }
  }

  private normalizeIsmsPhase(value: string): IsmsPhase {
    return value === 'surveillance' ? 'surveillance' : 'initial'
  }

  private normalizePhaseHistorySource(value: string): PhaseHistorySource {
    if (value === 'wizard' || value === 'settings' || value === 'system') {
      return value
    }
    return 'system'
  }

  private mapToScopeRow(row: typeof organizationIsmsScopes.$inferSelect): OrganizationScopeRow {
    return {
      id: row.id,
      organization_id: row.organizationId,
      physical_locations: parseJsonArray(row.physicalLocations, 'physical_locations'),
      it_systems: parseJsonArray(row.itSystems, 'it_systems'),
      departments: parseJsonArray(row.departments, 'departments'),
      processes: parseJsonArray(row.processes, 'processes'),
      exclusions: parseJsonArray(row.exclusions, 'exclusions'),
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }
  }

  private mapToDepartmentRow(row: typeof organizationDepartments.$inferSelect): DepartmentRow {
    return {
      id: row.id,
      organization_id: row.organizationId,
      name: row.name,
      name_en: row.nameEn,
      parent_department_id: row.parentDepartmentId,
      manager: row.manager,
      description: row.description,
      member_count: row.memberCount,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }
  }

  private mapToProjectRoleRow(row: typeof projectRoles.$inferSelect): ProjectRoleRow {
    const responsibilities = row.responsibilities
      ? parseJsonArray(row.responsibilities, 'responsibilities')
      : null
    return {
      id: row.id,
      organization_id: row.organizationId,
      key: row.key,
      name: row.name,
      name_en: row.nameEn,
      description: row.description,
      responsibilities,
      display_order: row.displayOrder,
      is_required: row.isRequired,
      seed_source: row.seedSource,
      seeded_at: row.seededAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }
  }
}

function countByStatus(statuses: string[]): Record<string, number> {
  return statuses.reduce<Record<string, number>>((acc, status) => {
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
}
