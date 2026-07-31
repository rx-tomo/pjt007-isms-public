import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { handleNotificationsGet, handleNotificationsPost } from './handlers'

const ALLOWED_ROLES = ['super_admin', 'system_operator', 'org_admin', 'auditor', 'approver', 'user']

export async function GET(request: NextRequest) {
  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant-primary',
    allowedRoles: ALLOWED_ROLES,
    actionName: 'notifications.read',
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleNotificationsGet(request, guard)
}

export async function POST(request: NextRequest) {
  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant-primary',
    allowedRoles: ALLOWED_ROLES,
    actionName: 'notifications.write',
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleNotificationsPost(request, guard)
}
