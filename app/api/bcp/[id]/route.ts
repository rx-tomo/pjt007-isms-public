import { BcpService, parsePlanUpdateBody } from '@/lib/services/bcp'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const bcpService = new BcpService()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params
    const plan = await bcpService.getPlanById(id)

    if (plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: plan })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params

    const input = parsePlanUpdateBody(await request.json().catch(() => null))
    if (!input) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const plan = await bcpService.updatePlan(caller.organizationId, id, input)
    return NextResponse.json({ data: plan })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params

    await bcpService.deletePlan(caller.organizationId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
