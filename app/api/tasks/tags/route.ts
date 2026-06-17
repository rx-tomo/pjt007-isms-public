import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getAuditLogRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { TaskService } from '@/lib/services/task'
import type { Json } from '@/types/database.types'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function assertOrganizationAccess(userId: string, organizationId: string) {
  const db = getDb()
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

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const organizationId = normalizeString(new URL(request.url).searchParams.get('organizationId'))
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'organizationId is required' }, { status: 400 }))
  }

  const hasAccess = await assertOrganizationAccess(user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new TaskService()
  const tags = await service.getTaskTags(organizationId)

  return applyCookies(NextResponse.json({ data: tags }))
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  const organizationId = normalizeString(body?.organization_id)
  const name = normalizeString(body?.name)
  const color = normalizeString(body?.color) || null

  if (!organizationId || !name) {
    return applyCookies(NextResponse.json({ error: 'organization_id and name are required' }, { status: 400 }))
  }

  const hasAccess = await assertOrganizationAccess(user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new TaskService()
  const tag = await service.createTaskTag({ organization_id: organizationId, name, color })

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId,
    userId: user.id,
    action: 'task.tag.created',
    resourceType: 'task_tag',
    resourceId: tag.id,
    changes: { name, color } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return applyCookies(NextResponse.json({ data: tag }, { status: 201 }))
}
