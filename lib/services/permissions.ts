import { getDb } from '@/lib/db/drizzle/client'
import { userPermissionSets, auditLogs, userMemberships } from '@/lib/db/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { defaultPermissions } from '../constants/permissions'
import {
  assertActiveOrganizationMember,
  badMemberMutationRequest,
  isMemberTenantInvariantError,
  MemberTenantInvariantError,
  withImmediateMemberTransaction,
} from '@/lib/services/memberTenantInvariant'

const permissionKeys = [
  'can_manage_documents',
  'can_manage_risks',
  'can_manage_tasks',
  'can_manage_audit',
  'can_manage_assets',
  'can_manage_controls',
] as const

type PermissionKey = (typeof permissionKeys)[number]
type ValidatedPermissionUpdate = Partial<Record<PermissionKey, boolean>>

/** snake_case interface matching the old snake_case row shape */
export interface PermissionSet {
  id: string
  organization_id: string
  user_id: string
  can_manage_documents: boolean | null
  can_manage_risks: boolean | null
  can_manage_tasks: boolean | null
  can_manage_audit: boolean | null
  can_manage_assets: boolean | null
  can_manage_controls: boolean | null
  created_at: string | null
  updated_at: string | null
}

export { defaultPermissions } from '../constants/permissions'
export type { PermissionUpdate } from '../constants/permissions'

export function parsePermissionUpdate(value: unknown): ValidatedPermissionUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badMemberMutationRequest('permissions must be an object')
  }

  const record = value as Record<string, unknown>
  const allowed = new Set<string>(permissionKeys)
  const keys = Object.keys(record)
  if (keys.length === 0 || keys.some(key => !allowed.has(key))) {
    badMemberMutationRequest('permissions must contain only recognized keys')
  }

  const parsed: ValidatedPermissionUpdate = {}
  for (const key of keys as PermissionKey[]) {
    if (typeof record[key] !== 'boolean') {
      badMemberMutationRequest(`${key} must be boolean`)
    }
    parsed[key] = record[key]
  }
  return parsed
}

