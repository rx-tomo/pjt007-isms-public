import { getDb } from '@/lib/db/drizzle/client'
import {
  notifications,
  notificationPreferences,
} from '@/lib/db/drizzle/schema/notifications'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq } from 'drizzle-orm'
import { EmailService } from '@/lib/services/email'
import { createPendingEmailLog, finalizeEmailLog } from '@/lib/server/emailLogs'
import {
  listChannels,
  logDeliveryAttempt,
  updateChannelStatus,
  type NotificationChannel,
  type NotificationChannelLogInsert,
} from '@/lib/services/notificationChannels'

type DeliveryResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  status?: 'sent' | 'failed'
  emailLogId?: string
  message?: string
  channelResults?: ExternalChannelDeliveryResult[]
}

type ExternalChannelDeliveryResult = {
  channel_id: string
  channel_type: NotificationChannel['channelType']
  notification_type: string
  attempts: number
  status: 'sent' | 'failed'
  last_error?: string | null
}

type NotificationRow = {
  id: string
  organizationId: string
  userId: string | null
  title: string
  message: string
  type: string
  link: string | null
}

type NotificationPreferencesRow = {
  emailEnabled: boolean
  taskReminders: boolean
  documentApprovals: boolean
  auditSchedules: boolean
  riskAlerts: boolean
}

type UserProfileRow = {
  email: string | null
  fullName: string | null
  languagePreference: string | null
}

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007').replace(/\/$/, '')
const EXTERNAL_DELIVERY_ENABLED = !['false', '0', 'no'].includes(
  (process.env.NOTIFICATION_EXTERNAL_DELIVERY_ENABLED ?? '').toLowerCase()
)
const EXTERNAL_MAX_ATTEMPTS = Math.max(
  1,
  Number.isNaN(Number(process.env.NOTIFICATION_EXTERNAL_MAX_ATTEMPTS))
    ? 3
    : Number(process.env.NOTIFICATION_EXTERNAL_MAX_ATTEMPTS)
)
const EXTERNAL_RETRY_DELAY_MS = Math.max(
  0,
  Number.isNaN(Number(process.env.NOTIFICATION_EXTERNAL_RETRY_DELAY_MS))
    ? 250
    : Number(process.env.NOTIFICATION_EXTERNAL_RETRY_DELAY_MS)
)

function buildActionUrl(link: string | null) {
  if (!link) return null
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link
  }
  return `${APP_BASE_URL}${link.startsWith('/') ? link : `/${link}`}`
}

function shouldSendEmail(
  type: string,
  preferences: NotificationPreferencesRow | null
) {
  const effective: NotificationPreferencesRow =
    preferences ?? {
      emailEnabled: true,
      taskReminders: true,
      documentApprovals: true,
      auditSchedules: true,
      riskAlerts: true
    }

  if (!effective.emailEnabled) return false

  switch (type) {
    case 'task_reminder':
      return effective.taskReminders
    case 'document_approval':
      return effective.documentApprovals
    case 'audit_schedule':
      return effective.auditSchedules
    case 'risk_alert':
      return effective.riskAlerts
    default:
      return true
  }
}

