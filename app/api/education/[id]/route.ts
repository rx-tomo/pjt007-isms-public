import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new EducationService()

/**
 * GET /api/education/[id] - Get education plan by ID with relations
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const plan = await service.getPlanById(params.id)

    if (!plan) {
      return NextResponse.json({ error: 'Education plan not found' }, { status: 404 })
    }

    // Verify org scope
    if (plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: plan })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * PUT /api/education/[id] - Update an education plan
 */
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Verify org scope before update
    const existing = await service.getPlanById(params.id)
    if (!existing || existing.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()

    const plan = await service.updatePlan(params.id, {
      title: body.title,
      description: body.description,
      target_audience: body.target_audience,
      start_date: body.start_date,
      end_date: body.end_date,
      status: body.status,
    })

    if (!plan) {
      return NextResponse.json({ error: 'Education plan not found' }, { status: 404 })
    }

    return NextResponse.json({ data: plan })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * DELETE /api/education/[id] - Delete an education plan
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Verify org scope before delete
    const existing = await service.getPlanById(params.id)
    if (!existing || existing.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await service.deletePlan(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
