import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { pricingPlans } from '@/lib/db/drizzle/schema'
import { eq, desc } from 'drizzle-orm'

export async function POST(request: Request) {
  const db = getDb()
  try {
    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // 上位プラン（display_order が最大）を選択
    const plans = await db
      .select({ id: pricingPlans.id })
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(desc(pricingPlans.displayOrder))
      .limit(1)

    const plan = plans[0]
    if (!plan) {
      return NextResponse.json({ error: 'pricing plan not found' }, { status: 404 })
    }

    // 既存のモック完了エンドポイントを利用して整合更新
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}/api/stripe/mock/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, planId: plan.id, status: 'active' })
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `mock complete failed: ${text}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
}
