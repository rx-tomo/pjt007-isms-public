import { NextRequest } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { notifyOpsChannel } from '@/lib/server/ops/notify'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { asc } from 'drizzle-orm'

const VALID_EVENTS = new Set(['health_failure', 'standby_state'] as const)

type OpsAlertPayload = {
  event: 'health_failure' | 'standby_state'
  queueLength?: number
  failoverState?: 'primary' | 'standby'
  lastDeployAt?: string | null
  details?: string
}

export async function POST(request: NextRequest) {
  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.ops_alert'
  })

  if (guardResult.error) {
    return guardResult.error
  }

  const guard = guardResult.guard
  if (!guard) {
    return guardResult.error ?? new Response('Guard unavailable', { status: 500 })
  }

  let payload: OpsAlertPayload
  try {
    payload = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (!VALID_EVENTS.has(payload.event)) {
    return guard.json({ error: 'Unknown event type' }, { status: 400 })
  }

  const db = getDb()

  let organizationId = guard.profile.organization_id
  if (!organizationId) {
    const orgRows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .orderBy(asc(organizations.createdAt))
      .limit(1)

    organizationId = orgRows[0]?.id ?? null
  }

  const action = payload.event === 'standby_state' ? 'edge_function.failover' : 'edge_function.health_alert'
  const changes = {
    queueLength: payload.queueLength ?? null,
    failoverState: payload.failoverState ?? null,
    lastDeployAt: payload.lastDeployAt ?? null,
    details: payload.details ?? null
  }

  if (organizationId) {
    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: guard.userId,
        action,
        resourceType: 'edge_function',
        resourceId: 'tenant-admin',
        changes: JSON.stringify(changes),
        scope: 'global'
      })
    } catch (error) {
      console.warn('[super-admin/ops-alert] Failed to record audit log', error)
    }
  }

  void notifyOpsChannel({
    title: payload.event === 'standby_state' ? 'tenant-admin running in standby' : 'tenant-admin health alert',
    text:
      payload.event === 'standby_state'
        ? 'Operations toggled the standby function; monitor the deployment and queue before switching back.'
        : 'Health probes failed twice in a row; investigate the Edge Function logs and failover procedure.',
    details: {
      ['Queue length']: payload.queueLength ?? 'n/a',
      ['Failover state']: payload.failoverState ?? 'primary',
      ['Last deploy']: payload.lastDeployAt ?? 'unknown',
      ['Details']: payload.details ?? 'none'
    }
  })

  return guard.json({ status: 'ok' })
}
