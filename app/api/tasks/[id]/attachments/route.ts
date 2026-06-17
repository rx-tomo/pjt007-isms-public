import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getAuditLogRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { taskAttachments, tasks, userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
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

async function getTaskAttachment(taskId: string, attachmentId: string) {
  const db = getDb()
  const [attachment] = await db
    .select({
      id: taskAttachments.id,
      taskId: taskAttachments.taskId,
      fileName: taskAttachments.fileName,
      filePath: taskAttachments.filePath,
      fileSize: taskAttachments.fileSize,
    })
    .from(taskAttachments)
    .where(and(
      eq(taskAttachments.id, attachmentId),
      eq(taskAttachments.taskId, taskId)
    ))
    .limit(1)

  return attachment ?? null
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return applyCookies(NextResponse.json({ error: 'file is required' }, { status: 400 }))
  }

  try {
    const service = new TaskService()
    const attachment = await service.uploadAttachment(params.id, file, user.id)

    const auditLog = await getAuditLogRepository()
    await auditLog.log({
      organizationId: task.organizationId,
      userId: user.id,
      action: 'task.attachment.created',
      resourceType: 'task',
      resourceId: params.id,
      changes: {
        attachment_id: attachment.id,
        file_name: attachment.file_name,
        file_size: attachment.file_size,
      } as Json,
      userAgent: request.headers.get('user-agent'),
    })

    return applyCookies(NextResponse.json({ data: attachment }, { status: 201 }))
  } catch (error) {
    console.error('Task attachment upload failed', error)
    const message = error instanceof Error ? error.message : 'Failed to upload attachment'
    return applyCookies(NextResponse.json({ error: message }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const task = await getAccessibleTask(params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const attachmentId = new URL(request.url).searchParams.get('attachmentId')?.trim()
  if (!attachmentId) {
    return applyCookies(NextResponse.json({ error: 'attachmentId is required' }, { status: 400 }))
  }

  const attachment = await getTaskAttachment(params.id, attachmentId)
  if (!attachment) {
    return applyCookies(NextResponse.json({ error: 'Attachment not found' }, { status: 404 }))
  }

  const service = new TaskService()
  await service.deleteAttachment(attachmentId)

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: task.organizationId,
    userId: user.id,
    action: 'task.attachment.deleted',
    resourceType: 'task',
    resourceId: params.id,
    changes: {
      attachment_id: attachment.id,
      file_name: attachment.fileName,
      file_path: attachment.filePath,
    } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: { id: attachmentId } }))
}
