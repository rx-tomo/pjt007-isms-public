import { BcpService } from '@/lib/services/bcp'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const bcpService = new BcpService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const plans = await bcpService.listPlans(caller.organizationId)
    return NextResponse.json({ data: plans })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const body = await request.json()

    // Force organization_id to caller's org (ignore client-provided value)
    const plan = await bcpService.createPlan({
      ...body,
      organization_id: caller.organizationId,
      created_by: caller.userId,
    })
    return NextResponse.json({ data: plan }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
