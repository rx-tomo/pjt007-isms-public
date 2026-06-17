/**
 * SQLite User Repository
 *
 * Implements IUserRepository using Drizzle ORM with SQLite.
 * Handles user profile CRUD, organization membership, and invitations
 * with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - Converts boolean fields (is_active, isCiso, etc.) to integer (0/1) for SQLite
 * - All organization-scoped queries include organization_id filtering
 * - findByAuthId maps to findById (auth_id == user profile id in this system)
 *
 * @module lib/db/repositories/sqlite/UserRepository
 */

import { eq, and, gte, isNull } from 'drizzle-orm'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import { userProfiles, userMemberships, organizationInvitations } from '@/lib/db/drizzle/schema/users'
import { projectAssignments } from '@/lib/db/drizzle/schema/organizations'
import type {
  IUserRepository,
  UserProfile,
  UserProfileInsert,
  UserProfileUpdate,
  OrganizationInvitation,
  UserRole
} from '../interfaces/IUserRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteUserRepository extends BaseSQLiteRepository implements IUserRepository {
  /**
   * Constructor accepts an optional db override for testing (dependency injection)
   */
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  // =========================================
  // Base Repository Methods (IBaseRepository)
  // =========================================

  /**
   * Find a user by their ID
   */
  async findById(id: string): Promise<UserProfile | null> {
    const rows = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, id))

    if (rows.length === 0) return null

    return this.mapUserRowToEntity(rows[0])
  }

  /**
   * Find multiple users with optional filters
   */
  async findMany(filters?: Record<string, unknown>): Promise<UserProfile[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db.select().from(userProfiles)
      return rows.map(row => this.mapUserRowToEntity(row))
    }

    // Build conditions from filters
    const conditions = Object.entries(filters).map(([key, value]) => {
      const column = userProfiles[key as keyof typeof userProfiles.$inferSelect]
      if (!column) {
        throw new Error(`Unknown column: ${key}`)
      }
      return eq(column as ReturnType<typeof eq extends (a: infer A, ...args: unknown[]) => unknown ? () => A : never>, value as string)
    })

    const rows = await this.db
      .select()
      .from(userProfiles)
      .where(and(...conditions))

    return rows.map(row => this.mapUserRowToEntity(row))
  }

  /**
   * Create a new user profile
   *
   * Accepts snake_case snake_case input and converts to Drizzle camelCase.
   */
  async create(data: UserProfileInsert): Promise<UserProfile> {
    const id = (data as Record<string, unknown>).id as string || crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: (data as Record<string, unknown>).organization_id as string ?? null,
      email: (data as Record<string, unknown>).email as string,
      fullName: (data as Record<string, unknown>).full_name as string,
      fullNameEn: (data as Record<string, unknown>).full_name_en as string ?? null,
      role: (data as Record<string, unknown>).role as string,
      department: (data as Record<string, unknown>).department as string ?? null,
      position: (data as Record<string, unknown>).position as string ?? null,
      phone: (data as Record<string, unknown>).phone as string ?? null,
      isActive: (data as Record<string, unknown>).is_active !== false,
      avatarUrl: (data as Record<string, unknown>).avatar_url as string ?? null,
      languagePreference: (data as Record<string, unknown>).language_preference as string ?? 'ja',
      primaryDepartmentId: (data as Record<string, unknown>).primary_department_id as string ?? null,
      createdAt: (data as Record<string, unknown>).created_at as string ?? now,
      updatedAt: (data as Record<string, unknown>).updated_at as string ?? now,
      lastLoginAt: (data as Record<string, unknown>).last_login_at as string ?? null,
    }

    await this.db.insert(userProfiles).values(row)

    this.logDataAccess('create user profile', row.organizationId ?? 'none', { id })

    return this.mapUserRowToEntity({
      ...row,
      isActive: row.isActive ? 1 : 0,
      isCiso: 0,
      isSecurityManager: 0,
      isOrgAdmin: 0,
      isAuditCommittee: 0,
      isIsmsPromoter: 0,
    })
  }

  /**
   * Update an existing user profile
   *
   * Accepts snake_case snake_case updates.
   */
  async update(id: string, updates: UserProfileUpdate): Promise<UserProfile | null> {
    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = { updatedAt: now }

    // Map snake_case input keys to camelCase Drizzle columns
    const keyMap: Record<string, string> = {
      email: 'email',
      full_name: 'fullName',
      full_name_en: 'fullNameEn',
      role: 'role',
      department: 'department',
      position: 'position',
      phone: 'phone',
      is_active: 'isActive',
      avatar_url: 'avatarUrl',
      language_preference: 'languagePreference',
      primary_department_id: 'primaryDepartmentId',
      organization_id: 'organizationId',
      last_login_at: 'lastLoginAt',
    }

    const updateInput = updates as Record<string, unknown>
    for (const [snakeKey, camelKey] of Object.entries(keyMap)) {
      if (snakeKey in updateInput) {
        updateData[camelKey] = updateInput[snakeKey]
      }
    }

    await this.db
      .update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.id, id))

    return this.findById(id)
  }

  /**
   * Delete a user profile by ID
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(userProfiles)
      .where(eq(userProfiles.id, id))
  }

  // =========================================
  // Organization Scoped Methods
  // =========================================

  /**
   * Find all users for a specific organization
   *
   * Delegates to getOrganizationUsers for consistent behavior.
   */
  async findByOrganizationId(
    organizationId: string,
    options?: {
      departmentId?: string | null
    }
  ): Promise<UserProfile[]> {
    return this.getOrganizationUsers(organizationId, options)
  }

  // =========================================
  // User-specific Methods
  // =========================================

  /**
   * Find a user by their auth ID
   *
   * In this system, auth_id maps directly to user profile id.
   */
  async findByAuthId(authId: string): Promise<UserProfile | null> {
    return this.findById(authId)
  }

  /**
   * Get all users in an organization
   *
   * Queries user_memberships joined with user_profiles to find
   * active members. Returns user profiles enriched with role and
   * organization_id from the membership.
   */
  async getOrganizationUsers(
    organizationId: string,
    options?: {
      departmentId?: string | null
    }
  ): Promise<UserProfile[]> {
    const hasDepartmentFilter = options?.departmentId !== undefined
    const departmentFilter = hasDepartmentFilter
      ? options.departmentId === DEPARTMENT_UNASSIGNED_VALUE
        ? null
        : options.departmentId
      : undefined

    this.requireOrganizationId(organizationId, 'getOrganizationUsers')

    // Query memberships with active status
    const membershipRows = await this.db
      .select()
      .from(userMemberships)
      .where(
        and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.status, 'active')
        )
      )

    if (membershipRows.length === 0) return []

    // Fetch user profiles for each membership
    const users: UserProfile[] = []
    for (const membership of membershipRows) {
      const userRows = await this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, membership.userId))

      if (userRows.length > 0) {
        const user = this.mapUserRowToEntity(userRows[0])
        if (hasDepartmentFilter && user.primary_department_id !== departmentFilter) {
          continue
        }
        users.push({
          ...user,
          role: membership.role as UserProfile['role'],
          organization_id: membership.organizationId,
        })
      }
    }

    this.logDataAccess('getOrganizationUsers', organizationId, { count: users.length })

    return users
  }

  /**
   * Toggle user active status
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    await this.db
      .update(userProfiles)
      .set({ isActive })
      .where(eq(userProfiles.id, userId))
  }

  /**
   * Check if user has specific roles
   */
  async hasRole(userId: string, roles: UserRole[]): Promise<boolean> {
    const rows = await this.db
      .select({ role: userProfiles.role })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))

    if (rows.length === 0) return false

    return roles.includes(rows[0].role as UserRole)
  }

  // =========================================
  // Invitation Operations
  // =========================================

  /**
   * Get pending invitations for an organization
   *
   * Returns invitations that have not been accepted (accepted_at is null).
   */
  async getPendingInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    this.requireOrganizationId(organizationId, 'getPendingInvitations')

    const rows = await this.db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          isNull(organizationInvitations.acceptedAt)
        )
      )

    return rows.map(row => this.mapInvitationRowToEntity(row))
  }

  /**
   * Create an invitation
   */
  async createInvitation(params: {
    organizationId: string
    email: string
    role: UserRole
    invitedBy: string
    token: string
    expiresAt: Date
  }): Promise<OrganizationInvitation> {
    this.requireOrganizationId(params.organizationId, 'createInvitation')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: params.organizationId,
      email: params.email.trim().toLowerCase(),
      role: params.role,
      invitedBy: params.invitedBy,
      token: params.token,
      expiresAt: params.expiresAt.toISOString(),
      acceptedAt: null as string | null,
      createdAt: now,
    }

    await this.db.insert(organizationInvitations).values(row)

    this.logDataAccess('createInvitation', params.organizationId, {
      id,
      email: row.email,
    })

    return this.mapInvitationRowToEntity(row)
  }

  /**
   * Find an invitation by token
   *
   * Only returns invitations that are:
   * - Not yet accepted (accepted_at is null)
   * - Not expired (expires_at >= now)
   */
  async findInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
    const now = new Date().toISOString()

    const rows = await this.db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.token, token),
          isNull(organizationInvitations.acceptedAt),
          gte(organizationInvitations.expiresAt, now)
        )
      )

    if (rows.length === 0) return null

    return this.mapInvitationRowToEntity(rows[0])
  }

  /**
   * Mark an invitation as accepted
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    const now = new Date().toISOString()

    await this.db
      .update(organizationInvitations)
      .set({ acceptedAt: now })
      .where(eq(organizationInvitations.id, invitationId))
  }

  // =========================================
  // Membership Operations
  // =========================================

  /**
   * Create user membership
   *
   * Creates a new membership record linking a user to an organization with a role.
   * If a membership already exists, it is effectively an upsert (insert or update).
   */
  async createMembership(params: {
    userId: string
    organizationId: string
    role: UserRole
  }): Promise<void> {
    this.requireOrganizationId(params.organizationId, 'createMembership')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Check if membership already exists
    const existing = await this.db
      .select()
      .from(userMemberships)
      .where(
        and(
          eq(userMemberships.userId, params.userId),
          eq(userMemberships.organizationId, params.organizationId)
        )
      )

    if (existing.length > 0) {
      // Update existing membership
      await this.db
        .update(userMemberships)
        .set({
          role: params.role,
          status: 'active',
          updatedAt: now,
        })
        .where(
          and(
            eq(userMemberships.userId, params.userId),
            eq(userMemberships.organizationId, params.organizationId)
          )
        )
    } else {
      // Insert new membership
      await this.db.insert(userMemberships).values({
        id,
        userId: params.userId,
        organizationId: params.organizationId,
        role: params.role,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }

    this.logDataAccess('createMembership', params.organizationId, {
      userId: params.userId,
      role: params.role,
    })
  }

  /**
   * Update membership role
   *
   * Updates both the membership role and the user profile role.
   */
  async updateMembershipRole(organizationId: string, userId: string, role: UserRole): Promise<void> {
    this.requireOrganizationId(organizationId, 'updateMembershipRole')

    const now = new Date().toISOString()

    // Update membership
    await this.db
      .update(userMemberships)
      .set({ role, updatedAt: now })
      .where(
        and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.userId, userId)
        )
      )

    // Update user profile role
    await this.db
      .update(userProfiles)
      .set({ role, updatedAt: now })
      .where(eq(userProfiles.id, userId))

    this.logDataAccess('updateMembershipRole', organizationId, {
      userId,
      newRole: role,
    })
  }

  /**
   * Transfer project assignments from invitation to user
   *
   * When an invited user accepts, their project_assignments (linked by invitation_id)
   * are updated to point to the actual user_id.
   */
  async transferProjectAssignments(invitationId: string, userId: string): Promise<void> {
    try {
      await this.db
        .update(projectAssignments)
        .set({
          userId,
          invitationId: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projectAssignments.invitationId, invitationId))
    } catch (error) {
      this.logError('transferProjectAssignments', error, { invitationId, userId })
    }
  }

  // =========================================
  // Private Mapping Helpers
  // =========================================

  /**
   * Maps a Drizzle user_profiles row to the UserProfile entity
   * (Database['public']['Tables']['user_profiles']['Row'])
   *
   * Key transformations:
   * - camelCase Drizzle columns -> snake_case snake_case row
   * - is_active: integer/boolean -> boolean | null
   */
  private mapUserRowToEntity(row: {
    id: string
    organizationId: string | null
    email: string
    fullName: string
    fullNameEn: string | null
    role: string
    department: string | null
    position: string | null
    phone: string | null
    isActive: number | boolean | null
    avatarUrl: string | null
    languagePreference: string | null
    primaryDepartmentId: string | null
    createdAt: string | null
    updatedAt: string | null
    lastLoginAt: string | null
    [key: string]: unknown
  }): UserProfile {
    // Convert isActive from integer/boolean to boolean | null
    let isActive: boolean | null = null
    if (row.isActive === 1 || row.isActive === true) {
      isActive = true
    } else if (row.isActive === 0 || row.isActive === false) {
      isActive = false
    }

    return {
      id: row.id,
      organization_id: row.organizationId,
      email: row.email,
      full_name: row.fullName,
      full_name_en: row.fullNameEn,
      role: row.role as UserProfile['role'],
      department: row.department,
      position: row.position,
      phone: row.phone,
      is_active: isActive,
      avatar_url: row.avatarUrl,
      language_preference: row.languagePreference,
      primary_department_id: row.primaryDepartmentId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      last_login_at: row.lastLoginAt,
    }
  }

  /**
   * Maps a Drizzle organization_invitations row to the OrganizationInvitation entity
   * (Database['public']['Tables']['organization_invitations']['Row'])
   */
  private mapInvitationRowToEntity(row: {
    id: string
    organizationId: string
    email: string
    role: string
    invitedBy: string
    token: string
    expiresAt: string
    acceptedAt: string | null
    createdAt: string | null
  }): OrganizationInvitation {
    return {
      id: row.id,
      organization_id: row.organizationId,
      email: row.email,
      role: row.role as OrganizationInvitation['role'],
      invited_by: row.invitedBy,
      token: row.token,
      expires_at: row.expiresAt,
      accepted_at: row.acceptedAt,
      created_at: row.createdAt,
    }
  }
}
