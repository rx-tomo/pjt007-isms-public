import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { taskComments, tasks, userProfiles, userMemberships } from '@/lib/db/drizzle/schema'
import { getAuditLogRepository } from '@/lib/container'
import { NotificationService } from '@/lib/services/notification'
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
      title: tasks.title,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task?.organizationId) return null
  const organizationId = task.organizationId

  const organizationIds = await getUserOrganizationIds(userId)
  if (!organizationIds.has(organizationId)) return null

  return { ...task, organizationId }
}

async function getTaskComment(taskId: string, commentId: string) {
  const db = getDb()
  const [comment] = await db
    .select()
    .from(taskComments)
    .where(and(
      eq(taskComments.id, commentId),
      eq(taskComments.taskId, taskId)
    ))
    .limit(1)

  return comment ?? null
}

async function getMentionedUsers(organizationId: string, comment: string, actorUserId: string) {
  const db = getDb()
  const users = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName,
    })
    .from(userProfiles)
    .where(and(
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isActive, true)
    ))

  const mentioned = new Map<string, { id: string; label: string }>()
  const lowerComment = comment.toLowerCase()

  for (const profile of users) {
    if (profile.id === actorUserId) continue

    const aliases = [profile.email, profile.fullName].filter((value): value is string => Boolean(value))
    const isMentioned = aliases.some((alias) => {
      const normalizedAlias = alias.trim()
      return normalizedAlias.length > 0 && lowerComment.includes(`@${normalizedAlias.toLowerCase()}`)
    })

    if (isMentioned) {
      mentioned.set(profile.id, {
        id: profile.id,
        label: profile.fullName || profile.email,
      })
    }
  }

  return [...mentioned.values()]
}

async function notifyMentionedUsers(params: {
  organizationId: string
  taskId: string
  taskTitle: string
  commentId: string
  comment: string
  actorUserId: string
  action: 'created' | 'updated'
}) {
  const mentionedUsers = await getMentionedUsers(params.organizationId, params.comment, params.actorUserId)

  const createdNotifications = await Promise.all(
    mentionedUsers.map(user =>
      NotificationService.createNotification({
        organization_id: params.organizationId,
        user_id: user.id,
        title: 'タスクコメントでメンションされました',
        message: `タスク「${params.taskTitle}」のコメントでメンションされました: ${params.comment.slice(0, 80)}`,
        type: 'info',
        priority: 'medium',
        link: `/tasks/${params.taskId}`,
        metadata: {
          task_id: params.taskId,
          comment_id: params.commentId,
          mentioned_by: params.actorUserId,
          action: params.action,
        },
      })
    )
  )

  return createdNotifications
    .filter((notification): notification is NonNullable<typeof notification> => Boolean(notification))
    .map(notification => notification.id)
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const service = new TaskService()
  const comments = await service.getTaskComments(params.id)

  return applyCookies(NextResponse.json({ data: comments }))
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  if (!comment) {
    return applyCookies(NextResponse.json({ error: 'comment is required' }, { status: 400 }))
  }

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const service = new TaskService()
  const created = await service.addComment(params.id, comment, user.id)
  const mentionNotificationIds = await notifyMentionedUsers({
    organizationId: task.organizationId,
    taskId: params.id,
    taskTitle: task.title,
    commentId: created.id,
    comment,
    actorUserId: user.id,
    action: 'created',
  })

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: task.organizationId,
    userId: user.id,
    action: 'task.comment.created',
    resourceType: 'task',
    resourceId: params.id,
    changes: {
      comment_id: created.id,
      comment_preview: comment.slice(0, 120),
      mention_notification_ids: mentionNotificationIds,
    } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: created }, { status: 201 }))
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  const commentId = typeof body?.commentId === 'string' ? body.commentId : ''
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  if (!commentId || !comment) {
    return applyCookies(NextResponse.json({ error: 'commentId and comment are required' }, { status: 400 }))
  }

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const existing = await getTaskComment(params.id, commentId)
  if (!existing) {
    return applyCookies(NextResponse.json({ error: 'Comment not found' }, { status: 404 }))
  }

  const service = new TaskService()
  const updated = await service.updateComment(params.id, commentId, comment)
  const mentionNotificationIds = await notifyMentionedUsers({
    organizationId: task.organizationId,
    taskId: params.id,
    taskTitle: task.title,
    commentId,
    comment,
    actorUserId: user.id,
    action: 'updated',
  })

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: task.organizationId,
    userId: user.id,
    action: 'task.comment.updated',
    resourceType: 'task',
    resourceId: params.id,
    changes: {
      comment_id: commentId,
      old_preview: existing.comment.slice(0, 120),
      new_preview: comment.slice(0, 120),
      mention_notification_ids: mentionNotificationIds,
    } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: updated }))
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  const commentId = typeof body?.commentId === 'string' ? body.commentId : ''
  if (!commentId) {
    return applyCookies(NextResponse.json({ error: 'commentId is required' }, { status: 400 }))
  }

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const existing = await getTaskComment(params.id, commentId)
  if (!existing) {
    return applyCookies(NextResponse.json({ error: 'Comment not found' }, { status: 404 }))
  }

  const service = new TaskService()
  await service.deleteComment(params.id, commentId)

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: task.organizationId,
    userId: user.id,
    action: 'task.comment.deleted',
    resourceType: 'task',
    resourceId: params.id,
    changes: {
      comment_id: commentId,
      deleted_preview: existing.comment.slice(0, 120),
    } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: { id: commentId } }))
}
