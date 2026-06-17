/**
 * Organization Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IOrganizationRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 */
import { getOrganizationRepository, getAuditLogRepository, getAuthProvider } from '@/lib/container'
import type { IOrganizationRepository } from '@/lib/db/repositories/interfaces/IOrganizationRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { Database, Json } from '@/types/database.types'
import type { IsmsPhase, PhaseHistoryEntry } from '@/lib/services/onboarding'

// Re-export types from the repository interface
export type {
  Organization,
  OrganizationScopeRow,
  DepartmentRow,
  ProjectRoleRow,
  ProjectAssignmentRow,
  ScopePayload,
  DepartmentPayload,
  ProjectRolePayload,
  ProjectAssignmentDetails,
  OrganizationStats
} from '@/lib/db/repositories/interfaces/IOrganizationRepository'

type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']
type Organization = Database['public']['Tables']['organizations']['Row']
type OrganizationScopeRow = Database['public']['Tables']['organization_isms_scopes']['Row']
type DepartmentRow = Database['public']['Tables']['organization_departments']['Row']
type ProjectRoleRow = Database['public']['Tables']['project_roles']['Row']
type UserRole = Database['public']['Enums']['user_role']

// Re-export for backward compatibility
export type ProjectRole = ProjectRoleRow
export type ProjectAssignment = Database['public']['Tables']['project_assignments']['Row']

// Import types from the repository
import type {
  ScopePayload,
  DepartmentPayload,
  ProjectRolePayload,
  ProjectAssignmentDetails,
  OrganizationStats
} from '@/lib/db/repositories/interfaces/IOrganizationRepository'

export class OrganizationService {
  private repositoryPromise: Promise<IOrganizationRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null

  private async getRepository(): Promise<IOrganizationRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getOrganizationRepository()
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

