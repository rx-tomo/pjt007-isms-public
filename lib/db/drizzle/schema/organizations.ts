/**
 * Drizzle ORM Schema - Organizations
 *
 * SQLite-compatible schema definitions for organization-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - Array types -> TEXT (JSON array string)
 * - INET -> TEXT
 */

import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const employeeCountRangeValues = ['1-50', '51-100', '101-300', '301-1000', '1000+'] as const
export type EmployeeCountRange = (typeof employeeCountRangeValues)[number]

export const isoCertificationStatusValues = ['certified', 'in_progress', 'planning', 'not_planned'] as const
export type IsoCertificationStatus = (typeof isoCertificationStatusValues)[number]

export const subscriptionPlanValues = ['trial', 'starter', 'standard', 'enterprise'] as const
export type SubscriptionPlan = (typeof subscriptionPlanValues)[number]

export const subscriptionStatusValues = ['active', 'inactive', 'suspended', 'cancelled'] as const
export type SubscriptionStatus = (typeof subscriptionStatusValues)[number]

export const organizationDeletionStatusValues = ['active', 'retention', 'early_requested', 'scheduled', 'processing', 'deleted', 'failed'] as const
export type OrganizationDeletionStatus = (typeof organizationDeletionStatusValues)[number]

export const ismsPhaseValues = [
  'initial',
  'surveillance'
] as const
export type IsmsPhase = (typeof ismsPhaseValues)[number]

export const phaseHistorySourceValues = ['wizard', 'settings', 'system'] as const
export type PhaseHistorySource = (typeof phaseHistorySourceValues)[number]

// =========================================
// Organizations Table
// =========================================
export const organizations = sqliteTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    employeeCountRange: text('employee_count_range'),
    industry: text('industry'),
    isoCertificationStatus: text('iso_certification_status'),
    subscriptionPlan: text('subscription_plan').default('trial'),
    subscriptionStatus: text('subscription_status').default('active'),
    ismsPhase: text('isms_phase'),
    ismsPhaseSetAt: text('isms_phase_set_at'),
    trialEndsAt: text('trial_ends_at'),
    createdAt: text('created_at'),
    aiConfig: text('ai_config'),  // JSON string of AIFeatureConfig
    updatedAt: text('updated_at'),
    deletedAt: text('deleted_at'), // Soft-delete timestamp (null = active)
    endedAt: text('ended_at'),
    retentionUntil: text('retention_until'),
    deletionScheduledAt: text('deletion_scheduled_at'),
    deletionStatus: text('deletion_status').notNull().default('active'),
  },
  (table) => [
    index('idx_organizations_subscription_status').on(table.subscriptionStatus),
    index('idx_organizations_created_at').on(table.createdAt),
    index('idx_organizations_deleted_at').on(table.deletedAt),
    index('idx_organizations_deletion_status').on(table.deletionStatus),
    index('idx_organizations_deletion_scheduled_at').on(table.deletionScheduledAt),
  ]
)

export type Organization = typeof organizations.$inferSelect
export type OrganizationInsert = typeof organizations.$inferInsert

// =========================================
// Organization ISMS Scopes Table
// =========================================
export const organizationIsmsScopes = sqliteTable(
  'organization_isms_scopes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Array fields stored as JSON strings
    physicalLocations: text('physical_locations').notNull().default('[]'),
    itSystems: text('it_systems').notNull().default('[]'),
    departments: text('departments').notNull().default('[]'),
    processes: text('processes').notNull().default('[]'),
    exclusions: text('exclusions').notNull().default('[]'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => [
    uniqueIndex('organization_isms_scopes_unique_org').on(table.organizationId),
    index('idx_organization_isms_scopes_org').on(table.organizationId),
  ]
)

export type OrganizationIsmsScope = typeof organizationIsmsScopes.$inferSelect
export type OrganizationIsmsScopeInsert = typeof organizationIsmsScopes.$inferInsert

// =========================================
// Organization Departments Table
// =========================================
export const organizationDepartments = sqliteTable(
  'organization_departments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    parentDepartmentId: text('parent_department_id'),
    manager: text('manager'),
    description: text('description'),
    memberCount: integer('member_count').default(0),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('idx_organization_departments_org').on(table.organizationId),
    index('idx_organization_departments_parent').on(table.parentDepartmentId),
  ]
)

export type OrganizationDepartment = typeof organizationDepartments.$inferSelect
export type OrganizationDepartmentInsert = typeof organizationDepartments.$inferInsert

