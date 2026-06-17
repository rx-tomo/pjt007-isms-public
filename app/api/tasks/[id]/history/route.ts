import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { tasks, userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { TaskService } from '@/lib/services/task'

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

async function canAccessTask(taskId: string, userId: string) {
  const [task] = await getDb()
    .select({ organizationId: tasks.organizationId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task?.organizationId) return false
  const organizationIds = await getUserOrganizationIds(userId)
  return organizationIds.has(task.organizationId)
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const hasAccess = await canAccessTask(params.id, user.id)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const service = new TaskService()
  const history = await service.getTaskHistory(params.id)

  return applyCookies(NextResponse.json({ data: history }))
}
