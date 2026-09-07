import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { pricingPlans } from '@/lib/db/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import { requireMockBillingAccess } from '@/lib/server/auth/mockBillingGuard'
import {
  completeMockBilling,
  MockBillingCompletionError,
} from '@/lib/server/billing/mockBillingCompletion'

export async function POST(request: NextRequest) {
  const db = getDb()
  try {
    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const guard = await requireMockBillingAccess(request, organizationId)
    if (guard.error) {
      return guard.error
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

    await completeMockBilling(db, {
      organizationId,
      planId: plan.id,
      status: 'active',
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MockBillingCompletionError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
}
