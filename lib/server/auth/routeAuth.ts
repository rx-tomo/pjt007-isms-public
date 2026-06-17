/**
 * Route Authentication Helper
 *
 * Authenticates API route requests via Better Auth.
 */

import type { NextRequest, NextResponse } from 'next/server'

export interface RouteAuthUser {
  id: string
  email: string
}

export interface RouteAuthResult {
  user: RouteAuthUser | null
  applyCookies: <T extends NextResponse>(response: T) => T
}

/**
 * Authenticate a route request and return the current user.
 */
export async function getRouteAuth(request: NextRequest): Promise<RouteAuthResult> {
  const noop = <T extends NextResponse>(response: T): T => response

  try {
    const { auth } = await import('@/lib/auth/better-auth')
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return { user: null, applyCookies: noop }
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      applyCookies: noop,
    }
  } catch (e) {
    console.error('[RouteAuth] error:', e)
    return { user: null, applyCookies: noop }
  }
}
