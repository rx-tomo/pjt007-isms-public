import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema/users'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'

type Params = {
  organizationId: string
}

const TENANT_ROLES = new Set([
  'system_operator',
  'org_admin',
  'auditor',
  'approver',
  'user',
])

const errorResponse = (
  respond: (body: unknown, init?: ResponseInit) => NextResponse,
  message: string,
  status = 400
) => respond({ error: message }, { status })

class StatusUpdateError extends Error {
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
    actionName: 'organization.members.status_update',
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

  let payload: { userId?: string; isActive?: boolean }
  try {
    payload = await request.json()
  } catch {
    return errorResponse(guard.json, 'Invalid JSON payload')
  }

  const targetUserId = payload.userId?.trim()
  const isActive = payload.isActive
  if (!targetUserId || typeof isActive !== 'boolean') {
    return errorResponse(guard.json, 'userId and isActive are required')
  }
  if (targetUserId === guard.userId) {
    return errorResponse(guard.json, 'You cannot change your own active state', 403)
  }

  try {
    await db.transaction(async tx => {
      const [target] = await tx
        .select({
          role: userMemberships.role,
          status: userMemberships.status,
          profileActive: userProfiles.isActive,
        })
        .from(userMemberships)
        .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
        .where(and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.userId, targetUserId)
        ))
        .limit(1)

      if (
        !target
        || target.profileActive !== true
        || !TENANT_ROLES.has(target.role)
        || !['active', 'inactive'].includes(target.status)
      ) {
        throw new StatusUpdateError('User not found', 404)
      }
      if (
        authorization.context.role === 'org_admin'
        && target.role === 'system_operator'
      ) {
        throw new StatusUpdateError(
          'org_admin cannot manage system_operator status',
          403
        )
      }

      if (!isActive && target.role === 'system_operator') {
        const [row] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(userMemberships)
          .where(and(
            eq(userMemberships.organizationId, organizationId),
            eq(userMemberships.role, 'system_operator'),
            eq(userMemberships.status, 'active')
          ))
        if ((row?.count ?? 0) <= 1) {
          throw new StatusUpdateError(
            'At least one system_operator must remain in the tenant',
            409
          )
        }
      }

      const status = isActive ? 'active' : 'inactive'
      const now = new Date().toISOString()
      await tx
        .update(userMemberships)
        .set({ status, updatedAt: now })
        .where(and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.userId, targetUserId)
        ))

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: guard.userId,
        action: isActive ? 'user.activated' : 'user.deactivated',
        resourceType: 'user_membership',
        resourceId: targetUserId,
        changes: JSON.stringify({ membership_status: status }),
        createdAt: now,
      })
    })
  } catch (error) {
    if (error instanceof StatusUpdateError) {
      return errorResponse(guard.json, error.message, error.status)
    }
    console.error('[Members status update] failed', error)
    return errorResponse(guard.json, 'Failed to update status', 500)
  }

  return guard.json({ status: 'ok', userId: targetUserId, isActive })
}
