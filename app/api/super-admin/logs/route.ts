import { NextRequest } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { SuperAdminService } from '@/lib/services/superAdmin'

export async function GET(request: NextRequest) {
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.logs.list',
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard

  try {
    const { searchParams } = new URL(request.url)
    const rawLimit = Number(searchParams.get('limit') ?? '50')
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50, 200))
    const before = searchParams.get('before') ?? undefined

    if (before && isNaN(Date.parse(before))) {
      return guard.json({ error: 'Invalid before parameter' }, { status: 400 })
    }

    const ALLOWED_SCOPES = ['global', 'tenant'] as const
    const rawScope = searchParams.get('scope')
    if (rawScope && !ALLOWED_SCOPES.includes(rawScope as any)) {
      return guard.json({ error: 'Invalid scope parameter' }, { status: 400 })
    }
    const scope = rawScope as 'global' | 'tenant' | undefined ?? undefined

    const service = new SuperAdminService()
    const logs = await service.listGlobalAuditLogs({
      limit,
      before: before ?? null,
      scope: scope ?? null,
    })

    return guard.json({ logs })
  } catch (err) {
    console.error('[SuperAdmin/Logs] GET failed', err)
    return guard.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
