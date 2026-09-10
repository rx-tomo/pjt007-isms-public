import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { buildHomeRoleDashboard } from '@/lib/server/home/roleDashboard'

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const organizationId = new URL(request.url).searchParams.get('organizationId')
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const authorization = await resolveTenantAuthorizationContext(
    getDb(),
    user.id,
    organizationId
  )
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const dashboard = await buildHomeRoleDashboard(authorization.context)
  return applyCookies(NextResponse.json({ dashboard }))
}
