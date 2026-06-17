import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getAuditLogRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { taskHistory, userProfiles } from '@/lib/db/drizzle/schema'
import { TaskService } from '@/lib/services/task'
import type { TaskPriority, TaskStatus } from '@/lib/db/repositories/interfaces/ITaskRepository'
import type { Json } from '@/types/database.types'

type Params = { id: string }

const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled']
const taskPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseStatus(value: unknown): TaskStatus | undefined {
  return typeof value === 'string' && taskStatuses.includes(value as TaskStatus)
    ? value as TaskStatus
    : undefined
}

function parsePriority(value: unknown): TaskPriority | undefined {
  return typeof value === 'string' && taskPriorities.includes(value as TaskPriority)
    ? value as TaskPriority
    : undefined
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

function buildTaskUpdates(body: Record<string, unknown>) {
  const updates: Parameters<TaskService['updateTask']>[1] = {}

  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
  if (body.description !== undefined) updates.description = normalizeOptionalString(body.description)
  if (body.category_id !== undefined) updates.category_id = normalizeOptionalString(body.category_id)
  if (body.assignee_id !== undefined) updates.assignee_id = normalizeOptionalString(body.assignee_id)
  if (body.reporter_id !== undefined) updates.reporter_id = normalizeOptionalString(body.reporter_id)
  if (body.department_id !== undefined) updates.department_id = normalizeOptionalString(body.department_id)
  if (body.status !== undefined) {
    const status = parseStatus(body.status)
    if (status) updates.status = status
  }
  if (body.priority !== undefined) {
    const priority = parsePriority(body.priority)
    if (priority) updates.priority = priority
  }
  if (body.due_date !== undefined) updates.due_date = normalizeOptionalString(body.due_date)
  if (body.estimated_hours !== undefined) updates.estimated_hours = parseOptionalNumber(body.estimated_hours)
  if (body.actual_hours !== undefined) updates.actual_hours = parseOptionalNumber(body.actual_hours)
  if (body.progress !== undefined) {
    const progress = parseProgress(body.progress)
    if (progress !== undefined) updates.progress = progress
  }
  if (body.parent_task_id !== undefined) updates.parent_task_id = normalizeOptionalString(body.parent_task_id)
  if (body.related_document_id !== undefined) updates.related_document_id = normalizeOptionalString(body.related_document_id)
  if (body.related_risk_id !== undefined) updates.related_risk_id = normalizeOptionalString(body.related_risk_id)
  if (body.completed_at !== undefined) updates.completed_at = normalizeOptionalString(body.completed_at)

  return updates
}

function hasOrganizationAccess(taskOrganizationId: string | null | undefined, userOrganizationId: string | null | undefined) {
  return Boolean(taskOrganizationId && userOrganizationId && taskOrganizationId === userOrganizationId)
}

type TaskUpdatePayload = Parameters<TaskService['updateTask']>[1]

const historyFields: Array<keyof TaskUpdatePayload> = [
  'title',
  'description',
  'category_id',
  'assignee_id',
  'reporter_id',
  'department_id',
  'status',
  'priority',
  'due_date',
  'estimated_hours',
  'actual_hours',
  'progress',
  'parent_task_id',
  'related_document_id',
  'related_risk_id',
  'completed_at',
]

function getTaskFieldValue(task: Awaited<ReturnType<TaskService['getTaskById']>>, field: keyof TaskUpdatePayload) {
  if (!task) return null
  return task[field as keyof typeof task] ?? null
}

async function getUserLabel(userId: string | null | undefined) {
  if (!userId) return null
  const [profile] = await getDb()
    .select({ fullName: userProfiles.fullName, email: userProfiles.email })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  return profile?.fullName || profile?.email || userId
}

async function formatHistoryValue(field: keyof TaskUpdatePayload, value: unknown) {
  if (field === 'assignee_id' || field === 'reporter_id') {
    return getUserLabel(typeof value === 'string' ? value : null)
  }
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

async function recordTaskHistory(
  taskId: string,
  userId: string,
  existing: NonNullable<Awaited<ReturnType<TaskService['getTaskById']>>>,
  updates: TaskUpdatePayload,
) {
  const rows = []

  for (const field of historyFields) {
    if (!(field in updates)) continue
    const oldValue = getTaskFieldValue(existing, field)
    const newValue = updates[field]
    if ((oldValue ?? null) === (newValue ?? null)) continue

    rows.push({
      id: crypto.randomUUID(),
      taskId,
      userId,
      action: 'updated',
      fieldName: field,
      oldValue: await formatHistoryValue(field, oldValue),
      newValue: await formatHistoryValue(field, newValue),
      createdAt: new Date().toISOString(),
    })
  }

  if (rows.length > 0) {
    await getDb().insert(taskHistory).values(rows)
  }
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const service = new TaskService()
  const [task, profile] = await Promise.all([
    service.getTaskById(params.id),
    import('@/lib/db/drizzle/client').then(async ({ getDb }) => {
      const db = getDb()
      const rows = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1)
      return rows[0] ?? null
    }),
  ])

  if (!task || !hasOrganizationAccess(task.organization_id, profile?.organizationId)) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

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

  const service = new TaskService()
  const existing = await service.getTaskById(params.id)

  if (!existing) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const db = getDb()
  const profileRows = await db
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)
  const profile = profileRows[0] ?? null

  if (!hasOrganizationAccess(existing.organization_id, profile?.organizationId)) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const updates = buildTaskUpdates(body as Record<string, unknown>)
  if (Object.keys(updates).length === 0) {
    return applyCookies(NextResponse.json({ data: existing }))
  }

  const updated = await service.updateTask(params.id, updates)
  await recordTaskHistory(params.id, user.id, existing, updates)

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'task.updated',
    resourceType: 'task',
    resourceId: params.id,
    changes: updates as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: updated }))
}
