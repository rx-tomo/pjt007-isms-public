import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import { getDb } from '@/lib/db/drizzle/client'
import { subscriptions, documents, auditLogs } from '@/lib/db/drizzle/schema'
import { desc, eq } from 'drizzle-orm'
import { SubscriptionProjectionService } from '@/lib/services/subscriptionProjection'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  const json = (body: unknown, init?: ResponseInit) => applyCookies(NextResponse.json(body, init))

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { organizationId } = body as { organizationId?: string }

  if (!organizationId) {
    return json({ error: 'organizationId is required' }, { status: 400 })
  }

  const db = getDb()

  const authorization = await authorizeTenantAction(
    db,
    user.id,
    organizationId,
    'billing.manage'
  )
  if (!authorization.ok) {
    return json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
  }

  const preflight = await new SubscriptionProjectionService(db).inspect()
  const targetConflicts = preflight.conflicts.filter(conflict => (
    'organizationId' in conflict && conflict.organizationId === organizationId
  ))
  if (targetConflicts.length > 0) {
    return json(
      { error: 'Subscription state is inconsistent', conflicts: targetConflicts },
      { status: 409 }
    )
  }
  if (preflight.currentByOrganization[organizationId]) {
    return json(
      { error: 'Immediate deletion is only available for canceled subscriptions' },
      { status: 400 }
    )
  }

  const [subscription] = await db
    .select({ status: subscriptions.status, canceledAt: subscriptions.canceledAt })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
    .limit(1)

  if (!subscription || subscription.status !== 'canceled') {
    return json(
      { error: 'Immediate deletion is only available for canceled subscriptions' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  try {
    await db.transaction(async tx => {
      await tx
        .update(documents)
        .set({ retentionDeleteAt: now })
        .where(eq(documents.organizationId, organizationId))

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        action: 'immediate_data_deletion_requested',
        resourceType: 'organization',
        resourceId: organizationId,
        changes: JSON.stringify({
          retention_delete_at: now,
          requested_by: user.email,
        }),
        scope: 'tenant',
        createdAt: now,
      })
    })
  } catch (updateError) {
    console.error('Failed to schedule immediate deletion', updateError)
    return json({ error: 'Failed to schedule deletion' }, { status: 500 })
  }

  return json({
    success: true,
    message: 'Data scheduled for immediate deletion',
    scheduled_at: now
  })
}
