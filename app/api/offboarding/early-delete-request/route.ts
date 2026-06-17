import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  organizations,
  organizationDeletionRequests,
} from '@/lib/db/drizzle/schema'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import {
  addRetentionDays,
  COMMERCIAL_OFFBOARDING_RETENTION_DAYS,
  ensureOrganizationDeletionSchedule,
} from '@/lib/offboarding/commercialOffboarding'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    organizationId?: string
    reason?: string
  }
  const organizationId = body.organizationId?.trim()

  if (!organizationId) {
    return Response.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'offboarding.early_delete.request',
    logContext: { organizationId },
  })
  if (!guard) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const now = new Date()
  const schedule = await ensureOrganizationDeletionSchedule(organizationId, guard.userId)
  const executionScheduledAt = now.toISOString()
  const requestId = crypto.randomUUID()
  const reason = body.reason?.trim() || null

  await db.insert(organizationDeletionRequests).values({
    id: requestId,
    organizationId,
    requesterId: guard.userId,
    requestedAt: executionScheduledAt,
    reason,
    source: 'customer_early_request',
    status: 'requested',
    executionScheduledAt,
    customerNotice: 'Early deletion request received. Support or an authorized operator must confirm before irreversible deletion.',
    createdAt: executionScheduledAt,
    updatedAt: executionScheduledAt,
  })

  const retentionUntil = schedule?.retentionUntil ?? addRetentionDays(now).toISOString()
  const deletionScheduledAt = schedule?.deletionScheduledAt ?? retentionUntil
  await db.update(organizations)
    .set({
      endedAt: schedule?.endedAt ?? now.toISOString(),
      retentionUntil,
      deletionScheduledAt,
      deletionStatus: 'early_requested',
      updatedAt: executionScheduledAt,
    })
    .where(eq(organizations.id, organizationId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId,
    userId: guard.userId,
    action: 'offboarding.early_delete.requested',
    resourceType: 'organization_deletion_request',
    resourceId: requestId,
    changes: JSON.stringify({
      reason,
      requested_at: executionScheduledAt,
      execution_scheduled_at: executionScheduledAt,
      deletion_scheduled_at: deletionScheduledAt,
      retention_until: retentionUntil,
      retention_days: COMMERCIAL_OFFBOARDING_RETENTION_DAYS,
    }),
    scope: 'tenant',
    createdAt: executionScheduledAt,
  })

  return guard.json({
    data: {
      requestId,
      status: 'requested',
      requestedAt: executionScheduledAt,
      executionScheduledAt,
      retentionUntil,
      deletionScheduledAt,
    },
  }, { status: 201 })
}
