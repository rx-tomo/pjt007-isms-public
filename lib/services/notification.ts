import { getDb } from '@/lib/db/drizzle/client'
import { notifications, notificationPreferences } from '@/lib/db/drizzle/schema'
import { eq, or, isNull, and, desc, sql } from 'drizzle-orm'

export type NotificationType = 'task_reminder' | 'document_approval' | 'audit_schedule' | 'risk_alert' | 'system' | 'info'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'
export type NotificationStatus = 'unread' | 'read' | 'archived'

export interface Notification {
  id: string
  organization_id: string
  user_id: string | null
  title: string
  message: string
  type: NotificationType
  priority: NotificationPriority
  status: NotificationStatus
  link?: string
  metadata?: any
  created_at: string
  read_at?: string
  archived_at?: string
}

export interface NotificationPollingOptions {
  /** Polling interval in milliseconds (default: 30000) */
  intervalMs?: number
  /** Include broadcast (user_id=null) notifications */
  includeBroadcasts?: boolean
  organizationId?: string | null
}

export interface NotificationPreferences {
  id: string
  user_id: string
  email_enabled: boolean
  app_enabled: boolean
  task_reminders: boolean
  document_approvals: boolean
  audit_schedules: boolean
  risk_alerts: boolean
  reminder_days_before: number
  created_at: string
  updated_at: string
}

export interface CreateNotificationParams {
  organization_id: string
  user_id?: string
  title: string
  message: string
  type: NotificationType
  priority?: NotificationPriority
  link?: string
  metadata?: any
}

class NotificationApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'NotificationApiError'
  }
}

function isNotificationAuthError(error: unknown) {
  return error instanceof NotificationApiError && (error.status === 401 || error.status === 403)
}

/** Map Drizzle row (camelCase) to service interface (snake_case) */
function mapNotificationRow(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    organization_id: row.organizationId,
    user_id: row.userId ?? null,
    title: row.title,
    message: row.message,
    type: row.type as NotificationType,
    priority: row.priority as NotificationPriority,
    status: row.status as NotificationStatus,
    link: row.link ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    created_at: row.createdAt,
    read_at: row.readAt ?? undefined,
    archived_at: row.archivedAt ?? undefined,
  }
}

function mapPreferencesRow(row: typeof notificationPreferences.$inferSelect): NotificationPreferences {
  return {
    id: row.id,
    user_id: row.userId,
    email_enabled: row.emailEnabled,
    app_enabled: row.appEnabled,
    task_reminders: row.taskReminders,
    document_approvals: row.documentApprovals,
    audit_schedules: row.auditSchedules,
    risk_alerts: row.riskAlerts,
    reminder_days_before: row.reminderDaysBefore,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

async function fetchNotificationsApi<T>(
  action: string,
  options?: { method?: string; body?: Record<string, unknown>; query?: Record<string, string> }
): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('fetchNotificationsApi must only be called from the browser')
  }

  const url = new URL('/api/notifications', window.location.origin)
  if (!options?.method || options.method === 'GET') {
    url.searchParams.set('action', action)
    Object.entries(options?.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value))
  }

  const response = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify({ action, ...options.body }) : undefined,
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new NotificationApiError(errorBody?.error ?? `API error ${response.status}`, response.status)
  }

  return response.json()
}

