import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import {
  assertActiveTenantMember,
  isTargetMemberNotFoundError,
} from '@/lib/server/auth/targetMember'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships } from '@/lib/db/drizzle/schema/users'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'

type TenantRole = 'system_operator' | 'org_admin' | 'auditor' | 'approver' | 'user'

type Params = {
  organizationId: string
}

const GLOBAL_SUPER_ADMIN_ROLE = 'super_admin'
const ALLOWED_TENANT_ROLES: TenantRole[] = [
  'system_operator',
  'org_admin',
  'auditor',
  'approver',
  'user',
]

const errorResponse = (
  respond: (body: unknown, init?: ResponseInit) => NextResponse,
  message: string,
  status = 400
) => respond({ error: message }, { status })

class RoleUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const { organizationId } = await props.params
  const guardResult = await requireServiceRole(request, {
    mode: 'tenant',
    allowedRoles: ['system_operator', 'org_admin'],
    organizationId,
    actionName: 'organization.members.role_update',
    logContext: { organizationId },
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard
  const db = getDb()
  const authorization = await authorizeTenantAction(
    db,
    guard.userId,
    organizationId,
    'members.manage'
  )
  if (!authorization.ok) {
    return errorResponse(guard.json, 'Forbidden', 403)
  }

  let payload: { userId?: string; role?: string }
  try {
    payload = await request.json()
  } catch {
    return errorResponse(guard.json, 'Invalid JSON payload')
  }

  const targetUserId = payload.userId?.trim()
  const targetRole = payload.role?.trim().toLowerCase()
  if (!targetUserId) {
    return errorResponse(guard.json, 'userId is required')
  }
  if (!targetRole || !ALLOWED_TENANT_ROLES.includes(targetRole as TenantRole)) {
    return errorResponse(guard.json, 'role is invalid')
  }

  try {
    await db.transaction(async tx => {
      const target = await assertActiveTenantMember(tx, organizationId, targetUserId)
      const currentRole = target.role

      if (currentRole === GLOBAL_SUPER_ADMIN_ROLE) {
        throw new RoleUpdateError('Global administrator accounts must be managed globally', 403)
      }
      if (
        authorization.context.role === 'org_admin'
        && (currentRole === 'system_operator' || targetRole === 'system_operator')
      ) {
        throw new RoleUpdateError('org_admin cannot manage system_operator roles', 403)
      }

      if (currentRole === 'system_operator' && targetRole !== 'system_operator') {
        const [row] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(userMemberships)
          .where(and(
            eq(userMemberships.organizationId, organizationId),
            eq(userMemberships.role, 'system_operator'),
            eq(userMemberships.status, 'active')
          ))
        if ((row?.count ?? 0) <= 1) {
          throw new RoleUpdateError('At least one system_operator must remain in the tenant', 409)
        }
      }

      const now = new Date().toISOString()
      await tx
        .update(userMemberships)
        .set({ role: targetRole as TenantRole, updatedAt: now })
        .where(and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.userId, targetUserId)
        ))

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: guard.userId,
        action: 'user.role_updated',
        resourceType: 'user_membership',
        resourceId: targetUserId,
        changes: JSON.stringify({ from: currentRole, to: targetRole }),
        createdAt: now,
      })
    })
  } catch (error) {
    if (isTargetMemberNotFoundError(error)) {
      return errorResponse(guard.json, 'User not found', 404)
    }
    if (error instanceof RoleUpdateError) {
      return errorResponse(guard.json, error.message, error.status)
    }
    console.error('[Members role update] failed', error)
    return errorResponse(guard.json, 'Failed to update role', 500)
  }

  return guard.json({ status: 'ok', userId: targetUserId, role: targetRole })
}
