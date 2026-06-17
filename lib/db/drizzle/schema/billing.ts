/**
 * Drizzle ORM Schema - Billing
 *
 * SQLite-compatible schema definitions for billing/subscription-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 * - BOOLEAN -> integer (0/1)
 * - INTEGER (money) -> integer
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const subscriptionStripeStatusValues = [
  'trialing',
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
] as const
export type SubscriptionStripeStatus = (typeof subscriptionStripeStatusValues)[number]

export const paymentStatusValues = ['pending', 'processing', 'succeeded', 'failed', 'canceled'] as const
export type PaymentStatus = (typeof paymentStatusValues)[number]

export const usageMetricTypeValues = ['users', 'storage', 'api_calls', 'documents'] as const
export type UsageMetricType = (typeof usageMetricTypeValues)[number]

// =========================================
// Pricing Plans Table
// =========================================
export const pricingPlans = sqliteTable(
  'pricing_plans',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    priceMonthly: integer('price_monthly').notNull(),
    stripePriceId: text('stripe_price_id'),
    features: text('features'), // JSON string
    maxUsers: integer('max_users'),
    maxStorageGb: integer('max_storage_gb'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    displayOrder: integer('display_order').default(0),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  }
)

export type PricingPlan = typeof pricingPlans.$inferSelect
export type PricingPlanInsert = typeof pricingPlans.$inferInsert

// =========================================
// Subscriptions Table
// =========================================
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' }),
    pricingPlanId: text('pricing_plan_id')
      .references(() => pricingPlans.id),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    status: text('status'),
    currentPeriodStart: text('current_period_start'),
    currentPeriodEnd: text('current_period_end'),
    trialStart: text('trial_start'),
    trialEnd: text('trial_end'),
    cancelAt: text('cancel_at'),
    canceledAt: text('canceled_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_subscriptions_organization_id').on(table.organizationId),
    index('idx_subscriptions_stripe_subscription_id').on(table.stripeSubscriptionId),
    index('idx_subscriptions_status').on(table.status),
  ]
)

export type Subscription = typeof subscriptions.$inferSelect
export type SubscriptionInsert = typeof subscriptions.$inferInsert

// =========================================
// Payment History Table
// =========================================
export const paymentHistory = sqliteTable(
  'payment_history',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' }),
    subscriptionId: text('subscription_id')
      .references(() => subscriptions.id),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeInvoiceId: text('stripe_invoice_id').unique(),
    amount: integer('amount').notNull(),
    currency: text('currency').default('JPY'),
    status: text('status'),
    description: text('description'),
    paymentMethodType: text('payment_method_type'),
    paidAt: text('paid_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_payment_history_organization_id').on(table.organizationId),
    index('idx_payment_history_subscription_id').on(table.subscriptionId),
  ]
)

export type PaymentHistoryRow = typeof paymentHistory.$inferSelect
export type PaymentHistoryInsert = typeof paymentHistory.$inferInsert

// =========================================
// Billing Info Table
// =========================================
export const billingInfo = sqliteTable(
  'billing_info',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .unique(),
    companyName: text('company_name'),
    companyNameKana: text('company_name_kana'),
    postalCode: text('postal_code'),
    prefecture: text('prefecture'),
    city: text('city'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    phone: text('phone'),
    taxId: text('tax_id'),
    billingEmail: text('billing_email'),
    billingContactName: text('billing_contact_name'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  }
)

export type BillingInfo = typeof billingInfo.$inferSelect
export type BillingInfoInsert = typeof billingInfo.$inferInsert

// =========================================
// Usage Tracking Table
// =========================================
export const usageTracking = sqliteTable(
  'usage_tracking',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' }),
    metricType: text('metric_type'),
    currentValue: integer('current_value').default(0),
    limitValue: integer('limit_value'),
    measuredAt: text('measured_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  }
)

export type UsageTrackingRow = typeof usageTracking.$inferSelect
export type UsageTrackingInsert = typeof usageTracking.$inferInsert

// =========================================
// Stripe Events Table
// =========================================
export const stripeEvents = sqliteTable(
  'stripe_events',
  {
    id: text('id').primaryKey(),
    stripeEventId: text('stripe_event_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    eventData: text('event_data'), // JSON string
    processed: integer('processed', { mode: 'boolean' }).default(false),
    errorMessage: text('error_message'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    processedAt: text('processed_at'),
  },
  (table) => [
    index('idx_stripe_events_stripe_event_id').on(table.stripeEventId),
    index('idx_stripe_events_processed').on(table.processed),
  ]
)

export type StripeEventRow = typeof stripeEvents.$inferSelect
export type StripeEventInsert = typeof stripeEvents.$inferInsert

// =========================================
// Relations
// =========================================
export const pricingPlansRelations = relations(pricingPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  pricingPlan: one(pricingPlans, {
    fields: [subscriptions.pricingPlanId],
    references: [pricingPlans.id],
  }),
  paymentHistory: many(paymentHistory),
}))

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentHistory.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [paymentHistory.subscriptionId],
    references: [subscriptions.id],
  }),
}))

export const billingInfoRelations = relations(billingInfo, ({ one }) => ({
  organization: one(organizations, {
    fields: [billingInfo.organizationId],
    references: [organizations.id],
  }),
}))

export const usageTrackingRelations = relations(usageTracking, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageTracking.organizationId],
    references: [organizations.id],
  }),
}))
