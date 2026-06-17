import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships, subscriptions, documents, auditLogs } from '@/lib/db/drizzle/schema'
import { eq, and } from 'drizzle-orm'

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

  const [profile] = await db
    .select({
      id: userProfiles.id,
      organizationId: userProfiles.organizationId,
      role: userProfiles.role,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return json({ error: 'Profile missing' }, { status: 403 })
  }

  if (profile.organizationId !== organizationId) {
    return json({ error: 'Forbidden - cross tenant request' }, { status: 403 })
  }

  const [membership] = await db
    .select({ role: userMemberships.role })
    .from(userMemberships)
    .where(and(
      eq(userMemberships.userId, user.id),
      eq(userMemberships.organizationId, organizationId)
    ))
    .limit(1)

  const effectiveRole = membership?.role || profile.role
  if (!effectiveRole || !['org_admin', 'system_operator'].includes(effectiveRole)) {
    return json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
  }

  const [subscription] = await db
    .select({ status: subscriptions.status, canceledAt: subscriptions.canceledAt })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1)

  if (!subscription || subscription.status !== 'canceled') {
    return json(
      { error: 'Immediate deletion is only available for canceled subscriptions' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  try {
    await db
      .update(documents)
      .set({ retentionDeleteAt: now })
      .where(eq(documents.organizationId, organizationId))
  } catch (updateError) {
    console.error('Failed to update retention_delete_at', updateError)
    return json({ error: 'Failed to schedule deletion' }, { status: 500 })
  }

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: user.id,
      action: 'immediate_data_deletion_requested',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: JSON.stringify({
        retention_delete_at: now,
        requested_by: user.email
      }),
      scope: 'tenant',
      createdAt: now,
    })
  } catch (auditError) {
    console.error('Failed to insert audit log', auditError)
  }

  return json({
    success: true,
    message: 'Data scheduled for immediate deletion',
    scheduled_at: now
  })
}
