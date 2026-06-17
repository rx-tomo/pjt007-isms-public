import { BcpService } from '@/lib/services/bcp'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const bcpService = new BcpService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const planId = request.nextUrl.searchParams.get('planId')

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    // Verify plan belongs to caller's org before export
    const plan = await bcpService.getPlanById(planId)
    if (plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const data = await bcpService.exportPlan(planId)
    return NextResponse.json({ data })
  } catch (error) {
    return handleRouteError(error)
  }
}
