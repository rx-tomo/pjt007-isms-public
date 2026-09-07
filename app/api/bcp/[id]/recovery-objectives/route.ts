import {
  BcpService,
  parseRecoveryObjectiveCreateBody,
} from '@/lib/services/bcp'
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

    // Verify plan belongs to caller's org
    const plan = await bcpService.getPlanById(id)
    if (plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const objectives = await bcpService.listRecoveryObjectives(id)
    return NextResponse.json({ data: objectives })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params
    const input = parseRecoveryObjectiveCreateBody(await request.json().catch(() => null))
    if (!input) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const objective = await bcpService.createRecoveryObjective({
      organizationId: caller.organizationId,
      planId: id,
    }, input)
    return NextResponse.json({ data: objective }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
