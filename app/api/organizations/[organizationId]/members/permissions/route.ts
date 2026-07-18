import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { PermissionService } from '@/lib/services/permissions'
import { isMemberTenantInvariantError } from '@/lib/services/memberTenantInvariant'

type Params = {
  organizationId: string
}

const errorResponse = (respond: (body: unknown, init?: ResponseInit) => NextResponse, message: string, status = 400) =>
  respond({ error: message }, { status })

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const organizationId = params.organizationId
  const guardResult = await requireServiceRole(request, {
    mode: 'tenant',
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId,
    actionName: 'organization.members.permissions_read',
    logContext: { organizationId },
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const userId = request.nextUrl.searchParams.get('userId')?.trim()
  if (!userId) {
    return errorResponse(guardResult.guard.json, 'userId is required')
  }

  try {
    const permissions = await new PermissionService().getUserPermissions(organizationId, userId)
    return guardResult.guard.json({ permissions })
  } catch (error) {
    if (isMemberTenantInvariantError(error)) {
      return errorResponse(guardResult.guard.json, error.message, error.status)
    }
    console.error('[Member permissions] read failed', error)
    return errorResponse(guardResult.guard.json, 'Failed to load permissions', 500)
  }
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const organizationId = params.organizationId
  const guardResult = await requireServiceRole(request, {
    mode: 'tenant',
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId,
    actionName: 'organization.members.permissions_update',
    logContext: { organizationId },
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return errorResponse(guardResult.guard.json, 'Invalid JSON payload')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return errorResponse(guardResult.guard.json, 'Invalid JSON payload')
  }
  const body = payload as Record<string, unknown>
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId || !Object.hasOwn(body, 'permissions')) {
    return errorResponse(guardResult.guard.json, 'userId and permissions are required')
  }

  try {
    const permissions = await new PermissionService().upsertUserPermissions(
      organizationId,
      userId,
      body.permissions,
      guardResult.guard.userId
    )
    return guardResult.guard.json({ permissions })
  } catch (error) {
    if (isMemberTenantInvariantError(error)) {
      return errorResponse(guardResult.guard.json, error.message, error.status)
    }
    console.error('[Member permissions] update failed', error)
    return errorResponse(guardResult.guard.json, 'Failed to update permissions', 500)
  }
}
