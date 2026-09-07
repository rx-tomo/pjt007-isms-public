import { BcpService, parseDrillUpdateBody } from '@/lib/services/bcp'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const bcpService = new BcpService()

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; drillId: string }> }
) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id, drillId } = params

    const input = parseDrillUpdateBody(await request.json().catch(() => null))
    if (!input) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const drill = await bcpService.updateDrill({
      organizationId: caller.organizationId,
      planId: id,
      childId: drillId,
    }, input)
    return NextResponse.json({ data: drill })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; drillId: string }> }
) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id, drillId } = params

    await bcpService.deleteDrill({
      organizationId: caller.organizationId,
      planId: id,
      childId: drillId,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
