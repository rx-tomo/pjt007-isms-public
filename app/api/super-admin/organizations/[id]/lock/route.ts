import { NextRequest } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { SuperAdminService } from '@/lib/services/superAdmin'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.organizations.toggle_lock',
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard

  const body = await request.json().catch(() => ({}))
  const action = (body as Record<string, unknown>).action as string | undefined
  const reason = ((body as Record<string, unknown>).reason as string | undefined)?.trim() || undefined

  if (action && action !== 'lock' && action !== 'unlock') {
    return guard.json({ error: 'action must be "lock" or "unlock"' }, { status: 400 })
  }

  try {
    const service = new SuperAdminService()

    if (action) {
      // New idempotent path
      const result = await service.setTenantLockState(id, action === 'lock', reason)
      return guard.json(result)
    } else {
      // Legacy toggle path (backward compat)
      const result = await service.toggleTenantLock(id, reason)
      return guard.json(result)
    }
  } catch (err: unknown) {
    console.error('[SuperAdmin/Organizations/Lock] PATCH failed', err)
    const isExpected = err instanceof Error && (err.message?.includes('not found') || err.message?.includes('is deleted'))
    const status = isExpected ? (err.message?.includes('not found') ? 404 : 409) : 500
    const message = isExpected ? err.message : 'Failed to update lock state'
    return guard.json({ error: message }, { status })
  }
}
