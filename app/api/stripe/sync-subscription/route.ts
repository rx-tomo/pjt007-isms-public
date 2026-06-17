import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { hasStripeSecret } from '@/lib/stripe/config'
import { STRIPE_API_VERSION, syncSubscriptionFromStripe } from '@/lib/stripe/subscriptionSync'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { subscriptions, pricingPlans } from '@/lib/db/drizzle/schema/billing'
import { eq, desc } from 'drizzle-orm'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

interface SyncSubscriptionBody {
  organizationId?: string
}

export async function POST(request: NextRequest) {
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined
  let body: SyncSubscriptionBody = {}
  try {
    body = (await request.json()) as SyncSubscriptionBody
  } catch {
    // ignore invalid body and fall through to validation error below
  }

  const organizationId = body.organizationId?.trim()

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId: organizationId || undefined,
    actionName: 'stripe.sync_subscription',
    logContext: organizationId ? { organizationId } : undefined
  })

  if (error) {
    return error
  }

  guardResult = guard
  if (!guard) {
    return new Response('Service role guard unavailable', { status: 500 })
  }
  const { json, logEvent } = guard
  jsonResponse = json

  if (!organizationId) {
    return json({ error: 'organizationId is required' }, { status: 400 })
  }

  const normalizedOrgId = organizationId.trim()
  if (!normalizedOrgId) {
    return json({ error: 'organizationId is required' }, { status: 400 })
  }

  if (!hasStripeSecret()) {
    return json({
      message: 'Stripe secret key is not configured. Skipping subscription sync.'
    })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    return json({ error: 'Stripe secret key is missing.' }, { status: 500 })
  }

  const db = getDb()

  const subRows = await db
    .select({
      id: subscriptions.id,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      organizationId: subscriptions.organizationId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, normalizedOrgId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  const subscriptionRow = subRows[0]

  if (!subscriptionRow?.stripeSubscriptionId) {
    return json({
      error: 'No Stripe subscription found for organization.'
    }, { status: 404 })
  }

  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })

  try {
    const synced = await syncSubscriptionFromStripe({
      stripe,
      subscriptionId: subscriptionRow.stripeSubscriptionId,
      organizationId: normalizedOrgId
    })

    if (!synced) {
      return json({
        error: 'Subscription sync did not return data.'
      }, { status: 404 })
    }

    // Hydrate with pricing plan data
    const hydratedRows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, synced.id))
      .limit(1)

    const hydratedSub = hydratedRows[0]
    let hydrated: Record<string, unknown> | null = null

    if (hydratedSub?.pricingPlanId) {
      const planRows = await db
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.id, hydratedSub.pricingPlanId))
        .limit(1)

      hydrated = { ...hydratedSub, pricing_plan: planRows[0] ?? null }
    } else if (hydratedSub) {
      hydrated = { ...hydratedSub, pricing_plan: null }
    }

    await logEvent('success',
      {
        organizationId: normalizedOrgId,
        subscriptionId: synced.id
      },
      { format: 'stripe.subscription_sync' }
    )

    return json({ data: hydrated ?? synced })
  } catch (error) {
    console.error('[Stripe] manual subscription sync failed', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder = jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder({ error: 'Failed to sync subscription' }, { status: 500 })
  }
}
