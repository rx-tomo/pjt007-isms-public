import { NextRequest, NextResponse } from 'next/server'
import { ManagementReviewService } from '@/lib/services/managementReview'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import { getDb } from '@/lib/db/drizzle/client'
import type { ReviewActionStatus } from '@/lib/db/drizzle/schema'
import { auditLogs, reviewActionStatusValues } from '@/lib/db/drizzle/schema'

const service = new ManagementReviewService()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Verify parent review belongs to caller's org
    const review = await service.getById(params.id)
    if (!review || review.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const actions = await service.listActions(params.id)
    return NextResponse.json({ data: actions })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Verify parent review belongs to caller's org
    const review = await service.getById(params.id)
    if (!review || review.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { title, description, assignee_id, due_date, status, review_item_id } = body as {
      title?: string
      description?: string
      assignee_id?: string
      due_date?: string
      status?: string
      review_item_id?: string
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    if (status && !reviewActionStatusValues.includes(status as ReviewActionStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const action = await service.createAction({
      review_id: params.id,
      review_item_id: review_item_id ?? null,
      title: title.trim(),
      description: description ?? null,
      assignee_id: assignee_id ?? null,
      due_date: due_date ?? null,
      status: (status as ReviewActionStatus) ?? undefined,
    })

    await getDb().insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: caller.organizationId,
      userId: caller.userId,
      action: 'management_review.action_created',
      resourceType: 'management_review_action',
      resourceId: action.id,
      changes: JSON.stringify({
        review_id: params.id,
        title: action.title,
        status: action.status,
        due_date: action.due_date,
      }),
      scope: 'tenant',
    })

    return NextResponse.json({ data: action }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
