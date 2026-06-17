/**
 * Drizzle ORM Schema - Management Reviews
 *
 * SQLite-compatible schema definitions for management review tables.
 * Includes: management_reviews, management_review_items, management_review_actions
 *
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================

// management_reviews.status
export const managementReviewStatusValues = ['planned', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const
export type ManagementReviewStatus = (typeof managementReviewStatusValues)[number]

// management_review_items.item_type
export const reviewItemTypeValues = ['input', 'discussion', 'decision', 'output'] as const
export type ReviewItemType = (typeof reviewItemTypeValues)[number]

// management_review_actions.status
export const reviewActionStatusValues = ['open', 'in_progress', 'completed', 'overdue', 'cancelled'] as const
export type ReviewActionStatus = (typeof reviewActionStatusValues)[number]

// =========================================
// Management Reviews Table
// =========================================
export const managementReviews = sqliteTable(
  'management_reviews',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    reviewDate: text('review_date').notNull(),
    status: text('status').notNull().default('planned'), // managementReviewStatusValues
    agenda: text('agenda'), // JSON string of agenda items
    participants: text('participants'), // JSON string of participant user IDs
    location: text('location'),
    minutes: text('minutes'),
    conclusions: text('conclusions'),
    createdBy: text('created_by').references(() => userProfiles.id),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_management_reviews_organization_id').on(table.organizationId),
    index('idx_management_reviews_status').on(table.status),
    index('idx_management_reviews_review_date').on(table.reviewDate),
  ]
)

export type ManagementReview = typeof managementReviews.$inferSelect
export type ManagementReviewInsert = typeof managementReviews.$inferInsert

// =========================================
// Management Review Items Table
// =========================================
export const managementReviewItems = sqliteTable(
  'management_review_items',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id')
      .notNull()
      .references(() => managementReviews.id, { onDelete: 'cascade' }),
    itemType: text('item_type').notNull(), // reviewItemTypeValues
    title: text('title').notNull(),
    description: text('description'),
    relatedArea: text('related_area'), // 'risk', 'audit', 'incident', 'policy'
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_management_review_items_review_id').on(table.reviewId),
    index('idx_management_review_items_item_type').on(table.itemType),
  ]
)

export type ManagementReviewItem = typeof managementReviewItems.$inferSelect
export type ManagementReviewItemInsert = typeof managementReviewItems.$inferInsert

// =========================================
// Management Review Actions Table
// =========================================
export const managementReviewActions = sqliteTable(
  'management_review_actions',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id')
      .notNull()
      .references(() => managementReviews.id, { onDelete: 'cascade' }),
    reviewItemId: text('review_item_id')
      .references(() => managementReviewItems.id),
    title: text('title').notNull(),
    description: text('description'),
    assigneeId: text('assignee_id').references(() => userProfiles.id),
    dueDate: text('due_date'),
    status: text('status').notNull().default('open'), // reviewActionStatusValues
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_management_review_actions_review_id').on(table.reviewId),
    index('idx_management_review_actions_assignee_id').on(table.assigneeId),
    index('idx_management_review_actions_status').on(table.status),
    index('idx_management_review_actions_due_date').on(table.dueDate),
  ]
)

export type ManagementReviewAction = typeof managementReviewActions.$inferSelect
export type ManagementReviewActionInsert = typeof managementReviewActions.$inferInsert

// =========================================
// Relations
// =========================================
export const managementReviewsRelations = relations(managementReviews, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [managementReviews.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [managementReviews.createdBy],
    references: [userProfiles.id],
  }),
  items: many(managementReviewItems),
  actions: many(managementReviewActions),
}))

export const managementReviewItemsRelations = relations(managementReviewItems, ({ one, many }) => ({
  review: one(managementReviews, {
    fields: [managementReviewItems.reviewId],
    references: [managementReviews.id],
  }),
  actions: many(managementReviewActions),
}))

export const managementReviewActionsRelations = relations(managementReviewActions, ({ one }) => ({
  review: one(managementReviews, {
    fields: [managementReviewActions.reviewId],
    references: [managementReviews.id],
  }),
  reviewItem: one(managementReviewItems, {
    fields: [managementReviewActions.reviewItemId],
    references: [managementReviewItems.id],
  }),
  assignee: one(userProfiles, {
    fields: [managementReviewActions.assigneeId],
    references: [userProfiles.id],
  }),
}))
