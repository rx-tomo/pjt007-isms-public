/**
 * Drizzle ORM Schema - Audit Logs
 *
 * SQLite-compatible schema definition for the system audit_logs table.
 * This is separate from the audit management tables (audit_plans, etc.)
 * and tracks all system-wide actions for compliance and traceability.
 *
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - INET -> TEXT
 */

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================

// audit_logs.scope
export const auditLogScopeValues = ['tenant', 'global'] as const
export type AuditLogScope = (typeof auditLogScopeValues)[number]

// =========================================
// Audit Logs Table
// =========================================
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => userProfiles.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    changes: text('changes'), // JSON string (JSONB in PostgreSQL)
    ipAddress: text('ip_address'), // INET -> TEXT
    userAgent: text('user_agent'),
    scope: text('scope').notNull().default('tenant'), // auditLogScopeValues
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_audit_logs_organization_id').on(table.organizationId),
    index('idx_audit_logs_user_id').on(table.userId),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
    index('idx_audit_logs_created_at').on(table.createdAt),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_scope').on(table.scope),
  ]
)

export type AuditLog = typeof auditLogs.$inferSelect
export type AuditLogInsert = typeof auditLogs.$inferInsert

// =========================================
// Relations
// =========================================
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(userProfiles, {
    fields: [auditLogs.userId],
    references: [userProfiles.id],
  }),
}))
