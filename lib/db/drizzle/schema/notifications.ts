/**
 * Drizzle ORM Schema - Notifications
 *
 * SQLite-compatible schema definitions for notification-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 * - BOOLEAN -> integer (0/1)
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const notificationTypeValues = [
  'task_reminder',
  'document_approval',
  'audit_schedule',
  'risk_alert',
  'system',
  'info',
] as const
export type NotificationType = (typeof notificationTypeValues)[number]

export const notificationPriorityValues = ['low', 'medium', 'high', 'urgent'] as const
export type NotificationPriority = (typeof notificationPriorityValues)[number]

export const notificationStatusValues = ['unread', 'read', 'archived'] as const
export type NotificationStatus = (typeof notificationStatusValues)[number]

// 'skipped' = delivery was intentionally not attempted (e.g. RESEND_API_KEY missing,
// no recipient / preference opt-out). The column is plain TEXT without a CHECK
// constraint, so adding a value requires no migration.
export const emailLogStatusValues = ['pending', 'sent', 'failed', 'skipped'] as const
export type EmailLogStatus = (typeof emailLogStatusValues)[number]

export const notificationChannelTypeValues = ['slack', 'teams', 'custom'] as const
export type NotificationChannelType = (typeof notificationChannelTypeValues)[number]

export const channelLogStatusValues = ['pending', 'sent', 'failed'] as const
export type ChannelLogStatus = (typeof channelLogStatusValues)[number]

// =========================================
// Notifications Table
// =========================================
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .references(() => userProfiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull(),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('unread'),
    link: text('link'),
    metadata: text('metadata'), // JSON string
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    readAt: text('read_at'),
    archivedAt: text('archived_at'),
  },
  (table) => [
    index('idx_notifications_user_id').on(table.userId),
    index('idx_notifications_status').on(table.status),
    index('idx_notifications_created_at').on(table.createdAt),
    index('idx_notifications_org_id').on(table.organizationId),
  ]
)

export type Notification = typeof notifications.$inferSelect
export type NotificationInsert = typeof notifications.$inferInsert

// =========================================
// Notification Preferences Table
// =========================================
export const notificationPreferences = sqliteTable(
  'notification_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'cascade' })
      .unique(),
    emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(true),
    appEnabled: integer('app_enabled', { mode: 'boolean' }).notNull().default(true),
    taskReminders: integer('task_reminders', { mode: 'boolean' }).notNull().default(true),
    documentApprovals: integer('document_approvals', { mode: 'boolean' }).notNull().default(true),
    auditSchedules: integer('audit_schedules', { mode: 'boolean' }).notNull().default(true),
    riskAlerts: integer('risk_alerts', { mode: 'boolean' }).notNull().default(true),
    reminderDaysBefore: integer('reminder_days_before').notNull().default(3),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_notification_preferences_user_id').on(table.userId),
  ]
)

export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NotificationPreferenceInsert = typeof notificationPreferences.$inferInsert

// =========================================
// Email Logs Table
// =========================================
export const emailLogs = sqliteTable(
  'email_logs',
  {
    id: text('id').primaryKey(),
    notificationId: text('notification_id')
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'cascade' }),
    toEmail: text('to_email').notNull(),
    subject: text('subject').notNull(),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    sentAt: text('sent_at'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_email_logs_notification_id').on(table.notificationId),
    index('idx_email_logs_status').on(table.status),
  ]
)

export type EmailLog = typeof emailLogs.$inferSelect
export type EmailLogInsert = typeof emailLogs.$inferInsert

// =========================================
// Organization Notification Channels Table
// =========================================
export const organizationNotificationChannels = sqliteTable(
  'organization_notification_channels',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    notificationType: text('notification_type').notNull(),
    channelType: text('channel_type').notNull(),
    webhookUrl: text('webhook_url').notNull(),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    lastStatus: text('last_status'),
    lastAttemptedAt: text('last_attempted_at'),
    failureCount: integer('failure_count').notNull().default(0),
    lastError: text('last_error'),
    customPayloadTemplate: text('custom_payload_template'), // JSON string
    customHeaders: text('custom_headers'), // JSON string
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_notification_channels_org').on(table.organizationId),
    index('idx_notification_channels_type').on(table.notificationType),
  ]
)

export type OrganizationNotificationChannel = typeof organizationNotificationChannels.$inferSelect
export type OrganizationNotificationChannelInsert = typeof organizationNotificationChannels.$inferInsert

// =========================================
// Organization Notification Channel Logs Table
// =========================================
export const organizationNotificationChannelLogs = sqliteTable(
  'organization_notification_channel_logs',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => organizationNotificationChannels.id, { onDelete: 'cascade' }),
    notificationId: text('notification_id')
      .references(() => notifications.id, { onDelete: 'set null' }),
    status: text('status').notNull(),
    attempt: integer('attempt').notNull(),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    details: text('details'), // JSON string
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_notification_channel_logs_channel').on(table.channelId),
    index('idx_notification_channel_logs_notification').on(table.notificationId),
    index('idx_notification_channel_logs_status').on(table.status),
  ]
)

export type OrganizationNotificationChannelLog = typeof organizationNotificationChannelLogs.$inferSelect
export type OrganizationNotificationChannelLogInsert = typeof organizationNotificationChannelLogs.$inferInsert

// =========================================
// Relations
// =========================================
export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(userProfiles, {
    fields: [notifications.userId],
    references: [userProfiles.id],
  }),
  emailLogs: many(emailLogs),
  channelLogs: many(organizationNotificationChannelLogs),
}))

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(userProfiles, {
    fields: [notificationPreferences.userId],
    references: [userProfiles.id],
  }),
}))

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  notification: one(notifications, {
    fields: [emailLogs.notificationId],
    references: [notifications.id],
  }),
  user: one(userProfiles, {
    fields: [emailLogs.userId],
    references: [userProfiles.id],
  }),
}))

export const organizationNotificationChannelsRelations = relations(
  organizationNotificationChannels,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationNotificationChannels.organizationId],
      references: [organizations.id],
    }),
    logs: many(organizationNotificationChannelLogs),
  })
)

export const organizationNotificationChannelLogsRelations = relations(
  organizationNotificationChannelLogs,
  ({ one }) => ({
    channel: one(organizationNotificationChannels, {
      fields: [organizationNotificationChannelLogs.channelId],
      references: [organizationNotificationChannels.id],
    }),
    notification: one(notifications, {
      fields: [organizationNotificationChannelLogs.notificationId],
      references: [notifications.id],
    }),
  })
)