  private async logAudit(params: {
    organizationId: string
    action: string
    resourceType: string
    resourceId?: string
    changes?: Record<string, unknown> | ScopePayload | DepartmentPayload | DepartmentRow | null
  }): Promise<void> {
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
      console.error('Audit logging failed:', err)
    }
  }

  /**
   * 現在のユーザーの組織情報を取得
   */
  async getCurrentOrganization(): Promise<Organization | null> {
    // ブラウザではAPI経由で取得（UserService.getCurrentUser と同じパターン）
    if (typeof window !== 'undefined') {
      return this.getCurrentOrganizationViaApi()
    }

    const auth = await this.getAuth()
    const user = await auth.getUser()

    if (!user) {
      return null
    }

    const repo = await this.getRepository()
    return repo.findByUserId(user.id)
  }

  private async fetchStructureApi<T>(
    organizationId: string,
    action: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchStructureApi must only be called from the browser')
    }
    const url = new URL(`/api/organizations/${organizationId}/structure`, window.location.origin)
    if (!options?.method || options.method === 'GET') {
      url.searchParams.set('action', action)
    }
    const res = await fetch(url.toString(), {
      method: options?.method ?? 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body ? JSON.stringify({ action, ...options.body as object }) : undefined,
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `API error ${res.status}`)
    }
    return res.json()
  }

  private async fetchSettingsApi<T>(
    organizationId: string,
    action: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchSettingsApi must only be called from the browser')
    }
    const url = new URL(`/api/organizations/${organizationId}/settings`, window.location.origin)
    if (!options?.method || options.method === 'GET') {
      url.searchParams.set('action', action)
    }
    const res = await fetch(url.toString(), {
      method: options?.method ?? 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body ? JSON.stringify({ action, ...options.body as object }) : undefined,
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `API error ${res.status}`)
    }
    return res.json()
  }

  private async getCurrentOrganizationViaApi(): Promise<Organization | null> {
    const response = await fetch('/api/auth/organization', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 404) return null
    if (!response.ok) throw new Error(`Failed to fetch organization: ${response.status}`)
    const payload = await response.json()
    return payload.organization ?? null
  }

  /**
   * 組織情報を更新
   */
  async updateOrganization(id: string, updates: OrganizationUpdate): Promise<Organization | null> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(id, 'updateOrganization', { method: 'POST', body: { updates } })
    }
    const repo = await this.getRepository()
    const result = await repo.update(id, updates)

    if (result) {
      await this.logAudit({
        organizationId: id,
        action: 'organization.updated',
        resourceType: 'organization',
        resourceId: id,
        changes: updates as Record<string, unknown>
      })
    }

    return result
  }

  async updateMembershipRole(
    organizationId: string,
    userId: string,
    role: UserRole
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchStructureApi<void>(organizationId, 'updateMembershipRole', {
        method: 'POST', body: { userId, role }
      })
      return
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userMemberships, userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, and } = await import('drizzle-orm')
    const db = getDb()

    const now = new Date().toISOString()

    // Update membership role
    const membershipRows = await db
      .update(userMemberships)
      .set({ role, updatedAt: now })
      .where(and(
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.userId, userId)
      ))
      .returning({ userId: userMemberships.userId })

    if (!membershipRows || membershipRows.length === 0) {
      throw new Error('ロールの更新に失敗しました')
    }

    // Update profile role
    await db
      .update(userProfiles)
      .set({ role, updatedAt: now })
      .where(eq(userProfiles.id, userId))

    await this.logAudit({
      organizationId,
      action: 'user.role_updated',
      resourceType: 'user_profile',
      resourceId: userId,
      changes: { role }
    })
  }

  async updateIsmsPhase(
    id: string,
    phase: IsmsPhase,
    source: 'wizard' | 'settings' = 'settings'
  ): Promise<Organization | null> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(id, 'updateIsmsPhase', {
        method: 'POST',
        body: { phase, source }
      })
    }
    const repo = await this.getRepository()
    const result = await repo.updateIsmsPhase(id, phase, source)

    if (result) {
      await this.logAudit({
        organizationId: id,
        action: 'organization.phase_changed',
        resourceType: 'organization',
        resourceId: id,
        changes: { isms_phase: phase, source }
      })
    }

    return result
  }

  async getPhaseHistory(organizationId: string, limit = 20): Promise<PhaseHistoryEntry[]> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(organizationId, 'phaseHistory')
    }
    const repo = await this.getRepository()
    return repo.getPhaseHistory(organizationId, limit)
  }

  /**
   * ISMS適用範囲を取得
   */
  async getOrganizationScope(organizationId: string): Promise<OrganizationScopeRow | null> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(organizationId, 'scope')
    }
    const repo = await this.getRepository()
    return repo.getScope(organizationId)
  }

  /**
   * ISMS適用範囲を保存（存在しない場合は作成）
   */
  async upsertOrganizationScope(organizationId: string, scope: ScopePayload): Promise<OrganizationScopeRow> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(organizationId, 'upsertScope', { method: 'POST', body: { scope } })
    }
    const repo = await this.getRepository()
    const result = await repo.upsertScope(organizationId, scope)

    await this.logAudit({
      organizationId,
      action: 'organization.scope_upserted',
      resourceType: 'organization_isms_scope',
      resourceId: result.id,
      changes: scope
    })

    return result
  }

  /**
   * 部門一覧を取得
   */
  async getOrganizationDepartments(organizationId: string): Promise<DepartmentRow[]> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(organizationId, 'departments')
    }
    const repo = await this.getRepository()
    return repo.getDepartments(organizationId)
  }

  /**
   * 部門を作成
   */
  async createDepartment(organizationId: string, payload: DepartmentPayload): Promise<DepartmentRow> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(organizationId, 'createDepartment', { method: 'POST', body: { payload } })
    }
    const repo = await this.getRepository()
    const result = await repo.createDepartment(organizationId, payload)

    await this.logAudit({
      organizationId,
      action: 'organization.department_created',
      resourceType: 'organization_department',
      resourceId: result.id,
      changes: result as unknown as Record<string, unknown>
    })

    return result
  }

  /**
   * 部門を更新
   */
  async updateDepartment(
    organizationId: string,
    departmentId: string,
    payload: DepartmentPayload
  ): Promise<DepartmentRow> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi(organizationId, 'updateDepartment', { method: 'POST', body: { departmentId, payload } })
    }
    const repo = await this.getRepository()
    const result = await repo.updateDepartment(organizationId, departmentId, payload)

    await this.logAudit({
      organizationId,
      action: 'organization.department_updated',
      resourceType: 'organization_department',
      resourceId: departmentId,
      changes: payload
    })

    return result
  }

  /**
   * 部門を削除
   */
  async deleteDepartment(organizationId: string, departmentId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchSettingsApi(organizationId, 'deleteDepartment', { method: 'POST', body: { departmentId } })
      return
    }
    const repo = await this.getRepository()
    await repo.deleteDepartment(organizationId, departmentId)

    await this.logAudit({
      organizationId,
      action: 'organization.department_deleted',
      resourceType: 'organization_department',
      resourceId: departmentId,
      changes: null
    })
  }

  /**
   * 体制ロール一覧を取得
   */
  async getProjectRoles(organizationId: string): Promise<ProjectRole[]> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'projectRoles')
    }
    const repo = await this.getRepository()
    return repo.getProjectRoles(organizationId)
  }

  /**
   * 体制ロールを作成
   */
  async createProjectRole(
    organizationId: string,
    payload: ProjectRolePayload
  ): Promise<ProjectRole> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'createProjectRole', { method: 'POST', body: { payload } })
    }
    const repo = await this.getRepository()
    const result = await repo.createProjectRole(organizationId, payload)

    await this.logAudit({
      organizationId,
      action: 'organization.project_role_created',
      resourceType: 'project_role',
      resourceId: result.id,
      changes: result as unknown as Record<string, unknown>
    })

    return result
  }

  /**
   * 体制ロールを更新
   */
  async updateProjectRole(
    organizationId: string,
    roleId: string,
    payload: Partial<ProjectRolePayload>
  ): Promise<ProjectRole> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'updateProjectRole', { method: 'POST', body: { roleId, payload } })
    }
    const repo = await this.getRepository()
    const result = await repo.updateProjectRole(organizationId, roleId, payload)

    await this.logAudit({
      organizationId,
      action: 'organization.project_role_updated',
      resourceType: 'project_role',
      resourceId: roleId,
      changes: payload as Record<string, unknown>
    })

    return result
  }

  /**
   * 体制ロールを削除
   */
  async deleteProjectRole(organizationId: string, roleId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchStructureApi(organizationId, 'deleteProjectRole', { method: 'POST', body: { roleId } })
      return
    }
    const repo = await this.getRepository()
    await repo.deleteProjectRole(organizationId, roleId)

    await this.logAudit({
      organizationId,
      action: 'organization.project_role_deleted',
      resourceType: 'project_role',
      resourceId: roleId,
      changes: null
    })
  }

  /**
   * 体制アサインメント一覧を取得
   */
  async getProjectAssignments(organizationId: string): Promise<ProjectAssignmentDetails[]> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'projectAssignments')
    }
    const repo = await this.getRepository()
    return repo.getProjectAssignments(organizationId)
  }

  /**
   * 体制アサインメントを一括更新
   */
  async syncProjectAssignments(params: {
    organizationId: string
    roleIds: string[]
    userId?: string
    invitationId?: string
    note?: string | null
  }): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchStructureApi(params.organizationId, 'syncProjectAssignments', { method: 'POST', body: params })
      return
    }
    const repo = await this.getRepository()
    await repo.syncProjectAssignments(params)

    // Audit logging is handled inside the repository for sync operations
    // as it needs to track what was added/removed
  }

  /**
   * 指定ロールのアサインメントを保存
   */
  async setRoleAssignments(params: {
    organizationId: string
    roleId: string
    userIds: string[]
    invitationIds?: string[]
    note?: string | null
  }): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchStructureApi(params.organizationId, 'setRoleAssignments', { method: 'POST', body: params })
      return
    }
    const repo = await this.getRepository()
    await repo.setRoleAssignments(params)

    // Audit logging is handled inside the repository for sync operations
  }

  /**
   * ロールとアサインメントをまとめて取得
   */
  async getProjectStructure(organizationId: string): Promise<{
    roles: ProjectRole[]
    assignments: ProjectAssignmentDetails[]
  }> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'projectStructure')
    }
    const repo = await this.getRepository()
    const [roles, assignments] = await Promise.all([
      repo.getProjectRoles(organizationId),
      repo.getProjectAssignments(organizationId)
    ])

    return { roles, assignments }
  }

  /**
   * 推奨体制ロールを一括登録（ウィザード用）
   * 既存のキーはスキップし、新規のみ挿入する
   */
  async bulkUpsertProjectRoles(
    organizationId: string,
    roles: ProjectRolePayload[]
  ): Promise<{ success: boolean; inserted: number; skipped: number }> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'bulkUpsertProjectRoles', { method: 'POST', body: { roles } })
    }
    const repo = await this.getRepository()
    return repo.bulkUpsertProjectRoles(organizationId, roles)
  }

  /**
   * 組織の統計情報を取得
   */
  async getOrganizationStats(organizationId: string): Promise<OrganizationStats> {
    if (typeof window !== 'undefined') {
      return this.fetchSettingsApi<OrganizationStats>(organizationId, 'stats')
    }
    const repo = await this.getRepository()
    return repo.getStats(organizationId)
  }

  // ──────────────────────────────────────────────
  // CISO management
  // ──────────────────────────────────────────────

  /**
   * CISOを設定（組織内で1人のみ）
   * 既存のCISOを解除してから指定ユーザーにCISOフラグを付与する
   */
  async setCiso(organizationId: string, userId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchStructureApi<void>(organizationId, 'setCiso', {
        method: 'POST', body: { userId }
      })
      return
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, and } = await import('drizzle-orm')
    const db = getDb()

    const now = new Date().toISOString()

    // 1. 既存のCISOを解除
    await db
      .update(userProfiles)
      .set({ isCiso: false, updatedAt: now })
      .where(and(
        eq(userProfiles.organizationId, organizationId),
        eq(userProfiles.isCiso, true)
      ))

    // 2. 新しいCISOを設定
    await db
      .update(userProfiles)
      .set({ isCiso: true, updatedAt: now })
      .where(and(
        eq(userProfiles.id, userId),
        eq(userProfiles.organizationId, organizationId)
      ))

    await this.logAudit({
      organizationId,
      action: 'organization.ciso_updated',
      resourceType: 'user_profile',
      resourceId: userId,
      changes: { is_ciso: true }
    })
  }

  /**
   * CISOを解除
   */
  async clearCiso(organizationId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchStructureApi<void>(organizationId, 'clearCiso', {
        method: 'POST', body: {}
      })
      return
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, and } = await import('drizzle-orm')
    const db = getDb()

    const now = new Date().toISOString()

    await db
      .update(userProfiles)
      .set({ isCiso: false, updatedAt: now })
      .where(and(
        eq(userProfiles.organizationId, organizationId),
        eq(userProfiles.isCiso, true)
      ))

    await this.logAudit({
      organizationId,
      action: 'organization.ciso_cleared',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: { is_ciso: false }
    })
  }

  /**
   * 現在のCISOを取得
   */
  async getCurrentCiso(organizationId: string): Promise<{ id: string; full_name: string | null; email: string } | null> {
    if (typeof window !== 'undefined') {
      const result = await this.fetchStructureApi<{ ciso: { id: string; full_name: string | null; email: string } | null }>(organizationId, 'ciso')
      return result.ciso ?? null
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, and } = await import('drizzle-orm')
    const db = getDb()

    const rows = await db
      .select({
        id: userProfiles.id,
        full_name: userProfiles.fullName,
        email: userProfiles.email,
      })
      .from(userProfiles)
      .where(and(
        eq(userProfiles.organizationId, organizationId),
        eq(userProfiles.isCiso, true)
      ))
      .limit(1)

    if (rows.length === 0) return null

    return rows[0]
  }

  /**
   * 組織メンバー一覧を取得（CISO選択用）
   */
  async getOrganizationMembers(organizationId: string): Promise<{ id: string; full_name: string | null; email: string; role: string; is_ciso: boolean; primary_department_id?: string | null }[]> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'members')
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, asc } = await import('drizzle-orm')
    const db = getDb()

    const rows = await db
      .select({
        id: userProfiles.id,
        full_name: userProfiles.fullName,
        email: userProfiles.email,
        role: userProfiles.role,
        is_ciso: userProfiles.isCiso,
        primary_department_id: userProfiles.primaryDepartmentId,
      })
      .from(userProfiles)
      .where(eq(userProfiles.organizationId, organizationId))
      .orderBy(asc(userProfiles.fullName))

    return rows.map(r => ({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      role: r.role,
      is_ciso: r.is_ciso ?? false,
      primary_department_id: r.primary_department_id,
    }))
  }

  /**
   * 組織メンバー一覧をロールフラグ付きで取得（体制ロール一括割当用）
   */
  async getMembersWithRoleFlags(organizationId: string): Promise<{
    id: string
    full_name: string | null
    email: string
    is_security_manager: boolean
    is_audit_committee: boolean
    is_isms_promoter: boolean
  }[]> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'memberFlags')
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, asc } = await import('drizzle-orm')
    const db = getDb()

    const rows = await db
      .select({
        id: userProfiles.id,
        full_name: userProfiles.fullName,
        email: userProfiles.email,
        is_security_manager: userProfiles.isSecurityManager,
        is_audit_committee: userProfiles.isAuditCommittee,
        is_isms_promoter: userProfiles.isIsmsPromoter,
      })
      .from(userProfiles)
      .where(eq(userProfiles.organizationId, organizationId))
      .orderBy(asc(userProfiles.fullName))

    return rows.map(m => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email,
      is_security_manager: m.is_security_manager ?? false,
      is_audit_committee: m.is_audit_committee ?? false,
      is_isms_promoter: m.is_isms_promoter ?? false,
    }))
  }

  /**
   * 体制ロールフラグを一括更新
   * 指定されたメンバーにフラグをセットし、それ以外のメンバーからはフラグを外す
   */
  async bulkUpdateRoleFlags(
    organizationId: string,
    roleFlag: 'is_security_manager' | 'is_audit_committee' | 'is_isms_promoter',
    enabledMemberIds: string[]
  ): Promise<{ updated: number }> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'bulkUpdateRoleFlags', {
        method: 'POST', body: { roleFlag, enabledMemberIds }
      })
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema')
    const { eq, and, inArray } = await import('drizzle-orm')
    const db = getDb()

    const now = new Date().toISOString()

    // Map roleFlag string to Drizzle column
    const columnMap = {
      is_security_manager: userProfiles.isSecurityManager,
      is_audit_committee: userProfiles.isAuditCommittee,
      is_isms_promoter: userProfiles.isIsmsPromoter,
    } as const
    const column = columnMap[roleFlag]

    // 1. 対象組織の全メンバーのフラグをfalseにリセット
    await db
      .update(userProfiles)
      .set({ [column.name]: false, updatedAt: now } as any)
      .where(and(
        eq(userProfiles.organizationId, organizationId),
        eq(column, true)
      ))

    let updatedCount = 0

    // 2. 選択されたメンバーのフラグをtrueに設定
    if (enabledMemberIds.length > 0) {
      const updatedRows = await db
        .update(userProfiles)
        .set({ [column.name]: true, updatedAt: now } as any)
        .where(and(
          eq(userProfiles.organizationId, organizationId),
          inArray(userProfiles.id, enabledMemberIds)
        ))
        .returning({ id: userProfiles.id })

      updatedCount = updatedRows.length
    }

    await this.logAudit({
      organizationId,
      action: 'organization.role_flags_updated',
      resourceType: 'user_profile',
      changes: { roleFlag, enabledMemberIds, updatedCount }
    })

    return { updated: updatedCount }
  }

  // ──────────────────────────────────────────────
  // Structure snapshots
  // ──────────────────────────────────────────────

  /**
   * 体制スナップショットを保存
   */
  async createStructureSnapshot(organizationId: string, snapshotName: string): Promise<{ id: string }> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'createSnapshot', {
        method: 'POST', body: { snapshotName }
      })
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { projectRoles, projectAssignments, userProfiles, organizationStructureSnapshots } = await import('@/lib/db/drizzle/schema')
    const { eq, and } = await import('drizzle-orm')
    const db = getDb()

    // 現在の体制情報を取得
    const [rolesData, assignmentsData, cisoData, membersData] = await Promise.all([
      db.select().from(projectRoles).where(eq(projectRoles.organizationId, organizationId)),
      db.select().from(projectAssignments).where(eq(projectAssignments.organizationId, organizationId)),
      db.select({
        id: userProfiles.id,
        full_name: userProfiles.fullName,
        email: userProfiles.email,
      }).from(userProfiles).where(and(
        eq(userProfiles.organizationId, organizationId),
        eq(userProfiles.isCiso, true)
      )).limit(1),
      db.select({
        id: userProfiles.id,
        full_name: userProfiles.fullName,
        email: userProfiles.email,
        role: userProfiles.role,
        is_ciso: userProfiles.isCiso,
        is_security_manager: userProfiles.isSecurityManager,
      }).from(userProfiles).where(eq(userProfiles.organizationId, organizationId)),
    ])

    const payload = {
      roles: rolesData,
      assignments: assignmentsData,
      ciso: cisoData[0] ?? null,
      members: membersData,
      capturedAt: new Date().toISOString()
    }

    const userId = await this.getCurrentUserId()
    const snapshotId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(organizationStructureSnapshots).values({
      id: snapshotId,
      organizationId,
      snapshotName,
      snapshotPayload: JSON.stringify(payload),
      createdBy: userId,
      createdAt: now,
    })

    await this.logAudit({
      organizationId,
      action: 'organization.structure_snapshot_created',
      resourceType: 'organization_structure_snapshot',
      resourceId: snapshotId,
      changes: { snapshot_name: snapshotName }
    })

    return { id: snapshotId }
  }

  /**
   * スナップショット一覧を取得
   */
  async getStructureSnapshots(organizationId: string): Promise<{
    id: string
    snapshot_name: string
    created_by: string | null
    created_at: string
  }[]> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'snapshots')
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { organizationStructureSnapshots } = await import('@/lib/db/drizzle/schema')
    const { eq, desc } = await import('drizzle-orm')
    const db = getDb()

    const rows = await db
      .select({
        id: organizationStructureSnapshots.id,
        snapshotName: organizationStructureSnapshots.snapshotName,
        createdBy: organizationStructureSnapshots.createdBy,
        createdAt: organizationStructureSnapshots.createdAt,
      })
      .from(organizationStructureSnapshots)
      .where(eq(organizationStructureSnapshots.organizationId, organizationId))
      .orderBy(desc(organizationStructureSnapshots.createdAt))

    return rows.map(row => ({
      id: row.id,
      snapshot_name: row.snapshotName,
      created_by: row.createdBy,
      created_at: row.createdAt ?? '',
    }))
  }

  /**
   * 2つのスナップショットを比較
   */
  async compareSnapshots(
    snapshotId1: string,
    snapshotId2: string,
    organizationId?: string
  ): Promise<{
    added: Record<string, unknown>[]
    removed: Record<string, unknown>[]
    changed: { key: string; before: unknown; after: unknown }[]
  }> {
    if (typeof window !== 'undefined') {
      if (!organizationId) throw new Error('organizationId is required in browser context')
      return this.fetchStructureApi(organizationId, 'compareSnapshots', {
        method: 'POST',
        body: { snapshotId1, snapshotId2 }
      })
    }
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { organizationStructureSnapshots } = await import('@/lib/db/drizzle/schema')
    const { inArray, and, eq } = await import('drizzle-orm')
    const db = getDb()

    const conditions = [inArray(organizationStructureSnapshots.id, [snapshotId1, snapshotId2])]
    if (organizationId) {
      conditions.push(eq(organizationStructureSnapshots.organizationId, organizationId))
    }

    const rows = await db
      .select({
        id: organizationStructureSnapshots.id,
        snapshotPayload: organizationStructureSnapshots.snapshotPayload,
      })
      .from(organizationStructureSnapshots)
      .where(and(...conditions))

    if (rows.length !== 2) {
      throw new Error('スナップショットの取得に失敗しました')
    }

    const snap1Row = rows.find(d => d.id === snapshotId1)!
    const snap2Row = rows.find(d => d.id === snapshotId2)!
    const snap1 = snap1Row.snapshotPayload ? JSON.parse(snap1Row.snapshotPayload) : {}
    const snap2 = snap2Row.snapshotPayload ? JSON.parse(snap2Row.snapshotPayload) : {}

    return this.diffSnapshots(snap1, snap2)
  }

  /**
   * スナップショットの差分を計算
   */
  private diffSnapshots(
    older: Record<string, unknown>,
    newer: Record<string, unknown>
  ): {
    added: Record<string, unknown>[]
    removed: Record<string, unknown>[]
    changed: { key: string; before: unknown; after: unknown }[]
  } {
    const added: Record<string, unknown>[] = []
    const removed: Record<string, unknown>[] = []
    const changed: { key: string; before: unknown; after: unknown }[] = []

    // Compare roles
    const olderRoles = (older.roles as { id: string; name: string }[] | undefined) ?? []
    const newerRoles = (newer.roles as { id: string; name: string }[] | undefined) ?? []
    const olderRoleIds = new Set(olderRoles.map(r => r.id))
    const newerRoleIds = new Set(newerRoles.map(r => r.id))

    for (const role of newerRoles) {
      if (!olderRoleIds.has(role.id)) {
        added.push({ type: 'role', ...role })
      }
    }
    for (const role of olderRoles) {
      if (!newerRoleIds.has(role.id)) {
        removed.push({ type: 'role', ...role })
      }
    }

    // Compare role name changes
    for (const newerRole of newerRoles) {
      if (olderRoleIds.has(newerRole.id)) {
        const olderRole = olderRoles.find(r => r.id === newerRole.id)!
        if (olderRole.name !== newerRole.name) {
          changed.push({
            key: `role:${newerRole.id}`,
            before: olderRole,
            after: newerRole
          })
        }
      }
    }

    // Compare CISO
    const olderCiso = older.ciso as { id: string; full_name: string | null } | null
    const newerCiso = newer.ciso as { id: string; full_name: string | null } | null
    if (olderCiso?.id !== newerCiso?.id) {
      changed.push({
        key: 'ciso',
        before: olderCiso,
        after: newerCiso
      })
    }

    // Compare assignments
    const olderAssignments = (older.assignments as { id: string; role_id: string; user_id: string | null }[] | undefined) ?? []
    const newerAssignments = (newer.assignments as { id: string; role_id: string; user_id: string | null }[] | undefined) ?? []
    const olderAssignmentIds = new Set(olderAssignments.map(a => a.id))
    const newerAssignmentIds = new Set(newerAssignments.map(a => a.id))

    for (const assignment of newerAssignments) {
      if (!olderAssignmentIds.has(assignment.id)) {
        added.push({ type: 'assignment', ...assignment })
      }
    }
    for (const assignment of olderAssignments) {
      if (!newerAssignmentIds.has(assignment.id)) {
        removed.push({ type: 'assignment', ...assignment })
      }
    }

    return { added, removed, changed }
  }
}
