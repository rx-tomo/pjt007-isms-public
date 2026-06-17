import { getDb } from '@/lib/db/drizzle/client'
import { userPermissionSets, auditLogs } from '@/lib/db/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { defaultPermissions, type PermissionUpdate } from '../constants/permissions'

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

export type { PermissionUpdate } from '../constants/permissions'
export { defaultPermissions } from '../constants/permissions'

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

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error || '権限の取得に失敗しました')
      }

      const payload = await response.json() as { permissions?: PermissionSet | null }
      return payload.permissions ?? null
    }

    const db = getDb()

    try {
      const rows = await db
        .select()
        .from(userPermissionSets)
        .where(
          and(
            eq(userPermissionSets.organizationId, organizationId),
            eq(userPermissionSets.userId, userId)
          )
        )
        .limit(1)

      return rows[0] ? mapPermissionRow(rows[0]) : null
    } catch (error) {
      console.error('Failed to fetch user permissions', error)
      throw new Error('権限の取得に失敗しました')
    }
  }

  async upsertUserPermissions(
    organizationId: string,
    userId: string,
    permissions: PermissionUpdate
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
        throw new Error(errorBody?.error || '権限の更新に失敗しました')
      }

      const payload = await response.json() as { permissions: PermissionSet }
      return payload.permissions
    }

    const db = getDb()

    try {
      // Check for existing record
      const existing = await db
        .select()
        .from(userPermissionSets)
        .where(
          and(
            eq(userPermissionSets.userId, userId),
            eq(userPermissionSets.organizationId, organizationId)
          )
        )
        .limit(1)

      const now = new Date().toISOString()

      if (existing[0]) {
        // Update
        const updatePayload: Record<string, unknown> = { updatedAt: now }
        if (permissions.can_manage_documents !== undefined) updatePayload.canManageDocuments = permissions.can_manage_documents
        if (permissions.can_manage_risks !== undefined) updatePayload.canManageRisks = permissions.can_manage_risks
        if (permissions.can_manage_tasks !== undefined) updatePayload.canManageTasks = permissions.can_manage_tasks
        if (permissions.can_manage_audit !== undefined) updatePayload.canManageAudit = permissions.can_manage_audit
        if (permissions.can_manage_assets !== undefined) updatePayload.canManageAssets = permissions.can_manage_assets
        if (permissions.can_manage_controls !== undefined) updatePayload.canManageControls = permissions.can_manage_controls

        const rows = await db
          .update(userPermissionSets)
          .set(updatePayload)
          .where(
            and(
              eq(userPermissionSets.userId, userId),
              eq(userPermissionSets.organizationId, organizationId)
            )
          )
          .returning()

        if (!rows[0]) throw new Error('権限の更新に失敗しました')
        const result = mapPermissionRow(rows[0])

        // Write audit log
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          action: 'user.permissions_updated',
          resourceType: 'user_permission_set',
          resourceId: result.id,
          organizationId,
          userId,
          changes: JSON.stringify(permissions),
        })

        return result
      } else {
        // Insert
        const id = crypto.randomUUID()
        const insertPayload = {
          id,
          organizationId,
          userId,
          canManageDocuments: permissions.can_manage_documents ?? defaultPermissions.can_manage_documents,
          canManageRisks: permissions.can_manage_risks ?? defaultPermissions.can_manage_risks,
          canManageTasks: permissions.can_manage_tasks ?? defaultPermissions.can_manage_tasks,
          canManageAudit: permissions.can_manage_audit ?? defaultPermissions.can_manage_audit,
          canManageAssets: permissions.can_manage_assets ?? defaultPermissions.can_manage_assets,
          canManageControls: permissions.can_manage_controls ?? defaultPermissions.can_manage_controls,
          createdAt: now,
          updatedAt: now,
        }

        const rows = await db
          .insert(userPermissionSets)
          .values(insertPayload)
          .returning()

        if (!rows[0]) throw new Error('権限の更新に失敗しました')
        const result = mapPermissionRow(rows[0])

        // Write audit log
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          action: 'user.permissions_updated',
          resourceType: 'user_permission_set',
          resourceId: result.id,
          organizationId,
          userId,
          changes: JSON.stringify(permissions),
        })

        return result
      }
    } catch (error) {
      console.error('Failed to save permission set', error)
      throw new Error('権限の更新に失敗しました')
    }
  }
}
