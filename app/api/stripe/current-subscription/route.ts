import { NextRequest, NextResponse } from 'next/server'
import { StripeService } from '@/lib/services/stripe'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import { SubscriptionProjectionConflictError } from '@/lib/services/subscriptionProjection'

export const runtime = 'nodejs'

const service = new StripeService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }
  if (organizationId !== caller.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const data = await service.getCurrentSubscription(organizationId)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof SubscriptionProjectionConflictError) {
      return NextResponse.json(
        {
          error: 'Subscription state is inconsistent',
          conflicts: error.conflicts,
        },
        { status: 409 }
      )
    }
    return handleRouteError(error)
  }
}
