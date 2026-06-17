import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNotNull, like, lte, type SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { educationPlans, educationRecords, userProfiles } from '@/lib/db/drizzle/schema'
import { notifications, notificationPreferences } from '@/lib/db/drizzle/schema/notifications'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { deliverNotification } from '@/lib/server/notificationDelivery'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']
type UserProfileRow = typeof userProfiles.$inferSelect

export const runtime = 'nodejs'

const ACTIVE_PLAN_STATUSES = ['draft', 'scheduled', 'in_progress']
const ALL_TARGET_LABELS = new Set(['全社員', '全員', '全従業員', 'all', 'all employees', 'everyone'])
const REMINDER_KIND = 'education_due'
const OVERDUE_REMINDER_KIND = 'education_overdue'

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseTargetAudience(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    }
  } catch {
    // Existing plans may store this as free text.
  }
  return value
    .split(/[,\n、]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function labelMatchesUser(label: string, user: UserProfileRow) {
  if (label.startsWith('user:')) {
    return label.slice('user:'.length) === user.id
  }

  if (label.startsWith('role:')) {
    return label.slice('role:'.length) === user.role
  }

  if (label.startsWith('department:')) {
    return label.slice('department:'.length).toLowerCase() === (user.department ?? '').toLowerCase()
  }

  if (ALL_TARGET_LABELS.has(label.toLowerCase())) {
    return true
  }

  const normalized = label.toLowerCase()
  const values = [user.department, user.position, user.role, user.fullName, user.email]
    .filter((item): item is string => Boolean(item))
    .map(item => item.toLowerCase())

  return values.some(value => value.includes(normalized) || normalized.includes(value))
}

function resolveTargetUsers(targetAudience: string | null, users: UserProfileRow[]) {
  const labels = parseTargetAudience(targetAudience)
  if (labels.length === 0 || labels.some(label => ALL_TARGET_LABELS.has(label.toLowerCase()))) {
    return users
  }
  const matchedUsers = users.filter(user => labels.some(label => labelMatchesUser(label, user)))
  return matchedUsers.length > 0 ? matchedUsers : users
}

export async function POST(request: NextRequest) {
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined

  try {
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['system_operator'],
      actionName: 'education.reminders'
    })

    if (error) return error

    guardResult = guard
    if (!guard) {
      return new Response('Service role guard unavailable', { status: 500 })
    }

    const { json, logEvent } = guard
    jsonResponse = json

    const db = getDb()
    const today = startOfDay(new Date())
    const todayDate = formatDate(new Date())
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 30)
    const body = await request.json().catch(() => ({})) as {
      organizationId?: unknown
      educationPlanId?: unknown
      planId?: unknown
    }
    const requestedOrganizationId = typeof body.organizationId === 'string' && body.organizationId.trim()
      ? body.organizationId.trim()
      : null
    const requestedPlanId = typeof body.educationPlanId === 'string' && body.educationPlanId.trim()
      ? body.educationPlanId.trim()
      : typeof body.planId === 'string' && body.planId.trim()
        ? body.planId.trim()
        : null
    const planConditions: SQL[] = [
      inArray(educationPlans.status, ACTIVE_PLAN_STATUSES),
      isNotNull(educationPlans.endDate),
      lte(educationPlans.endDate, formatDate(horizon))
    ]
    if (requestedOrganizationId) {
      planConditions.push(eq(educationPlans.organizationId, requestedOrganizationId))
    }
    if (requestedPlanId) {
      planConditions.push(eq(educationPlans.id, requestedPlanId))
    }

    const plans = await db
      .select()
      .from(educationPlans)
      .where(and(...planConditions))

    if (!plans.length) {
      return json({ ok: true, remindersSent: 0, processedPlans: 0 })
    }

    const organizationIds = Array.from(
      new Set(plans.map(plan => plan.organizationId).filter((id): id is string => Boolean(id)))
    )

    if (organizationIds.length === 0) {
      return json({
        ok: true,
        remindersSent: 0,
        processedPlans: plans.length,
        skipped: plans.map(plan => ({
          educationPlanId: plan.id,
          reason: 'missing_organization'
        }))
      })
    }

    const activeUsers = await db
      .select()
      .from(userProfiles)
      .where(and(
        inArray(userProfiles.organizationId, organizationIds),
        eq(userProfiles.isActive, true)
      ))

    const planIds = plans.map(plan => plan.id)
    const records = await db
      .select()
      .from(educationRecords)
      .where(inArray(educationRecords.planId, planIds))

    const usersByOrg = new Map<string, UserProfileRow[]>()
    for (const user of activeUsers) {
      if (!user.organizationId) continue
      const current = usersByOrg.get(user.organizationId) ?? []
      current.push(user)
      usersByOrg.set(user.organizationId, current)
    }

    const recordsByPlan = new Map<string, typeof records>()
    for (const record of records) {
      if (!record.planId) continue
      const current = recordsByPlan.get(record.planId) ?? []
      current.push(record)
      recordsByPlan.set(record.planId, current)
    }

    const candidateUsers = Array.from(new Set(activeUsers.map(user => user.id)))
    const preferences = candidateUsers.length > 0
      ? await db
          .select({
            userId: notificationPreferences.userId,
            taskReminders: notificationPreferences.taskReminders,
            reminderDaysBefore: notificationPreferences.reminderDaysBefore,
          })
          .from(notificationPreferences)
          .where(inArray(notificationPreferences.userId, candidateUsers))
      : []

    const preferenceMap = new Map<string, typeof preferences[number]>()
    for (const row of preferences) {
      preferenceMap.set(row.userId, row)
    }

    const remindersSent: Array<{
      educationPlanId: string
      userId: string
      notificationId: string
      reminderKind: string
      deliveryStatus: string
    }> = []
    const skipped: Array<{ educationPlanId: string; userId?: string; reason: string }> = []

    for (const plan of plans) {
      if (!plan.organizationId || !plan.endDate) {
        skipped.push({ educationPlanId: plan.id, reason: 'missing_organization_or_end_date' })
        continue
      }

      const orgUsers = usersByOrg.get(plan.organizationId) ?? []
      const targetUsers = resolveTargetUsers(plan.targetAudience, orgUsers)
      const planRecords = recordsByPlan.get(plan.id) ?? []
      const passedUserIds = new Set(planRecords
        .filter(record => record.result === 'passed')
        .map(record => record.attendeeId)
        .filter((id): id is string => Boolean(id)))
      const incompleteUsers = targetUsers.filter(user => !passedUserIds.has(user.id))

      for (const user of incompleteUsers) {
        const pref = preferenceMap.get(user.id)
        const remindersEnabled = pref ? pref.taskReminders : true
        const reminderDays = pref?.reminderDaysBefore ?? 3

        if (!remindersEnabled) {
          skipped.push({ educationPlanId: plan.id, userId: user.id, reason: 'preferences_disabled' })
          continue
        }

        const dueDate = new Date(`${plan.endDate}T00:00:00Z`)
        const isOverdue = plan.endDate < todayDate
        const reminderKind = isOverdue ? OVERDUE_REMINDER_KIND : REMINDER_KIND
        const reminderStart = startOfDay(new Date(dueDate))
        reminderStart.setDate(reminderStart.getDate() - reminderDays)

        if (!isOverdue && today < reminderStart) {
          skipped.push({ educationPlanId: plan.id, userId: user.id, reason: 'not_within_window' })
          continue
        }

        const existing = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(
            eq(notifications.organizationId, plan.organizationId),
            eq(notifications.userId, user.id),
            eq(notifications.type, 'task_reminder'),
            like(notifications.metadata, `%${plan.id}%`),
            like(notifications.metadata, `%${reminderKind}%`)
          ))
          .limit(1)

        if (existing.length > 0) {
          skipped.push({ educationPlanId: plan.id, userId: user.id, reason: 'already_sent' })
          continue
        }

        try {
          const messageDate = new Date(plan.endDate).toLocaleDateString('ja-JP', {
            timeZone: 'Asia/Tokyo'
          })
          const notificationId = crypto.randomUUID()
          const title = isOverdue
            ? '教育・訓練期限超過'
            : '教育・訓練期限リマインダー'
          const message = isOverdue
            ? `教育計画「${plan.title}」の期限${messageDate}を過ぎています。受講状況を確認してください。`
            : `教育計画「${plan.title}」の期限が${messageDate}に迫っています。受講を完了してください。`
          const auditAction = isOverdue
            ? 'education.training.overdue_reminder_sent'
            : 'education.training.reminder_sent'

          await db.insert(notifications).values({
            id: notificationId,
            organizationId: plan.organizationId,
            userId: user.id,
            title,
            message,
            type: 'task_reminder',
            priority: isOverdue ? 'urgent' : 'high',
            link: `/education/${plan.id}`,
            metadata: JSON.stringify({
              reminder_kind: reminderKind,
              education_plan_id: plan.id,
              due_date: plan.endDate,
              reminder_days_before: reminderDays
            }),
          })

          await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            organizationId: plan.organizationId,
            userId: user.id,
            action: auditAction,
            resourceType: 'education_plan',
            resourceId: plan.id,
            changes: JSON.stringify({
              due_date: plan.endDate,
              reminder_days_before: reminderDays,
              reminder_kind: reminderKind
            }),
          })

          const delivery = await deliverNotification(notificationId)
          const deliveryStatus = delivery.ok
            ? delivery.status ?? (delivery.skipped ? `skipped:${delivery.reason ?? 'unknown'}` : 'sent')
            : delivery.reason ?? delivery.status ?? 'failed'

          remindersSent.push({
            educationPlanId: plan.id,
            userId: user.id,
            notificationId,
            reminderKind,
            deliveryStatus
          })
        } catch (reminderError) {
          console.error('[Education Reminders] failed to process plan', plan.id, reminderError)
          skipped.push({
            educationPlanId: plan.id,
            userId: user.id,
            reason: reminderError instanceof Error ? reminderError.message : 'unknown_error'
          })
        }
      }
    }

    await logEvent('success', {
      processedPlans: plans.length,
      remindersSent: remindersSent.length,
      skipped: skipped.length,
      organizationId: requestedOrganizationId,
      educationPlanId: requestedPlanId
    }, { format: 'education.reminders' })

    return json({
      ok: true,
      processedPlans: plans.length,
      remindersSent: remindersSent.length,
      reminders: remindersSent,
      skipped,
      filters: {
        organizationId: requestedOrganizationId,
        educationPlanId: requestedPlanId
      }
    })
  } catch (error) {
    console.error('[Education Reminders] failed to process request', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder =
      jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder({ error: 'Failed to process education reminders' }, { status: 500 })
  }
}
