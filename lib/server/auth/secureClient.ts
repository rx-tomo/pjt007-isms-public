import { userRoleValues, type UserRole } from '@/lib/db/drizzle/schema'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationResult,
} from '@/lib/server/auth/authorizationContext'
import type { ServiceRoleEventStatus } from '@/lib/server/logging/serviceRoleEvents'
import { NextRequest, NextResponse } from 'next/server'

type ProfileRow = {
  id: string
  role: string
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

export type NonEmptyRoles = readonly [UserRole, ...UserRole[]]

type CommonGuardOptions = {
  actionName?: string
  logContext?: Record<string, unknown>
}

export type GuardOptions =
  | (CommonGuardOptions & {
      mode: 'tenant'
      organizationId: string
      allowedRoles?: readonly string[]
    })
  | (CommonGuardOptions & {
      mode: 'tenant-primary'
      allowedRoles?: readonly string[]
    })
  | (CommonGuardOptions & {
      mode: 'global'
      allowedRoles: NonEmptyRoles
    })
  | (CommonGuardOptions & {
      mode: 'system-job'
      allowedRoles: NonEmptyRoles
    })

type ProfileRecord = {
  id: string
  role: string
  organizationId: string | null
  isActive: boolean | null
}

type GuardDb = ReturnType<typeof getDb>

export interface ServiceRoleDependencies {
  getSession: (request: NextRequest) => Promise<{ user: { id: string } } | null>
  getDb: () => GuardDb
  getProfile: (db: GuardDb, userId: string) => Promise<ProfileRecord | null>
  resolveTenantContext: (
    db: GuardDb,
    userId: string,
    organizationId: string
  ) => Promise<TenantAuthorizationResult>
}

const AUTHORIZATION_MODES = new Set(['tenant', 'tenant-primary', 'global', 'system-job'])
const GLOBAL_PROFILE_ROLES = new Set<UserRole>(['system_operator', 'super_admin'])

const isUserRole = (value: string): value is UserRole =>
  (userRoleValues as readonly string[]).includes(value)

async function getDefaultDependencies(): Promise<ServiceRoleDependencies> {
  const { auth } = await import('@/lib/auth/better-auth')
  const { getDb } = await import('@/lib/db/drizzle/client')
  const { userProfiles } = await import('@/lib/db/drizzle/schema/users')
  const { eq } = await import('drizzle-orm')

  return {
    getSession: request => auth.api.getSession({ headers: request.headers }),
    getDb,
    getProfile: async (db, userId) => {
      const [profile] = await db
        .select({
          id: userProfiles.id,
          role: userProfiles.role,
          organizationId: userProfiles.organizationId,
          isActive: userProfiles.isActive,
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      return profile ?? null
    },
    resolveTenantContext: resolveTenantAuthorizationContext,
  }
}

function rolesAreValid(roles: readonly string[] | undefined): boolean {
  return roles === undefined || roles.every(role => isUserRole(role))
}

export async function requireServiceRole(
  request: NextRequest,
  options: GuardOptions,
  injectedDependencies?: ServiceRoleDependencies
): Promise<{ guard?: GuardResult; error?: NextResponse }> {
  const respondJson = (body: unknown, init?: ResponseInit) => NextResponse.json(body, init)

  try {
    const runtimeOptions = options as GuardOptions | undefined
    if (!runtimeOptions?.mode || !AUTHORIZATION_MODES.has(runtimeOptions.mode)) {
      return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
    }
    if (
      runtimeOptions.mode === 'tenant' &&
      (typeof runtimeOptions.organizationId !== 'string' || runtimeOptions.organizationId.trim() === '')
    ) {
      return { error: respondJson({ error: 'Organization ID is required' }, { status: 400 }) }
    }
    if (!rolesAreValid(runtimeOptions.allowedRoles)) {
      return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
    }
    if (
      (runtimeOptions.mode === 'global' || runtimeOptions.mode === 'system-job') &&
      (!runtimeOptions.allowedRoles || runtimeOptions.allowedRoles.length === 0)
    ) {
      return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
    }

    const dependencies = injectedDependencies ?? await getDefaultDependencies()
    const session = await dependencies.getSession(request)
    if (!session?.user) {
      return { error: respondJson({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const db = dependencies.getDb()
    const profileRecord = await dependencies.getProfile(db, session.user.id)
    if (!profileRecord || profileRecord.isActive !== true) {
      return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
    }

    let effectiveRole: UserRole
    let contextOrganizationId: string | null

    if (runtimeOptions.mode === 'tenant' || runtimeOptions.mode === 'tenant-primary') {
      const organizationId = runtimeOptions.mode === 'tenant'
        ? runtimeOptions.organizationId
        : profileRecord.organizationId
      if (!organizationId) {
        return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
      }

      const authorization = await dependencies.resolveTenantContext(
        db,
        session.user.id,
        organizationId
      )
      if (!authorization.ok) {
        return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
      }
      effectiveRole = authorization.context.role
      contextOrganizationId = authorization.context.organizationId
    } else {
      if (!isUserRole(profileRecord.role)) {
        return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
      }
      effectiveRole = profileRecord.role
      if (!GLOBAL_PROFILE_ROLES.has(effectiveRole)) {
        return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
      }
      contextOrganizationId = profileRecord.organizationId
    }

    if (runtimeOptions.allowedRoles) {
      const allowedSet = new Set(runtimeOptions.allowedRoles)
      if (!allowedSet.has(effectiveRole)) {
        return { error: respondJson({ error: 'Forbidden' }, { status: 403 }) }
      }
    }

    const actionName = runtimeOptions.actionName ?? 'service_role'
    const profile: ProfileRow = {
      id: profileRecord.id,
      role: effectiveRole,
      organization_id: contextOrganizationId,
    }

    const logEvent = async (
      status: ServiceRoleEventStatus,
      context?: Record<string, unknown>,
      metadata?: { format?: string; documentId?: string | null }
    ) => {
      const organizationId = contextOrganizationId
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
          changes: context
            ? JSON.stringify({ ...runtimeOptions.logContext, ...context, status })
            : JSON.stringify({ status }),
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('[ServiceRole] failed to write audit log', err)
      }
    }

    const wrapResponse = <T extends NextResponse>(response: T): T => response
    const serviceClient = null as any

    return {
      guard: {
        serviceClient,
        profile,
        userId: session.user.id,
        wrapResponse,
        json: respondJson,
        logEvent,
      },
    }
  } catch (err) {
    console.error('[ServiceRole] Error:', err)
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
  }
}