// =========================================
// Project Roles Table
// =========================================
export const projectRoles = sqliteTable(
  'project_roles',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    description: text('description'),
    // Array stored as JSON string
    responsibilities: text('responsibilities'),
    displayOrder: integer('display_order').default(0),
    isRequired: integer('is_required', { mode: 'boolean' }).default(false),
    seedSource: text('seed_source'),
    seededAt: text('seeded_at'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => [
    uniqueIndex('project_roles_key_unique').on(table.organizationId, table.key),
    index('idx_project_roles_org').on(table.organizationId),
    index('idx_project_roles_display_order').on(table.organizationId, table.displayOrder),
  ]
)

export type ProjectRole = typeof projectRoles.$inferSelect
export type ProjectRoleInsert = typeof projectRoles.$inferInsert

// =========================================
// Project Assignments Table
// =========================================
export const projectAssignments = sqliteTable(
  'project_assignments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => projectRoles.id, { onDelete: 'cascade' }),
    // One of userId or invitationId must be set (checked at application level)
    userId: text('user_id'),
    invitationId: text('invitation_id'),
    assignedBy: text('assigned_by'),
    note: text('note'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('idx_project_assignments_org').on(table.organizationId),
    index('idx_project_assignments_role').on(table.roleId),
    index('idx_project_assignments_user').on(table.userId),
    index('idx_project_assignments_invitation').on(table.invitationId),
  ]
)

export type ProjectAssignment = typeof projectAssignments.$inferSelect
export type ProjectAssignmentInsert = typeof projectAssignments.$inferInsert

// =========================================
// Organization Phase History Table
// =========================================
export const organizationPhaseHistory = sqliteTable(
  'organization_phase_history',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(),
    source: text('source').notNull().default('system'),
    changedBy: text('changed_by'),
    notes: text('notes'),
    recordedAt: text('recorded_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_organization_phase_history_org').on(table.organizationId, table.recordedAt),
  ]
)

export type OrganizationPhaseHistory = typeof organizationPhaseHistory.$inferSelect
export type OrganizationPhaseHistoryInsert = typeof organizationPhaseHistory.$inferInsert

// =========================================
// Organization Structure Snapshots Table
// =========================================
export const organizationStructureSnapshots = sqliteTable(
  'organization_structure_snapshots',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    snapshotName: text('snapshot_name').notNull(),
    snapshotPayload: text('snapshot_payload').notNull(), // JSON string
    createdBy: text('created_by'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_org_snapshots_org').on(table.organizationId),
    index('idx_org_snapshots_created').on(table.createdAt),
  ]
)

export type OrganizationStructureSnapshot = typeof organizationStructureSnapshots.$inferSelect
export type OrganizationStructureSnapshotInsert = typeof organizationStructureSnapshots.$inferInsert

// =========================================
// Relations
// =========================================
export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  ismsScope: one(organizationIsmsScopes, {
    fields: [organizations.id],
    references: [organizationIsmsScopes.organizationId],
  }),
  departments: many(organizationDepartments),
  projectRoles: many(projectRoles),
  projectAssignments: many(projectAssignments),
  phaseHistory: many(organizationPhaseHistory),
  structureSnapshots: many(organizationStructureSnapshots),
}))

export const organizationIsmsScopesRelations = relations(organizationIsmsScopes, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationIsmsScopes.organizationId],
    references: [organizations.id],
  }),
}))

export const organizationDepartmentsRelations = relations(organizationDepartments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationDepartments.organizationId],
    references: [organizations.id],
  }),
  parent: one(organizationDepartments, {
    fields: [organizationDepartments.parentDepartmentId],
    references: [organizationDepartments.id],
    relationName: 'departmentHierarchy',
  }),
  children: many(organizationDepartments, {
    relationName: 'departmentHierarchy',
  }),
}))

export const projectRolesRelations = relations(projectRoles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectRoles.organizationId],
    references: [organizations.id],
  }),
  assignments: many(projectAssignments),
}))

export const projectAssignmentsRelations = relations(projectAssignments, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectAssignments.organizationId],
    references: [organizations.id],
  }),
  role: one(projectRoles, {
    fields: [projectAssignments.roleId],
    references: [projectRoles.id],
  }),
}))

export const organizationPhaseHistoryRelations = relations(organizationPhaseHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationPhaseHistory.organizationId],
    references: [organizations.id],
  }),
}))

export const organizationStructureSnapshotsRelations = relations(organizationStructureSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationStructureSnapshots.organizationId],
    references: [organizations.id],
  }),
}))

// =========================================
// Helper functions for JSON array fields
// =========================================
export function parseJsonArray(value: string | null, fieldName?: string): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      console.warn(`[parseJsonArray] Expected array but got ${typeof parsed}${fieldName ? ` for field: ${fieldName}` : ''}`)
      return []
    }
    return parsed
  } catch (error) {
    console.warn(`[parseJsonArray] Failed to parse JSON${fieldName ? ` for field: ${fieldName}` : ''}:`, error)
    return []
  }
}

export function stringifyJsonArray(value: string[]): string {
  return JSON.stringify(value)
}
