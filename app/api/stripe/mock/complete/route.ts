import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { addMonths } from 'date-fns'
import { getDb } from '@/lib/db/drizzle/client'
import { pricingPlans, subscriptions, paymentHistory, stripeEvents } from '@/lib/db/drizzle/schema'
import { eq } from 'drizzle-orm'
import { isStripeMockMode, resolveStripePriceIdFromEnv } from '@/lib/stripe/config'
import { DEFAULT_PRICING_PLANS } from '@/lib/stripe/defaultPricingPlans'

interface MockCompletePayload {
  organizationId?: string
  planId?: string
  priceId?: string
  sessionId?: string
  customerId?: string
  subscriptionId?: string
  status?: 'trialing' | 'active'
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Mock endpoint is disabled in production.' }, { status: 403 })
  }

  if (!isStripeMockMode()) {
    return NextResponse.json({ error: 'Enable STRIPE_TEST_MODE=mock to use this endpoint.' }, { status: 403 })
  }

  // Require dev login session — prevents cross-tenant writes in preview environments
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const sessionToken =
    cookieStore.get('better-auth.session_token')?.value ||
    cookieStore.get('__Secure-better-auth.session_token')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const db = getDb()

  let payload: MockCompletePayload
  try {
    payload = ((await request.json()) ?? {}) as MockCompletePayload
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const organizationId = payload.organizationId
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 })
  }

  const planId = payload.planId
  if (!planId) {
    return NextResponse.json({ error: 'planId is required.' }, { status: 400 })
  }

  const planRows = await db
    .select({
      id: pricingPlans.id,
      name: pricingPlans.name,
      priceMonthly: pricingPlans.priceMonthly,
      stripePriceId: pricingPlans.stripePriceId,
      description: pricingPlans.description,
    })
    .from(pricingPlans)
    .where(eq(pricingPlans.id, planId))
    .limit(1)

  let planRow = planRows[0]
  if (!planRow) {
    // GAP-021: 料金ページは pricing_plans が空のとき DEFAULT_PRICING_PLANS を表示するため、
    // DB未登録のデフォルトプランIDはここで実体化して整合させる
    const defaultPlan = DEFAULT_PRICING_PLANS.find((plan) => plan.id === planId)
    if (!defaultPlan) {
      return NextResponse.json({ error: 'Pricing plan not found.' }, { status: 404 })
    }
    await db.insert(pricingPlans).values({
      id: defaultPlan.id,
      name: defaultPlan.name,
      description: defaultPlan.description,
      priceMonthly: defaultPlan.price_monthly,
      features: JSON.stringify(defaultPlan.features),
      maxUsers: defaultPlan.max_users,
      maxStorageGb: defaultPlan.max_storage_gb,
      isActive: defaultPlan.is_active,
      displayOrder: defaultPlan.display_order,
    })
    console.info('[Stripe Mock] default pricing plan materialized', { planId: defaultPlan.id })
    planRow = {
      id: defaultPlan.id,
      name: defaultPlan.name,
      priceMonthly: defaultPlan.price_monthly,
      stripePriceId: null,
      description: defaultPlan.description,
    }
  }

  let stripePriceId = planRow.stripePriceId ?? null
  if (!stripePriceId) {
    const envPrice = resolveStripePriceIdFromEnv(planRow.name)
    if (envPrice?.priceId) {
      try {
        await db.update(pricingPlans)
          .set({ stripePriceId: envPrice.priceId })
          .where(eq(pricingPlans.id, planRow.id))
        stripePriceId = envPrice.priceId
      } catch (err) {
        console.warn('[Stripe Mock] failed to persist price id from env', err)
      }
    }
  }

  if (!stripePriceId && payload.priceId) {
    stripePriceId = payload.priceId
  }

  if (!stripePriceId) {
    return NextResponse.json({ error: 'Stripe price ID is not configured for the plan.' }, { status: 409 })
  }

  const sessionId = payload.sessionId ?? `cs_test_mock_${Date.now()}`
  const customerId = payload.customerId ?? `cus_mock_${randomUUID()}`
  const mockSubscriptionId = payload.subscriptionId ?? `sub_mock_${randomUUID()}`
  const status = payload.status ?? 'active'

  const now = new Date()
  const currentPeriodStart = now.toISOString()
  const currentPeriodEnd = addMonths(now, 1).toISOString()

  // Upsert subscription by stripeSubscriptionId
  const existingSub = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, mockSubscriptionId))
    .limit(1)

  const subPayload = {
    organizationId,
    pricingPlanId: planRow.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: mockSubscriptionId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    trialStart: status === 'trialing' ? currentPeriodStart : null,
    trialEnd: status === 'trialing' ? currentPeriodEnd : null,
  }

  let subscriptionRowId: string
  if (existingSub.length > 0) {
    await db.update(subscriptions)
      .set(subPayload)
      .where(eq(subscriptions.stripeSubscriptionId, mockSubscriptionId))
    subscriptionRowId = existingSub[0].id
  } else {
    subscriptionRowId = randomUUID()
    await db.insert(subscriptions).values({ id: subscriptionRowId, ...subPayload })
  }

  const amount = Math.max(planRow.priceMonthly ?? 0, 0)
  const mockInvoiceId = `in_mock_${randomUUID()}`

  await db.insert(paymentHistory).values({
    id: randomUUID(),
    organizationId,
    subscriptionId: subscriptionRowId,
    stripePaymentIntentId: `pi_mock_${randomUUID()}`,
    stripeInvoiceId: mockInvoiceId,
    amount,
    currency: 'JPY',
    status: 'succeeded',
    description: planRow.description ?? `Mock subscription for ${planRow.name}`,
    paymentMethodType: 'card',
    paidAt: now.toISOString(),
  })

  const eventPayload = {
    id: `evt_mock_${randomUUID()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        mode: 'subscription',
        payment_status: 'paid',
        client_reference_id: organizationId,
        customer: customerId,
        subscription: mockSubscriptionId,
        metadata: {
          organization_id: organizationId,
          pricing_plan_id: planRow.id,
          stripe_price_id: stripePriceId
        }
      }
    }
  }

  // Upsert stripe event
  const existingEvt = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, eventPayload.id))
    .limit(1)

  if (existingEvt.length > 0) {
    await db.update(stripeEvents)
      .set({
        eventType: eventPayload.type,
        eventData: JSON.stringify(eventPayload),
        processed: true,
        processedAt: now.toISOString(),
      })
      .where(eq(stripeEvents.stripeEventId, eventPayload.id))
  } else {
    await db.insert(stripeEvents).values({
      id: randomUUID(),
      stripeEventId: eventPayload.id,
      eventType: eventPayload.type,
      eventData: JSON.stringify(eventPayload),
      processed: true,
      processedAt: now.toISOString(),
    })
  }

  console.info('[Stripe Mock] subscription synchronized', {
    organizationId,
    planId: planRow.id,
    sessionId,
    subscriptionId: mockSubscriptionId
  })

  return NextResponse.json({
    sessionId,
    subscriptionId: mockSubscriptionId,
    customerId,
    planId: planRow.id,
    priceId: stripePriceId
  })
}
