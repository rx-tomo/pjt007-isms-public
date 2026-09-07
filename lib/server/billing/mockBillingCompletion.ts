import { randomUUID } from 'node:crypto'
import { addMonths } from 'date-fns'
import { and, eq } from 'drizzle-orm'
import type { DrizzleDb } from '@/lib/db/drizzle/client'
import {
  paymentHistory,
  pricingPlans,
  stripeEvents,
  subscriptions,
} from '@/lib/db/drizzle/schema'
import { DEFAULT_PRICING_PLANS } from '@/lib/stripe/defaultPricingPlans'
import { resolveStripePriceIdFromEnv } from '@/lib/stripe/config'

export interface MockBillingCompletionInput {
  organizationId: string
  planId: string
  priceId?: string
  sessionId?: string
  customerId?: string
  subscriptionId?: string
  status?: 'trialing' | 'active'
}

export interface MockBillingCompletionResult {
  sessionId: string
  subscriptionId: string
  customerId: string
  planId: string
  priceId: string
}

export class MockBillingCompletionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'MockBillingCompletionError'
  }
}

export async function completeMockBilling(
  db: DrizzleDb,
  input: MockBillingCompletionInput
): Promise<MockBillingCompletionResult> {
  return db.transaction(async (tx) => {
    const planRows = await tx
      .select({
        id: pricingPlans.id,
        name: pricingPlans.name,
        priceMonthly: pricingPlans.priceMonthly,
        stripePriceId: pricingPlans.stripePriceId,
        description: pricingPlans.description,
      })
      .from(pricingPlans)
      .where(eq(pricingPlans.id, input.planId))
      .limit(1)

    let planRow = planRows[0]
    if (!planRow) {
      const defaultPlan = DEFAULT_PRICING_PLANS.find((plan) => plan.id === input.planId)
      if (!defaultPlan) {
        throw new MockBillingCompletionError('Pricing plan not found.', 404)
      }

      await tx.insert(pricingPlans).values({
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
        await tx
          .update(pricingPlans)
          .set({ stripePriceId: envPrice.priceId })
          .where(eq(pricingPlans.id, planRow.id))
        stripePriceId = envPrice.priceId
      }
    }

    if (!stripePriceId && input.priceId) {
      stripePriceId = input.priceId
    }
    if (!stripePriceId) {
      throw new MockBillingCompletionError(
        'Stripe price ID is not configured for the plan.',
        409
      )
    }

    const sessionId = input.sessionId ?? `cs_test_mock_${Date.now()}`
    const customerId = input.customerId ?? `cus_mock_${randomUUID()}`
    const mockSubscriptionId = input.subscriptionId ?? `sub_mock_${randomUUID()}`
    const status = input.status ?? 'active'
    const now = new Date()
    const currentPeriodStart = now.toISOString()
    const currentPeriodEnd = addMonths(now, 1).toISOString()

    const existingSub = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.stripeSubscriptionId, mockSubscriptionId),
        eq(subscriptions.organizationId, input.organizationId)
      ))
      .limit(1)

    if (input.subscriptionId && existingSub.length === 0) {
      const claimedSubscription = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, mockSubscriptionId))
        .limit(1)
      if (claimedSubscription.length > 0) {
        throw new MockBillingCompletionError('Subscription not found.', 404)
      }
    }

    const subPayload = {
      organizationId: input.organizationId,
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
      await tx
        .update(subscriptions)
        .set(subPayload)
        .where(and(
          eq(subscriptions.stripeSubscriptionId, mockSubscriptionId),
          eq(subscriptions.organizationId, input.organizationId)
        ))
      subscriptionRowId = existingSub[0].id
    } else {
      subscriptionRowId = randomUUID()
      await tx.insert(subscriptions).values({ id: subscriptionRowId, ...subPayload })
    }

    const mockInvoiceId = `in_mock_${randomUUID()}`
    await tx.insert(paymentHistory).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      subscriptionId: subscriptionRowId,
      stripePaymentIntentId: `pi_mock_${randomUUID()}`,
      stripeInvoiceId: mockInvoiceId,
      amount: Math.max(planRow.priceMonthly ?? 0, 0),
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
          client_reference_id: input.organizationId,
          customer: customerId,
          subscription: mockSubscriptionId,
          metadata: {
            organization_id: input.organizationId,
            pricing_plan_id: planRow.id,
            stripe_price_id: stripePriceId,
          },
        },
      },
    }

    await tx.insert(stripeEvents).values({
      id: randomUUID(),
      stripeEventId: eventPayload.id,
      eventType: eventPayload.type,
      eventData: JSON.stringify(eventPayload),
      processed: true,
      processedAt: now.toISOString(),
    })

    return {
      sessionId,
      subscriptionId: mockSubscriptionId,
      customerId,
      planId: planRow.id,
      priceId: stripePriceId,
    }
  })
}
