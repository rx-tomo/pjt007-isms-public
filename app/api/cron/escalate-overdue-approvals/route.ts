import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import {
  approvalRequests,
  approvalEvents,
  notifications,
} from '@/lib/db/drizzle/schema'
import { eq, and, lt, sql } from 'drizzle-orm'

function buildResourceLink(resourceType: string, resourceId: string): string {
  switch (resourceType) {
    case 'incident':
      return `/incidents/${resourceId}`
    case 'document':
      return `/documents/${resourceId}`
    case 'audit_plan':
      return `/audit/plans/${resourceId}`
    case 'audit_report':
      return `/audit/plans/${resourceId}/report`
    default:
      return `/approvals`
  }
}

export async function GET(request: Request) {
  // Authorize via Vercel Cron's Authorization header (Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  try {
    // 1. Find overdue pending approvals
    const overdueApprovals = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.status, 'pending'),
          lt(approvalRequests.dueAt, new Date().toISOString())
        )
      )

    let processed = 0
    let skipped = 0
    let notified = 0

    for (const approval of overdueApprovals) {
      // 2. Check if already escalated (duplicate prevention)
      const existingEvents = await db
        .select({ id: approvalEvents.id })
        .from(approvalEvents)
        .where(
          and(
            eq(approvalEvents.approvalRequestId, approval.id),
            eq(approvalEvents.eventType, 'escalated')
          )
        )
        .limit(1)

      if (existingEvents.length > 0) {
        skipped++
        continue
      }

      // 3. Resolve escalation target users
      // Note: The RPC function resolve_approval_escalation_users is PostgreSQL-specific.
      // For SQLite/Drizzle, we fall back to fetching org_admin and system_operator users.
      const { userProfiles } = await import('@/lib/db/drizzle/schema/users')
      const escalationUsers = await db
        .select({ userId: userProfiles.id })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.organizationId, approval.organizationId),
            eq(userProfiles.isActive, true),
            sql`${userProfiles.role} IN ('org_admin', 'system_operator')`
          )
        )

      if (escalationUsers.length === 0) {
        console.warn(
          `[escalate] No escalation users found for ${approval.id}`
        )
        skipped++
        continue
      }

      // 4. Create notifications for each escalation user
      const resourceLink = buildResourceLink(
        approval.resourceType,
        approval.resourceId
      )

      for (const user of escalationUsers) {
        if (!user.userId) continue

        try {
          await db.insert(notifications).values({
            id: crypto.randomUUID(),
            organizationId: approval.organizationId,
            userId: user.userId,
            title: '承認エスカレーション',
            message: `承認リクエスト（${approval.resourceType}）が期限を超過しています。対応をお願いします。`,
            type: 'system',
            priority: 'urgent',
            link: resourceLink,
            metadata: JSON.stringify({
              approval_request_id: approval.id,
              resource_type: approval.resourceType,
              resource_id: approval.resourceId,
              due_at: approval.dueAt,
            }),
          })
          notified++
        } catch (notifyError) {
          console.error(
            `[escalate] Failed to notify user ${user.userId} for ${approval.id}`,
            notifyError
          )
        }
      }

      // 5. Record escalation event
      try {
        await db.insert(approvalEvents).values({
          id: crypto.randomUUID(),
          approvalRequestId: approval.id,
          eventType: 'escalated',
          actorId: null,
          payload: JSON.stringify({
            escalation_user_ids: escalationUsers
              .map((u) => u.userId)
              .filter(Boolean),
            due_at: approval.dueAt,
          }),
        })
      } catch (eventError) {
        console.error(
          `[escalate] Failed to record escalation event for ${approval.id}`,
          eventError
        )
      }

      processed++
    }

    console.log(
      `[escalate] Done: processed=${processed}, skipped=${skipped}, notified=${notified}`
    )

    return NextResponse.json({ processed, skipped, notified })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[escalate] Unexpected error', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
