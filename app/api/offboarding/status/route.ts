import { NextRequest } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getOffboardingStatus } from '@/lib/offboarding/commercialOffboarding'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()

  if (!organizationId) {
    return Response.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'offboarding.status.view',
    logContext: { organizationId },
  })
  if (!guard) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await getOffboardingStatus(organizationId, guard.userId)
  return guard.json({ data: status })
}
