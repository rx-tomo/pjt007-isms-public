/**
 * Resolve Caller Organization
 *
 * Shared helper that authenticates the request and resolves the caller's organization.
 * Use this in API routes to enforce auth + org-scope in a single call.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'

export type CallerOrgResult =
  | { userId: string; organizationId: string; error?: undefined }
  | { userId?: undefined; organizationId?: undefined; error: NextResponse }

/**
 * Authenticate the request and resolve the caller's organizationId from user_profiles.
 */
export async function resolveCallerOrg(request: NextRequest): Promise<CallerOrgResult> {
  const { user } = await getRouteAuth(request)

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  try {
    const { getDb } = await import('@/lib/db/drizzle/client')
    const { userProfiles } = await import('@/lib/db/drizzle/schema/users')
    const { eq } = await import('drizzle-orm')
    const db = getDb()

    const profiles = await db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    const profile = profiles[0]
    if (!profile?.organizationId) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    return { userId: user.id, organizationId: profile.organizationId }
  } catch (e) {
    console.error('[resolveCallerOrg] error:', e)
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
  }
}
