import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { hasStripeSecret, isStripeMockMode, resolveStripePriceIdFromEnv } from '@/lib/stripe/config'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { pricingPlans } from '@/lib/db/drizzle/schema/billing'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and } from 'drizzle-orm'
import { findDefaultPricingPlan } from '@/lib/stripe/defaultPricingPlans'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

interface CreateCheckoutPayload {
  organizationId?: string
  planId?: string
  successUrl?: string
  cancelUrl?: string
}

export async function POST(request: NextRequest) {
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined
  try {
    const body = (await request.json()) as CreateCheckoutPayload
    const { organizationId, planId, successUrl, cancelUrl } = body
    const normalizedOrgId = organizationId?.trim()

    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['org_admin', 'system_operator'],
      organizationId: normalizedOrgId || undefined,
      actionName: 'stripe.create_checkout_session',
      logContext: planId ? { planId } : undefined
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

    if (!organizationId || !planId || !successUrl || !cancelUrl) {
      return json(
        { error: 'organizationId, planId, successUrl, cancelUrl は必須です。' },
        { status: 400 }
      )
    }

    if (!normalizedOrgId) {
      return json({ error: 'organizationId is required' }, { status: 400 })
    }

    const db = getDb()
    const secretKeyRaw = process.env.STRIPE_SECRET_KEY ?? ''
    const secretConfigured = hasStripeSecret()

    // Stripe Price ID を取得
    const planRows = await db
      .select({ id: pricingPlans.id, name: pricingPlans.name, stripePriceId: pricingPlans.stripePriceId })
      .from(pricingPlans)
      .where(eq(pricingPlans.id, planId))
      .limit(1)

    const fallbackPlan = findDefaultPricingPlan(planId)
    const pricingPlan = planRows[0] ?? (
      fallbackPlan
        ? { id: fallbackPlan.id, name: fallbackPlan.name, stripePriceId: fallbackPlan.stripe_price_id ?? null }
        : undefined
    )
    if (!pricingPlan) {
      console.error('[Stripe] pricing plan not found', { planId })
      return json(
        { error: '指定されたプランが見つかりません。' },
        { status: 404 }
      )
    }

    const envPrice = resolveStripePriceIdFromEnv(pricingPlan.name)

    let stripePriceId = pricingPlan.stripePriceId ?? envPrice?.priceId ?? null

    if (!pricingPlan.stripePriceId && envPrice?.priceId) {
      try {
        await db.update(pricingPlans)
          .set({ stripePriceId: envPrice.priceId })
          .where(eq(pricingPlans.id, pricingPlan.id))
        stripePriceId = envPrice.priceId
      } catch (updateError) {
        console.warn('[Stripe] failed to persist stripe_price_id from env', {
          planId,
          envKey: envPrice.envKey,
          message: updateError instanceof Error ? updateError.message : String(updateError)
        })
      }
    }

    if (!secretConfigured) {
      console.info('[Stripe Skeleton] create-checkout-session fallback (missing secret key)', {
        organizationId: normalizedOrgId,
        planId
      })
      return json({ sessionId: `cs_test_mock_${Date.now()}` })
    }

    if (!stripePriceId) {
      console.error('[Stripe] pricing plan lacks stripe_price_id', {
        planId,
        organizationId: normalizedOrgId,
        envTried: envPrice?.envKey ?? null
      })
      return json(
        { error: '料金プランに対応する Stripe 価格が未設定です。管理者に連絡してください。' },
        { status: 409 }
      )
    }

    if (isStripeMockMode()) {
      console.info('[Stripe Mock] create-checkout-session simulated', {
        organizationId: normalizedOrgId,
        planId,
        stripePriceId
      })
      return json({ sessionId: `cs_test_mock_${Date.now()}` })
    }

    const secretKey = secretKeyRaw.trim()

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-05-28.basil'
    })

    // 組織情報と管理者メールを取得（顧客識別用）
    const orgRows = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, normalizedOrgId))
      .limit(1)

    const adminRows = await db
      .select({ email: userProfiles.email, fullName: userProfiles.fullName })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.organizationId, normalizedOrgId),
          eq(userProfiles.role, 'org_admin')
        )
      )
      .limit(1)

    const adminUser = adminRows[0] ?? null

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: normalizedOrgId,
      metadata: {
        organization_id: normalizedOrgId,
        pricing_plan_id: pricingPlan.id
      },
      billing_address_collection: 'auto',
      customer_email: adminUser?.email ?? undefined,
      subscription_data: {
          metadata: {
            organization_id: normalizedOrgId,
          pricing_plan_id: pricingPlan.id
        }
      },
      line_items: [
        {
          price: stripePriceId,
          quantity: 1
        }
      ],
      allow_promotion_codes: false,
      automatic_tax: { enabled: true },
      locale: 'ja'
    })

    console.info('[Stripe] checkout session created', {
      sessionId: checkoutSession.id,
      organizationId: normalizedOrgId,
      planId
    })

    await logEvent('success',
      {
        planId,
        organizationId: normalizedOrgId,
        sessionId: checkoutSession.id
      },
      { format: 'stripe.checkout_session' }
    )

    return json({
      sessionId: checkoutSession.id
    })
  } catch (error) {
    console.error('[Stripe] create checkout session failed', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder = jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder(
      { error: 'Checkout セッションの作成に失敗しました。' },
      { status: 500 }
    )
  }
}
