import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { TaskService } from '@/lib/services/task'
import type { TaskPriority, TaskStatus } from '@/lib/db/repositories/interfaces/ITaskRepository'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { TaskTenantMutationService } from '@/lib/server/tasks/taskTenantMutationService'
import { isTaskTenantInvariantError } from '@/lib/services/taskTenantInvariant'

function parseStatus(value: string | null): TaskStatus | undefined {
  if (!value) return undefined
  if (['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(value)) {
    return value as TaskStatus
  }
  return undefined
}

function parsePriority(value: string | null): TaskPriority | undefined {
  if (!value) return undefined
  if (['low', 'medium', 'high', 'urgent'].includes(value)) {
    return value as TaskPriority
  }
  return undefined
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'tasks'
  const organizationId = searchParams.get('organizationId')?.trim()

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const authorization = await resolveTenantAuthorizationContext(db, user.id, organizationId)
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new TaskService()

  try {
    if (action === 'categories') {
      const data = await service.getTaskCategories(organizationId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'tasks') {
      const data = await service.getTasks({
        organizationId,
        status: parseStatus(searchParams.get('status')),
        priority: parsePriority(searchParams.get('priority')),
        assigneeId: searchParams.get('assigneeId') ?? undefined,
        categoryId: searchParams.get('categoryId') ?? undefined,
        departmentId: searchParams.get('departmentId') ?? undefined,
        includeNoDepartment: searchParams.get('includeNoDepartment') === 'true',
      })
      return applyCookies(NextResponse.json(data))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch (error) {
    console.error('Tasks API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }

  const data = body as Record<string, unknown>
  const organizationId = normalizeOptionalString(data.organization_id)

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'organization_id is required' }, { status: 400 }))
  }

  try {
    const db = getDb()
    const authorization = await resolveTenantAuthorizationContext(db, user.id, organizationId)
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const service = new TaskTenantMutationService()
    const created = await service.createTask(authorization.context, data, {
      userId: user.id,
      userAgent: request.headers.get('user-agent'),
    })

    return applyCookies(NextResponse.json({ data: created }, { status: 201 }))
  } catch (error) {
    if (isTaskTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Tasks API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to create task' }, { status: 500 }))
  }
}
