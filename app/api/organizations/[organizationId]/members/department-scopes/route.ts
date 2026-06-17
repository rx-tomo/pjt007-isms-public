import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { DepartmentScopeService } from '@/lib/services/departmentScope'

type Params = {
  organizationId: string
}

const errorResponse = (respond: (body: unknown, init?: ResponseInit) => NextResponse, message: string, status = 400) =>
  respond({ error: message }, { status })

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const organizationId = params.organizationId
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId,
    actionName: 'organization.members.department_scopes_read',
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
    const scopes = await new DepartmentScopeService().listUserScopes(organizationId, userId)
    return guardResult.guard.json({ scopes })
  } catch (error) {
    console.error('[Member department scopes] read failed', error)
    return errorResponse(guardResult.guard.json, 'Failed to load department scopes', 500)
  }
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const organizationId = params.organizationId
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId,
    actionName: 'organization.members.department_scopes_update',
    logContext: { organizationId },
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  let payload: { userId?: string; departmentIds?: string[] }
  try {
    payload = await request.json()
  } catch {
    return errorResponse(guardResult.guard.json, 'Invalid JSON payload')
  }

  const userId = payload.userId?.trim()
  if (!userId || !Array.isArray(payload.departmentIds)) {
    return errorResponse(guardResult.guard.json, 'userId and departmentIds are required')
  }

  try {
    const scopes = await new DepartmentScopeService().updateUserDepartmentScopes({
      organizationId,
      userId,
      departmentIds: payload.departmentIds,
    })
    return guardResult.guard.json({ scopes })
  } catch (error) {
    console.error('[Member department scopes] update failed', error)
    return errorResponse(guardResult.guard.json, 'Failed to update department scopes', 500)
  }
}
