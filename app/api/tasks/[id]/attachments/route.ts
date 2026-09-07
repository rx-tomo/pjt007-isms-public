import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { getAccessibleTaskForUser } from '@/lib/server/auth/taskAccess'
import { getAuditLogRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { taskAttachments } from '@/lib/db/drizzle/schema'
import { TaskService } from '@/lib/services/task'
import { getStorageProvider } from '@/lib/storage'
import { createStorageDownloadHeaders } from '@/lib/storage/storageRoutePolicy'
import {
  getTaskAttachmentMaxFileSize,
  isTaskAttachmentStoragePath,
  isTaskAttachmentSizeAllowed,
  TASK_ATTACHMENT_MULTIPART_OVERHEAD_BYTES,
  validateTaskAttachment,
} from '@/lib/storage/taskAttachmentPolicy'
import { parseLimitedFormData } from '@/lib/server/http/limitedFormData'
import type { Json } from '@/types/database.types'

type Params = { id: string }

async function getTaskAttachment(taskId: string, attachmentId: string) {
  const db = getDb()
  const [attachment] = await db
    .select({
      id: taskAttachments.id,
      taskId: taskAttachments.taskId,
      fileName: taskAttachments.fileName,
      filePath: taskAttachments.filePath,
      fileSize: taskAttachments.fileSize,
      mimeType: taskAttachments.mimeType,
    })
    .from(taskAttachments)
    .where(and(
      eq(taskAttachments.id, attachmentId),
      eq(taskAttachments.taskId, taskId)
    ))
    .limit(1)

  return attachment ?? null
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const task = await getAccessibleTaskForUser(getDb(), params.id, user.id)
  if (!task) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }
  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    task.organizationId,
    'tasks.read'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }

  const attachmentId = request.nextUrl.searchParams.get('attachmentId')?.trim()
  if (!attachmentId) {
    return applyCookies(NextResponse.json({ error: 'attachmentId is required' }, { status: 400 }))
  }

  const attachment = await getTaskAttachment(params.id, attachmentId)
  if (!attachment) {
    return applyCookies(NextResponse.json({ error: 'Attachment not found' }, { status: 404 }))
  }
  if (!isTaskAttachmentStoragePath(
    attachment.filePath,
    task.organizationId,
    task.id
  )) {
    return applyCookies(NextResponse.json({ error: 'Attachment not found' }, { status: 404 }))
  }

  const storage = getStorageProvider()
  const { data, error } = await storage.download('task-attachments', attachment.filePath)
  if (error || !data) {
    return applyCookies(NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 }))
  }

  const body = await data.arrayBuffer()
  return applyCookies(new NextResponse(body, {
    headers: createStorageDownloadHeaders(attachment.filePath, attachment.fileName),
  }))
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

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

  const formDataResult = await parseLimitedFormData(
    request,
    getTaskAttachmentMaxFileSize() + TASK_ATTACHMENT_MULTIPART_OVERHEAD_BYTES
  )
  if (!formDataResult.ok) {
    const status = formDataResult.reason === 'too_large' ? 413 : 400
    const error = status === 413 ? 'Attachment is too large' : 'Invalid form data'
    return applyCookies(NextResponse.json({ error }, { status }))
  }

  const formData = formDataResult.formData
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return applyCookies(NextResponse.json({ error: 'file is required' }, { status: 400 }))
  }
  if (!isTaskAttachmentSizeAllowed(file.size)) {
    return applyCookies(NextResponse.json({ error: 'Attachment is too large' }, { status: 413 }))
  }

  const validation = validateTaskAttachment(file.name, file.type)
  if (!validation.ok) {
    return applyCookies(NextResponse.json(
      { error: validation.reason === 'invalid_file_name' ? 'Invalid file name' : 'Unsupported file type' },
      { status: 400 }
    ))
  }

  try {
    const service = new TaskService()
    const attachment = await service.uploadAttachment(params.id, file, user.id, task.organizationId)

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
    return applyCookies(NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

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

  const attachmentId = new URL(request.url).searchParams.get('attachmentId')?.trim()
  if (!attachmentId) {
    return applyCookies(NextResponse.json({ error: 'attachmentId is required' }, { status: 400 }))
  }

  const attachment = await getTaskAttachment(params.id, attachmentId)
  if (!attachment) {
    return applyCookies(NextResponse.json({ error: 'Attachment not found' }, { status: 404 }))
  }
  if (!isTaskAttachmentStoragePath(
    attachment.filePath,
    task.organizationId,
    task.id
  )) {
    return applyCookies(NextResponse.json({ error: 'Attachment not found' }, { status: 404 }))
  }

  const service = new TaskService()
  await service.deleteAttachment(attachmentId, params.id, task.organizationId)

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
