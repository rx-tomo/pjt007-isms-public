/**
 * User Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IUserRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 *
 * Note: Methods that require external API calls (inviteUser, acceptInvitation)
 * still use fetch for email notifications and billing synchronization.
 */
import { getUserRepository, getAuditLogRepository, getAuthProvider } from '@/lib/container'
import type { IUserRepository, UserProfile, UserProfileUpdate, OrganizationInvitation, UserRole } from '@/lib/db/repositories/interfaces/IUserRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { Json } from '@/types/database.types'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'

// Re-export types for backward compatibility
export type { UserProfile, UserRole }

export class UserService {
  private repositoryPromise: Promise<IUserRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null

  private async getRepository(): Promise<IUserRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getUserRepository()
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

  private async getCurrentUserViaApi(): Promise<UserProfile | null> {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      if (response.status === 401 || response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch current user profile: ${response.status}`)
      }

      const payload = await response.json() as { profile?: UserProfile | null }
      return payload.profile ?? null
    } catch (error) {
      console.error('Failed to fetch current user via API:', error)
      return null
    }
  }

  private async fetchStructureApi<T>(organizationId: string, action: string): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchStructureApi must only be called from the browser')
    }

    const url = new URL(`/api/organizations/${organizationId}/structure`, window.location.origin)
    url.searchParams.set('action', action)

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  private async logAudit(params: {
    action: string
    resourceType: string
    resourceId?: string | null
    changes?: Record<string, unknown> | null
    organizationId?: string | null
  }): Promise<void> {
    try {
      const [auditLog, userId] = await Promise.all([
        this.getAuditLog(),
        this.getCurrentUserId()
      ])

      // Get organization ID from current user if not provided
      let orgId = params.organizationId
      if (!orgId && userId) {
        const repo = await this.getRepository()
        const userProfile = await repo.findById(userId)
        orgId = userProfile?.organization_id ?? null
      }

      if (orgId) {
        await auditLog.log({
          organizationId: orgId,
          userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId ?? null,
          changes: params.changes as Json
        })
      }
    } catch (err) {
      console.error('Audit logging failed:', err)
    }
  }

  /**
   * 現在のユーザープロファイルを取得
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    // Never access DB repositories directly in the browser.
    // Client runtime must resolve the profile via API.
    if (typeof window !== 'undefined') {
      return this.getCurrentUserViaApi()
    }

    const auth = await this.getAuth()
    const user = await auth.getUser()

    if (!user) {
      return null
    }

    const repo = await this.getRepository()
    return repo.findByAuthId(user.id)
  }

  /**
   * ユーザープロファイルを取得（getCurrentUserのエイリアス）
   */
  async getUserProfile(): Promise<UserProfile | null> {
    return this.getCurrentUser()
  }

  private async getUserProfileById(userId: string): Promise<UserProfile | null> {
    const repo = await this.getRepository()
    return repo.findById(userId)
  }

  /**
   * 組織内のユーザー一覧を取得
   */
  async getOrganizationUsers(
    organizationId: string,
    options?: {
      departmentId?: string | null
    }
  ): Promise<UserProfile[]> {
    if (typeof window !== 'undefined') {
      const members = await this.fetchStructureApi<UserProfile[]>(organizationId, 'members')
      if (!options?.departmentId) {
        return members
      }
      return members.filter(member => member.primary_department_id === options.departmentId)
    }
    const repo = await this.getRepository()
    return repo.getOrganizationUsers(organizationId, options)
  }

  /**
   * 組織内ユーザーを部門スコープ付きで取得
   */
  async getOrganizationUsersScoped(organizationId: string, requestingUserId: string): Promise<UserProfile[]> {
    if (typeof window !== 'undefined') {
      const members = await this.fetchStructureApi<UserProfile[]>(organizationId, 'members')
      const requestingUser = members.find(member => member.id === requestingUserId)
      if (!requestingUser) {
        throw new Error('Requesting user not found')
      }

      if (hasFullDepartmentAccess(requestingUser.role)) {
        return members
      }

      const departmentId = requestingUser.primary_department_id ?? DEPARTMENT_UNASSIGNED_VALUE
      return members.filter(member => member.primary_department_id === departmentId)
    }

    const repo = await this.getRepository()
    const requestingUser = await this.getUserProfileById(requestingUserId)
    if (!requestingUser) {
      throw new Error('Requesting user not found')
    }

    if (hasFullDepartmentAccess(requestingUser.role)) {
      return repo.getOrganizationUsers(organizationId)
    }

    const departmentId = requestingUser.primary_department_id ?? DEPARTMENT_UNASSIGNED_VALUE
    return repo.getOrganizationUsers(organizationId, { departmentId })
  }

  /**
   * 承諾待ちの組織招待を取得
   */
  async getPendingInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    if (typeof window !== 'undefined') {
      return this.fetchStructureApi(organizationId, 'pendingInvitations')
    }
    const repo = await this.getRepository()
    return repo.getPendingInvitations(organizationId)
  }

  /**
   * ユーザープロファイルを更新
   */
  async updateUserProfile(userId: string, updates: UserProfileUpdate): Promise<UserProfile | null> {
    const repo = await this.getRepository()
    const result = await repo.update(userId, updates)

    if (result) {
      await this.logAudit({
        action: 'user.updated',
        resourceType: 'user_profile',
        resourceId: userId,
        changes: updates as Record<string, unknown>,
        organizationId: result.organization_id
      })
    }

    return result
  }

  /**
   * ユーザープロファイルを更新（updateUserProfileのエイリアス）
   */
  async updateUser(userId: string, updates: UserProfileUpdate): Promise<UserProfile | null> {
    return this.updateUserProfile(userId, updates)
  }

  /**
   * ユーザーを組織に招待
   *
   * Note: This method uses fetch for sending invitation emails via API.
   */
  async inviteUser(
    organizationId: string,
    email: string,
    role: UserRole,
    invitedBy: string,
    options?: {
      organizationName?: string | null
      invitedByName?: string | null
      locale?: string
    }
  ): Promise<OrganizationInvitation> {
    const normalizedEmail = email.trim().toLowerCase()
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationId,
          email: normalizedEmail,
          role,
          locale: options?.locale,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error || '招待の作成に失敗しました')
      }

      return response.json()
    }

    // 招待トークンを生成
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7日後に期限切れ

    const repo = await this.getRepository()
    const invitation = await repo.createInvitation({
      organizationId,
      email: normalizedEmail,
      role,
      invitedBy,
      token,
      expiresAt
    })

    // Send invitation email via API
    try {
      const response = await fetch('/api/notifications/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          token,
          invitationId: invitation.id,
          organizationId,
          organizationName: options?.organizationName,
          invitedById: invitedBy,
          invitedByName: options?.invitedByName,
          locale: options?.locale,
          expiresAt: expiresAt.toISOString()
        })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const message = errorBody?.error || '招待メールの送信に失敗しました'
        throw new Error(message)
      }
    } catch (error) {
      console.error('Invitation email send failed', error)
      throw error instanceof Error
        ? error
        : new Error('招待メールの送信に失敗しました')
    }

    // 監査ログに記録
    await this.logAudit({
      action: 'user.invited',
      resourceType: 'organization_invitation',
      resourceId: invitation.id,
      changes: { email: normalizedEmail, role },
      organizationId
    })

    return invitation
  }

  /**
   * 招待を受け入れる
   *
   * Note: This method uses fetch for billing plan synchronization.
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    const repo = await this.getRepository()

    // 有効な招待を取得
    const invitation = await repo.findInvitationByToken(token)
    if (!invitation) {
      throw new Error('無効または期限切れの招待です')
    }

    // ユーザープロファイルを作成
    await repo.create({
      id: userId,
      organization_id: invitation.organization_id,
      email: invitation.email,
      role: invitation.role,
      full_name: '', // 後でプロファイル編集で設定
      is_active: true
    })

    // メンバーシップを作成
    try {
      await repo.createMembership({
        userId,
        organizationId: invitation.organization_id,
        role: invitation.role
      })
    } catch (membershipError) {
      // メンバーシップ作成失敗時はプロファイルも削除
      console.error('Membership creation error:', membershipError)
      await repo.delete(userId)
      throw new Error('メンバーシップの作成に失敗しました')
    }

    // 招待に紐づく体制ロールをユーザーへ引き継ぎ
    await repo.transferProjectAssignments(invitation.id, userId)

    // 招待を承認済みにマーク
    await repo.acceptInvitation(invitation.id)

    // 追加座席の課金状態を同期
    try {
      await fetch('/api/billing/ensure-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: invitation.organization_id })
      })
    } catch (error) {
      console.error('Failed to ensure plan capacity after invitation acceptance', error)
    }

    // 監査ログに記録
    await this.logAudit({
      action: 'invitation.accepted',
      resourceType: 'organization_invitation',
      resourceId: invitation.id,
      changes: { user_id: userId },
      organizationId: invitation.organization_id
    })
  }

  /**
   * ユーザーのアクティブ状態を切り替え
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    const repo = await this.getRepository()

    // Get the user profile first to get organization_id for audit log
    const userProfile = await repo.findById(userId)

    await repo.toggleUserStatus(userId, isActive)

    // 監査ログに記録
    await this.logAudit({
      action: isActive ? 'user.activated' : 'user.deactivated',
      resourceType: 'user_profile',
      resourceId: userId,
      changes: { is_active: isActive },
      organizationId: userProfile?.organization_id
    })
  }

  /**
   * ユーザーのロールを確認
   */
  async hasRole(userId: string, roles: UserRole[]): Promise<boolean> {
    const repo = await this.getRepository()
    return repo.hasRole(userId, roles)
  }
}
