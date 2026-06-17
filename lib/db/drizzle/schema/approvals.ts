/**
 * Drizzle ORM Schema - Approvals
 *
 * SQLite-compatible schema definitions for approval workflow tables.
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
export const approvalResourceTypeValues = [
  'document',
  'audit_plan',
  'audit_report',
  'nonconformity_closure',
  'followup_record',
  'incident',
  'iso_control_soa',
  'soa_version',
] as const
export type ApprovalResourceType = (typeof approvalResourceTypeValues)[number]

export const approvalRequestStatusValues = ['pending', 'approved', 'rejected', 'expired'] as const
export type ApprovalRequestStatus = (typeof approvalRequestStatusValues)[number]

export const approvalEventTypeValues = [
  'requested',
  'approved',
  'rejected',
  'expired',
  'reminded',
  'escalated',
  'reverted',
] as const
export type ApprovalEventType = (typeof approvalEventTypeValues)[number]

export const escalationTargetTypeValues = ['user', 'role_flag', 'department_manager'] as const
export type EscalationTargetType = (typeof escalationTargetTypeValues)[number]

// =========================================
// Approval Requests Table
// =========================================
export const approvalRequests = sqliteTable(
  'approval_requests',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    status: text('status').notNull().default('pending'),
    requestedBy: text('requested_by').references(() => userProfiles.id, { onDelete: 'set null' }),
    requestedAt: text('requested_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    approverId: text('approver_id').references(() => userProfiles.id, { onDelete: 'set null' }),
    approvedAt: text('approved_at'),
    rejectionReason: text('rejection_reason'),
    dueAt: text('due_at'),
    notifiedAt: text('notified_at'),
    escalationNotifiedAt: text('escalation_notified_at'),
    stepNumber: integer('step_number'),
    revertedAt: text('reverted_at'),
    revertReason: text('revert_reason'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_approval_requests_org_status').on(table.organizationId, table.status),
    index('idx_approval_requests_resource').on(table.resourceType, table.resourceId),
    index('idx_approval_requests_due_at').on(table.dueAt),
    index('idx_approval_requests_resource_step').on(table.resourceType, table.resourceId, table.stepNumber),
    index('idx_approval_requests_reverted_at').on(table.revertedAt),
  ]
)

export type ApprovalRequest = typeof approvalRequests.$inferSelect
export type ApprovalRequestInsert = typeof approvalRequests.$inferInsert

// =========================================
// Approval Events Table
// =========================================
export const approvalEvents = sqliteTable(
  'approval_events',
  {
    id: text('id').primaryKey(),
    approvalRequestId: text('approval_request_id')
      .notNull()
      .references(() => approvalRequests.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    actorId: text('actor_id').references(() => userProfiles.id, { onDelete: 'set null' }),
    // JSONB stored as JSON string
    payload: text('payload').notNull().default('{}'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_approval_events_request_id').on(table.approvalRequestId),
    index('idx_approval_events_created_at').on(table.createdAt),
  ]
)

export type ApprovalEvent = typeof approvalEvents.$inferSelect
export type ApprovalEventInsert = typeof approvalEvents.$inferInsert

// =========================================
// Approval Escalation Rules Table
// =========================================
export const approvalEscalationRules = sqliteTable(
  'approval_escalation_rules',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    escalationTargetType: text('escalation_target_type').notNull(),
    escalationUserId: text('escalation_user_id').references(() => userProfiles.id, { onDelete: 'set null' }),
    escalationRoleFlag: text('escalation_role_flag'),
    // JSONB array stored as JSON string
    ccRoleFlags: text('cc_role_flags').notNull().default('[]'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('approval_escalation_rules_org_resource_unique').on(table.organizationId, table.resourceType),
    index('idx_approval_escalation_rules_org').on(table.organizationId),
    index('idx_approval_escalation_rules_type').on(table.resourceType),
  ]
)

export type ApprovalEscalationRule = typeof approvalEscalationRules.$inferSelect
export type ApprovalEscalationRuleInsert = typeof approvalEscalationRules.$inferInsert

// =========================================
// Relations
// =========================================
export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [approvalRequests.organizationId],
    references: [organizations.id],
  }),
  requestedByUser: one(userProfiles, {
    fields: [approvalRequests.requestedBy],
    references: [userProfiles.id],
    relationName: 'approvalRequestedBy',
  }),
  approver: one(userProfiles, {
    fields: [approvalRequests.approverId],
    references: [userProfiles.id],
    relationName: 'approvalApprover',
  }),
  events: many(approvalEvents),
}))

export const approvalEventsRelations = relations(approvalEvents, ({ one }) => ({
  approvalRequest: one(approvalRequests, {
    fields: [approvalEvents.approvalRequestId],
    references: [approvalRequests.id],
  }),
  actor: one(userProfiles, {
    fields: [approvalEvents.actorId],
    references: [userProfiles.id],
  }),
}))

export const approvalEscalationRulesRelations = relations(approvalEscalationRules, ({ one }) => ({
  organization: one(organizations, {
    fields: [approvalEscalationRules.organizationId],
    references: [organizations.id],
  }),
  escalationUser: one(userProfiles, {
    fields: [approvalEscalationRules.escalationUserId],
    references: [userProfiles.id],
  }),
}))
