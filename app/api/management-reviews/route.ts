import { NextRequest, NextResponse } from 'next/server'
import { ManagementReviewService } from '@/lib/services/managementReview'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import type { ManagementReviewStatus } from '@/lib/db/drizzle/schema'
import { managementReviewStatusValues } from '@/lib/db/drizzle/schema'

const service = new ManagementReviewService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const reviews = await service.list(caller.organizationId)
    return NextResponse.json({ data: reviews })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

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

  if (!title?.trim() || !review_date) {
    return NextResponse.json({ error: 'title and review_date are required' }, { status: 400 })
  }

  if (status && !managementReviewStatusValues.includes(status as ManagementReviewStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const review = await service.create({
      organization_id: caller.organizationId,
      title: title.trim(),
      review_date,
      status: (status as ManagementReviewStatus) ?? undefined,
      agenda: agenda ?? null,
      participants: participants ?? null,
      location: location ?? null,
      minutes: minutes ?? null,
      conclusions: conclusions ?? null,
      created_by: caller.userId,
    })

    return NextResponse.json({ data: review }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
