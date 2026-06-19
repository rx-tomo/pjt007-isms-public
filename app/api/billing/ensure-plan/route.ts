import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import type { NotificationPriority } from '@/lib/services/notification'
import { resolveStripePriceIdFromEnv } from '@/lib/stripe/config'
import { deliverNotification } from '@/lib/server/notificationDelivery'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { pricingPlans, subscriptions } from '@/lib/db/drizzle/schema/billing'
import { notifications, emailLogs } from '@/lib/db/drizzle/schema/notifications'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and, inArray, desc, or, isNull, sql } from 'drizzle-orm'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-05-28.basil'

interface EnsurePlanRequestBody {
  organizationId?: string
}

export async function POST(request: NextRequest) {
  let body: EnsurePlanRequestBody = {}
  try {
    body = (await request.json()) ?? {}
  } catch {
    // ignore when body is empty
  }

  const normalizedOrgId = (body.organizationId ?? '').trim()
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined

  try {
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['org_admin', 'system_operator'],
      organizationId: normalizedOrgId || undefined,
      actionName: 'billing.ensure_plan',
      logContext: normalizedOrgId ? { organizationId: normalizedOrgId } : undefined
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

    if (!normalizedOrgId) {
      return json({ error: 'organizationId is required' }, { status: 400 })
    }

    const respondSuccess = async (
      payload: unknown,
      context: Record<string, unknown> = {},
      init?: ResponseInit
    ) => {
      await logEvent(
        'success',
        { organizationId: normalizedOrgId, ...context },
        { format: 'billing.ensure_plan' }
      )
      return json(payload, init)
    }

    const db = getDb()

    // refresh_user_usage RPC replacement: count active users directly
    // (The RPC was PostgreSQL-specific; for Drizzle/SQLite we simply query active users.)

    const activeUserRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.organizationId, normalizedOrgId),
          or(isNull(userProfiles.isActive), eq(userProfiles.isActive, true))
        )
      )

    const activeSeats = activeUserRows[0]?.count ?? 0

    const subRows = await db
      .select({
        id: subscriptions.id,
        organizationId: subscriptions.organizationId,
        pricingPlanId: subscriptions.pricingPlanId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, normalizedOrgId),
          inArray(subscriptions.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    const subscription = subRows[0]

    if (!subscription) {
      return respondSuccess(
        {
          message: 'No active subscription found. Usage tracking only.',
          activeSeats
        },
        { outcome: 'usage_tracking' }
      )
    }

    const plans = await db
      .select({
        id: pricingPlans.id,
        name: pricingPlans.name,
        maxUsers: pricingPlans.maxUsers,
        stripePriceId: pricingPlans.stripePriceId,
        displayOrder: pricingPlans.displayOrder,
      })
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(pricingPlans.displayOrder)

    if (!plans.length) {
      console.error('[Billing] no active pricing plans found')
      return json({ error: 'Failed to fetch pricing plans' }, { status: 500 })
    }

    // Persist env-derived stripe_price_id where missing
    await Promise.all(
      plans.map(async plan => {
        if (plan.stripePriceId) return

        const envPrice = resolveStripePriceIdFromEnv(plan.name)
        if (!envPrice) return

        try {
          await db.update(pricingPlans)
            .set({ stripePriceId: envPrice.priceId })
            .where(eq(pricingPlans.id, plan.id))
          plan.stripePriceId = envPrice.priceId
        } catch (updateError) {
          console.warn('[Billing] failed to persist stripe_price_id from env', {
            planId: plan.id,
            envKey: envPrice.envKey,
            message: updateError instanceof Error ? updateError.message : String(updateError)
          })
        }
      })
    )

    const currentPlan = plans.find(plan => plan.id === subscription.pricingPlanId) ?? null

    const maxUsers = currentPlan?.maxUsers ?? null
    if (!currentPlan) {
      console.warn('[Billing] subscription has unknown pricing_plan_id', subscription.pricingPlanId)
    }

    if (maxUsers !== null) {
      await handleSeatUsageNotifications(db, {
        organizationId: normalizedOrgId,
        activeSeats,
        maxUsers,
        planName: currentPlan?.name ?? null
      })
    }

    if (maxUsers === null || activeSeats <= maxUsers) {
      return respondSuccess(
        {
          upgraded: false,
          activeSeats,
          currentPlan: currentPlan ? { id: currentPlan.id, name: currentPlan.name, max_users: currentPlan.maxUsers } : null
        },
        { outcome: 'usage_within_limit' }
      )
    }

    // 次の適切なプランを探索
    const orderedPlans = plans
      .filter(plan => plan.stripePriceId)
      .sort((a, b) => {
        const aMax = a.maxUsers ?? Number.MAX_SAFE_INTEGER
        const bMax = b.maxUsers ?? Number.MAX_SAFE_INTEGER
        if (aMax === bMax) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        return aMax - bMax
      })

    const candidate =
      orderedPlans.find(plan => plan.maxUsers !== null && activeSeats <= (plan.maxUsers ?? Number.MAX_SAFE_INTEGER)) ??
      orderedPlans.find(plan => plan.maxUsers === null)

    if (!candidate || candidate.id === currentPlan?.id) {
      return respondSuccess(
        {
          upgraded: false,
          activeSeats,
          currentPlan: currentPlan ? { id: currentPlan.id, name: currentPlan.name, max_users: currentPlan.maxUsers } : null,
          message: 'No higher plan available or already at suitable plan.'
        },
        { outcome: 'no_candidate' }
      )
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret || !candidate.stripePriceId || !subscription.stripeSubscriptionId) {
      console.warn('[Billing] Stripe upgrade skipped due to missing configuration or subscription id')
      return respondSuccess(
        {
          upgraded: false,
          activeSeats,
          currentPlan: currentPlan ? { id: currentPlan.id, name: currentPlan.name, max_users: currentPlan.maxUsers } : null,
          message: 'Stripe credentials or subscription identifiers are missing.'
        },
        { outcome: 'stripe_config_missing' }
      )
    }

    try {
      const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION })
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
        apiVersion: STRIPE_API_VERSION
      })
      const primaryItem = stripeSubscription.items.data[0]

      if (!primaryItem) {
        throw new Error('Subscription has no items to update')
      }

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: primaryItem.id,
            price: candidate.stripePriceId,
            quantity: 1
          }
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          organization_id: normalizedOrgId
        }
      })

      await db.update(subscriptions)
        .set({ pricingPlanId: candidate.id })
        .where(eq(subscriptions.id, subscription.id))

      return respondSuccess(
        {
          upgraded: true,
          activeSeats,
          newPlan: { id: candidate.id, name: candidate.name, max_users: candidate.maxUsers }
        },
        { outcome: 'performed_upgrade' }
      )
    } catch (error) {
      console.error('[Billing] failed to upgrade subscription', error)
      await guardResult?.logEvent('error', {
        error: error instanceof Error ? error.message : 'unknown'
      })
      const responder = jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
      return responder({ error: 'Failed to upgrade subscription automatically' }, { status: 500 })
    }
  } catch (error) {
    console.error('[Billing] ensure-plan failed', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder = jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder({ error: 'Failed to evaluate billing plan' }, { status: 500 })
  }
}

