import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getAuditLogRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { taskTags, tasks, userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { TaskService } from '@/lib/services/task'
import type { Json } from '@/types/database.types'

type Params = { id: string }

async function getUserOrganizationIds(userId: string) {
  const db = getDb()
  const [profileRows, membershipRows] = await Promise.all([
    db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({ organizationId: userMemberships.organizationId })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.status, 'active')
      )),
  ])

  return new Set([
    profileRows[0]?.organizationId,
    ...membershipRows.map((row) => row.organizationId),
  ].filter((id): id is string => Boolean(id)))
}

async function getAccessibleTask(taskId: string, userId: string) {
  const db = getDb()
  const [task] = await db
    .select({
      id: tasks.id,
      organizationId: tasks.organizationId,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task?.organizationId) return null
  const organizationId = task.organizationId

  const organizationIds = await getUserOrganizationIds(userId)
  if (!organizationIds.has(organizationId)) return null

  return { id: task.id, organizationId }
}

function normalizeTagIds(value: unknown) {
  if (!Array.isArray(value)) return null
  const tagIds = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return Array.from(new Set(tagIds))
}

async function validateTagOrganization(tagIds: string[], organizationId: string) {
  if (tagIds.length === 0) return true

  const db = getDb()
  const rows = await db
    .select({ id: taskTags.id })
    .from(taskTags)
    .where(and(
      inArray(taskTags.id, tagIds),
      eq(taskTags.organizationId, organizationId)
    ))

  return rows.length === tagIds.length
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

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const validTags = await validateTagOrganization(tagIds, task.organizationId)
  if (!validTags) {
    return applyCookies(NextResponse.json({ error: 'Invalid tag for task organization' }, { status: 400 }))
  }

  const service = new TaskService()
  await service.setTaskTags(params.id, tagIds)
  const updatedTask = await service.getTaskById(params.id)

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: task.organizationId,
    userId: user.id,
    action: 'task.tags.updated',
    resourceType: 'task',
    resourceId: params.id,
    changes: { tagIds } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: updatedTask?.tags ?? [] }))
}
