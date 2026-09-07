import { BcpService, parseRecoveryObjectiveUpdateBody } from '@/lib/services/bcp'
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

    const input = parseRecoveryObjectiveUpdateBody(await request.json().catch(() => null))
    if (!input) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const objective = await bcpService.updateRecoveryObjective({
      organizationId: caller.organizationId,
      planId: id,
      childId: objectiveId,
    }, input)
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

    await bcpService.deleteRecoveryObjective({
      organizationId: caller.organizationId,
      planId: id,
      childId: objectiveId,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
