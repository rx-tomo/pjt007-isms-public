import { and, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  notificationPreferences,
  notifications,
  taskReminders,
  tasks,
  userMemberships,
} from '@/lib/db/drizzle/schema'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
} from '@/lib/server/auth/authorizationContext'

export interface AccessibleTask {
  id: string
  organizationId: string
  title: string
  authorization: TenantAuthorizationContext
}

/**
 * Resolves a task's tenant before authorizing the session user against that tenant.
 * Missing tasks, organization-less tasks, inactive profiles/memberships, and foreign
 * tenants intentionally collapse to null so child routes can return the same 404.
 */
export async function getAccessibleTaskForUser(
  db: ReturnType<typeof getDb>,
  taskId: string,
  userId: string
): Promise<AccessibleTask | null> {
  const [task] = await db
    .select({
      id: tasks.id,
      organizationId: tasks.organizationId,
      title: tasks.title,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task?.organizationId) {
    return null
  }

  const authorization = await resolveTenantAuthorizationContext(
    db,
    userId,
    task.organizationId
  )
  if (!authorization.ok) {
    return null
  }

  return {
    id: task.id,
    organizationId: task.organizationId,
    title: task.title,
    authorization: authorization.context,
  }
}

const ACTIVE_TASK_STATUSES = ['todo', 'in_progress', 'review']

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

interface ReminderDeliveryResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  status?: 'sent' | 'failed'
}

export interface TaskReminderProcessingResult {
  processedTasks: number
  eligibleTasks: number
  remindersSent: number
  reminders: Array<{
    taskId: string
    notificationId: string
    deliveryStatus: string
  }>
  skipped: Array<{
    taskId: string
    reason: string
  }>
}

