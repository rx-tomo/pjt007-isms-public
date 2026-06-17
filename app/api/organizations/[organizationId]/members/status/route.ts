import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships } from '@/lib/db/drizzle/schema/users'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { eq, and, sql } from 'drizzle-orm'

type RoleKey =
  | 'super_admin'
  | 'system_operator'
  | 'org_admin'
  | 'auditor'
  | 'approver'
  | 'user'

type Params = {
  organizationId: string
}

const normalizeRole = (value?: string | null) => (value ?? '').toLowerCase() as RoleKey

const errorResponse = (respond: (body: unknown, init?: ResponseInit) => NextResponse, message: string, status = 400) =>
  respond({ error: message }, { status })

async function countActiveByRole(
  role: RoleKey,
  organizationId?: string | null
) {
  const db = getDb()

  if (role === 'super_admin') {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.role, role),
          eq(userProfiles.isActive, true)
        )
      )
    return rows[0]?.count ?? 0
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(userMemberships)
    .where(
      and(
        eq(userMemberships.role, role),
        eq(userMemberships.status, 'active'),
        eq(userMemberships.organizationId, organizationId ?? '')
      )
    )
  return rows[0]?.count ?? 0
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params;
  const organizationId = params.organizationId
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId,
    actionName: 'organization.members.status_update',
    logContext: { organizationId }
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard
  const db = getDb()

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

  const actorRole = normalizeRole(guard.profile.role)

  const profileRows = await db
    .select({
      id: userProfiles.id,
      role: userProfiles.role,
      isActive: userProfiles.isActive,
      organizationId: userProfiles.organizationId,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, targetUserId))
    .limit(1)

  const profile = profileRows[0]
  if (!profile) {
    return errorResponse(guard.json, 'User not found', 404)
  }

  const currentRole = normalizeRole(profile.role)

  if (currentRole !== 'super_admin' && currentRole !== 'system_operator') {
    const membershipRows = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(
        and(
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.userId, targetUserId)
        )
      )
      .limit(1)

    if (profile.organizationId !== organizationId && membershipRows.length === 0) {
      return errorResponse(guard.json, 'User does not belong to this organization', 403)
    }
  }

  // Authorization matrix
  if (currentRole === 'super_admin' && actorRole !== 'super_admin') {
    return errorResponse(guard.json, 'Only super_admin can manage super_admin accounts', 403)
  }
  if (actorRole === 'super_admin') {
    const allowedTargets: RoleKey[] = ['super_admin', 'system_operator']
    if (!allowedTargets.includes(currentRole)) {
      return errorResponse(guard.json, 'super_admin may manage only super_admin or system_operator status', 403)
    }
  }
  if (actorRole === 'org_admin') {
    if (currentRole === 'system_operator' || currentRole === 'super_admin') {
      return errorResponse(guard.json, 'org_admin cannot manage system_operator or super_admin status', 403)
    }
  }
  if (actorRole === 'system_operator' && currentRole === 'super_admin') {
    return errorResponse(guard.json, 'system_operator cannot manage super_admin status', 403)
  }

  // Guards for last accounts
  if (!isActive) {
    if (currentRole === 'system_operator') {
      const activeOperators = await countActiveByRole('system_operator', organizationId)
      if (activeOperators <= 1) {
        return errorResponse(guard.json, 'At least one system_operator must remain in the tenant', 409)
      }
    }

    if (currentRole === 'super_admin') {
      const activeSupers = await countActiveByRole('super_admin', null)
      if (activeSupers <= 1) {
        return errorResponse(guard.json, 'At least one super_admin must remain', 409)
      }
    }
  }

  try {
    await db.update(userProfiles)
      .set({ isActive })
      .where(eq(userProfiles.id, targetUserId))
  } catch (updateError) {
    console.error('[Members status update] failed', updateError)
    return errorResponse(guard.json, 'Failed to update status', 500)
  }

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: guard.userId,
      action: isActive ? 'user.activated' : 'user.deactivated',
      resourceType: 'user_profile',
      resourceId: targetUserId,
      changes: JSON.stringify({ is_active: isActive }),
    })
  } catch (auditError) {
    console.warn('[Members status update] audit log skipped', auditError)
  }

  return guard.json({ status: 'ok', userId: targetUserId, isActive })
}
