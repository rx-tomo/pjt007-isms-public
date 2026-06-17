import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'

export const runtime = 'nodejs'

const service = new EducationService()

/**
 * GET /api/education/[id]/records - Get records for a plan
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Verify parent plan belongs to caller's org
    const plan = await service.getPlanById(params.id)
    if (!plan || plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const records = await service.getRecordsByPlanId(params.id)
    return NextResponse.json({ data: records })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * POST /api/education/[id]/records - Add a record to a plan
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Verify parent plan belongs to caller's org
    const plan = await service.getPlanById(params.id)
    if (!plan || plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()

    if (!body.attendee_id) {
      return NextResponse.json(
        { error: 'attendee_id is required' },
        { status: 400 }
      )
    }

    // Verify attendee belongs to the same organization as the caller
    const db = getDb()
    const attendeeRows = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.id, body.attendee_id),
          eq(userProfiles.organizationId, caller.organizationId)
        )
      )
      .limit(1)

    if (attendeeRows.length === 0) {
      return NextResponse.json(
        { error: 'attendee_id does not belong to your organization' },
        { status: 400 }
      )
    }

    const record = await service.createRecord({
      plan_id: params.id,
      attendee_id: body.attendee_id,
      attended_at: body.attended_at ?? null,
      completed_at: body.completed_at ?? null,
      score: body.score ?? null,
      result: body.result ?? null,
      feedback: body.feedback ?? null,
    })

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
