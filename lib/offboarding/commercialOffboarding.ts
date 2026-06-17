import { and, desc, eq, inArray, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  organizations,
  organizationDeletionRequests,
  organizationDeletionRuns,
  subscriptions,
} from '@/lib/db/drizzle/schema'

export const COMMERCIAL_OFFBOARDING_RETENTION_DAYS = 30

export function addRetentionDays(date: Date, days = COMMERCIAL_OFFBOARDING_RETENTION_DAYS) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function ensureOrganizationDeletionSchedule(organizationId: string, actorUserId: string) {
  const db = getDb()
  const now = new Date()

  const [org] = await db
    .select({
      id: organizations.id,
      endedAt: organizations.endedAt,
      retentionUntil: organizations.retentionUntil,
      deletionScheduledAt: organizations.deletionScheduledAt,
      deletionStatus: organizations.deletionStatus,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!org) return null

  const [subscription] = await db
    .select({
      status: subscriptions.status,
      canceledAt: subscriptions.canceledAt,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  const endedAtSource = org.endedAt
    ?? subscription?.canceledAt
    ?? (subscription?.status === 'canceled' ? subscription.currentPeriodEnd : null)
    ?? null

  if (!endedAtSource) {
    return {
      endedAt: org.endedAt,
      retentionUntil: org.retentionUntil,
      deletionScheduledAt: org.deletionScheduledAt,
      deletionStatus: org.deletionStatus ?? 'active',
      dueForDeletion: false,
    }
  }

  const endedAt = new Date(endedAtSource)
  const retentionUntil = org.retentionUntil ?? addRetentionDays(endedAt).toISOString()
  const deletionScheduledAt = org.deletionScheduledAt ?? retentionUntil
  const deletionStatus = org.deletionStatus && org.deletionStatus !== 'active' ? org.deletionStatus : 'retention'

  if (!org.endedAt || !org.retentionUntil || !org.deletionScheduledAt || org.deletionStatus === 'active') {
    await db.update(organizations)
      .set({
        endedAt: org.endedAt ?? endedAt.toISOString(),
        retentionUntil,
        deletionScheduledAt,
        deletionStatus,
        updatedAt: now.toISOString(),
      })
      .where(eq(organizations.id, organizationId))

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: actorUserId,
      action: 'offboarding.deletion_scheduled',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: JSON.stringify({
        ended_at: org.endedAt ?? endedAt.toISOString(),
        retention_until: retentionUntil,
        deletion_scheduled_at: deletionScheduledAt,
        retention_days: COMMERCIAL_OFFBOARDING_RETENTION_DAYS,
      }),
      scope: 'tenant',
      createdAt: now.toISOString(),
    })
  }

  return {
    endedAt: org.endedAt ?? endedAt.toISOString(),
    retentionUntil,
    deletionScheduledAt,
    deletionStatus,
    dueForDeletion: new Date(deletionScheduledAt).getTime() <= now.getTime(),
  }
}

export async function listDueDeletionOrganizations(now = new Date()) {
  const db = getDb()

  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      deletionScheduledAt: organizations.deletionScheduledAt,
      deletionStatus: organizations.deletionStatus,
    })
    .from(organizations)
    .where(and(
      lte(organizations.deletionScheduledAt, now.toISOString()),
      inArray(organizations.deletionStatus, ['retention', 'scheduled', 'failed'])
    ))
}

export async function getOffboardingStatus(organizationId: string, actorUserId: string) {
  const db = getDb()
  const schedule = await ensureOrganizationDeletionSchedule(organizationId, actorUserId)

  const requests = await db
    .select()
    .from(organizationDeletionRequests)
    .where(eq(organizationDeletionRequests.organizationId, organizationId))
    .orderBy(desc(organizationDeletionRequests.requestedAt))
    .limit(5)

  const runs = await db
    .select()
    .from(organizationDeletionRuns)
    .where(eq(organizationDeletionRuns.organizationId, organizationId))
    .orderBy(desc(organizationDeletionRuns.startedAt))
    .limit(5)

  return {
    retentionDays: COMMERCIAL_OFFBOARDING_RETENTION_DAYS,
    schedule,
    requests,
    runs,
  }
}
