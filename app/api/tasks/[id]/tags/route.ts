import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { getAccessibleTaskForUser } from '@/lib/server/auth/taskAccess'
import { getDb } from '@/lib/db/drizzle/client'
import { TaskService } from '@/lib/services/task'
import { TaskTenantMutationService } from '@/lib/server/tasks/taskTenantMutationService'
import { isTaskTenantInvariantError } from '@/lib/services/taskTenantInvariant'

type Params = { id: string }

function normalizeTagIds(value: unknown) {
  if (!Array.isArray(value)) return null
  if (value.some(item => typeof item !== 'string')) return null
  const tagIds = value.map(item => item.trim()).filter(Boolean)
  return Array.from(new Set(tagIds))
}

export async function PUT(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  const tagIds = normalizeTagIds(body?.tagIds)
  if (!tagIds) {
    return applyCookies(NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 }))
  }

  try {
    const task = await getAccessibleTaskForUser(getDb(), params.id, user.id)
    if (!task) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    const authorization = await authorizeTenantAction(
      getDb(),
      user.id,
      task.organizationId,
      'tasks.update'
    )
    if (!authorization.ok) {
      const status = tenantActionDenialStatus(authorization)
      return applyCookies(NextResponse.json(
        { error: status === 403 ? 'Forbidden' : 'Not found' },
        { status }
      ))
    }

    const service = new TaskTenantMutationService()
    await service.setTaskTags(authorization.context, params.id, tagIds, {
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
    })
    const updatedTask = await new TaskService().getTaskByIdForOrganization(params.id, task.organizationId)
    return applyCookies(NextResponse.json({ data: updatedTask?.tags ?? [] }))
  } catch (error) {
    if (isTaskTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Task tags API PUT failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update task tags' }, { status: 500 }))
  }
}
