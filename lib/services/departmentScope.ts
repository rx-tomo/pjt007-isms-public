import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs, userDepartmentScopes, userMemberships } from '@/lib/db/drizzle/schema'
import {
  assertActiveOrganizationMember,
  assertDepartmentsBelongToOrganization,
  badMemberMutationRequest,
  MemberTenantInvariantError,
  normalizeDepartmentIds,
  withImmediateMemberTransaction,
} from '@/lib/services/memberTenantInvariant'

export interface UserDepartmentScope {
  id: string
  organization_id: string
  user_id: string
  department_id: string
  created_at: string | null
  updated_at: string | null
}

interface UpdatePayload {
  organizationId: string
  userId: string
  departmentIds: unknown
  actorUserId?: string
}

function mapScopeRow(row: typeof userDepartmentScopes.$inferSelect): UserDepartmentScope {
  return {
    id: row.id,
    organization_id: row.organizationId,
    user_id: row.userId,
    department_id: row.departmentId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class DepartmentScopeService {
  constructor(private readonly injectedDb?: ReturnType<typeof getDb>) {}

  private get db(): ReturnType<typeof getDb> {
    return this.injectedDb ?? getDb()
  }

  async listUserScopes(organizationId: string, userId: string): Promise<UserDepartmentScope[]> {
    if (typeof window !== 'undefined') {
      const url = new URL(`/api/organizations/${organizationId}/members/department-scopes`, window.location.origin)
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
            errorBody?.error || '部門スコープの取得に失敗しました'
          )
        }
        throw new Error(errorBody?.error || '部門スコープの取得に失敗しました')
      }

      const payload = await response.json() as { scopes?: UserDepartmentScope[] }
      return payload.scopes ?? []
    }

    const rows = await this.db
      .select({
        membershipId: userMemberships.id,
        scope: userDepartmentScopes,
      })
      .from(userMemberships)
      .leftJoin(userDepartmentScopes, and(
        eq(userDepartmentScopes.organizationId, organizationId),
        eq(userDepartmentScopes.userId, userId)
      ))
      .where(and(
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.userId, userId),
        eq(userMemberships.status, 'active')
      ))
      .orderBy(userDepartmentScopes.createdAt)

    if (!rows[0]) {
      throw new MemberTenantInvariantError(404, 'Member not found')
    }
    return rows.flatMap(row => row.scope ? [mapScopeRow(row.scope)] : [])
  }

  async getUserDepartmentIds(organizationId: string, userId: string): Promise<string[]> {
    const scopes = await this.listUserScopes(organizationId, userId)
    return scopes.map(scope => scope.department_id)
  }

  async updateUserDepartmentScopes({
    organizationId,
    userId,
    departmentIds,
    actorUserId,
  }: UpdatePayload): Promise<UserDepartmentScope[]> {
    if (typeof window !== 'undefined') {
      const response = await fetch(`/api/organizations/${organizationId}/members/department-scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, departmentIds }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        if (response.status === 400 || response.status === 404) {
          throw new MemberTenantInvariantError(
            response.status,
            errorBody?.error || '部門スコープの更新に失敗しました'
          )
        }
        throw new Error(errorBody?.error || '部門スコープの更新に失敗しました')
      }

      const payload = await response.json() as { scopes?: UserDepartmentScope[] }
      return payload.scopes ?? []
    }

    actorUserId = actorUserId?.trim()
    if (!actorUserId) badMemberMutationRequest('actorUserId is required')
    const uniqueIds = normalizeDepartmentIds(departmentIds)
    const db = this.db

    return withImmediateMemberTransaction(db, async tx => {
      await assertActiveOrganizationMember(tx, organizationId, userId)
      await assertDepartmentsBelongToOrganization(tx, organizationId, uniqueIds)

      const existing = await tx
        .select()
        .from(userDepartmentScopes)
        .where(and(
          eq(userDepartmentScopes.organizationId, organizationId),
          eq(userDepartmentScopes.userId, userId)
        ))

      const existingIds = new Map(existing.map(scope => [scope.departmentId, scope.id]))
      const toDelete = existing
        .filter(scope => !uniqueIds.includes(scope.departmentId))
        .map(scope => scope.id)

      if (toDelete.length > 0) {
        await tx.delete(userDepartmentScopes).where(inArray(userDepartmentScopes.id, toDelete))
      }

      const now = new Date().toISOString()
      const toInsert = uniqueIds
        .filter(id => !existingIds.has(id))
        .map(id => ({
          id: crypto.randomUUID(),
          organizationId,
          userId,
          departmentId: id,
          createdAt: now,
          updatedAt: now,
        }))

      if (toInsert.length > 0) {
        await tx.insert(userDepartmentScopes).values(toInsert)
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: actorUserId,
        action: 'user.department_scopes_updated',
        resourceType: 'user_department_scope',
        resourceId: userId,
        changes: JSON.stringify({ department_ids: uniqueIds, target_user_id: userId }),
      })

      const rows = await tx
        .select()
        .from(userDepartmentScopes)
        .where(and(
          eq(userDepartmentScopes.organizationId, organizationId),
          eq(userDepartmentScopes.userId, userId)
        ))
        .orderBy(userDepartmentScopes.createdAt)
      return rows.map(mapScopeRow)
    })
  }
}
