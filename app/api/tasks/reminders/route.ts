import { NextRequest, NextResponse } from 'next/server'
import { deliverNotification } from '@/lib/server/notificationDelivery'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { tasks, taskReminders } from '@/lib/db/drizzle/schema/tasks'
import { notifications } from '@/lib/db/drizzle/schema/notifications'
import { notificationPreferences } from '@/lib/db/drizzle/schema/notifications'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { eq, and, inArray, gte, lte, isNotNull } from 'drizzle-orm'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

export const runtime = 'nodejs'

const ACTIVE_STATUSES = ['todo', 'in_progress', 'review']

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
      actionName: 'tasks.reminders'
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

    // Load tasks with active statuses, assignee, and due date within range
    const taskList = await db
      .select({
        id: tasks.id,
        organizationId: tasks.organizationId,
        title: tasks.title,
        dueDate: tasks.dueDate,
        status: tasks.status,
        assigneeId: tasks.assigneeId,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.status, ACTIVE_STATUSES),
          isNotNull(tasks.assigneeId),
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, formatDate(today)),
          lte(tasks.dueDate, formatDate(horizon))
        )
      )

    if (!taskList.length) {
      return json({ ok: true, remindersSent: 0, processedTasks: 0 })
    }

    const assigneeIds = Array.from(
      new Set(taskList.map(task => task.assigneeId).filter((id): id is string => Boolean(id)))
    )

    // Load notification preferences
    const preferencesData = await db
      .select({
        userId: notificationPreferences.userId,
        emailEnabled: notificationPreferences.emailEnabled,
        taskReminders: notificationPreferences.taskReminders,
        documentApprovals: notificationPreferences.documentApprovals,
        auditSchedules: notificationPreferences.auditSchedules,
        riskAlerts: notificationPreferences.riskAlerts,
        reminderDaysBefore: notificationPreferences.reminderDaysBefore,
      })
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, assigneeIds))

    const preferenceMap = new Map<string, typeof preferencesData[number]>()
    for (const row of preferencesData) {
      if (row.userId) preferenceMap.set(row.userId, row)
    }

    // Load already-sent reminders
    const taskIds = taskList.map(task => task.id)
    const reminderRows = await db
      .select({
        taskId: taskReminders.taskId,
        userId: taskReminders.userId,
        sentAt: taskReminders.sentAt,
      })
      .from(taskReminders)
      .where(
        and(
          inArray(taskReminders.taskId, taskIds),
          eq(taskReminders.isSent, true)
        )
      )

    const sentLookup = new Set(
      reminderRows.map(row => `${row.taskId}:${row.userId}`)
    )

    const remindersSent: Array<{
      taskId: string
      notificationId: string
      deliveryStatus: string
    }> = []
    const skipped: Array<{
      taskId: string
      reason: string
    }> = []

    for (const task of taskList) {
      if (!task.assigneeId || !task.dueDate) {
        skipped.push({ taskId: task.id, reason: 'missing_assignee_or_due_date' })
        continue
      }

      const pref = preferenceMap.get(task.assigneeId)
      const remindersEnabled = pref ? pref.taskReminders : true
      const reminderDays = pref?.reminderDaysBefore ?? 3

      if (!remindersEnabled) {
        skipped.push({ taskId: task.id, reason: 'preferences_disabled' })
        continue
      }

      const dueDate = new Date(`${task.dueDate}T00:00:00Z`)
      const reminderStart = startOfDay(new Date(dueDate))
      reminderStart.setDate(reminderStart.getDate() - reminderDays)

      if (today < reminderStart) {
        skipped.push({ taskId: task.id, reason: 'not_within_window' })
        continue
      }

      if (sentLookup.has(`${task.id}:${task.assigneeId}`)) {
        skipped.push({ taskId: task.id, reason: 'already_sent' })
        continue
      }

      try {
        const messageDate = new Date(task.dueDate).toLocaleDateString('ja-JP', {
          timeZone: 'Asia/Tokyo'
        })
        const message = `タスク「${task.title}」の期限が${messageDate}に迫っています。`

        const notificationId = crypto.randomUUID()
        await db.insert(notifications).values({
          id: notificationId,
          organizationId: task.organizationId!,
          userId: task.assigneeId,
          title: 'タスク期限リマインダー',
          message,
          type: 'task_reminder',
          priority: 'high',
          link: `/tasks/${task.id}`,
          metadata: JSON.stringify({
            task_id: task.id,
            due_date: task.dueDate,
            reminder_days_before: reminderDays
          }),
        })

        const nowIso = new Date().toISOString()

        try {
          await db.insert(taskReminders).values({
            id: crypto.randomUUID(),
            taskId: task.id,
            userId: task.assigneeId,
            reminderDate: nowIso,
            reminderType: 'both',
            isSent: true,
            sentAt: nowIso,
          })
          sentLookup.add(`${task.id}:${task.assigneeId}`)
        } catch (reminderLogError) {
          console.error('[Task Reminders] failed to record task_reminders entry', reminderLogError)
        }

        try {
          await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            organizationId: task.organizationId!,
            userId: task.assigneeId,
            action: 'task.reminder_sent',
            resourceType: 'task',
            resourceId: task.id,
            changes: JSON.stringify({
              due_date: task.dueDate,
              reminder_days_before: reminderDays
            }),
          })
        } catch (auditLogError) {
          console.error('[Task Reminders] failed to write audit log', auditLogError)
        }

        const delivery = await deliverNotification(notificationId)
        const deliveryStatus = delivery.ok
          ? delivery.status ?? (delivery.skipped ? `skipped:${delivery.reason ?? 'unknown'}` : 'sent')
          : delivery.reason ?? delivery.status ?? 'failed'

        remindersSent.push({
          taskId: task.id,
          notificationId,
          deliveryStatus
        })
      } catch (error) {
        console.error('[Task Reminders] failed to process task', task.id, error)
        skipped.push({
          taskId: task.id,
          reason: error instanceof Error ? error.message : 'unknown_error'
        })
      }
    }

    await logEvent('success', {
      processedTasks: taskList.length,
      remindersSent: remindersSent.length,
      skipped: skipped.length
    }, { format: 'tasks.reminders' })

    return json({
      ok: true,
      processedTasks: taskList.length,
      remindersSent: remindersSent.length,
      reminders: remindersSent,
      skipped
    })
  } catch (error) {
    console.error('[Task Reminders] failed to process request', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder =
      jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder({ error: 'Failed to process task reminders' }, { status: 500 })
  }
}
