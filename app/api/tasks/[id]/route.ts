import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { TaskService } from '@/lib/services/task'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { TaskTenantMutationService } from '@/lib/server/tasks/taskTenantMutationService'
import { isTaskTenantInvariantError } from '@/lib/services/taskTenantInvariant'

type Params = { id: string }

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const service = new TaskService()
  const organizationId = await service.getTaskOrganizationId(params.id)
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const db = getDb()
  const authorization = await resolveTenantAuthorizationContext(db, user.id, organizationId)
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const task = await service.getTaskByIdForOrganization(params.id, authorization.context.organizationId)
  if (!task) return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))

  return applyCookies(NextResponse.json({ data: task }))
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }

  try {
    const readService = new TaskService()
    const organizationId = await readService.getTaskOrganizationId(params.id)
    if (!organizationId) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const db = getDb()
    const authorization = await resolveTenantAuthorizationContext(db, user.id, organizationId)
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    const service = new TaskTenantMutationService()
    const result = await service.updateTask(
      authorization.context,
      params.id,
      body as Record<string, unknown>,
      {
        userId: user.id,
        userAgent: request.headers.get('user-agent'),
      }
    )
    if (!result) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    return applyCookies(NextResponse.json({ data: result.task }))
  } catch (error) {
    if (isTaskTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Tasks API PATCH failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update task' }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const readService = new TaskService()
    const organizationId = await readService.getTaskOrganizationId(params.id)
    if (!organizationId) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const authorization = await resolveTenantAuthorizationContext(getDb(), user.id, organizationId)
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const service = new TaskTenantMutationService()
    await service.deleteTask(authorization.context, params.id, {
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
    })
    return applyCookies(NextResponse.json({ data: { id: params.id } }))
  } catch (error) {
    if (isTaskTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Tasks API DELETE failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to delete task' }, { status: 500 }))
  }
}
