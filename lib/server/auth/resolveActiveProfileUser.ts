import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { getDb as getDbType } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import type { RouteAuthResult } from '@/lib/server/auth/routeAuth'

export type ActiveProfileUserResult =
  | { userId: string; error?: undefined }
  | { userId?: undefined; error: NextResponse }

export interface ResolveActiveProfileUserDependencies {
  getRouteAuth: (request: NextRequest) => Promise<RouteAuthResult>
  getDb: () => ReturnType<typeof getDbType>
}

/**
 * Authenticate the request and require only an active user profile.
 *
 * Use this for user-global resources that do not belong to an organization.
 */
export async function resolveActiveProfileUser(
  request: NextRequest,
  dependencies?: ResolveActiveProfileUserDependencies
): Promise<ActiveProfileUserResult> {
  try {
    const routeAuth = dependencies?.getRouteAuth ?? getRouteAuth
    const { user } = await routeAuth(request)

    if (!user) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const db = dependencies?.getDb
      ? dependencies.getDb()
      : (await import('@/lib/db/drizzle/client')).getDb()

    const [profile] = await db
      .select({ isActive: userProfiles.isActive })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    if (!profile || profile.isActive !== true) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    return { userId: user.id }
  } catch (error) {
    console.error('[resolveActiveProfileUser] error:', error)
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
  }
}