interface SeatUsageNotificationParams {
  organizationId: string
  activeSeats: number
  maxUsers: number
  planName: string | null
}

interface ThresholdConfig {
  key: '70' | '90' | 'over'
  trigger: number
  priority: NotificationPriority
  title: string
  buildMessage: (context: { activeSeats: number; maxUsers: number; usagePercent: number; planName: string | null }) => string
}

type DbInstance = ReturnType<typeof getDb>

async function handleSeatUsageNotifications(
  db: DbInstance,
  { organizationId, activeSeats, maxUsers, planName }: SeatUsageNotificationParams
) {
  if (maxUsers <= 0) return

  const usagePercent = maxUsers === 0 ? 100 : (activeSeats / maxUsers) * 100
  const thresholds: ThresholdConfig[] = [
    {
      key: '70',
      trigger: 70,
      priority: 'medium',
      title: 'ライセンス使用率が 70% に到達しました',
      buildMessage: ({ activeSeats, maxUsers, usagePercent }) =>
        `現在の有効ユーザー数は ${activeSeats} / ${maxUsers} ライセンス枠 (${usagePercent.toFixed(1)}%) です。プラン上限に備えて、追加招待や削減計画を確認してください。`
    },
    {
      key: '90',
      trigger: 90,
      priority: 'high',
      title: 'ライセンス使用率が 90% を超過しました',
      buildMessage: ({ activeSeats, maxUsers, usagePercent }) =>
        `現在の有効ユーザー数は ${activeSeats} / ${maxUsers} ライセンス枠 (${usagePercent.toFixed(1)}%) です。サポートチームと連携し、事前にプラン変更またはユーザー枠の最適化を検討してください。`
    }
  ]

  const triggersToFire = thresholds.filter(config => usagePercent >= config.trigger)

  if (activeSeats > maxUsers) {
    triggersToFire.push({
      key: 'over',
      trigger: 100,
      priority: 'urgent',
      title: 'プランのライセンス上限を超過しました',
      buildMessage: ({ activeSeats, maxUsers }) =>
        `現在の有効ユーザー数は ${activeSeats} ライセンス枠で、プラン上限 ${maxUsers} ライセンス枠を超過しています。自動アップグレードまたは追加課金の結果を確認し、顧客への連絡を実施してください。`
    })
  }

  if (!triggersToFire.length) return

  const recipients = await db
    .select({ id: userProfiles.id, email: userProfiles.email, fullName: userProfiles.fullName, role: userProfiles.role })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.organizationId, organizationId),
        inArray(userProfiles.role, ['system_operator', 'org_admin']),
        eq(userProfiles.isActive, true)
      )
    )

  if (!recipients.length) {
    console.info('[Billing] no active admins found for license usage notifications')
    return
  }

  const dedupeSince = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()

  for (const config of triggersToFire) {
    for (const recipient of recipients) {
      // Deduplicate: check if notification with same category+key was sent in last 7 days
      // Using metadata LIKE search since metadata is stored as JSON string
      const existingRows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.organizationId, organizationId),
            eq(notifications.userId, recipient.id),
            eq(notifications.type, 'system'),
            sql`${notifications.metadata} LIKE ${'%"category":"seat_usage"%'}`,
            sql`${notifications.metadata} LIKE ${'%"key":"' + config.key + '"%'}`,
            sql`${notifications.createdAt} >= ${dedupeSince}`
          )
        )
        .limit(1)

      if (existingRows.length > 0) {
        continue
      }

      const notificationId = crypto.randomUUID()
      try {
        await db.insert(notifications).values({
          id: notificationId,
          organizationId,
          userId: recipient.id,
          title: config.title,
          message: config.buildMessage({ activeSeats, maxUsers, usagePercent, planName }),
          type: 'system',
          priority: config.priority,
          metadata: JSON.stringify({
            category: 'seat_usage',
            key: config.key,
            active_seats: activeSeats,
            max_users: maxUsers,
            usage_percent: Number(usagePercent.toFixed(1)),
            plan_name: planName,
            triggered_at: new Date().toISOString()
          }),
        })
      } catch (notificationError) {
        console.error('[Billing] failed to create license usage notification', notificationError)
        continue
      }

      let emailLogId: string | undefined

      if (recipient.email) {
        const subject = `【Riscala AI for ISMS】${config.title}`
        const logId = crypto.randomUUID()
        try {
          await db.insert(emailLogs).values({
            id: logId,
            notificationId,
            userId: recipient.id,
            toEmail: recipient.email,
            subject,
            status: 'pending',
          })
          emailLogId = logId
        } catch (emailLogError) {
          console.error('[Billing] failed to enqueue license usage email log', emailLogError)
        }
      }

      const deliveryResult = await deliverNotification(notificationId, { emailLogId })

      if (!deliveryResult.ok && deliveryResult.status === 'failed') {
        console.error('[Billing] notification delivery failed', deliveryResult.message ?? '')
      }
    }
  }
}
