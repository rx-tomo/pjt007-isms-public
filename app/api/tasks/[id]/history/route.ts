import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { getAccessibleTaskForUser } from '@/lib/server/auth/taskAccess'
import { getDb } from '@/lib/db/drizzle/client'
import { TaskService } from '@/lib/services/task'

type Params = { id: string }

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

  const service = new TaskService()
  const history = await service.getTaskHistory(params.id)

  return applyCookies(NextResponse.json({ data: history }))
}
