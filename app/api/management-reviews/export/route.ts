import { NextRequest, NextResponse } from 'next/server'
import { ManagementReviewService } from '@/lib/services/managementReview'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { safeParseArray } from '@/lib/utils/safe-json'

const service = new ManagementReviewService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const url = new URL(request.url)
  const reviewId = url.searchParams.get('id')

  if (!reviewId) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
  }

  const review = await service.exportReview(reviewId)

  if (!review) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify org scope
  if (review.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Return JSON export (can be extended to CSV/Excel later)
  const exportData = {
    review: {
      title: review.title,
      review_date: review.review_date,
      status: review.status,
      location: review.location,
      agenda: safeParseArray(review.agenda),
      participants: safeParseArray(review.participants),
      minutes: review.minutes,
      conclusions: review.conclusions,
    },
    items: review.items.map((item) => ({
      item_type: item.item_type,
      title: item.title,
      description: item.description,
      related_area: item.related_area,
    })),
    actions: review.actions.map((action) => ({
      title: action.title,
      description: action.description,
      assignee_id: action.assignee_id,
      due_date: action.due_date,
      status: action.status,
      completed_at: action.completed_at,
    })),
    exported_at: new Date().toISOString(),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="management-review-${reviewId}.json"`,
    },
  })
}