async function deliverViaEmailService(
  notificationId: string,
  providedEmailLogId?: string
): Promise<DeliveryResult> {
  const db = getDb()
  const providedLogId = providedEmailLogId ?? null

  // Finalize a caller-provided pending email_logs row on skip so it never
  // lingers as 'pending'. Without a provided row there is nothing to record
  // for pre-send skips: email_logs requires recipient data (user_id NOT NULL,
  // to_email) that is unavailable in those cases.
  const skip = async (reason: string): Promise<DeliveryResult> => {
    await finalizeEmailLog(providedLogId, { status: 'skipped', errorMessage: reason })
    return {
      ok: true,
      skipped: true,
      reason,
      emailLogId: providedLogId ?? undefined,
    }
  }

  const notificationRows = await db
    .select({
      id: notifications.id,
      organizationId: notifications.organizationId,
      userId: notifications.userId,
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      link: notifications.link,
    })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1)

  const notification = notificationRows[0]
  if (!notification) {
    return skip('missing_notification')
  }

  if (!notification.userId) {
    return skip('no_recipient')
  }

  const prefRows = await db
    .select({
      emailEnabled: notificationPreferences.emailEnabled,
      taskReminders: notificationPreferences.taskReminders,
      documentApprovals: notificationPreferences.documentApprovals,
      auditSchedules: notificationPreferences.auditSchedules,
      riskAlerts: notificationPreferences.riskAlerts,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, notification.userId))
    .limit(1)

  const preferences = prefRows[0] ?? null

  if (!shouldSendEmail(notification.type, preferences)) {
    return skip('preferences')
  }

  const profileRows = await db
    .select({
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      languagePreference: userProfiles.languagePreference,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, notification.userId))
    .limit(1)

  const profile = profileRows[0]
  if (!profile?.email) {
    return skip('no_email')
  }

  const actionUrl = buildActionUrl(notification.link)

  // Email log lifecycle: reuse the caller-provided pending row when present,
  // otherwise create our own so every send attempt is recorded.
  const emailLogId =
    providedLogId ??
    (await createPendingEmailLog({
      notificationId: notification.id,
      userId: notification.userId,
      toEmail: profile.email,
      subject: notification.title,
    }))

  const emailService = new EmailService()

  try {
    const sendResult = await emailService.sendNotificationEmail({
      to: profile.email,
      subject: notification.title,
      message: notification.message,
      actionUrl: actionUrl ?? undefined,
      locale: profile.languagePreference === 'en' ? 'en' : 'ja',
      recipientName: profile.fullName ?? null
    })

    if (sendResult?.delivered === false) {
      await finalizeEmailLog(emailLogId, {
        status: 'skipped',
        errorMessage: sendResult.reason,
      })
      return {
        ok: true,
        skipped: true,
        reason: sendResult.reason,
        emailLogId: emailLogId ?? undefined,
      }
    }

    await finalizeEmailLog(emailLogId, { status: 'sent' })
    return { ok: true, status: 'sent', emailLogId: emailLogId ?? undefined }
  } catch (error) {
    console.error('[NotificationDelivery] EmailService fallback failed', error)
    const message = error instanceof Error ? error.message : String(error)
    await finalizeEmailLog(emailLogId, { status: 'failed', errorMessage: message })
    return {
      ok: false,
      status: 'failed',
      message,
      emailLogId: emailLogId ?? undefined,
    }
  }
}

async function sendWebhookRequest(
  url: string,
  body: unknown,
  customHeaders?: Record<string, string> | null
): Promise<{ status: number; ok: boolean; bodyText: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  const bodyText = await response.text().catch(() => '')
  return { status: response.status, ok: response.ok, bodyText }
}

function buildChannelPayload(
  channel: NotificationChannel,
  notification: NotificationRow,
  actionUrl: string | null
) {
  const actionSection = actionUrl ? `\n\n${actionUrl}` : ''
  const text = `${notification.title}\n${notification.message}${actionSection}`

  if (channel.channelType === 'slack') {
    return { text }
  }

  if (channel.channelType === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: notification.title,
      themeColor: '0072C6',
      title: notification.title,
      text
    }
  }

  if (channel.channelType === 'custom') {
    const template = channel.customPayloadTemplate
      ? (JSON.parse(channel.customPayloadTemplate) as Record<string, unknown>)
      : null
    if (template) {
      return replacePlaceholders(template, {
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: actionUrl || '',
        timestamp: new Date().toISOString(),
        notification_id: notification.id,
        organization_id: notification.organizationId
      })
    }
    return {
      event: 'notification',
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: actionUrl,
      timestamp: new Date().toISOString(),
      notification_id: notification.id,
      organization_id: notification.organizationId
    }
  }

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    summary: notification.title,
    themeColor: '0072C6',
    title: notification.title,
    text
  }
}

