import Stripe from 'stripe'
import { resolveStripePriceIdFromEnv } from '@/lib/stripe/config'
import { getDb } from '@/lib/db/drizzle/client'
import { subscriptions, pricingPlans, type Subscription } from '@/lib/db/drizzle/schema'
import { eq } from 'drizzle-orm'

export const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-05-28.basil'

type SubscriptionStatus = Subscription['status']

type SyncSubscriptionParams = {
  stripe: Stripe
  subscription?: Stripe.Subscription
  subscriptionId?: string
  organizationId?: string
  pricingPlanId?: string
}

export async function syncSubscriptionFromStripe({
  stripe,
  subscription,
  subscriptionId,
  organizationId,
  pricingPlanId
}: SyncSubscriptionParams): Promise<Subscription | null> {
  const db = getDb()
  const stripeSubscription = subscriptionId
    ? await stripe.subscriptions.retrieve(subscriptionId, { apiVersion: STRIPE_API_VERSION })
    : subscription

  if (!stripeSubscription) {
    console.warn('[Stripe] subscription not retrievable', { subscriptionId })
    return null
  }

  const organization = organizationId ?? (stripeSubscription.metadata?.organization_id as string | undefined)

  if (!organization) {
    console.warn('[Stripe] subscription lacks organization metadata', stripeSubscription.id)
    return null
  }

  const planId = await resolvePricingPlanId({
    pricingPlanId,
    priceId: stripeSubscription.items.data[0]?.price?.id ?? undefined
  })

  if (!planId) {
    console.warn('[Stripe] unable to resolve pricing plan id', stripeSubscription.id)
    return null
  }

  const normalizedStatus = normalizeSubscriptionStatus(stripeSubscription.status)
  const periodBounds = deriveSubscriptionPeriod(stripeSubscription)

  const payload = {
    organizationId: organization,
    pricingPlanId: planId,
    stripeCustomerId: typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id ?? null,
    stripeSubscriptionId: stripeSubscription.id,
    status: normalizedStatus,
    currentPeriodStart: periodBounds.start,
    currentPeriodEnd: periodBounds.end,
    trialStart: toIsoDate(stripeSubscription.trial_start),
    trialEnd: toIsoDate(stripeSubscription.trial_end),
    cancelAt: toIsoDate(stripeSubscription.cancel_at),
    canceledAt: toIsoDate(stripeSubscription.canceled_at)
  }

  // Upsert: try update first, if no rows affected then insert
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
    .limit(1)

  if (existing.length > 0) {
    await db.update(subscriptions)
      .set(payload)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
  } else {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      ...payload,
    })
  }

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
    .limit(1)

  return rows[0] ?? null
}

type ResolvePricingPlanParams = {
  pricingPlanId?: string
  priceId?: string
}

async function resolvePricingPlanId({ pricingPlanId, priceId }: ResolvePricingPlanParams) {
  if (pricingPlanId) return pricingPlanId
  if (!priceId) return null

  const db = getDb()

  const byPriceId = await db
    .select({ id: pricingPlans.id })
    .from(pricingPlans)
    .where(eq(pricingPlans.stripePriceId, priceId))
    .limit(1)

  if (byPriceId[0]?.id) {
    return byPriceId[0].id
  }

  const activePlans = await db
    .select({ id: pricingPlans.id, name: pricingPlans.name })
    .from(pricingPlans)
    .where(eq(pricingPlans.isActive, true))

  for (const plan of activePlans) {
    const envPrice = resolveStripePriceIdFromEnv(plan.name)
    if (!envPrice) continue
    if (envPrice.priceId !== priceId) continue

    try {
      await db.update(pricingPlans)
        .set({ stripePriceId: priceId })
        .where(eq(pricingPlans.id, plan.id))
    } catch (err) {
      console.warn('[Stripe] failed to persist stripe_price_id during webhook resolution', {
        planId: plan.id,
        message: err instanceof Error ? err.message : String(err)
      })
    }

    return plan.id
  }

  return null
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    'trialing',
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid'
  ]

  if (allowed.includes(status as SubscriptionStatus)) {
    return status as SubscriptionStatus
  }

  if (status === 'paused') {
    return 'past_due'
  }

  console.warn('[Stripe] received unsupported subscription status, defaulting to active', status)
  return 'active'
}

function deriveSubscriptionPeriod(subscription: Stripe.Subscription) {
  const anchor = subscription.billing_cycle_anchor
  const recurring = subscription.items?.data?.[0]?.price?.recurring

  if (!anchor || !recurring) {
    return { start: null, end: null }
  }

  const intervalCount = recurring.interval_count ?? 1
  const startDate = new Date(anchor * 1000)
  const endDate = addIntervalUtc(new Date(anchor * 1000), recurring.interval, intervalCount)

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  }
}

function addIntervalUtc(
  date: Date,
  interval: Stripe.Price.Recurring.Interval,
  count: number
) {
  const result = new Date(date.getTime())

  switch (interval) {
    case 'day':
      result.setUTCDate(result.getUTCDate() + count)
      break
    case 'week':
      result.setUTCDate(result.getUTCDate() + count * 7)
      break
    case 'month':
      result.setUTCMonth(result.getUTCMonth() + count)
      break
    case 'year':
      result.setUTCFullYear(result.getUTCFullYear() + count)
      break
  }

  return result
}

function toIsoDate(timestamp?: number | null) {
  if (!timestamp) return null
  return new Date(timestamp * 1000).toISOString()
}

export { normalizeSubscriptionStatus, deriveSubscriptionPeriod, addIntervalUtc, toIsoDate }
