import { getDb } from '@/lib/db/drizzle/client'
import {
  pricingPlans,
  subscriptions,
  paymentHistory,
  billingInfo,
  usageTracking,
  stripeEvents,
  userProfiles,
  documents,
} from '@/lib/db/drizzle/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { isStripeMockMode } from '@/lib/stripe/config'
import { loadStripe } from '@stripe/stripe-js'
import { getAuthProvider } from '@/lib/container'

export interface PricingPlan {
  id: string
  name: string
  description?: string
  price_monthly: number
  stripe_price_id?: string
  features: {
    features: string[]
  }
  max_users?: number
  max_storage_gb?: number
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  organization_id: string
  pricing_plan_id: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  status: 'trialing' | 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid'
  current_period_start?: string
  current_period_end?: string
  trial_start?: string
  trial_end?: string
  cancel_at?: string
  canceled_at?: string
  created_at: string
  updated_at: string
  pricing_plan?: PricingPlan
}

export interface PaymentHistory {
  id: string
  organization_id: string
  subscription_id?: string
  stripe_payment_intent_id?: string
  stripe_invoice_id?: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  description?: string
  payment_method_type?: string
  paid_at?: string
  created_at: string
}

export interface BillingInfo {
  id: string
  organization_id: string
  company_name?: string
  company_name_kana?: string
  postal_code?: string
  prefecture?: string
  city?: string
  address_line1?: string
  address_line2?: string
  phone?: string
  tax_id?: string
  billing_email?: string
  billing_contact_name?: string
  created_at: string
  updated_at: string
}

export interface UsageTracking {
  id: string
  organization_id: string
  metric_type: 'users' | 'storage' | 'api_calls' | 'documents' | 'document_versions_extra'
  current_value: number
  limit_value?: number
  measured_at: string
  created_at: string
}

// Client-side Stripe instance
let stripePromise: Promise<any> | null = null

