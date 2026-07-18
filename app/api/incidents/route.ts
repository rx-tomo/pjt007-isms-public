import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { IncidentService } from '@/lib/services/incident'
import {
  IncidentTenantMutationService,
  isIncidentTenantMutationError,
  normalizeIncidentCreateBody,
} from '@/lib/server/incidents/incidentTenantMutationService'
import { resolveIncidentCreateAuthorization } from '@/lib/server/incidents/incidentRouteAuthorization'
import { eq } from 'drizzle-orm'

async function resolveCurrentTenantAuthorization(userId: string) {
  const db = getDb()
  const [profile] = await db
    .select({
      organizationId: userProfiles.organizationId,
      isActive: userProfiles.isActive,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  if (!profile?.organizationId || profile.isActive !== true) return null

  const authorization = await resolveTenantAuthorizationContext(
    db,
    userId,
    profile.organizationId
  )
  return authorization.ok ? authorization.context : null
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const authorization = await resolveCurrentTenantAuthorization(user.id)
    if (!authorization) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const data = await new IncidentService().listForTenantAuthorization(authorization)
    return applyCookies(NextResponse.json({ data }))
  } catch (error) {
    console.error('Incidents API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load incidents' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)

  try {
    const input = normalizeIncidentCreateBody(body)
    const authorization = await resolveIncidentCreateAuthorization(
      getDb(),
      user.id,
      input.departmentId
    )
    if (!authorization) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const created = await new IncidentTenantMutationService().createIncident(
      authorization,
      body,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({
      data: created.incident,
      links: created.links,
    }, { status: 201 }))
  } catch (error) {
    if (isIncidentTenantMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Incidents API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to create incident' }, { status: 500 }))
  }
}
