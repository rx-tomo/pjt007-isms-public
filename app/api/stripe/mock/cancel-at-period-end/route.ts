import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { subscriptions } from '@/lib/db/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import { requireMockBillingAccess } from '@/lib/server/auth/mockBillingGuard'

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json()
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const guard = await requireMockBillingAccess(request, organizationId)
    if (guard.error) {
      return guard.error
    }

    const db = getDb()
    const subs = await db
      .select({ id: subscriptions.id, currentPeriodEnd: subscriptions.currentPeriodEnd })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    const sub = subs[0]
    if (!sub) {
      return NextResponse.json({ error: 'subscription not found' }, { status: 404 })
    }

    await db.update(subscriptions)
      .set({ cancelAt: sub.currentPeriodEnd })
      .where(eq(subscriptions.id, sub.id))

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
}