export const getStripe = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key || !/^pk_(test|live)_/i.test(key)) {
    return null
  }

  if (!stripePromise) {
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

function toPricingPlan(row: typeof pricingPlans.$inferSelect): PricingPlan {
  let features: { features: string[] } = { features: [] }
  if (row.features) {
    try {
      features = typeof row.features === 'string' ? JSON.parse(row.features) : row.features
    } catch { /* ignore */ }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    price_monthly: row.priceMonthly,
    stripe_price_id: row.stripePriceId ?? undefined,
    features,
    max_users: row.maxUsers ?? undefined,
    max_storage_gb: row.maxStorageGb ?? undefined,
    is_active: row.isActive ?? true,
    display_order: row.displayOrder ?? 0,
    created_at: row.createdAt ?? '',
    updated_at: row.updatedAt ?? '',
  }
}

function toSubscription(
  row: typeof subscriptions.$inferSelect,
  plan?: typeof pricingPlans.$inferSelect | null
): Subscription {
  return {
    id: row.id,
    organization_id: row.organizationId ?? '',
    pricing_plan_id: row.pricingPlanId ?? '',
    stripe_customer_id: row.stripeCustomerId ?? undefined,
    stripe_subscription_id: row.stripeSubscriptionId ?? undefined,
    status: (row.status ?? 'active') as Subscription['status'],
    current_period_start: row.currentPeriodStart ?? undefined,
    current_period_end: row.currentPeriodEnd ?? undefined,
    trial_start: row.trialStart ?? undefined,
    trial_end: row.trialEnd ?? undefined,
    cancel_at: row.cancelAt ?? undefined,
    canceled_at: row.canceledAt ?? undefined,
    created_at: row.createdAt ?? '',
    updated_at: row.updatedAt ?? '',
    pricing_plan: plan ? toPricingPlan(plan) : undefined,
  }
}

export class StripeService {
  private stripe: Stripe | null = null

  constructor() {
    // Server-side only
    if (typeof window === 'undefined' && process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-05-28.basil',
      })
    }
  }

  private isStripeConfigured(): boolean {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    return Boolean(publishableKey && publishableKey.trim() && !publishableKey.includes('...'))
  }

  private async getMockSubscription(organizationId: string): Promise<Subscription> {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const db = getDb()
    const [plan] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(pricingPlans.displayOrder)
      .limit(1)

    const fallbackPlan: PricingPlan = plan
      ? toPricingPlan(plan)
      : {
          id: 'mock-plan',
          name: 'Trial',
          description: 'Mock plan while Stripe is disabled',
          price_monthly: 0,
          features: { features: ['Mock subscription (Stripe disabled)'] },
          is_active: true,
          display_order: 0,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        }

    return {
      id: `mock-subscription-${organizationId}`,
      organization_id: organizationId,
      pricing_plan_id: fallbackPlan.id,
      stripe_customer_id: undefined,
      stripe_subscription_id: undefined,
      status: 'trialing',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_start: now.toISOString(),
      trial_end: periodEnd.toISOString(),
      cancel_at: undefined,
      canceled_at: undefined,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      pricing_plan: fallbackPlan
    }
  }

  private async getCurrentUserProfile(): Promise<{ id: string; organization_id: string | null } | null> {
    const authProvider = await getAuthProvider()
    const authUser = await authProvider.getUser()
    if (!authUser) return null

    const db = getDb()
    const [profile] = await db
      .select({ id: userProfiles.id, organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, authUser.id))
      .limit(1)

    if (!profile) return null
    return { id: profile.id, organization_id: profile.organizationId }
  }

  // Pricing plan management
  async getPricingPlans(): Promise<PricingPlan[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(pricingPlans.displayOrder)

    return rows.map(toPricingPlan)
  }

  async getPricingPlanById(planId: string): Promise<PricingPlan | null> {
    const db = getDb()
    const [row] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, planId))
      .limit(1)

    return row ? toPricingPlan(row) : null
  }

  // Subscription management
  async getCurrentSubscription(organizationId: string): Promise<Subscription | null> {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({ organizationId })
      const response = await fetch(`/api/stripe/current-subscription?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status === 404) return null
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? `API error ${response.status}`)
      }

      const payload = await response.json()
      return payload.data ?? null
    }

    const db = getDb()

    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    if (rows.length > 0) {
      const sub = rows[0]
      // Load pricing plan
      let plan: typeof pricingPlans.$inferSelect | null = null
      if (sub.pricingPlanId) {
        const [p] = await db
          .select()
          .from(pricingPlans)
          .where(eq(pricingPlans.id, sub.pricingPlanId))
          .limit(1)
        plan = p ?? null
      }
      return toSubscription(sub, plan)
    }

    // Mock mode fallback
    if (isStripeMockMode()) {
      return this.getMockSubscription(organizationId)
    }

    if (!this.isStripeConfigured()) {
      return this.getMockSubscription(organizationId)
    }

    return null
  }

  async syncSubscriptionFromStripe(organizationId: string): Promise<Subscription | null> {
    if (!this.isStripeConfigured()) {
      return this.getCurrentSubscription(organizationId)
    }

    const response = await fetch('/api/stripe/sync-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ organizationId })
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to sync subscription from Stripe')
    }

    const body = (await response.json()) as { data?: Subscription | null }
    return body.data ?? null
  }

  async createSubscription(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription> {
    const db = getDb()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    await db.insert(subscriptions).values({
      id,
      organizationId: subscription.organization_id,
      pricingPlanId: subscription.pricing_plan_id,
      stripeCustomerId: subscription.stripe_customer_id ?? null,
      stripeSubscriptionId: subscription.stripe_subscription_id ?? null,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      trialStart: subscription.trial_start ?? null,
      trialEnd: subscription.trial_end ?? null,
      cancelAt: subscription.cancel_at ?? null,
      canceledAt: subscription.canceled_at ?? null,
      createdAt: now,
      updatedAt: now,
    })

    const [inserted] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1)
    if (!inserted) throw new Error('Failed to create subscription')
    return toSubscription(inserted)
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> {
    const db = getDb()
    const now = new Date().toISOString()

    const setValues: Record<string, unknown> = { updatedAt: now }
    if (updates.status !== undefined) setValues.status = updates.status
    if (updates.stripe_customer_id !== undefined) setValues.stripeCustomerId = updates.stripe_customer_id
    if (updates.stripe_subscription_id !== undefined) setValues.stripeSubscriptionId = updates.stripe_subscription_id
    if (updates.current_period_start !== undefined) setValues.currentPeriodStart = updates.current_period_start
    if (updates.current_period_end !== undefined) setValues.currentPeriodEnd = updates.current_period_end
    if (updates.trial_start !== undefined) setValues.trialStart = updates.trial_start
    if (updates.trial_end !== undefined) setValues.trialEnd = updates.trial_end
    if (updates.cancel_at !== undefined) setValues.cancelAt = updates.cancel_at
    if (updates.canceled_at !== undefined) setValues.canceledAt = updates.canceled_at

    await db.update(subscriptions).set(setValues).where(eq(subscriptions.id, subscriptionId))

    const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1)
    if (!updated) throw new Error('Failed to update subscription')
    return toSubscription(updated)
  }

  // Payment history
  async getPaymentHistory(organizationId: string): Promise<PaymentHistory[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(paymentHistory)
      .where(eq(paymentHistory.organizationId, organizationId))
      .orderBy(desc(paymentHistory.createdAt))

    return rows.map(row => ({
      id: row.id,
      organization_id: row.organizationId ?? '',
      subscription_id: row.subscriptionId ?? undefined,
      stripe_payment_intent_id: row.stripePaymentIntentId ?? undefined,
      stripe_invoice_id: row.stripeInvoiceId ?? undefined,
      amount: row.amount,
      currency: row.currency ?? 'JPY',
      status: (row.status ?? 'pending') as PaymentHistory['status'],
      description: row.description ?? undefined,
      payment_method_type: row.paymentMethodType ?? undefined,
      paid_at: row.paidAt ?? undefined,
      created_at: row.createdAt ?? '',
    }))
  }

  async createPaymentRecord(payment: Omit<PaymentHistory, 'id' | 'created_at'>): Promise<PaymentHistory> {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(paymentHistory).values({
      id,
      organizationId: payment.organization_id,
      subscriptionId: payment.subscription_id ?? null,
      stripePaymentIntentId: payment.stripe_payment_intent_id ?? null,
      stripeInvoiceId: payment.stripe_invoice_id ?? null,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description ?? null,
      paymentMethodType: payment.payment_method_type ?? null,
      paidAt: payment.paid_at ?? null,
      createdAt: now,
    })

    const [inserted] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, id)).limit(1)
    if (!inserted) throw new Error('Failed to create payment record')

    return {
      id: inserted.id,
      organization_id: inserted.organizationId ?? '',
      subscription_id: inserted.subscriptionId ?? undefined,
      stripe_payment_intent_id: inserted.stripePaymentIntentId ?? undefined,
      stripe_invoice_id: inserted.stripeInvoiceId ?? undefined,
      amount: inserted.amount,
      currency: inserted.currency ?? 'JPY',
      status: (inserted.status ?? 'pending') as PaymentHistory['status'],
      description: inserted.description ?? undefined,
      payment_method_type: inserted.paymentMethodType ?? undefined,
      paid_at: inserted.paidAt ?? undefined,
      created_at: inserted.createdAt ?? '',
    }
  }

  // Billing info
  async getBillingInfo(organizationId: string): Promise<BillingInfo | null> {
    const db = getDb()
    const [row] = await db
      .select()
      .from(billingInfo)
      .where(eq(billingInfo.organizationId, organizationId))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      organization_id: row.organizationId ?? '',
      company_name: row.companyName ?? undefined,
      company_name_kana: row.companyNameKana ?? undefined,
      postal_code: row.postalCode ?? undefined,
      prefecture: row.prefecture ?? undefined,
      city: row.city ?? undefined,
      address_line1: row.addressLine1 ?? undefined,
      address_line2: row.addressLine2 ?? undefined,
      phone: row.phone ?? undefined,
      tax_id: row.taxId ?? undefined,
      billing_email: row.billingEmail ?? undefined,
      billing_contact_name: row.billingContactName ?? undefined,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
    }
  }

  async upsertBillingInfo(info: Omit<BillingInfo, 'id' | 'created_at' | 'updated_at'>): Promise<BillingInfo> {
    const db = getDb()
    const now = new Date().toISOString()

    // Check if exists
    const [existing] = await db
      .select({ id: billingInfo.id })
      .from(billingInfo)
      .where(eq(billingInfo.organizationId, info.organization_id))
      .limit(1)

    if (existing) {
      await db.update(billingInfo).set({
        companyName: info.company_name ?? null,
        companyNameKana: info.company_name_kana ?? null,
        postalCode: info.postal_code ?? null,
        prefecture: info.prefecture ?? null,
        city: info.city ?? null,
        addressLine1: info.address_line1 ?? null,
        addressLine2: info.address_line2 ?? null,
        phone: info.phone ?? null,
        taxId: info.tax_id ?? null,
        billingEmail: info.billing_email ?? null,
        billingContactName: info.billing_contact_name ?? null,
        updatedAt: now,
      }).where(eq(billingInfo.id, existing.id))
    } else {
      await db.insert(billingInfo).values({
        id: crypto.randomUUID(),
        organizationId: info.organization_id,
        companyName: info.company_name ?? null,
        companyNameKana: info.company_name_kana ?? null,
        postalCode: info.postal_code ?? null,
        prefecture: info.prefecture ?? null,
        city: info.city ?? null,
        addressLine1: info.address_line1 ?? null,
        addressLine2: info.address_line2 ?? null,
        phone: info.phone ?? null,
        taxId: info.tax_id ?? null,
        billingEmail: info.billing_email ?? null,
        billingContactName: info.billing_contact_name ?? null,
        createdAt: now,
        updatedAt: now,
      })
    }

    const result = await this.getBillingInfo(info.organization_id)
    if (!result) throw new Error('Failed to upsert billing info')
    return result
  }

  // Usage tracking
  async getCurrentUsage(organizationId: string, metricType: UsageTracking['metric_type']): Promise<number> {
    const db = getDb()
    const [row] = await db
      .select({ currentValue: usageTracking.currentValue })
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.organizationId, organizationId),
          eq(usageTracking.metricType, metricType)
        )
      )
      .orderBy(desc(usageTracking.createdAt))
      .limit(1)

    return row?.currentValue ?? 0
  }

  async updateUsage(organizationId: string, metricType: UsageTracking['metric_type'], value: number): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select({ id: usageTracking.id })
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.organizationId, organizationId),
          eq(usageTracking.metricType, metricType)
        )
      )
      .orderBy(desc(usageTracking.createdAt))
      .limit(1)

    if (existing) {
      await db.update(usageTracking).set({
        currentValue: value,
        measuredAt: now,
      }).where(eq(usageTracking.id, existing.id))
    } else {
      await db.insert(usageTracking).values({
        id: crypto.randomUUID(),
        organizationId,
        metricType,
        currentValue: value,
        measuredAt: now,
        createdAt: now,
      })
    }
  }

  async checkUsageLimit(organizationId: string, metricType: string): Promise<boolean> {
    const db = getDb()
    const [row] = await db
      .select({ currentValue: usageTracking.currentValue, limitValue: usageTracking.limitValue })
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.organizationId, organizationId),
          eq(usageTracking.metricType, metricType)
        )
      )
      .orderBy(desc(usageTracking.createdAt))
      .limit(1)

    if (!row || !row.limitValue) return true // no limit
    return (row.currentValue ?? 0) < row.limitValue
  }

  // Stripe checkout (client-side)
  async createCheckoutSession(
    organizationId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string }> {
    // キー未設定でもAPIを呼ぶ（サーバー側がmockセッションIDを返し、購読作成の導線につながる）
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId,
        planId,
        successUrl,
        cancelUrl,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create checkout session')
    }

    return response.json()
  }

  async createPortalSession(
    returnUrl: string,
    locale?: string,
    organizationId?: string
  ): Promise<{ url: string }> {
    // キー未設定でもAPIを呼ぶ（サーバー側が /mock/portal URL を返す）。
    // クライアントから getDb() は使えないため、organizationId は呼び出し側から受け取り、
    // 未指定時のみ /api/auth/profile から解決する
    let orgId = organizationId ?? null
    if (!orgId) {
      const profileResponse = await fetch('/api/auth/profile')
      if (!profileResponse.ok) throw new Error('Not authenticated')
      const profilePayload = await profileResponse.json()
      orgId = profilePayload?.profile?.organization_id ?? profilePayload?.organization_id ?? null
    }
    if (!orgId) throw new Error('User profile not found')

    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId: orgId,
        returnUrl,
        locale,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create portal session')
    }

    return response.json()
  }

  async getCurrentActiveSubscription(): Promise<any> {
    const profile = await this.getCurrentUserProfile()
    if (!profile) throw new Error('Not authenticated')
    if (!profile.organization_id) throw new Error('User profile not found')

    const db = getDb()
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, profile.organization_id),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1)

    if (!sub) return null

    let plan: typeof pricingPlans.$inferSelect | null = null
    if (sub.pricingPlanId) {
      const [p] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, sub.pricingPlanId)).limit(1)
      plan = p ?? null
    }

    return toSubscription(sub, plan)
  }

  async getUsageData(): Promise<{
    current_users: number
    current_documents: number
    storage_used_mb: number
  }> {
    const profile = await this.getCurrentUserProfile()
    if (!profile) throw new Error('Not authenticated')
    if (!profile.organization_id) throw new Error('User profile not found')

    const db = getDb()
    const orgId = profile.organization_id

    // User count
    const userCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.organizationId, orgId),
          eq(userProfiles.isActive, true)
        )
      )

    // Document count and size
    const docResult = await db
      .select({
        count: sql<number>`count(*)`,
        totalSize: sql<number>`coalesce(sum(${documents.fileSize}), 0)`
      })
      .from(documents)
      .where(eq(documents.organizationId, orgId))

    const totalBytes = docResult[0]?.totalSize ?? 0
    const storageUsedMb = totalBytes > 0 ? Number((totalBytes / (1024 * 1024)).toFixed(2)) : 0

    return {
      current_users: userCountResult[0]?.count ?? 0,
      current_documents: docResult[0]?.count ?? 0,
      storage_used_mb: storageUsedMb
    }
  }

  // Webhook processing
  async logStripeEvent(
    eventId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    const db = getDb()
    try {
      await db.insert(stripeEvents).values({
        id: crypto.randomUUID(),
        stripeEventId: eventId,
        eventType,
        eventData: JSON.stringify(eventData),
        processed: false,
        createdAt: new Date().toISOString(),
      })
    } catch (err: any) {
      // Ignore unique constraint violation (duplicate event)
      if (err?.message?.includes('UNIQUE constraint failed') || err?.code === '23505') {
        return
      }
      throw err
    }
  }

  async markEventProcessed(eventId: string, errorMessage?: string): Promise<void> {
    const db = getDb()
    await db
      .update(stripeEvents)
      .set({
        processed: true,
        processedAt: new Date().toISOString(),
        errorMessage: errorMessage ?? null,
      })
      .where(eq(stripeEvents.stripeEventId, eventId))
  }

  // Trial start
  async startTrial(organizationId: string): Promise<Subscription> {
    const db = getDb()
    const [trialPlan] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.name, 'トライアル'))
      .limit(1)

    if (!trialPlan) throw new Error('Trial plan not found')

    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    return this.createSubscription({
      organization_id: organizationId,
      pricing_plan_id: trialPlan.id,
      status: 'trialing',
      trial_start: new Date().toISOString(),
      trial_end: trialEnd.toISOString()
    })
  }

  // Usage statistics
  async getUsageStatistics(organizationId: string): Promise<{
    users: { current: number; limit: number | null }
    storage: { current: number; limit: number | null }
    documents: { current: number; limit: number | null }
  }> {
    const subscription = await this.getCurrentSubscription(organizationId)

    if (!subscription?.pricing_plan) {
      throw new Error('No active subscription found')
    }

    const [userCount, storageUsage, documentCount] = await Promise.all([
      this.getCurrentUsage(organizationId, 'users'),
      this.getCurrentUsage(organizationId, 'storage'),
      this.getCurrentUsage(organizationId, 'documents')
    ])

    return {
      users: {
        current: userCount,
        limit: subscription.pricing_plan.max_users ?? null
      },
      storage: {
        current: storageUsage,
        limit: subscription.pricing_plan.max_storage_gb ?? null
      },
      documents: {
        current: documentCount,
        limit: null
      }
    }
  }
}
