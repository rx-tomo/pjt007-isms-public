/**
 * Drizzle ORM Schema - Commercial offboarding
 *
 * Tracks contract-end retention, early deletion requests, and deletion evidence.
 */

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

export const deletionRequestStatusValues = ['requested', 'confirmed', 'scheduled', 'processing', 'completed', 'failed', 'cancelled'] as const
export type DeletionRequestStatus = (typeof deletionRequestStatusValues)[number]

export const deletionRequestSourceValues = ['customer_early_request', 'contract_end_retention', 'support_ops'] as const
export type DeletionRequestSource = (typeof deletionRequestSourceValues)[number]

export const deletionRunResultValues = ['success', 'partial_failure', 'failed'] as const
export type DeletionRunResult = (typeof deletionRunResultValues)[number]

export const organizationDeletionRequests = sqliteTable(
  'organization_deletion_requests',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    requesterId: text('requester_id').references(() => userProfiles.id),
    requestedAt: text('requested_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    reason: text('reason'),
    source: text('source').notNull().default('customer_early_request'),
    status: text('status').notNull().default('requested'),
    confirmedBy: text('confirmed_by').references(() => userProfiles.id),
    confirmedAt: text('confirmed_at'),
    executionScheduledAt: text('execution_scheduled_at'),
    customerNotice: text('customer_notice'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_org_deletion_requests_org').on(table.organizationId),
    index('idx_org_deletion_requests_status').on(table.status),
    index('idx_org_deletion_requests_scheduled').on(table.executionScheduledAt),
  ]
)

export const organizationDeletionRuns = sqliteTable(
  'organization_deletion_runs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    deletionRequestId: text('deletion_request_id').references(() => organizationDeletionRequests.id, { onDelete: 'set null' }),
    scope: text('scope').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    result: text('result').notNull(),
    errorSummary: text('error_summary'),
    customerEvidence: text('customer_evidence'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_org_deletion_runs_org').on(table.organizationId),
    index('idx_org_deletion_runs_request').on(table.deletionRequestId),
    index('idx_org_deletion_runs_result').on(table.result),
  ]
)

export type OrganizationDeletionRequest = typeof organizationDeletionRequests.$inferSelect
export type OrganizationDeletionRequestInsert = typeof organizationDeletionRequests.$inferInsert
export type OrganizationDeletionRun = typeof organizationDeletionRuns.$inferSelect
export type OrganizationDeletionRunInsert = typeof organizationDeletionRuns.$inferInsert

export const organizationDeletionRequestsRelations = relations(organizationDeletionRequests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationDeletionRequests.organizationId],
    references: [organizations.id],
  }),
  requester: one(userProfiles, {
    fields: [organizationDeletionRequests.requesterId],
    references: [userProfiles.id],
  }),
  runs: many(organizationDeletionRuns),
}))

export const organizationDeletionRunsRelations = relations(organizationDeletionRuns, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationDeletionRuns.organizationId],
    references: [organizations.id],
  }),
  request: one(organizationDeletionRequests, {
    fields: [organizationDeletionRuns.deletionRequestId],
    references: [organizationDeletionRequests.id],
  }),
}))
