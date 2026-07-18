import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { IncidentService } from '@/lib/services/incident'
import {
  IncidentTenantMutationService,
  assertIncidentRelatedResourceAccess,
  isIncidentTenantMutationError,
} from '@/lib/server/incidents/incidentTenantMutationService'
import { resolveIncidentTargetAuthorization } from '@/lib/server/incidents/incidentRouteAuthorization'

type Params = { id: string }

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const { id } = await props.params
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const authorization = await resolveIncidentTargetAuthorization(getDb(), user.id, id)
    if (!authorization) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const service = new IncidentService()
    const incident = await service.getByIdForTenantAuthorization(id, authorization)
    if (!incident) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const storedLinks = await service.getIncidentLinks(id)
    const links = (await Promise.all(storedLinks.map(async link => {
      try {
        await assertIncidentRelatedResourceAccess(getDb(), authorization, {
          linkType: link.link_type,
          linkId: link.link_id,
        })
        return link
      } catch (error) {
        if (isIncidentTenantMutationError(error) && error.status === 404) return null
        throw error
      }
    }))).filter((link): link is (typeof storedLinks)[number] => link !== null)
    return applyCookies(NextResponse.json({ data: incident, links }))
  } catch (error) {
    console.error('Incident detail API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load incident' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const { id } = await props.params
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const body = await request.json().catch(() => null)

  try {
    const authorization = await resolveIncidentTargetAuthorization(getDb(), user.id, id)
    if (!authorization) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    const link = await new IncidentTenantMutationService().createLink(
      authorization,
      id,
      body,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data: link }, { status: 201 }))
  } catch (error) {
    if (isIncidentTenantMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Incident link API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to create incident link' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const { id } = await props.params
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const body = await request.json().catch(() => null)

  try {
    const authorization = await resolveIncidentTargetAuthorization(getDb(), user.id, id)
    if (!authorization) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    const incident = await new IncidentTenantMutationService().updateIncidentStatus(
      authorization,
      id,
      body,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data: incident }))
  } catch (error) {
    if (isIncidentTenantMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Incident API PATCH failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update incident' }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const { id } = await props.params
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const body = await request.json().catch(() => null)

  try {
    const authorization = await resolveIncidentTargetAuthorization(getDb(), user.id, id)
    if (!authorization) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    await new IncidentTenantMutationService().deleteLink(
      authorization,
      id,
      body,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(new NextResponse(null, { status: 204 }))
  } catch (error) {
    if (isIncidentTenantMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Incident link API DELETE failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to delete incident link' }, { status: 500 }))
  }
}
