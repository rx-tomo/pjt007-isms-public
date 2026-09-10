import { BcpService, parseScenarioUpdateBody } from '@/lib/services/bcp'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const bcpService = new BcpService()

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; scenarioId: string }> }
) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id, scenarioId } = params

    const input = parseScenarioUpdateBody(await request.json().catch(() => null))
    if (!input) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const scenario = await bcpService.updateScenario({
      organizationId: caller.organizationId,
      planId: id,
      childId: scenarioId,
    }, input)
    return NextResponse.json({ data: scenario })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; scenarioId: string }> }
) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id, scenarioId } = params

    await bcpService.deleteScenario({
      organizationId: caller.organizationId,
      planId: id,
      childId: scenarioId,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
