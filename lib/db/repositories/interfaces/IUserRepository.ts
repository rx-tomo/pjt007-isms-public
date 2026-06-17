import type { Database } from '@/types/database.types'
import type { IBaseRepository, IOrganizationScopedRepository } from './IBaseRepository'

// Database types
type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
type OrganizationInvitation = Database['public']['Tables']['organization_invitations']['Row']
type OrganizationInvitationInsert = Database['public']['Tables']['organization_invitations']['Insert']
type UserRole = Database['public']['Enums']['user_role']

// Re-export for convenience
export type {
  UserProfile,
  UserProfileInsert,
  UserProfileUpdate,
  OrganizationInvitation,
  OrganizationInvitationInsert,
  UserRole
}

/**
 * Invitation options for sending emails
 */
export interface InvitationOptions {
  organizationName?: string | null
  invitedByName?: string | null
  locale?: string
}

/**
 * User Repository Interface
 *
 * Handles all user-related data operations including:
 * - User profile CRUD
 * - Organization membership
 * - Invitations
 */
export interface IUserRepository extends IOrganizationScopedRepository<UserProfile, UserProfileInsert, UserProfileUpdate> {
  /**
   * Find a user by their auth ID
   */
  findByAuthId(authId: string): Promise<UserProfile | null>

  /**
   * Get all users in an organization
   */
  getOrganizationUsers(
    organizationId: string,
    options?: {
      departmentId?: string | null
    }
  ): Promise<UserProfile[]>

  /**
   * Toggle user active status
   */
  toggleUserStatus(userId: string, isActive: boolean): Promise<void>

  /**
   * Check if user has specific roles
   */
  hasRole(userId: string, roles: UserRole[]): Promise<boolean>

  // Invitation operations
  /**
   * Get pending invitations for an organization
   */
  getPendingInvitations(organizationId: string): Promise<OrganizationInvitation[]>

  /**
   * Create an invitation
   */
  createInvitation(params: {
    organizationId: string
    email: string
    role: UserRole
    invitedBy: string
    token: string
    expiresAt: Date
  }): Promise<OrganizationInvitation>

  /**
   * Find an invitation by token
   */
  findInvitationByToken(token: string): Promise<OrganizationInvitation | null>

  /**
   * Mark an invitation as accepted
   */
  acceptInvitation(invitationId: string): Promise<void>

  // Membership operations
  /**
   * Create user membership
   */
  createMembership(params: {
    userId: string
    organizationId: string
    role: UserRole
  }): Promise<void>

  /**
   * Update membership role
   */
  updateMembershipRole(organizationId: string, userId: string, role: UserRole): Promise<void>

  /**
   * Transfer project assignments from invitation to user
   */
  transferProjectAssignments(invitationId: string, userId: string): Promise<void>
}
