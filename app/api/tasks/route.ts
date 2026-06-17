import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships } from '@/lib/db/drizzle/schema'
import { getAuditLogRepository } from '@/lib/container'
import { TaskService } from '@/lib/services/task'
import type { TaskPriority, TaskStatus } from '@/lib/db/repositories/interfaces/ITaskRepository'
import type { Json } from '@/types/database.types'

async function assertOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  return profile?.organizationId === organizationId || Boolean(membership)
}

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

function parseBodyStatus(value: unknown): TaskStatus | undefined {
  return typeof value === 'string' ? parseStatus(value) : undefined
}

function parseBodyPriority(value: unknown): TaskPriority | undefined {
  return typeof value === 'string' ? parsePriority(value) : undefined
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'number') return undefined
  return Number.isFinite(value) ? value : undefined
}

function parseProgress(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(100, Math.max(0, Math.round(value)))
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'tasks'
  const organizationId = searchParams.get('organizationId') ?? undefined

  if (organizationId) {
    const db = getDb()
    const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
    if (!hasAccess) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
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
  const title = normalizeOptionalString(data.title)

  if (!organizationId || !title) {
    return applyCookies(NextResponse.json({ error: 'organization_id and title are required' }, { status: 400 }))
  }

  const db = getDb()
  const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const status = parseBodyStatus(data.status)
  const priority = parseBodyPriority(data.priority)
  const progress = parseProgress(data.progress)
  const estimatedHours = parseOptionalNumber(data.estimated_hours)
  const actualHours = parseOptionalNumber(data.actual_hours)

  try {
    const service = new TaskService()
    const created = await service.createTask({
      organization_id: organizationId,
      title,
      description: normalizeOptionalString(data.description),
      category_id: normalizeOptionalString(data.category_id),
      assignee_id: normalizeOptionalString(data.assignee_id),
      reporter_id: normalizeOptionalString(data.reporter_id) ?? user.id,
      status,
      priority,
      due_date: normalizeOptionalString(data.due_date),
      estimated_hours: estimatedHours,
      actual_hours: actualHours,
      progress,
      parent_task_id: normalizeOptionalString(data.parent_task_id),
      related_document_id: normalizeOptionalString(data.related_document_id),
      related_risk_id: normalizeOptionalString(data.related_risk_id),
    })

    const auditLog = await getAuditLogRepository()
    await auditLog.log({
      organizationId,
      userId: user.id,
      action: 'task.created',
      resourceType: 'task',
      resourceId: created.id,
      changes: {
        title,
        status: status ?? 'todo',
        priority: priority ?? 'medium',
        progress: progress ?? 0,
      } as Json,
      userAgent: request.headers.get('user-agent'),
    })

    return applyCookies(NextResponse.json({ data: created }, { status: 201 }))
  } catch (error) {
    console.error('Tasks API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to create task' }, { status: 500 }))
  }
}
