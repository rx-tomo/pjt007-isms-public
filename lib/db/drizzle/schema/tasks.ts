/**
 * Drizzle ORM Schema - Tasks
 *
 * SQLite-compatible schema definitions for task-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 * - DECIMAL -> real()
 * - BOOLEAN -> integer (0/1)
 * - DATE -> TEXT (ISO date string)
 */

import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'
import { documents } from './documents'
import { risks } from './risks'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const taskStatusValues = ['todo', 'in_progress', 'review', 'done', 'cancelled'] as const
export type TaskStatus = (typeof taskStatusValues)[number]

export const taskPriorityValues = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof taskPriorityValues)[number]

export const taskReminderTypeValues = ['email', 'notification', 'both'] as const
export type TaskReminderType = (typeof taskReminderTypeValues)[number]

// =========================================
// Task Categories Table
// =========================================
export const taskCategories = sqliteTable(
  'task_categories',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    icon: text('icon'),
    displayOrder: integer('display_order').default(0),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  }
)

export type TaskCategory = typeof taskCategories.$inferSelect
export type TaskCategoryInsert = typeof taskCategories.$inferInsert

// =========================================
// Tasks Table
// =========================================
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    categoryId: text('category_id').references(() => taskCategories.id),
    assigneeId: text('assignee_id').references(() => userProfiles.id),
    reporterId: text('reporter_id').references(() => userProfiles.id),
    status: text('status').default('todo'),
    priority: text('priority').default('medium'),
    dueDate: text('due_date'),
    estimatedHours: real('estimated_hours'),
    actualHours: real('actual_hours'),
    progress: integer('progress').default(0),
    // Self-referencing FK; .references() omitted to avoid circular type inference (same pattern as organizationDepartments)
    parentTaskId: text('parent_task_id'),
    relatedDocumentId: text('related_document_id').references(() => documents.id),
    relatedRiskId: text('related_risk_id').references(() => risks.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_tasks_organization_id').on(table.organizationId),
    index('idx_tasks_assignee_id').on(table.assigneeId),
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_priority').on(table.priority),
    index('idx_tasks_due_date').on(table.dueDate),
    index('idx_tasks_org_status').on(table.organizationId, table.status),
    index('idx_tasks_org_due_date').on(table.organizationId, table.dueDate),
  ]
)

export type Task = typeof tasks.$inferSelect
export type TaskInsert = typeof tasks.$inferInsert

// =========================================
// Task Comments Table
// =========================================
export const taskComments = sqliteTable(
  'task_comments',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => userProfiles.id),
    comment: text('comment').notNull(),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_task_comments_task_id').on(table.taskId),
  ]
)

export type TaskComment = typeof taskComments.$inferSelect
export type TaskCommentInsert = typeof taskComments.$inferInsert

// =========================================
// Task Attachments Table
// =========================================
export const taskAttachments = sqliteTable(
  'task_attachments',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    uploadedBy: text('uploaded_by').references(() => userProfiles.id),
    uploadedAt: text('uploaded_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_task_attachments_task_id').on(table.taskId),
  ]
)

export type TaskAttachment = typeof taskAttachments.$inferSelect
export type TaskAttachmentInsert = typeof taskAttachments.$inferInsert

// =========================================
// Task Tags Table
// =========================================
export const taskTags = sqliteTable(
  'task_tags',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  }
)

export type TaskTag = typeof taskTags.$inferSelect
export type TaskTagInsert = typeof taskTags.$inferInsert

// =========================================
// Task Tag Relations (Junction Table)
// =========================================
export const taskTagRelations = sqliteTable(
  'task_tag_relations',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => taskTags.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index('idx_task_tag_relations_task_id').on(table.taskId),
    index('idx_task_tag_relations_tag_id').on(table.tagId),
    index('idx_task_tag_relations_order').on(table.taskId, table.displayOrder),
  ]
)

export type TaskTagRelation = typeof taskTagRelations.$inferSelect
export type TaskTagRelationInsert = typeof taskTagRelations.$inferInsert

// =========================================
// Task History Table
// =========================================
export const taskHistory = sqliteTable(
  'task_history',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => userProfiles.id),
    action: text('action').notNull(),
    fieldName: text('field_name'),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_task_history_task_id').on(table.taskId),
  ]
)

export type TaskHistory = typeof taskHistory.$inferSelect
export type TaskHistoryInsert = typeof taskHistory.$inferInsert

// =========================================
// Task Reminders Table
// =========================================
export const taskReminders = sqliteTable(
  'task_reminders',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => userProfiles.id),
    reminderDate: text('reminder_date').notNull(),
    reminderType: text('reminder_type'),
    isSent: integer('is_sent', { mode: 'boolean' }).default(false),
    sentAt: text('sent_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_task_reminders_task_id').on(table.taskId),
    index('idx_task_reminders_reminder_date').on(table.reminderDate),
  ]
)

export type TaskReminder = typeof taskReminders.$inferSelect
export type TaskReminderInsert = typeof taskReminders.$inferInsert

// =========================================
// Relations
// =========================================
export const taskCategoriesRelations = relations(taskCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [taskCategories.organizationId],
    references: [organizations.id],
  }),
  tasks: many(tasks),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  category: one(taskCategories, {
    fields: [tasks.categoryId],
    references: [taskCategories.id],
  }),
  assignee: one(userProfiles, {
    fields: [tasks.assigneeId],
    references: [userProfiles.id],
    relationName: 'taskAssignee',
  }),
  reporter: one(userProfiles, {
    fields: [tasks.reporterId],
    references: [userProfiles.id],
    relationName: 'taskReporter',
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'taskHierarchy',
  }),
  subtasks: many(tasks, {
    relationName: 'taskHierarchy',
  }),
  relatedDocument: one(documents, {
    fields: [tasks.relatedDocumentId],
    references: [documents.id],
  }),
  relatedRisk: one(risks, {
    fields: [tasks.relatedRiskId],
    references: [risks.id],
  }),
  comments: many(taskComments),
  attachments: many(taskAttachments),
  tagAssignments: many(taskTagRelations),
  history: many(taskHistory),
  reminders: many(taskReminders),
}))

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(userProfiles, {
    fields: [taskComments.userId],
    references: [userProfiles.id],
  }),
}))

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
  uploadedByUser: one(userProfiles, {
    fields: [taskAttachments.uploadedBy],
    references: [userProfiles.id],
  }),
}))

export const taskTagsRelations = relations(taskTags, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [taskTags.organizationId],
    references: [organizations.id],
  }),
  taskAssignments: many(taskTagRelations),
}))

export const taskTagRelationsRelations = relations(taskTagRelations, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTagRelations.taskId],
    references: [tasks.id],
  }),
  tag: one(taskTags, {
    fields: [taskTagRelations.tagId],
    references: [taskTags.id],
  }),
}))

export const taskHistoryRelations = relations(taskHistory, ({ one }) => ({
  task: one(tasks, {
    fields: [taskHistory.taskId],
    references: [tasks.id],
  }),
  user: one(userProfiles, {
    fields: [taskHistory.userId],
    references: [userProfiles.id],
  }),
}))

export const taskRemindersRelations = relations(taskReminders, ({ one }) => ({
  task: one(tasks, {
    fields: [taskReminders.taskId],
    references: [tasks.id],
  }),
  user: one(userProfiles, {
    fields: [taskReminders.userId],
    references: [userProfiles.id],
  }),
}))
