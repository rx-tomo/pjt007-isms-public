/**
 * Require Service Role Guard
 *
 * Provides authentication and authorization for API routes.
 * Validates user authentication and role-based access control.
 * Uses Better Auth for authentication.
 *
 * @module lib/auth/requireServiceRole
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * User profile with role information
 */
export interface UserProfile {
  id: string
  organization_id: string
  role: string
  email: string
  full_name?: string
  language_preference?: 'ja' | 'en'
}

/**
 * Guard options for role-based access control
 */
export interface RequireServiceRoleOptions {
  /** List of roles allowed to access the endpoint */
  allowedRoles: string[]
  /** Action name for audit logging */
  actionName: string
}

/**
 * Authenticated guard result
 */
export interface AuthGuard {
  /** User profile information */
  profile: UserProfile
  /** User ID */
  userId: string
  /** Helper to create JSON responses */
  json: <T>(data: T, init?: ResponseInit) => NextResponse<T>
  /** Helper to log audit events */
  logEvent: (action: string, details: Record<string, unknown>) => Promise<void>
}

/**
 * Guard result type
 */
export interface RequireServiceRoleResult {
  guard: AuthGuard
  error: NextResponse | null
}

/**
 * Require authenticated user with specific role
 *
 * Validates the request has a valid authenticated user and the user
 * has one of the allowed roles.
 *
 * @param request - The NextRequest object
 * @param options - Guard options including allowed roles
 * @returns Guard result with authenticated context or error response
 *
 * @example
 * ```typescript
 * const { guard, error } = await requireServiceRole(request, {
 *   allowedRoles: ['org_admin', 'risk_manager'],
 *   actionName: 'ai.risks.analyze'
 * })
 * if (error) return error
 *
 * const { profile, userId, json, logEvent } = guard
 * ```
 */
export async function requireServiceRole(
  request: NextRequest,
  options: RequireServiceRoleOptions
): Promise<RequireServiceRoleResult> {
  const { allowedRoles, actionName } = options

  const json = <T>(data: T, init?: ResponseInit): NextResponse<T> => {
    return NextResponse.json(data, init)
  }

  try {
    const { auth } = await import('@/lib/auth/better-auth')
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Query user profile from Drizzle DB for role and organization info
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema/users')
    const { eq } = await import('drizzle-orm')
    const db = getDb()

    const profiles = await db
      .select({
        id: userProfiles.id,
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
        languagePreference: userProfiles.languagePreference,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, session.user.id))
      .limit(1)

    const profileRow = profiles[0]
    if (!profileRow) {
      return {
        guard: null as unknown as AuthGuard,
        error: json({ error: 'User profile not found' }, { status: 404 })
      }
    }

    const profile: UserProfile = {
      id: profileRow.id,
      organization_id: profileRow.organizationId ?? '',
      role: profileRow.role,
      email: profileRow.email,
      full_name: profileRow.fullName ?? undefined,
      language_preference: (profileRow.languagePreference as 'ja' | 'en') ?? undefined,
    }

    // Check role authorization
    if (!allowedRoles.includes(profile.role)) {
      return {
        guard: null as unknown as AuthGuard,
        error: json(
          { error: `Permission denied: requires one of ${allowedRoles.join(', ')} role` },
          { status: 403 }
        )
      }
    }

    // Create audit log helper using Drizzle
    const logEvent = async (action: string, details: Record<string, unknown>): Promise<void> => {
      try {
        const { auditLogs } = await import('@/lib/db/drizzle/schema/audit-logs')
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: profile.organization_id,
          userId: session.user.id,
          action: `${actionName}.${action}`,
          resourceType: 'ai_analysis',
          changes: JSON.stringify(details),
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('[Audit Log] Failed to log event:', err)
      }
    }

    return {
      guard: {
        profile,
        userId: session.user.id,
        json,
        logEvent
      },
      error: null
    }
  } catch (err) {
    console.error('[requireServiceRole] Error:', err)
    return {
      guard: null as unknown as AuthGuard,
      error: json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
