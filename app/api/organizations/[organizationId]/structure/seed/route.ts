import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { OrganizationService } from '@/lib/services/organization'

type Params = { organizationId: string }

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId: params.organizationId,
    actionName: 'organization.structure.seed',
    logContext: { organizationId: params.organizationId },
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const roles = body.roles
  if (!Array.isArray(roles)) {
    return guard.json({ error: 'roles must be an array' }, { status: 400 })
  }

  try {
    const service = new OrganizationService()
    const result = await service.bulkUpsertProjectRoles(params.organizationId, roles as any)
    return guard.json(result)
  } catch (err) {
    console.error('[Structure seed] failed', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return guard.json({ error: message }, { status: 500 })
  }
}
