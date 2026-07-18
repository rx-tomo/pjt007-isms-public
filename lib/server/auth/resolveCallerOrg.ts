/**
 * Resolve Caller Organization
 *
 * Shared helper that authenticates the request and resolves the caller's organization.
 * Use this in API routes to enforce auth + org-scope in a single call.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { getDb as getDbType } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import type { RouteAuthResult } from '@/lib/server/auth/routeAuth'
import { eq } from 'drizzle-orm'

export type CallerOrgResult =
  | { userId: string; organizationId: string; error?: undefined }
  | { userId?: undefined; organizationId?: undefined; error: NextResponse }

export interface ResolveCallerOrgDependencies {
  getRouteAuth: (request: NextRequest) => Promise<RouteAuthResult>
  getDb: () => ReturnType<typeof getDbType>
}

/**
 * Authenticate the request and resolve an active primary-organization membership.
 */
export async function resolveCallerOrg(
  request: NextRequest,
  dependencies?: ResolveCallerOrgDependencies
): Promise<CallerOrgResult> {
  try {
    const routeAuth = dependencies?.getRouteAuth ?? getRouteAuth
    const { user } = await routeAuth(request)

    if (!user) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const db = dependencies?.getDb
      ? dependencies.getDb()
      : (await import('@/lib/db/drizzle/client')).getDb()

    const profiles = await db
      .select({
        organizationId: userProfiles.organizationId,
        isActive: userProfiles.isActive,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    const profile = profiles[0]
    if (!profile || profile.isActive !== true || !profile.organizationId) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    const authorization = await resolveTenantAuthorizationContext(
      db,
      user.id,
      profile.organizationId
    )
    if (!authorization.ok) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    return { userId: user.id, organizationId: profile.organizationId }
  } catch (e) {
    console.error('[resolveCallerOrg] error:', e)
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
  }
}
