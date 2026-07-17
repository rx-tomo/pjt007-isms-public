/**
 * Tenant-primary compatibility guard used by AI API routes.
 */
import { userRoleValues } from '@/lib/db/drizzle/schema'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationResult,
} from '@/lib/server/auth/authorizationContext'
import { NextRequest, NextResponse } from 'next/server'

export interface UserProfile {
  id: string
  organization_id: string
  role: string
  email: string
  full_name?: string
  language_preference?: 'ja' | 'en'
}

export interface RequireServiceRoleOptions {
  mode: 'tenant-primary'
  allowedRoles: readonly string[]
  actionName: string
}

export interface AuthGuard {
  profile: UserProfile
  userId: string
  json: <T>(data: T, init?: ResponseInit) => NextResponse<T>
  logEvent: (action: string, details: Record<string, unknown>) => Promise<void>
}

export interface RequireServiceRoleResult {
  guard: AuthGuard
  error: NextResponse | null
}

type ProfileRecord = {
  id: string
  organizationId: string | null
  role: string
  isActive: boolean | null
  email: string
  fullName: string | null
  languagePreference: string | null
}

type GuardDb = ReturnType<typeof getDb>

export interface AiServiceRoleDependencies {
  getSession: (request: NextRequest) => Promise<{ user: { id: string } } | null>
  getDb: () => GuardDb
  getProfile: (db: GuardDb, userId: string) => Promise<ProfileRecord | null>
  resolveTenantContext: (
    db: GuardDb,
    userId: string,
    organizationId: string
  ) => Promise<TenantAuthorizationResult>
}

const isKnownRole = (value: string) => (userRoleValues as readonly string[]).includes(value)

async function getDefaultDependencies(): Promise<AiServiceRoleDependencies> {
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
          organizationId: userProfiles.organizationId,
          role: userProfiles.role,
          isActive: userProfiles.isActive,
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          languagePreference: userProfiles.languagePreference,
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      return profile ?? null
    },
    resolveTenantContext: resolveTenantAuthorizationContext,
  }
}

export async function requireServiceRole(
  request: NextRequest,
  options: RequireServiceRoleOptions,
  injectedDependencies?: AiServiceRoleDependencies
): Promise<RequireServiceRoleResult> {
  const json = <T>(data: T, init?: ResponseInit): NextResponse<T> =>
    NextResponse.json(data, init)

  try {
    const runtimeOptions = options as RequireServiceRoleOptions | undefined
    if (runtimeOptions?.mode !== 'tenant-primary') {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'Forbidden' }, { status: 403 }),
      }
    }
    if (
      runtimeOptions.allowedRoles.length === 0 ||
      runtimeOptions.allowedRoles.some(role => !isKnownRole(role))
    ) {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

    const dependencies = injectedDependencies ?? await getDefaultDependencies()
    const session = await dependencies.getSession(request)
    if (!session?.user) {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }

    const db = dependencies.getDb()
    const profileRecord = await dependencies.getProfile(db, session.user.id)
    if (!profileRecord || profileRecord.isActive !== true || !profileRecord.organizationId) {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

    const authorization = await dependencies.resolveTenantContext(
      db,
      session.user.id,
      profileRecord.organizationId
    )
    if (!authorization.ok) {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

    const effectiveRole = authorization.context.role
    if (!runtimeOptions.allowedRoles.includes(effectiveRole)) {
      return {
        guard: null as unknown as AuthGuard,
        error: json(
          { error: `Permission denied: requires one of ${runtimeOptions.allowedRoles.join(', ')} role` },
          { status: 403 }
        ),
      }
    }

    const profile: UserProfile = {
      id: profileRecord.id,
      organization_id: authorization.context.organizationId,
      role: effectiveRole,
      email: profileRecord.email,
      full_name: profileRecord.fullName ?? undefined,
      language_preference:
        profileRecord.languagePreference === 'ja' || profileRecord.languagePreference === 'en'
          ? profileRecord.languagePreference
          : undefined,
    }

    const logEvent = async (action: string, details: Record<string, unknown>): Promise<void> => {
      try {
        const { auditLogs } = await import('@/lib/db/drizzle/schema/audit-logs')
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: profile.organization_id,
          userId: session.user.id,
          action: `${runtimeOptions.actionName}.${action}`,
          resourceType: 'ai_analysis',
          changes: JSON.stringify(details),
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('[Audit Log] Failed to log event:', err)
      }
    }

    return {
      guard: { profile, userId: session.user.id, json, logEvent },
      error: null,
    }
  } catch (err) {
    console.error('[requireServiceRole] Error:', err)
    return {
      guard: null as unknown as AuthGuard,
      error: json({ error: 'Internal server error' }, { status: 500 }),
    }
  }
}
