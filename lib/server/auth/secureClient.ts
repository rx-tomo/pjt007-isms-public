import { logServiceRoleEvent, ServiceRoleEventStatus } from '@/lib/server/logging/serviceRoleEvents'
import { NextRequest, NextResponse } from 'next/server'

type ProfileRow = {
  id: string
  role: string | null
  organization_id: string | null
}

type GuardResult = {
  /** @deprecated Will be removed once all callers are migrated to Drizzle */
  serviceClient: any
  profile: ProfileRow
  userId: string
  wrapResponse: <T extends NextResponse>(response: T) => T
  json: (body: unknown, init?: ResponseInit) => NextResponse
  logEvent: (
    status: ServiceRoleEventStatus,
    context?: Record<string, unknown>,
    metadata?: { format?: string; documentId?: string | null }
  ) => Promise<void>
}

type GuardOptions = {
  allowedRoles?: string[]
  organizationId?: string
  actionName?: string
  logContext?: Record<string, unknown>
}

const CROSS_ORG_ROLES = new Set(['system_operator', 'super_admin'])

const normalizeRole = (value?: string | null) => value?.toLowerCase() ?? ''

export async function requireServiceRole(
  request: NextRequest,
  options: GuardOptions = {}
): Promise<{ guard?: GuardResult; error?: NextResponse }> {
  const respondJson = (body: unknown, init?: ResponseInit) =>
    NextResponse.json(body, init)

  const actionName = options.actionName ?? 'service_role'

  try {
    const { auth } = await import('@/lib/auth/better-auth')
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return { error: respondJson({ error: 'Unauthorized' }, { status: 401 }) }
    }

    // Query user profile from Drizzle DB
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema/users')
    const { eq } = await import('drizzle-orm')
    const db = getDb()

    const profiles = await db
      .select({
        id: userProfiles.id,
        role: userProfiles.role,
        organizationId: userProfiles.organizationId,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, session.user.id))
      .limit(1)

    const profileRow = profiles[0]
    if (!profileRow) {
      console.error('[ServiceRole] failed to resolve user profile')
      return { error: respondJson({ error: 'Profile not found' }, { status: 403 }) }
    }

    const profile: ProfileRow = {
      id: profileRow.id,
      role: profileRow.role,
      organization_id: profileRow.organizationId,
    }

    const role = normalizeRole(profile.role)
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      const allowedSet = new Set(options.allowedRoles.map(normalizeRole))
      if (!allowedSet.has(role)) {
        return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
      }
    }

    if (options.organizationId) {
      const orgMismatch = profile.organization_id !== options.organizationId
      if (orgMismatch && !CROSS_ORG_ROLES.has(role)) {
        return { error: respondJson({ error: 'Organization mismatch' }, { status: 403 }) }
      }
    }

    // Audit log via Drizzle
    const logEvent = async (
      status: ServiceRoleEventStatus,
      context?: Record<string, unknown>,
      metadata?: { format?: string; documentId?: string | null }
    ) => {
      const organizationId = options.organizationId ?? profile.organization_id
      if (!organizationId) {
        console.warn('[ServiceRole] logEvent skipped: missing organization_id')
        return
      }
      try {
        const { auditLogs } = await import('@/lib/db/drizzle/schema/audit-logs')
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId,
          userId: session.user.id,
          action: actionName,
          resourceType: 'service_role',
          resourceId: metadata?.documentId ?? null,
          changes: context ? JSON.stringify({ ...options.logContext, ...context, status }) : JSON.stringify({ status }),
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('[ServiceRole] failed to write audit log', err)
      }
    }

    // No-op wrapResponse (no auth cookies to apply)
    const wrapResponse = <T extends NextResponse>(response: T): T => response

    // Backward compat: serviceClient is null in Better Auth mode.
    // Callers that still use it will be migrated to Drizzle.
    const serviceClient = null as any

    return {
      guard: {
        serviceClient,
        profile,
        userId: session.user.id,
        wrapResponse,
        json: respondJson,
        logEvent
      }
    }
  } catch (err) {
    console.error('[ServiceRole] Error:', err)
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
  }
}

export const isMultiOrgRole = (role?: string | null) => CROSS_ORG_ROLES.has(normalizeRole(role))
