import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs } from '@/lib/db/drizzle/schema'

export const runtime = 'nodejs'

const service = new EducationService()

/**
 * POST /api/education/[id]/my-record - Create or update the caller's own completion record.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const plan = await service.getPlanById(params.id)
    if (!plan || plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const now = new Date().toISOString()
    const payload = {
      attended_at: body.attended_at ?? now,
      completed_at: body.completed_at ?? now,
      score: typeof body.score === 'number' ? body.score : null,
      result: 'passed',
      feedback: typeof body.feedback === 'string' && body.feedback.trim()
        ? body.feedback.trim()
        : null,
    }

    const existingRecord = (plan.records ?? [])
      .find(record => record.attendee_id === caller.userId)

    const record = existingRecord
      ? await service.updateRecord(existingRecord.id, payload)
      : await service.createRecord({
          plan_id: params.id,
          attendee_id: caller.userId,
          ...payload,
        })

    if (!record) {
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
    }

    await getDb().insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: caller.organizationId,
      userId: caller.userId,
      action: 'education.record.update',
      resourceType: 'education_record',
      resourceId: record.id,
      changes: JSON.stringify({
        plan_id: params.id,
        attended_at: payload.attended_at,
        completed_at: payload.completed_at,
        score: payload.score,
        result: payload.result,
      }),
      createdAt: now,
    })

    return NextResponse.json({ data: record }, { status: existingRecord ? 200 : 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