export class NotificationService {
  /**
   * 通知を作成
   */
  static async createNotification(params: CreateNotificationParams): Promise<Notification | null> {
    const db = getDb()
    const id = crypto.randomUUID()

    try {
      const rows = await db
        .insert(notifications)
        .values({
          id,
          organizationId: params.organization_id,
          userId: params.user_id || null,
          title: params.title,
          message: params.message,
          type: params.type,
          priority: params.priority || 'medium',
          link: params.link ?? null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        })
        .returning()

      const data = rows[0] ?? null
      if (!data) return null

      if (typeof window !== 'undefined' && data.id) {
        try {
          await fetch('/api/notifications/deliver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId: data.id })
          })
        } catch (deliveryError) {
          console.error('Failed to enqueue notification delivery', deliveryError)
        }
      }

      return mapNotificationRow(data)
    } catch (error) {
      console.error('Error creating notification:', error)
      return null
    }
  }

  /**
   * ユーザーの通知を取得
   */
  static async getNotifications(userId: string, status?: NotificationStatus): Promise<Notification[]> {
    if (typeof window !== 'undefined') {
      try {
        return await fetchNotificationsApi('list', {
          query: {
            userId,
            ...(status ? { status } : {}),
          },
        })
      } catch (error) {
        if (isNotificationAuthError(error)) return []
        throw error
      }
    }

    const db = getDb()

    try {
      const conditions = [
        or(eq(notifications.userId, userId), isNull(notifications.userId))
      ]

      if (status) {
        conditions.push(eq(notifications.status, status))
      }

      const rows = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))

      return rows.map(mapNotificationRow)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return []
    }
  }

  /**
   * 未読通知数を取得
   */
  static async getUnreadCount(userId: string): Promise<number> {
    if (typeof window !== 'undefined') {
      try {
        const result = await fetchNotificationsApi<{ count: number }>('unreadCount', { query: { userId } })
        return result.count
      } catch (error) {
        if (isNotificationAuthError(error)) return 0
        throw error
      }
    }

    const db = getDb()

    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            or(eq(notifications.userId, userId), isNull(notifications.userId)),
            eq(notifications.status, 'unread')
          )
        )

      return result[0]?.count ?? 0
    } catch (error) {
      console.error('Error counting unread notifications:', error)
      return 0
    }
  }

  /**
   * 通知を既読にする
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      const result = await fetchNotificationsApi<{ success: boolean }>('markAsRead', {
        method: 'POST',
        body: { notificationId },
      })
      return result.success
    }

    const db = getDb()

    try {
      await db
        .update(notifications)
        .set({
          status: 'read',
          readAt: new Date().toISOString(),
        })
        .where(eq(notifications.id, notificationId))

      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  /**
   * 複数の通知を既読にする
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      const result = await fetchNotificationsApi<{ success: boolean }>('markAllAsRead', {
        method: 'POST',
        body: { userId },
      })
      return result.success
    }

    const db = getDb()

    try {
      await db
        .update(notifications)
        .set({
          status: 'read',
          readAt: new Date().toISOString(),
        })
        .where(
          and(
            or(eq(notifications.userId, userId), isNull(notifications.userId)),
            eq(notifications.status, 'unread')
          )
        )

      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  /**
   * 通知をアーカイブ
   */
  static async archiveNotification(notificationId: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      const result = await fetchNotificationsApi<{ success: boolean }>('archive', {
        method: 'POST',
        body: { notificationId },
      })
      return result.success
    }

    const db = getDb()

    try {
      await db
        .update(notifications)
        .set({
          status: 'archived',
          archivedAt: new Date().toISOString(),
        })
        .where(eq(notifications.id, notificationId))

      return true
    } catch (error) {
      console.error('Error archiving notification:', error)
      return false
    }
  }

  /**
   * ポーリングで通知の変更を監視する。
   * 30秒間隔（設定可能）で通知一覧を取得し、コールバックに渡す。
   * 戻り値の関数を呼ぶとポーリングを停止する。
   */
  static startPolling(
    userId: string,
    onUpdate: (notifications: Notification[]) => void,
    options?: NotificationPollingOptions
  ): () => void {
    const intervalMs = options?.intervalMs ?? 30_000

    let stopped = false

    const fetchAndNotify = async () => {
      if (stopped) return
      try {
        const notifications = await NotificationService.getNotifications(userId)
        if (!stopped) {
          onUpdate(notifications)
        }
      } catch (error) {
        console.error('[NotificationService] Polling fetch failed', error)
      }
    }

    // Initial fetch
    fetchAndNotify()

    const timerId = setInterval(fetchAndNotify, intervalMs)

    return () => {
      stopped = true
      clearInterval(timerId)
    }
  }

  /**
   * ユーザーの通知設定を取得
   */
  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    if (typeof window !== 'undefined') {
      return fetchNotificationsApi<NotificationPreferences>('preferences', {
        query: { userId },
      })
    }

    const db = getDb()

    try {
      const rows = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1)

      const data = rows[0] ?? null

      // デフォルト設定を返す
      if (!data) {
        return {
          id: '',
          user_id: userId,
          email_enabled: true,
          app_enabled: true,
          task_reminders: true,
          document_approvals: true,
          audit_schedules: true,
          risk_alerts: true,
          reminder_days_before: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      return mapPreferencesRow(data)
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
      return null
    }
  }

  /**
   * ユーザーの通知設定を更新
   */
  static async updatePreferences(
    userId: string,
    preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<NotificationPreferences | null> {
    if (typeof window !== 'undefined') {
      return fetchNotificationsApi<NotificationPreferences>('updatePreferences', {
        method: 'POST',
        body: { userId, preferences },
      })
    }

    const db = getDb()

    try {
      // 既存の設定を確認
      const existing = await db
        .select({ id: notificationPreferences.id })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1)

      // Map snake_case preferences to camelCase columns
      const updatePayload: Record<string, unknown> = {}
      if (preferences.email_enabled !== undefined) updatePayload.emailEnabled = preferences.email_enabled
      if (preferences.app_enabled !== undefined) updatePayload.appEnabled = preferences.app_enabled
      if (preferences.task_reminders !== undefined) updatePayload.taskReminders = preferences.task_reminders
      if (preferences.document_approvals !== undefined) updatePayload.documentApprovals = preferences.document_approvals
      if (preferences.audit_schedules !== undefined) updatePayload.auditSchedules = preferences.audit_schedules
      if (preferences.risk_alerts !== undefined) updatePayload.riskAlerts = preferences.risk_alerts
      if (preferences.reminder_days_before !== undefined) updatePayload.reminderDaysBefore = preferences.reminder_days_before
      updatePayload.updatedAt = new Date().toISOString()

      if (existing[0]) {
        // 更新
        const rows = await db
          .update(notificationPreferences)
          .set(updatePayload)
          .where(eq(notificationPreferences.userId, userId))
          .returning()

        return rows[0] ? mapPreferencesRow(rows[0]) : null
      } else {
        // 新規作成
        const id = crypto.randomUUID()
        const rows = await db
          .insert(notificationPreferences)
          .values({
            id,
            userId,
            ...updatePayload,
          } as typeof notificationPreferences.$inferInsert)
          .returning()

        return rows[0] ? mapPreferencesRow(rows[0]) : null
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      return null
    }
  }

  /**
   * タスクリマインダー通知を作成
   */
  static async createTaskReminder(
    organizationId: string,
    userId: string,
    taskTitle: string,
    dueDate: string,
    taskId: string
  ): Promise<Notification | null> {
    return this.createNotification({
      organization_id: organizationId,
      user_id: userId,
      title: 'タスク期限リマインダー',
      message: `タスク「${taskTitle}」の期限が${dueDate}に迫っています。`,
      type: 'task_reminder',
      priority: 'high',
      link: `/tasks/${taskId}`,
      metadata: { task_id: taskId, due_date: dueDate }
    })
  }

  /**
   * 文書承認依頼通知を作成
   */
  static async createDocumentApprovalRequest(
    organizationId: string,
    approverId: string,
    documentTitle: string,
    documentId: string,
    requesterId: string
  ): Promise<Notification | null> {
    return this.createNotification({
      organization_id: organizationId,
      user_id: approverId,
      title: '文書承認依頼',
      message: `文書「${documentTitle}」の承認が必要です。`,
      type: 'document_approval',
      priority: 'high',
      link: `/documents/${documentId}`,
      metadata: { document_id: documentId, requester_id: requesterId }
    })
  }

  /**
   * 監査スケジュール通知を作成
   */
  static async createAuditScheduleNotification(
    organizationId: string,
    auditTitle: string,
    auditDate: string,
    auditId: string
  ): Promise<Notification | null> {
    return this.createNotification({
      organization_id: organizationId,
      title: '監査スケジュール',
      message: `${auditDate}に「${auditTitle}」の監査が予定されています。`,
      type: 'audit_schedule',
      priority: 'medium',
      link: `/audit/plans/${auditId}`,
      metadata: { audit_id: auditId, audit_date: auditDate }
    })
  }

  /**
   * 監査フォローアップ担当通知を作成
   */
  static async createAuditFollowUpAssignment(
    organizationId: string,
    userId: string,
    followUpTitle: string,
    followUpId: string,
    auditPlanId: string,
    nonconformityId?: string | null,
    dueDate?: string | null
  ): Promise<Notification | null> {
    const dueDateMessage = dueDate ? `期限は${dueDate}です。` : '期限を確認してください。'

    return this.createNotification({
      organization_id: organizationId,
      user_id: userId,
      title: '監査フォローアップ担当',
      message: `フォローアップ「${followUpTitle}」の担当者に設定されました。${dueDateMessage}`,
      type: 'info',
      priority: dueDate ? 'high' : 'medium',
      link: `/audit/plans/${auditPlanId}`,
      metadata: {
        follow_up_record_id: followUpId,
        audit_plan_id: auditPlanId,
        nonconformity_id: nonconformityId ?? null,
        due_date: dueDate ?? null
      }
    })
  }

  /**
   * リスクアラート通知を作成
   */
  static async createRiskAlert(
    organizationId: string,
    riskTitle: string,
    riskLevel: string,
    riskId: string
  ): Promise<Notification | null> {
    return this.createNotification({
      organization_id: organizationId,
      title: 'リスクアラート',
      message: `リスク「${riskTitle}」が${riskLevel}レベルに達しました。`,
      type: 'risk_alert',
      priority: 'urgent',
      link: `/risks/${riskId}`,
      metadata: { risk_id: riskId, risk_level: riskLevel }
    })
  }
}