function replacePlaceholders(
  template: Record<string, unknown>,
  values: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(template)) {
    if (typeof value === 'string') {
      let replaced = value
      for (const [placeholder, replacement] of Object.entries(values)) {
        replaced = replaced.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), replacement)
      }
      result[key] = replaced
    } else if (typeof value === 'object' && value !== null) {
      result[key] = replacePlaceholders(value as Record<string, unknown>, values)
    } else {
      result[key] = value
    }
  }
  return result
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function deliverChannel(
  channel: NotificationChannel,
  notification: NotificationRow,
): Promise<ExternalChannelDeliveryResult> {
  const actionUrl = buildActionUrl(notification.link)
  let attempts = 0
  let lastError: string | null = null
  let finalStatus: 'sent' | 'failed' = 'failed'

  while (attempts < EXTERNAL_MAX_ATTEMPTS) {
    attempts += 1
    try {
      const payload = buildChannelPayload(channel, notification, actionUrl)
      const customHeaders = channel.customHeaders
        ? (JSON.parse(channel.customHeaders) as Record<string, string>)
        : null
      const { ok, status, bodyText } = await sendWebhookRequest(channel.webhookUrl, payload, customHeaders)
      const logPayload: NotificationChannelLogInsert = {
        channelId: channel.id,
        notificationId: notification.id,
        status: ok ? 'sent' : 'failed',
        attempt: attempts,
        responseStatus: status,
        responseBody: bodyText,
        errorMessage: ok ? null : `HTTP ${status}`,
        details: JSON.stringify({
          notification_type: notification.type,
          channel_type: channel.channelType,
          notification_id: notification.id
        })
      }
      await logDeliveryAttempt(logPayload)

      if (!ok) {
        lastError = `HTTP ${status}`
        if (attempts < EXTERNAL_MAX_ATTEMPTS && EXTERNAL_RETRY_DELAY_MS > 0) {
          await delay(EXTERNAL_RETRY_DELAY_MS)
        }
        continue
      }

      finalStatus = 'sent'
      lastError = null
      break
    } catch (err) {
      attempts = Math.min(attempts, EXTERNAL_MAX_ATTEMPTS)
      lastError = err instanceof Error ? err.message : String(err)
      await logDeliveryAttempt(
        {
          channelId: channel.id,
          notificationId: notification.id,
          status: 'failed',
          attempt: attempts,
          errorMessage: lastError,
          details: JSON.stringify({
            notification_type: notification.type,
            channel_type: channel.channelType,
            notification_id: notification.id
          })
        },
      )

      if (attempts < EXTERNAL_MAX_ATTEMPTS && EXTERNAL_RETRY_DELAY_MS > 0) {
        await delay(EXTERNAL_RETRY_DELAY_MS)
      }
    }
  }

  const recordedFailureCount = finalStatus === 'sent' ? 0 : (channel.failureCount ?? 0) + 1
  await updateChannelStatus(
    channel.id,
    {
      last_status: finalStatus,
      last_attempted_at: new Date().toISOString(),
      failure_count: recordedFailureCount,
      last_error: finalStatus === 'sent' ? null : lastError
    },
  )

  return {
    channel_id: channel.id,
    channel_type: channel.channelType,
    notification_type: notification.type,
    attempts,
    status: finalStatus,
    last_error: lastError
  }
}

async function deliverExternalChannels(
  notificationId: string,
): Promise<ExternalChannelDeliveryResult[]> {
  if (!EXTERNAL_DELIVERY_ENABLED) {
    return []
  }

  const db = getDb()
  const notificationRows = await db
    .select({
      id: notifications.id,
      organizationId: notifications.organizationId,
      userId: notifications.userId,
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      link: notifications.link,
    })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1)

  const notification = notificationRows[0]
  if (!notification || !notification.organizationId) {
    return []
  }

  const channels = await listChannels(notification.organizationId)
  const targets = channels.filter(
    channel => channel.isEnabled && channel.notificationType === notification.type
  )

  const results: ExternalChannelDeliveryResult[] = []
  for (const target of targets) {
    const result = await deliverChannel(target, notification)
    results.push(result)
  }

  return results
}

export async function deliverNotification(
  notificationId: string,
  options?: { emailLogId?: string }
): Promise<DeliveryResult> {
  const emailResult = await deliverViaEmailService(notificationId, options?.emailLogId)

  const channelResults = await deliverExternalChannels(notificationId).catch(err => {
    console.error('[NotificationDelivery] External channel delivery failed', err)
    return []
  })

  return {
    ...emailResult,
    channelResults
  }
}
