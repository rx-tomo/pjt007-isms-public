import { NextRequest, NextResponse } from 'next/server'
import { ManagementReviewService } from '@/lib/services/managementReview'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import { getDb } from '@/lib/db/drizzle/client'
import type { ManagementReviewStatus } from '@/lib/db/drizzle/schema'
import { auditLogs, managementReviewStatusValues } from '@/lib/db/drizzle/schema'

const service = new ManagementReviewService()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const review = await service.getById(params.id)

  if (!review) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify org scope
  if (review.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ data: review })
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  // Verify org scope before update
  const existing = await service.getById(params.id)
  if (!existing || existing.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, review_date, status, agenda, participants, location, minutes, conclusions } = body as {
    title?: string
    review_date?: string
    status?: string
    agenda?: string
    participants?: string
    location?: string
    minutes?: string
    conclusions?: string
  }

  if (status && !managementReviewStatusValues.includes(status as ManagementReviewStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const review = await service.update(params.id, {
      title,
      review_date,
      status: status as ManagementReviewStatus | undefined,
      agenda,
      participants,
      location,
      minutes,
      conclusions,
    })

    await getDb().insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: caller.organizationId,
      userId: caller.userId,
      action: 'management_review.updated',
      resourceType: 'management_review',
      resourceId: review.id,
      changes: JSON.stringify({
        before: {
          title: existing.title,
          status: existing.status,
          review_date: existing.review_date,
          minutes: existing.minutes,
          conclusions: existing.conclusions,
        },
        after: {
          title: review.title,
          status: review.status,
          review_date: review.review_date,
          minutes: review.minutes,
          conclusions: review.conclusions,
        },
      }),
      scope: 'tenant',
    })

    return NextResponse.json({ data: review })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  // Verify org scope before delete
  const existing = await service.getById(params.id)
  if (!existing || existing.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await service.delete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
