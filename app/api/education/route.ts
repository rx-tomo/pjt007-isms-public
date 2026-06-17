import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new EducationService()

/**
 * GET /api/education - List education plans for the caller's organization
 */
export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const status = request.nextUrl.searchParams.get('status') ?? undefined
    const search = request.nextUrl.searchParams.get('search') ?? undefined

    const plans = await service.getPlans(caller.organizationId, { status, search })
    return NextResponse.json({ data: plans })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * POST /api/education - Create a new education plan
 */
export async function POST(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const body = await request.json()

    if (!body.title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      )
    }

    // Force organization_id to caller's org
    const plan = await service.createPlan({
      organization_id: caller.organizationId,
      title: body.title,
      description: body.description ?? null,
      target_audience: body.target_audience ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      status: body.status ?? null,
    })

    return NextResponse.json({ data: plan }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
