import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { organizationInvitations } from '@/lib/db/drizzle/schema/users'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userProfiles, userMemberships } from '@/lib/db/drizzle/schema/users'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { authUsers } from '@/lib/db/drizzle/schema/auth'
import { eq, desc, lt, inArray } from 'drizzle-orm'

const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.invitations.list'
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard
  const db = getDb()
  const searchParams = request.nextUrl.searchParams
  const limitParam = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_LIMIT) : 50
  const cursor = searchParams.get('cursor')

  try {
    // Get invitations with cursor-based pagination
    const invitationRows = cursor
      ? await db
          .select()
          .from(organizationInvitations)
          .where(lt(organizationInvitations.createdAt, cursor))
          .orderBy(desc(organizationInvitations.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(organizationInvitations)
          .orderBy(desc(organizationInvitations.createdAt))
          .limit(limit)

    // Get total count
    const allRows = await db.select({ id: organizationInvitations.id }).from(organizationInvitations)
    const count = allRows.length

    // Resolve organization names and invited_by profiles
    const orgIds = Array.from(new Set(invitationRows.map(r => r.organizationId).filter(Boolean) as string[]))
    const inviterIds = Array.from(new Set(invitationRows.map(r => r.invitedBy).filter(Boolean) as string[]))

    const orgMap = new Map<string, string>()
    if (orgIds.length > 0) {
      const orgRows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds))
      for (const o of orgRows) orgMap.set(o.id, o.name)
    }

    const inviterMap = new Map<string, { fullName: string | null; email: string | null }>()
    if (inviterIds.length > 0) {
      const inviterRows = await db.select({ id: userProfiles.id, fullName: userProfiles.fullName, email: userProfiles.email }).from(userProfiles).where(inArray(userProfiles.id, inviterIds))
      for (const u of inviterRows) inviterMap.set(u.id, { fullName: u.fullName, email: u.email })
    }

    const invitations = invitationRows.map((row) => {
      const invitedByProfile = row.invitedBy ? inviterMap.get(row.invitedBy) : null

      return {
        id: row.id,
        email: row.email,
        role: row.role,
        organizationId: row.organizationId,
        organizationName: row.organizationId ? orgMap.get(row.organizationId) ?? null : null,
        invitedById: row.invitedBy,
        invitedByName: invitedByProfile?.fullName ?? invitedByProfile?.email ?? null,
        invitedByEmail: invitedByProfile?.email ?? null,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        acceptedAt: row.acceptedAt
      }
    })

    const nextCursor = invitations.length === limit ? invitations[invitations.length - 1]?.createdAt ?? null : null

    return guard.json({ invitations, total: count, nextCursor })
  } catch (err) {
    console.error('[SuperAdmin Invitations] list failed', err)
    return guard.json({ error: 'Failed to load invitations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.invitations.accept'
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard
  const db = getDb()

  let payload: { invitationId?: string; locale?: string }

  try {
    payload = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const invitationId = payload.invitationId?.trim()
  if (!invitationId) {
    return guard.json({ error: 'invitationId is required' }, { status: 400 })
  }

  const locale = payload.locale === 'en' ? 'en' : 'ja'

  const invitationRows = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, invitationId))
    .limit(1)

  const invitation = invitationRows[0]
  if (!invitation) {
    return guard.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.acceptedAt) {
    return guard.json({ error: 'Invitation already accepted', code: 'ALREADY_ACCEPTED' }, { status: 409 })
  }

  if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
    return guard.json({ error: 'Invitation expired', code: 'EXPIRED' }, { status: 400 })
  }

  const email = invitation.email.toLowerCase()
  const { userId, temporaryPassword } = await ensureAuthUser(email)

  // Upsert profile
  const existingProfile = await db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.id, userId)).limit(1)
  if (existingProfile.length > 0) {
    await db.update(userProfiles).set({
      organizationId: invitation.organizationId,
      email,
      role: invitation.role,
      isActive: true,
      languagePreference: locale,
    }).where(eq(userProfiles.id, userId))
  } else {
    await db.insert(userProfiles).values({
      id: userId,
      organizationId: invitation.organizationId,
      email,
      fullName: '',
      role: invitation.role,
      isActive: true,
      languagePreference: locale,
    })
  }

  // Upsert membership
  const existingMembership = await db.select({ userId: userMemberships.userId })
    .from(userMemberships)
    .where(eq(userMemberships.userId, userId))
    .limit(1)

  if (existingMembership.length > 0) {
    await db.update(userMemberships).set({
      organizationId: invitation.organizationId,
      role: invitation.role,
      status: 'active',
    }).where(eq(userMemberships.userId, userId))
  } else {
    await db.insert(userMemberships).values({
      id: crypto.randomUUID(),
      userId,
      organizationId: invitation.organizationId!,
      role: invitation.role,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  // Mark invitation as accepted
  await db.update(organizationInvitations)
    .set({ acceptedAt: new Date().toISOString() })
    .where(eq(organizationInvitations.id, invitationId))

  // Audit log
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: invitation.organizationId!,
      userId: guard.userId,
      action: 'invitation.accepted.admin',
      resourceType: 'organization_invitation',
      resourceId: invitationId,
      changes: JSON.stringify({ email, role: invitation.role, accepted_by: 'super_admin' }),
      scope: 'tenant',
    })
  } catch (error) {
    console.warn('[SuperAdmin Invitations] audit log insert failed', error)
  }

  return guard.json({ status: 'accepted', invitationId, userId, temporaryPassword })
}

export async function DELETE(request: NextRequest) {
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.invitations.delete'
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard
  const db = getDb()

  let payload: { ids?: unknown }

  try {
    payload = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const ids = Array.isArray(payload.ids)
    ? (payload.ids.map((value) => (typeof value === 'string' ? value : null)).filter(Boolean) as string[])
    : []

  if (ids.length === 0) {
    return guard.json({ error: 'No invitation IDs provided' }, { status: 400 })
  }

  try {
    // Select before delete to return the deleted IDs
    const toDelete = await db.select({ id: organizationInvitations.id })
      .from(organizationInvitations)
      .where(inArray(organizationInvitations.id, ids))

    await db.delete(organizationInvitations)
      .where(inArray(organizationInvitations.id, ids))

    return guard.json({ deleted: toDelete.map((row) => row.id) })
  } catch (err) {
    console.error('[SuperAdmin Invitations] delete failed', err)
    return guard.json({ error: 'Failed to delete invitations' }, { status: 500 })
  }
}

async function ensureAuthUser(
  email: string
): Promise<{ userId: string; temporaryPassword: string | null }> {
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    return { userId: existing.id, temporaryPassword: null }
  }

  const { auth } = await import('@/lib/auth/better-auth')
  const temporaryPassword = crypto.randomUUID()
  const result = await auth.api.signUpEmail({
    body: { name: email.split('@')[0], email, password: temporaryPassword },
  })
  return { userId: result.user.id, temporaryPassword }
}

async function findAuthUserByEmail(
  email: string
): Promise<{ id: string; email?: string | null } | null> {
  const db = getDb()
  const rows = await db.select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers).where(eq(authUsers.email, email.toLowerCase())).limit(1)
  return rows[0] ?? null
}
