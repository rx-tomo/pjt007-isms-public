import { BcpService } from '@/lib/services/bcp'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const bcpService = new BcpService()

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; objectiveId: string }> }
) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id, objectiveId } = params

    // Verify parent plan belongs to caller's org
    const plan = await bcpService.getPlanById(id)
    if (plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const objective = await bcpService.updateRecoveryObjective(objectiveId, body)
    return NextResponse.json({ data: objective })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; objectiveId: string }> }
) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id, objectiveId } = params

    // Verify parent plan belongs to caller's org
    const plan = await bcpService.getPlanById(id)
    if (plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await bcpService.deleteRecoveryObjective(objectiveId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