export async function processTaskReminders(params: {
  db: ReturnType<typeof getDb>
  actorUserId: string
  now?: Date
  deliver: (notificationId: string) => Promise<ReminderDeliveryResult>
}): Promise<TaskReminderProcessingResult> {
  const { db, actorUserId, deliver } = params
  const today = startOfDay(params.now ?? new Date())
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + 30)

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
    .where(and(
      inArray(tasks.status, ACTIVE_TASK_STATUSES),
      isNotNull(tasks.assigneeId),
      isNotNull(tasks.dueDate),
      gte(tasks.dueDate, formatDate(today)),
      lte(tasks.dueDate, formatDate(horizon))
    ))

  if (!taskList.length) {
    return {
      processedTasks: 0,
      eligibleTasks: 0,
      remindersSent: 0,
      reminders: [],
      skipped: [],
    }
  }

  const assigneeIds = Array.from(
    new Set(taskList.map(task => task.assigneeId).filter((id): id is string => Boolean(id)))
  )
  const activeMemberships = await db
    .select({
      userId: userMemberships.userId,
      organizationId: userMemberships.organizationId,
    })
    .from(userMemberships)
    .where(and(
      inArray(userMemberships.userId, assigneeIds),
      eq(userMemberships.status, 'active')
    ))
  const activePairs = new Set(
    activeMemberships.map(row => `${row.organizationId}:${row.userId}`)
  )

  const skipped: TaskReminderProcessingResult['skipped'] = []
  const eligibleTasks = taskList.filter(task => {
    if (
      !task.organizationId ||
      !task.assigneeId ||
      !activePairs.has(`${task.organizationId}:${task.assigneeId}`)
    ) {
      skipped.push({
        taskId: task.id,
        reason: 'assignee_not_active_in_task_organization',
      })
      return false
    }
    return true
  })

  if (!eligibleTasks.length) {
    return {
      processedTasks: taskList.length,
      eligibleTasks: 0,
      remindersSent: 0,
      reminders: [],
      skipped,
    }
  }

  const eligibleAssigneeIds = Array.from(new Set(eligibleTasks.map(task => task.assigneeId!)))
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
    .where(inArray(notificationPreferences.userId, eligibleAssigneeIds))

  const preferenceMap = new Map<string, typeof preferencesData[number]>()
  for (const row of preferencesData) {
    if (row.userId) preferenceMap.set(row.userId, row)
  }

  const reminderRows = await db
    .select({
      taskId: taskReminders.taskId,
      userId: taskReminders.userId,
      sentAt: taskReminders.sentAt,
    })
    .from(taskReminders)
    .where(and(
      inArray(taskReminders.taskId, eligibleTasks.map(task => task.id)),
      eq(taskReminders.isSent, true)
    ))
  const sentLookup = new Set(reminderRows.map(row => `${row.taskId}:${row.userId}`))
  const reminders: TaskReminderProcessingResult['reminders'] = []

  for (const task of eligibleTasks) {
    const assigneeId = task.assigneeId!
    const organizationId = task.organizationId!
    const dueDateValue = task.dueDate!
    const pref = preferenceMap.get(assigneeId)
    const remindersEnabled = pref ? pref.taskReminders : true
    const reminderDays = pref?.reminderDaysBefore ?? 3

    if (!remindersEnabled) {
      skipped.push({ taskId: task.id, reason: 'preferences_disabled' })
      continue
    }

    const dueDate = new Date(`${dueDateValue}T00:00:00Z`)
    const reminderStart = startOfDay(new Date(dueDate))
    reminderStart.setDate(reminderStart.getDate() - reminderDays)
    if (today < reminderStart) {
      skipped.push({ taskId: task.id, reason: 'not_within_window' })
      continue
    }
    if (sentLookup.has(`${task.id}:${assigneeId}`)) {
      skipped.push({ taskId: task.id, reason: 'already_sent' })
      continue
    }

    try {
      const messageDate = new Date(dueDateValue).toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo'
      })
      const notificationId = crypto.randomUUID()
      await db.insert(notifications).values({
        id: notificationId,
        organizationId,
        userId: assigneeId,
        title: 'タスク期限リマインダー',
        message: `タスク「${task.title}」の期限が${messageDate}に迫っています。`,
        type: 'task_reminder',
        priority: 'high',
        link: `/tasks/${task.id}`,
        metadata: JSON.stringify({
          task_id: task.id,
          due_date: dueDateValue,
          reminder_days_before: reminderDays
        }),
      })

      const nowIso = new Date().toISOString()
      try {
        await db.insert(taskReminders).values({
          id: crypto.randomUUID(),
          taskId: task.id,
          userId: assigneeId,
          reminderDate: nowIso,
          reminderType: 'both',
          isSent: true,
          sentAt: nowIso,
        })
        sentLookup.add(`${task.id}:${assigneeId}`)
      } catch (reminderLogError) {
        console.error('[Task Reminders] failed to record task_reminders entry', reminderLogError)
      }

      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId,
          userId: actorUserId,
          action: 'task.reminder_sent',
          resourceType: 'task',
          resourceId: task.id,
          changes: JSON.stringify({
            due_date: dueDateValue,
            reminder_days_before: reminderDays
          }),
        })
      } catch (auditLogError) {
        console.error('[Task Reminders] failed to write audit log', auditLogError)
      }

      const delivery = await deliver(notificationId)
      const deliveryStatus = delivery.ok
        ? delivery.status ?? (delivery.skipped ? `skipped:${delivery.reason ?? 'unknown'}` : 'sent')
        : delivery.reason ?? delivery.status ?? 'failed'
      reminders.push({ taskId: task.id, notificationId, deliveryStatus })
    } catch (error) {
      console.error('[Task Reminders] failed to process task', task.id, error)
      skipped.push({
        taskId: task.id,
        reason: error instanceof Error ? error.message : 'unknown_error'
      })
    }
  }

  return {
    processedTasks: taskList.length,
    eligibleTasks: eligibleTasks.length,
    remindersSent: reminders.length,
    reminders,
    skipped,
  }
}
