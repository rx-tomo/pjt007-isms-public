import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { TaskService } from '@/lib/services/task'
import { buildTaskCsv } from '@/lib/utils/exporters/taskExport'
import type { TaskPriority, TaskStatus } from '@/lib/db/repositories/interfaces/ITaskRepository'

async function resolveOrganizationId(db: ReturnType<typeof getDb>, userId: string, requestedOrganizationId?: string) {
  if (requestedOrganizationId) {
    return requestedOrganizationId
  }

  const [profile] = await db
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (profile?.organizationId) {
    return profile.organizationId
  }

  const [membership] = await db
    .select({ organizationId: userMemberships.organizationId })
    .from(userMemberships)
    .where(and(
      eq(userMemberships.userId, userId),
      eq(userMemberships.status, 'active')
    ))
    .limit(1)

  return membership?.organizationId ?? null
}

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
  return ['todo', 'in_progress', 'review', 'done', 'cancelled'].includes(value) ? value as TaskStatus : undefined
}

function parsePriority(value: string | null): TaskPriority | undefined {
  if (!value) return undefined
  return ['low', 'medium', 'high', 'urgent'].includes(value) ? value as TaskPriority : undefined
}

function normalizeTaskTagValue(value: string) {
  return value.trim().toLowerCase()
}

function taskMatchesTagFilter(task: Awaited<ReturnType<TaskService['getTasks']>>[number], tagFilter: string) {
  const normalizedTag = normalizeTaskTagValue(tagFilter)
  if (!normalizedTag) return true

  const tagCandidates = task.tags?.flatMap(tag => [
    normalizeTaskTagValue(tag.id),
    normalizeTaskTagValue(tag.name),
  ]) ?? []
  if (tagCandidates.some(candidate => candidate === normalizedTag || candidate.includes(normalizedTag))) {
    return true
  }

  if (normalizedTag === 'improvement') {
    const searchableText = normalizeTaskTagValue(`${task.title} ${task.description ?? ''} ${task.category?.name ?? ''}`)
    return ['改善', '是正', 'pdca', 'improvement'].some(keyword => searchableText.includes(keyword))
  }

  return false
}

export async function GET(request: NextRequest) {
  const isTemplate = request.nextUrl.searchParams.get('template') === 'true'

  if (isTemplate) {
    const BOM = '\uFEFF'
    const headers = 'title,description,category,assignee_email,status,priority,due_date,estimated_hours,tags'
    const csv = BOM + headers + '\n'

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="task_import_template.csv"'
      }
    })
  }

  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const db = getDb()
  const organizationId = await resolveOrganizationId(
    db,
    user.id,
    request.nextUrl.searchParams.get('organizationId') ?? undefined
  )

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'organizationId is required' }, { status: 400 }))
  }

  const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  try {
    const service = new TaskService()
    let tasks = await service.getTasks({
      organizationId,
      status: parseStatus(request.nextUrl.searchParams.get('status')),
      priority: parsePriority(request.nextUrl.searchParams.get('priority')),
      assigneeId: request.nextUrl.searchParams.get('assigneeId') ?? undefined,
      categoryId: request.nextUrl.searchParams.get('categoryId') ?? undefined,
      departmentId: request.nextUrl.searchParams.get('departmentId') ?? undefined,
      includeNoDepartment: request.nextUrl.searchParams.get('includeNoDepartment') === 'true',
    })

    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase()
    if (search) {
      tasks = tasks.filter(task => {
        const title = task.title.toLowerCase()
        const description = task.description?.toLowerCase() ?? ''
        return title.includes(search) || description.includes(search)
      })
    }

    if (request.nextUrl.searchParams.get('due') === 'overdue') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      tasks = tasks.filter(task => {
        if (!task.due_date || task.status === 'done' || task.status === 'cancelled') {
          return false
        }
        const dueDate = new Date(task.due_date)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate < today
      })
    }

    const tag = request.nextUrl.searchParams.get('tag')?.trim()
    if (tag) {
      tasks = tasks.filter(task => taskMatchesTagFilter(task, tag))
    }

    const csv = buildTaskCsv(tasks, { bom: true })

    return applyCookies(new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tasks-export.csv"'
      }
    }))
  } catch (error) {
    console.error('Task export failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to export tasks' }, { status: 500 }))
  }
}
