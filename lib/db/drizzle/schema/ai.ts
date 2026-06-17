/**
 * Drizzle ORM Schema - AI
 *
 * SQLite-compatible schema definitions for AI-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - boolean -> integer (0/1)
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const suggestionTypeValues = ['threat', 'vulnerability', 'impact', 'likelihood', 'treatment'] as const
export type SuggestionType = (typeof suggestionTypeValues)[number]

export const requestTypeValues = ['risk_identification', 'risk_assessment', 'treatment_suggestion'] as const
export type RequestType = (typeof requestTypeValues)[number]

export const suggestionDecisionValues = ['draft', 'accepted', 'accepted_with_edits', 'rejected', 'expired'] as const
export type SuggestionDecision = (typeof suggestionDecisionValues)[number]

export const alertLevelValues = ['warning', 'critical', 'exceeded'] as const
export type AlertLevel = (typeof alertLevelValues)[number]

// =========================================
// AI Suggestions Table
// =========================================
export const aiSuggestions = sqliteTable(
  'ai_suggestions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    riskId: text('risk_id'),
    suggestionType: text('suggestion_type').notNull(),
    inputContext: text('input_context').notNull(),
    inputScope: text('input_scope'),
    suggestionContent: text('suggestion_content').notNull(),
    decisionStatus: text('decision_status').notNull().default('draft'),
    finalContent: text('final_content'),
    decisionReason: text('decision_reason'),
    accepted: integer('accepted'),
    acceptedAt: text('accepted_at'),
    acceptedBy: text('accepted_by'),
    usageLogId: text('usage_log_id'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_ai_suggestions_org').on(table.organizationId),
    index('idx_ai_suggestions_risk').on(table.riskId),
    index('idx_ai_suggestions_decision_status').on(table.decisionStatus),
    index('idx_ai_suggestions_usage_log').on(table.usageLogId),
  ]
)

export type AISuggestionRow = typeof aiSuggestions.$inferSelect
export type AISuggestionInsert = typeof aiSuggestions.$inferInsert

// =========================================
// AI Usage Logs Table
// =========================================
export const aiUsageLogs = sqliteTable(
  'ai_usage_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    userId: text('user_id'),
    provider: text('provider').notNull(),
    providerMode: text('provider_mode').notNull().default('mock'),
    modelLabel: text('model_label'),
    requestType: text('request_type').notNull(),
    status: text('status').notNull().default('succeeded'),
    inputScope: text('input_scope'),
    targetRecords: text('target_records'),
    redactionSummary: text('redaction_summary'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    cached: integer('cached'),
    latencyMs: integer('latency_ms'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_ai_usage_logs_org').on(table.organizationId),
    index('idx_ai_usage_logs_user').on(table.userId),
    index('idx_ai_usage_logs_created').on(table.createdAt),
    index('idx_ai_usage_logs_status').on(table.status),
    index('idx_ai_usage_logs_provider_mode').on(table.providerMode),
  ]
)

export type AIUsageLogRow = typeof aiUsageLogs.$inferSelect
export type AIUsageLogInsert = typeof aiUsageLogs.$inferInsert

// =========================================
// AI Alerts Table
// =========================================
export const aiAlerts = sqliteTable(
  'ai_alerts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    threshold: real('threshold').notNull(),
    currentUsage: integer('current_usage').notNull(),
    limitValue: integer('limit_value').notNull(),
    percentage: real('percentage').notNull(),
    alertLevel: text('alert_level').notNull(),
    message: text('message').notNull(),
    messageJa: text('message_ja').notNull(),
    month: text('month').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_ai_alerts_org').on(table.organizationId),
    index('idx_ai_alerts_month').on(table.organizationId, table.month),
  ]
)

export type AIAlertRow = typeof aiAlerts.$inferSelect
export type AIAlertInsert = typeof aiAlerts.$inferInsert
