/**
 * Drizzle ORM Schema - BCP
 *
 * SQLite-compatible schema definitions for business continuity plan tables.
 */

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const bcpPlanStatusValues = ['draft', 'active', 'under_review', 'archived'] as const
export type BcpPlanStatus = (typeof bcpPlanStatusValues)[number]

export const bcpScenarioTypeValues = [
  'natural_disaster',
  'cyber_attack',
  'system_failure',
  'pandemic',
  'supply_chain',
  'power_outage',
  'other',
] as const
export type BcpScenarioType = (typeof bcpScenarioTypeValues)[number]

export const bcpImpactLevelValues = ['low', 'medium', 'high', 'critical'] as const
export type BcpImpactLevel = (typeof bcpImpactLevelValues)[number]

export const bcpLikelihoodValues = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'] as const
export type BcpLikelihood = (typeof bcpLikelihoodValues)[number]

export const bcpDrillStatusValues = ['planned', 'in_progress', 'completed', 'cancelled'] as const
export type BcpDrillStatus = (typeof bcpDrillStatusValues)[number]

export const bcpPriorityValues = ['low', 'medium', 'high', 'critical'] as const
export type BcpPriority = (typeof bcpPriorityValues)[number]

// =========================================
// BCP Plans Table
// =========================================
export const bcpPlans = sqliteTable(
  'bcp_plans',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    scope: text('scope'),
    status: text('status').notNull().default('draft'),
    version: text('version').default('1.0'),
    lastReviewedAt: text('last_reviewed_at'),
    nextReviewDate: text('next_review_date'),
    createdBy: text('created_by').references(() => userProfiles.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_bcp_plans_organization_id').on(table.organizationId),
    index('idx_bcp_plans_status').on(table.status),
  ]
)

export type BcpPlan = typeof bcpPlans.$inferSelect
export type BcpPlanInsert = typeof bcpPlans.$inferInsert

// =========================================
// BCP Scenarios Table
// =========================================
export const bcpScenarios = sqliteTable(
  'bcp_scenarios',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => bcpPlans.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    scenarioType: text('scenario_type').notNull(),
    impactLevel: text('impact_level').notNull(),
    likelihood: text('likelihood').notNull(),
    responseProcedure: text('response_procedure'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_bcp_scenarios_plan_id').on(table.planId),
    index('idx_bcp_scenarios_organization_id').on(table.organizationId),
  ]
)

export type BcpScenario = typeof bcpScenarios.$inferSelect
export type BcpScenarioInsert = typeof bcpScenarios.$inferInsert

// =========================================
// BCP Drills Table
// =========================================
export const bcpDrills = sqliteTable(
  'bcp_drills',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => bcpPlans.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    scheduledDate: text('scheduled_date').notNull(),
    conductedDate: text('conducted_date'),
    status: text('status').notNull().default('planned'),
    participants: text('participants'),
    result: text('result'),
    findings: text('findings'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_bcp_drills_plan_id').on(table.planId),
    index('idx_bcp_drills_organization_id').on(table.organizationId),
    index('idx_bcp_drills_status').on(table.status),
  ]
)

export type BcpDrill = typeof bcpDrills.$inferSelect
export type BcpDrillInsert = typeof bcpDrills.$inferInsert

// =========================================
// BCP Recovery Objectives Table
// =========================================
export const bcpRecoveryObjectives = sqliteTable(
  'bcp_recovery_objectives',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => bcpPlans.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    targetSystem: text('target_system').notNull(),
    rtoHours: text('rto_hours').notNull(),
    rpoHours: text('rpo_hours').notNull(),
    priority: text('priority').notNull().default('medium'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_bcp_recovery_objectives_plan_id').on(table.planId),
    index('idx_bcp_recovery_objectives_organization_id').on(table.organizationId),
  ]
)

export type BcpRecoveryObjective = typeof bcpRecoveryObjectives.$inferSelect
export type BcpRecoveryObjectiveInsert = typeof bcpRecoveryObjectives.$inferInsert

// =========================================
// Relations
// =========================================
export const bcpPlansRelations = relations(bcpPlans, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bcpPlans.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [bcpPlans.createdBy],
    references: [userProfiles.id],
  }),
  scenarios: many(bcpScenarios),
  drills: many(bcpDrills),
  recoveryObjectives: many(bcpRecoveryObjectives),
}))

export const bcpScenariosRelations = relations(bcpScenarios, ({ one }) => ({
  plan: one(bcpPlans, {
    fields: [bcpScenarios.planId],
    references: [bcpPlans.id],
  }),
  organization: one(organizations, {
    fields: [bcpScenarios.organizationId],
    references: [organizations.id],
  }),
}))

export const bcpDrillsRelations = relations(bcpDrills, ({ one }) => ({
  plan: one(bcpPlans, {
    fields: [bcpDrills.planId],
    references: [bcpPlans.id],
  }),
  organization: one(organizations, {
    fields: [bcpDrills.organizationId],
    references: [organizations.id],
  }),
}))

export const bcpRecoveryObjectivesRelations = relations(
  bcpRecoveryObjectives,
  ({ one }) => ({
    plan: one(bcpPlans, {
      fields: [bcpRecoveryObjectives.planId],
      references: [bcpPlans.id],
    }),
    organization: one(organizations, {
      fields: [bcpRecoveryObjectives.organizationId],
      references: [organizations.id],
    }),
  })
)
