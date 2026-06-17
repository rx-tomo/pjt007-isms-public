import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNotNull, like, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { followUpRecords } from '@/lib/db/drizzle/schema/audit'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { notifications, notificationPreferences } from '@/lib/db/drizzle/schema/notifications'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { deliverNotification } from '@/lib/server/notificationDelivery'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

export const runtime = 'nodejs'

const ACTIVE_FOLLOW_UP_STATUSES = ['open', 'in_progress']
const REMINDER_KIND = 'follow_up_due'
const OVERDUE_REMINDER_KIND = 'follow_up_overdue'

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function POST(request: NextRequest) {
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined

  try {
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['system_operator'],
      actionName: 'audit.follow_up_reminders'
    })

    if (error) {
      return error
    }

    guardResult = guard
    if (!guard) {
      return new Response('Service role guard unavailable', { status: 500 })
    }
    const { json, logEvent } = guard
    jsonResponse = json

    const db = getDb()
    const today = startOfDay(new Date())
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 30)

    const followUps = await db
      .select({
        id: followUpRecords.id,
        organizationId: followUpRecords.organizationId,
        auditPlanId: followUpRecords.auditPlanId,
        nonconformityId: followUpRecords.nonconformityId,
        title: followUpRecords.title,
        status: followUpRecords.status,
        dueDate: followUpRecords.dueDate,
        assignedTo: followUpRecords.assignedTo,
      })
      .from(followUpRecords)
      .where(and(
        inArray(followUpRecords.status, ACTIVE_FOLLOW_UP_STATUSES),
        isNotNull(followUpRecords.assignedTo),
        isNotNull(followUpRecords.dueDate),
        lte(followUpRecords.dueDate, formatDate(horizon))
      ))

    if (!followUps.length) {
      return json({ ok: true, remindersSent: 0, processedFollowUps: 0 })
    }

    const assigneeIds = Array.from(
      new Set(followUps.map(row => row.assignedTo).filter((id): id is string => Boolean(id)))
    )

    const preferences = await db
      .select({
        userId: notificationPreferences.userId,
        taskReminders: notificationPreferences.taskReminders,
        reminderDaysBefore: notificationPreferences.reminderDaysBefore,
      })
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, assigneeIds))

    const preferenceMap = new Map<string, typeof preferences[number]>()
    for (const row of preferences) {
      preferenceMap.set(row.userId, row)
    }

    const remindersSent: Array<{
      followUpRecordId: string
      notificationId: string
      reminderKind: string
      deliveryStatus: string
    }> = []
    const skipped: Array<{ followUpRecordId: string; reason: string }> = []

    for (const followUp of followUps) {
      if (!followUp.assignedTo || !followUp.dueDate) {
        skipped.push({ followUpRecordId: followUp.id, reason: 'missing_assignee_or_due_date' })
        continue
      }

      const pref = preferenceMap.get(followUp.assignedTo)
      const remindersEnabled = pref ? pref.taskReminders : true
      const reminderDays = pref?.reminderDaysBefore ?? 3

      if (!remindersEnabled) {
        skipped.push({ followUpRecordId: followUp.id, reason: 'preferences_disabled' })
        continue
      }

      const dueDate = new Date(`${followUp.dueDate}T00:00:00Z`)
      const isOverdue = followUp.dueDate < formatDate(today)
      const reminderKind = isOverdue ? OVERDUE_REMINDER_KIND : REMINDER_KIND
      const reminderStart = startOfDay(new Date(dueDate))
      reminderStart.setDate(reminderStart.getDate() - reminderDays)

      if (!isOverdue && today < reminderStart) {
        skipped.push({ followUpRecordId: followUp.id, reason: 'not_within_window' })
        continue
      }

      const existing = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.organizationId, followUp.organizationId),
          eq(notifications.userId, followUp.assignedTo),
          eq(notifications.type, 'task_reminder'),
          like(notifications.metadata, `%${followUp.id}%`),
          like(notifications.metadata, `%${reminderKind}%`)
        ))
        .limit(1)

      if (existing.length > 0) {
        skipped.push({ followUpRecordId: followUp.id, reason: 'already_sent' })
        continue
      }

      try {
        const messageDate = new Date(followUp.dueDate).toLocaleDateString('ja-JP', {
          timeZone: 'Asia/Tokyo'
        })
        const notificationId = crypto.randomUUID()
        const title = isOverdue
          ? '監査フォローアップ期限超過'
          : '監査フォローアップ期限リマインダー'
        const message = isOverdue
          ? `フォローアップ「${followUp.title}」の期限${messageDate}を過ぎています。`
          : `フォローアップ「${followUp.title}」の期限が${messageDate}に迫っています。`
        const auditAction = isOverdue
          ? 'audit.follow_up.overdue_reminder_sent'
          : 'audit.follow_up.reminder_sent'

        await db.insert(notifications).values({
          id: notificationId,
          organizationId: followUp.organizationId,
          userId: followUp.assignedTo,
          title,
          message,
          type: 'task_reminder',
          priority: isOverdue ? 'urgent' : 'high',
          link: `/audit/plans/${followUp.auditPlanId}`,
          metadata: JSON.stringify({
            reminder_kind: reminderKind,
            follow_up_record_id: followUp.id,
            audit_plan_id: followUp.auditPlanId,
            nonconformity_id: followUp.nonconformityId,
            due_date: followUp.dueDate,
            reminder_days_before: reminderDays
          }),
        })

        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: followUp.organizationId,
          userId: followUp.assignedTo,
          action: auditAction,
          resourceType: 'follow_up_record',
          resourceId: followUp.id,
          changes: JSON.stringify({
            due_date: followUp.dueDate,
            reminder_days_before: reminderDays,
            reminder_kind: reminderKind
          }),
        })

        const delivery = await deliverNotification(notificationId)
        const deliveryStatus = delivery.ok
          ? delivery.status ?? (delivery.skipped ? `skipped:${delivery.reason ?? 'unknown'}` : 'sent')
          : delivery.reason ?? delivery.status ?? 'failed'

        remindersSent.push({
          followUpRecordId: followUp.id,
          notificationId,
          reminderKind,
          deliveryStatus
        })
      } catch (reminderError) {
        console.error('[Audit Follow-up Reminders] failed to process follow-up', followUp.id, reminderError)
        skipped.push({
          followUpRecordId: followUp.id,
          reason: reminderError instanceof Error ? reminderError.message : 'unknown_error'
        })
      }
    }

    await logEvent('success', {
      processedFollowUps: followUps.length,
      remindersSent: remindersSent.length,
      skipped: skipped.length
    }, { format: 'audit.follow_up_reminders' })

    return json({
      ok: true,
      processedFollowUps: followUps.length,
      remindersSent: remindersSent.length,
      reminders: remindersSent,
      skipped
    })
  } catch (error) {
    console.error('[Audit Follow-up Reminders] failed to process request', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder =
      jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder({ error: 'Failed to process audit follow-up reminders' }, { status: 500 })
  }
}
