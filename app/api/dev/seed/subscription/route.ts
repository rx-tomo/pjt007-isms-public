import { NextResponse } from 'next/server'
import { getUser } from '@/lib/server/auth/getUser'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { pricingPlans, subscriptions } from '@/lib/db/drizzle/schema/billing'
import { eq, asc } from 'drizzle-orm'

export async function POST() {
  // 1. Authenticate via AUTH_MODE-aware getUser()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // 2. Get organization_id from profile
  const db = getDb()
  const [profile] = await db
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  const organizationId = profile?.organizationId ?? null
  if (!organizationId) return NextResponse.json({ error: 'no organization' }, { status: 404 })

  // 3. Find active pricing plan
  const [plan] = await db
    .select({ id: pricingPlans.id })
    .from(pricingPlans)
    .where(eq(pricingPlans.isActive, true))
    .orderBy(asc(pricingPlans.displayOrder))
    .limit(1)

  if (!plan) return NextResponse.json({ error: 'no pricing plan' }, { status: 409 })

  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1)

  // 4. Upsert subscription
  // Check if subscription exists first
  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1)

  try {
    if (existing) {
      await db
        .update(subscriptions)
        .set({
          pricingPlanId: plan.id,
          status: 'active',
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: end.toISOString(),
          updatedAt: now.toISOString(),
        })
        .where(eq(subscriptions.organizationId, organizationId))
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        organizationId,
        pricingPlanId: plan.id,
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, organizationId, planId: plan.id })
}
