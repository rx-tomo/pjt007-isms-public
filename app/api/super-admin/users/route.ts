import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships } from '@/lib/db/drizzle/schema/users'
import { authUsers } from '@/lib/db/drizzle/schema/auth'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { eq } from 'drizzle-orm'

type RoleKey = 'super_admin' | 'system_operator'

const normalizeRole = (value?: string | null) => (value ?? '').toLowerCase()

function isPublicDemoMode() {
  return process.env.DEMO_PUBLIC_LOGIN_ENABLED === 'true' && process.env.DEMO_RESET_ENABLED === 'true'
}

async function findAuthUserByEmail(
  email: string
): Promise<{ id: string; email?: string | null } | null> {
  const db = getDb()
  const rows = await db.select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers).where(eq(authUsers.email, email.toLowerCase())).limit(1)
  return rows[0] ?? null
}

async function ensureAuthUser(
  email: string
): Promise<{ userId: string; temporaryPassword: string | null }> {
  const existing = await findAuthUserByEmail(email)
  if (existing) return { userId: existing.id, temporaryPassword: null }

  const { auth } = await import('@/lib/auth/better-auth')
  const temporaryPassword = crypto.randomUUID()
  const result = await auth.api.signUpEmail({
    body: { name: email.split('@')[0], email, password: temporaryPassword },
  })
  return { userId: result.user.id, temporaryPassword }
}

export async function POST(request: NextRequest) {
  if (isPublicDemoMode()) {
    return new Response(JSON.stringify({ error: 'Public demo user creation is disabled.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    })
  }

  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.users.create'
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard
  const db = getDb()

  let payload: { email?: string; role?: RoleKey; organizationId?: string | null; locale?: string }
  try {
    payload = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const role = normalizeRole(payload.role) as RoleKey
  const locale = payload.locale === 'en' ? 'en' : 'ja'
  const organizationId = payload.organizationId?.trim() || null

  if (!email) {
    return guard.json({ error: 'email is required' }, { status: 400 })
  }

  if (!['super_admin', 'system_operator'].includes(role)) {
    return guard.json({ error: 'role must be super_admin or system_operator' }, { status: 400 })
  }

  if (role === 'system_operator' && !organizationId) {
    return guard.json({ error: 'organizationId is required for system_operator' }, { status: 400 })
  }

  try {
    const { userId, temporaryPassword } = await ensureAuthUser(email)

    const existingProfileRows = await db
      .select({ id: userProfiles.id, role: userProfiles.role, organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const existingProfile = existingProfileRows[0]

    if (existingProfile && existingProfile.role !== role) {
      return guard.json({ error: 'User already exists with a different role' }, { status: 409 })
    }

    // Upsert profile
    if (existingProfile) {
      await db.update(userProfiles).set({
        organizationId: role === 'super_admin' ? null : organizationId,
        email,
        fullName: role === 'super_admin' ? 'Super Admin' : 'System Operator',
        role,
        isActive: true,
        languagePreference: locale,
      }).where(eq(userProfiles.id, userId))
    } else {
      await db.insert(userProfiles).values({
        id: userId,
        organizationId: role === 'super_admin' ? null : organizationId,
        email,
        fullName: role === 'super_admin' ? 'Super Admin' : 'System Operator',
        role,
        isActive: true,
        languagePreference: locale,
      })
    }

    if (role === 'system_operator' && organizationId) {
      // Upsert membership
      const existingMembership = await db.select({ userId: userMemberships.userId })
        .from(userMemberships)
        .where(eq(userMemberships.userId, userId))
        .limit(1)

      if (existingMembership.length > 0) {
        await db.update(userMemberships).set({
          organizationId,
          role: 'system_operator',
          status: 'active',
        }).where(eq(userMemberships.userId, userId))
      } else {
        await db.insert(userMemberships).values({
          id: crypto.randomUUID(),
          userId,
          organizationId,
          role: 'system_operator',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    }

    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: organizationId ?? '',
        userId: guard.userId,
        action: 'super_admin.user_created',
        resourceType: 'user_profile',
        resourceId: userId,
        changes: JSON.stringify({ role, email, organization_id: organizationId }),
      })
    } catch (auditErr) {
      console.warn('[SuperAdmin users create] audit log insert failed', auditErr)
    }

    return guard.json({ status: 'ok', userId, role, temporaryPassword })
  } catch (err: any) {
    console.error('[SuperAdmin users create] failed', err)
    return guard.json({ error: err?.message ?? 'Failed to create user' }, { status: 500 })
  }
}
