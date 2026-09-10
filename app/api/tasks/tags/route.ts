import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { getDb } from '@/lib/db/drizzle/client'
import { TaskService } from '@/lib/services/task'
import { createTaskTagWithAudit } from '@/lib/services/tenantAuditedMutations'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const organizationId = normalizeString(new URL(request.url).searchParams.get('organizationId'))
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'organizationId is required' }, { status: 400 }))
  }

  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    organizationId,
    'tasks.read'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }

  const service = new TaskService()
  const tags = await service.getTaskTags(organizationId)

  return applyCookies(NextResponse.json({ data: tags }))
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  const organizationId = normalizeString(body?.organization_id)
  const name = normalizeString(body?.name)
  const color = normalizeString(body?.color) || null

  if (!organizationId || !name) {
    return applyCookies(NextResponse.json({ error: 'organization_id and name are required' }, { status: 400 }))
  }

  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    organizationId,
    'tasks.update'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }

  const tag = await createTaskTagWithAudit(getDb(), {
    organizationId,
    actorUserId: user.id,
    name,
    color,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: tag }, { status: 201 }))
}