/** Map Drizzle row (camelCase) to service interface (snake_case) */
function mapPermissionRow(row: typeof userPermissionSets.$inferSelect): PermissionSet {
  return {
    id: row.id,
    organization_id: row.organizationId,
    user_id: row.userId,
    can_manage_documents: row.canManageDocuments,
    can_manage_risks: row.canManageRisks,
    can_manage_tasks: row.canManageTasks,
    can_manage_audit: row.canManageAudit,
    can_manage_assets: row.canManageAssets,
    can_manage_controls: row.canManageControls,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class PermissionService {
  constructor(private readonly injectedDb?: ReturnType<typeof getDb>) {}

  private get db(): ReturnType<typeof getDb> {
    return this.injectedDb ?? getDb()
  }

  getDefaultPermissions() {
    return { ...defaultPermissions }
  }

  async getUserPermissions(organizationId: string, userId: string): Promise<PermissionSet | null> {
    if (typeof window !== 'undefined') {
      const url = new URL(`/api/organizations/${organizationId}/members/permissions`, window.location.origin)
      url.searchParams.set('userId', userId)
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        if (response.status === 400 || response.status === 404) {
          throw new MemberTenantInvariantError(
            response.status,
            errorBody?.error || '権限の取得に失敗しました'
          )
        }
        throw new Error(errorBody?.error || '権限の取得に失敗しました')
      }

      const payload = await response.json() as { permissions?: PermissionSet | null }
      return payload.permissions ?? null
    }

    const db = this.db

    try {
      const rows = await db
        .select({
          membershipId: userMemberships.id,
          permissions: userPermissionSets,
        })
        .from(userMemberships)
        .leftJoin(userPermissionSets, and(
          eq(userPermissionSets.organizationId, organizationId),
          eq(userPermissionSets.userId, userId)
        ))
        .where(and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.userId, userId),
          eq(userMemberships.status, 'active')
        ))
        .limit(1)

      if (!rows[0]) {
        throw new MemberTenantInvariantError(404, 'Member not found')
      }
      return rows[0].permissions ? mapPermissionRow(rows[0].permissions) : null
    } catch (error) {
      if (isMemberTenantInvariantError(error)) throw error
      console.error('Failed to fetch user permissions', error)
      throw new Error('権限の取得に失敗しました')
    }
  }

  async upsertUserPermissions(
    organizationId: string,
    userId: string,
    permissions: unknown,
    actorUserId?: string
  ): Promise<PermissionSet> {
    if (typeof window !== 'undefined') {
      const response = await fetch(`/api/organizations/${organizationId}/members/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, permissions }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        if (response.status === 400 || response.status === 404) {
          throw new MemberTenantInvariantError(
            response.status,
            errorBody?.error || '権限の更新に失敗しました'
          )
        }
        throw new Error(errorBody?.error || '権限の更新に失敗しました')
      }

      const payload = await response.json() as { permissions: PermissionSet }
      return payload.permissions
    }

    actorUserId = actorUserId?.trim()
    if (!actorUserId) badMemberMutationRequest('actorUserId is required')
    const parsedPermissions = parsePermissionUpdate(permissions)
    const db = this.db

    try {
      return await withImmediateMemberTransaction(db, async tx => {
        await assertActiveOrganizationMember(tx, organizationId, userId)
        const existing = await tx
          .select()
          .from(userPermissionSets)
          .where(and(
            eq(userPermissionSets.userId, userId),
            eq(userPermissionSets.organizationId, organizationId)
          ))
          .limit(1)

        const now = new Date().toISOString()
        let result: PermissionSet
        if (existing[0]) {
          const updatePayload: Record<string, unknown> = { updatedAt: now }
          if (parsedPermissions.can_manage_documents !== undefined) updatePayload.canManageDocuments = parsedPermissions.can_manage_documents
          if (parsedPermissions.can_manage_risks !== undefined) updatePayload.canManageRisks = parsedPermissions.can_manage_risks
          if (parsedPermissions.can_manage_tasks !== undefined) updatePayload.canManageTasks = parsedPermissions.can_manage_tasks
          if (parsedPermissions.can_manage_audit !== undefined) updatePayload.canManageAudit = parsedPermissions.can_manage_audit
          if (parsedPermissions.can_manage_assets !== undefined) updatePayload.canManageAssets = parsedPermissions.can_manage_assets
          if (parsedPermissions.can_manage_controls !== undefined) updatePayload.canManageControls = parsedPermissions.can_manage_controls

          const rows = await tx
            .update(userPermissionSets)
            .set(updatePayload)
            .where(and(
              eq(userPermissionSets.userId, userId),
              eq(userPermissionSets.organizationId, organizationId)
            ))
            .returning()
          if (!rows[0]) throw new Error('権限の更新に失敗しました')
          result = mapPermissionRow(rows[0])
        } else {
          const rows = await tx
            .insert(userPermissionSets)
            .values({
              id: crypto.randomUUID(),
              organizationId,
              userId,
              canManageDocuments: parsedPermissions.can_manage_documents ?? defaultPermissions.can_manage_documents,
              canManageRisks: parsedPermissions.can_manage_risks ?? defaultPermissions.can_manage_risks,
              canManageTasks: parsedPermissions.can_manage_tasks ?? defaultPermissions.can_manage_tasks,
              canManageAudit: parsedPermissions.can_manage_audit ?? defaultPermissions.can_manage_audit,
              canManageAssets: parsedPermissions.can_manage_assets ?? defaultPermissions.can_manage_assets,
              canManageControls: parsedPermissions.can_manage_controls ?? defaultPermissions.can_manage_controls,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
          if (!rows[0]) throw new Error('権限の更新に失敗しました')
          result = mapPermissionRow(rows[0])
        }

        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          action: 'user.permissions_updated',
          resourceType: 'user_permission_set',
          resourceId: result.id,
          organizationId,
          userId: actorUserId,
          changes: JSON.stringify({ ...parsedPermissions, target_user_id: userId }),
        })
        return result
      })
    } catch (error) {
      if (isMemberTenantInvariantError(error)) throw error
      console.error('Failed to save permission set', error)
      throw new Error('権限の更新に失敗しました')
    }
  }
}
