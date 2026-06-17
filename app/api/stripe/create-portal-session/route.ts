import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { hasStripeSecret, isStripeMockMode } from '@/lib/stripe/config'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { subscriptions } from '@/lib/db/drizzle/schema/billing'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and, desc } from 'drizzle-orm'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

interface CreatePortalPayload {
  organizationId?: string
  returnUrl?: string
  locale?: string
}

export async function POST(request: NextRequest) {
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined
  try {
    const body = (await request.json()) as CreatePortalPayload
    const { organizationId, returnUrl } = body
    const locale = ['ja', 'en', 'zh'].includes(body.locale ?? '') ? body.locale : 'ja'
    const normalizedOrgId = organizationId?.trim()

    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['org_admin', 'system_operator'],
      organizationId: normalizedOrgId || undefined,
      actionName: 'stripe.create_portal_session',
      logContext: returnUrl ? { returnUrl } : undefined
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
      return json({ error: 'organizationId は必須です。' }, { status: 400 })
    }

    if (!normalizedOrgId) {
      return json({ error: 'organizationId は必須です。' }, { status: 400 })
    }

    const secretKeyRaw = process.env.STRIPE_SECRET_KEY ?? ''
    const secretConfigured = hasStripeSecret()

    // mock判定を先に行う（非本番のキー未設定もmock扱い。GAP-021/022）
    if (isStripeMockMode()) {
      const mockUrl = `${new URL('/mock/portal', request.url).toString()}?organizationId=${normalizedOrgId}&locale=${locale}`
      console.info('[Stripe Mock] customer portal URL generated', { organizationId: normalizedOrgId, mockUrl })
      return json({ url: mockUrl })
    }

    if (!secretConfigured) {
      // 本番でキー未設定は構成エラー（旧実装のダミーURL返却は行き止まりのため廃止）
      console.error('[Stripe] create-portal-session called without secret key in production')
      return json(
        { error: 'Stripe が構成されていません。管理者に連絡してください。' },
        { status: 503 }
      )
    }

    const secretKey = secretKeyRaw.trim()

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-05-28.basil'
    })

    const db = getDb()

    const subRows = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId, organizationId: subscriptions.organizationId })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, normalizedOrgId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    let customerId = subRows[0]?.stripeCustomerId ?? undefined

    if (!customerId) {
      const adminRows = await db
        .select({ email: userProfiles.email })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.organizationId, normalizedOrgId),
            eq(userProfiles.role, 'org_admin')
          )
        )
        .limit(1)

      const adminUser = adminRows[0]
      if (adminUser?.email) {
        const customers = await stripe.customers.list({
          email: adminUser.email,
          limit: 1
        })
        customerId = customers.data[0]?.id
      }
    }

    if (!customerId) {
      return json(
        { error: 'Stripe カスタマーが見つかりません。プラン契約後に再度お試しください。' },
        { status: 400 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl && returnUrl.trim() !== '' ? returnUrl : new URL('/home', request.url).toString()
    })

    await logEvent('success',
      {
        organizationId: normalizedOrgId,
        portalUrl: session.url
      },
      { format: 'stripe.portal_session' }
    )

    return json({
      url: session.url
    })
  } catch (error) {
    console.error('[Stripe] create portal session failed', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder =
      jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder(
      { error: 'カスタマーポータルの生成に失敗しました。' },
      { status: 500 }
    )
  }
}
