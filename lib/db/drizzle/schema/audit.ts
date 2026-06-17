/**
 * Drizzle ORM Schema - Audit
 *
 * SQLite-compatible schema definitions for audit management tables.
 * Includes: audit_plans, audit_units, audit_checklists, audit_evidence,
 *           audit_reports, audit_team_members, nonconformities,
 *           corrective_actions, follow_up_records, iso27001_requirements
 *
 * Note: audit_period_statistics is a VIEW in PostgreSQL.
 * It is not represented here as a table — compute at the application/query layer.
 *
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 * - GENERATED ALWAYS AS -> regular column (computed at app layer)
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================

// audit_plans.audit_type
export const auditTypeValues = ['internal', 'external', 'certification', 'surveillance'] as const
export type AuditType = (typeof auditTypeValues)[number]

// audit_plans.status
export const auditPlanStatusValues = ['planning', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const
export type AuditPlanStatus = (typeof auditPlanStatusValues)[number]

// audit_team_members.role
export const auditTeamRoleValues = ['lead', 'auditor', 'observer'] as const
export type AuditTeamRole = (typeof auditTeamRoleValues)[number]

// audit_checklists.status
export const checklistStatusValues = ['not_started', 'in_progress', 'completed'] as const
export type ChecklistStatus = (typeof checklistStatusValues)[number]

// audit_checklists.result
export const checklistResultValues = ['conformity', 'minor_nc', 'major_nc', 'observation', 'not_applicable'] as const
export type ChecklistResult = (typeof checklistResultValues)[number]

// nonconformities.type
export const nonconformityTypeValues = ['major', 'minor'] as const
export type NonconformityType = (typeof nonconformityTypeValues)[number]

// nonconformities.status
export const nonconformityStatusValues = ['open', 'in_progress', 'resolved', 'closed', 'verified'] as const
export type NonconformityStatus = (typeof nonconformityStatusValues)[number]

// corrective_actions.status
export const correctiveActionStatusValues = ['planned', 'in_progress', 'completed', 'verified'] as const
export type CorrectiveActionStatus = (typeof correctiveActionStatusValues)[number]

// follow_up_records.status
export const followUpStatusValues = ['open', 'in_progress', 'completed', 'verified', 'closed'] as const
export type FollowUpStatus = (typeof followUpStatusValues)[number]

// audit_units.unit_type
export const auditUnitTypeValues = ['site', 'process'] as const
export type AuditUnitType = (typeof auditUnitTypeValues)[number]

// audit_reports.approval_status
export const reportApprovalStatusValues = ['draft', 'submitted', 'approved', 'rejected'] as const
export type ReportApprovalStatus = (typeof reportApprovalStatusValues)[number]

// =========================================
// ISO 27001 Requirements Table
// =========================================
export const iso27001Requirements = sqliteTable(
  'iso27001_requirements',
  {
    id: text('id').primaryKey(),
    clauseNumber: text('clause_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    parentId: text('parent_id'),
    isApplicable: integer('is_applicable', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  () => []
)

export type Iso27001Requirement = typeof iso27001Requirements.$inferSelect
export type Iso27001RequirementInsert = typeof iso27001Requirements.$inferInsert

// =========================================
// Audit Units Table
// =========================================
export const auditUnits = sqliteTable(
  'audit_units',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    unitType: text('unit_type').notNull(), // auditUnitTypeValues
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('audit_units_org_name_unique').on(table.organizationId, table.name),
    index('idx_audit_units_organization_id').on(table.organizationId),
    index('idx_audit_units_unit_type').on(table.unitType),
  ]
)

export type AuditUnit = typeof auditUnits.$inferSelect
export type AuditUnitInsert = typeof auditUnits.$inferInsert

// =========================================
// Audit Plans Table
// =========================================
export const auditPlans = sqliteTable(
  'audit_plans',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    auditType: text('audit_type'), // auditTypeValues
    standard: text('standard').default('ISO27001'),
    plannedStartDate: text('planned_start_date'),
    plannedEndDate: text('planned_end_date'),
    actualStartDate: text('actual_start_date'),
    actualEndDate: text('actual_end_date'),
    leadAuditorId: text('lead_auditor_id').references(() => userProfiles.id),
    status: text('status').default('planning'), // auditPlanStatusValues
    // GENERATED ALWAYS AS (FY/Q calculation) in PostgreSQL
    // Computed at application layer from planned_start_date / actual_start_date
    auditPeriod: text('audit_period'),
    auditedUnitId: text('audited_unit_id').references(() => auditUnits.id),
    auditorSignature: text('auditor_signature'),
    auditorSignedAt: text('auditor_signed_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_audit_plans_organization_id').on(table.organizationId),
    index('idx_audit_plans_status').on(table.status),
    index('idx_audit_plans_audit_period').on(table.auditPeriod),
    index('idx_audit_plans_audited_unit_id').on(table.auditedUnitId),
  ]
)

export type AuditPlan = typeof auditPlans.$inferSelect
export type AuditPlanInsert = typeof auditPlans.$inferInsert

// =========================================
// Audit Team Members Table
// =========================================
export const auditTeamMembers = sqliteTable(
  'audit_team_members',
  {
    id: text('id').primaryKey(),
    auditPlanId: text('audit_plan_id').references(() => auditPlans.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => userProfiles.id),
    role: text('role'), // auditTeamRoleValues
    assignedAt: text('assigned_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_audit_team_members_plan').on(table.auditPlanId),
    index('idx_audit_team_members_user').on(table.userId),
  ]
)

export type AuditTeamMember = typeof auditTeamMembers.$inferSelect
export type AuditTeamMemberInsert = typeof auditTeamMembers.$inferInsert

// =========================================
// Audit Checklists Table
// =========================================
export const auditChecklists = sqliteTable(
  'audit_checklists',
  {
    id: text('id').primaryKey(),
    auditPlanId: text('audit_plan_id').references(() => auditPlans.id, { onDelete: 'cascade' }),
    requirementId: text('requirement_id').references(() => iso27001Requirements.id),
    checkItem: text('check_item').notNull(),
    evidenceRequired: text('evidence_required'),
    auditorId: text('auditor_id').references(() => userProfiles.id),
    status: text('status').default('not_started'), // checklistStatusValues
    result: text('result'), // checklistResultValues
    findings: text('findings'),
    evidenceProvided: text('evidence_provided'),
    reviewedAt: text('reviewed_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_audit_checklists_audit_plan_id').on(table.auditPlanId),
    index('idx_audit_checklists_requirement_id').on(table.requirementId),
    index('idx_audit_checklists_status').on(table.status),
  ]
)

export type AuditChecklist = typeof auditChecklists.$inferSelect
export type AuditChecklistInsert = typeof auditChecklists.$inferInsert

// =========================================
// Nonconformities Table
// =========================================
export const nonconformities = sqliteTable(
  'nonconformities',
  {
    id: text('id').primaryKey(),
    auditChecklistId: text('audit_checklist_id').references(() => auditChecklists.id, { onDelete: 'cascade' }),
    ncNumber: text('nc_number').notNull().unique(),
    type: text('type'), // nonconformityTypeValues
    description: text('description').notNull(),
    rootCause: text('root_cause'),
    correctiveAction: text('corrective_action'),
    preventiveAction: text('preventive_action'),
    responsibleId: text('responsible_id').references(() => userProfiles.id),
    dueDate: text('due_date'),
    status: text('status').default('open'), // nonconformityStatusValues
    resolutionDate: text('resolution_date'),
    verificationDate: text('verification_date'),
    verifiedBy: text('verified_by').references(() => userProfiles.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_nonconformities_audit_checklist_id').on(table.auditChecklistId),
    index('idx_nonconformities_status').on(table.status),
  ]
)

export type Nonconformity = typeof nonconformities.$inferSelect
export type NonconformityInsert = typeof nonconformities.$inferInsert

// =========================================
// Corrective Actions Table
// =========================================
export const correctiveActions = sqliteTable(
  'corrective_actions',
  {
    id: text('id').primaryKey(),
    nonconformityId: text('nonconformity_id').references(() => nonconformities.id, { onDelete: 'cascade' }),
    actionDescription: text('action_description').notNull(),
    responsibleId: text('responsible_id').references(() => userProfiles.id),
    plannedDate: text('planned_date'),
    completionDate: text('completion_date'),
    status: text('status').default('planned'), // correctiveActionStatusValues
    effectivenessReview: text('effectiveness_review'),
    reviewedBy: text('reviewed_by').references(() => userProfiles.id),
    reviewedAt: text('reviewed_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_corrective_actions_nonconformity_id').on(table.nonconformityId),
  ]
)

export type CorrectiveAction = typeof correctiveActions.$inferSelect
export type CorrectiveActionInsert = typeof correctiveActions.$inferInsert

// =========================================
// Audit Reports Table
// =========================================
export const auditReports = sqliteTable(
  'audit_reports',
  {
    id: text('id').primaryKey(),
    auditPlanId: text('audit_plan_id').references(() => auditPlans.id, { onDelete: 'cascade' }),
    executiveSummary: text('executive_summary'),
    scope: text('scope'),
    methodology: text('methodology'),
    positiveFindings: text('positive_findings'),
    improvementOpportunities: text('improvement_opportunities'),
    conclusion: text('conclusion'),
    reportDate: text('report_date'),
    // approved_by was converted to TEXT and FK dropped in migration 20251015093000
    approvedBy: text('approved_by'),
    approvedAt: text('approved_at'),
    approvalStatus: text('approval_status').notNull().default('draft'), // reportApprovalStatusValues
    rejectionReason: text('rejection_reason'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_audit_reports_audit_plan_id').on(table.auditPlanId),
    index('idx_audit_reports_approval_status').on(table.approvalStatus),
  ]
)

export type AuditReport = typeof auditReports.$inferSelect
export type AuditReportInsert = typeof auditReports.$inferInsert

// =========================================
// Audit Evidence Table
// =========================================
export const auditEvidence = sqliteTable(
  'audit_evidence',
  {
    id: text('id').primaryKey(),
    auditChecklistId: text('audit_checklist_id').references(() => auditChecklists.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    description: text('description'),
    uploadedBy: text('uploaded_by').references(() => userProfiles.id),
    uploadedAt: text('uploaded_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_audit_evidence_audit_checklist_id').on(table.auditChecklistId),
  ]
)

export type AuditEvidenceRow = typeof auditEvidence.$inferSelect
export type AuditEvidenceInsert = typeof auditEvidence.$inferInsert

// =========================================
// Follow-up Records Table
// =========================================
export const followUpRecords = sqliteTable(
  'follow_up_records',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    auditPlanId: text('audit_plan_id')
      .notNull()
      .references(() => auditPlans.id, { onDelete: 'cascade' }),
    nonconformityId: text('nonconformity_id').references(() => nonconformities.id),
    title: text('title').notNull(),
    description: text('description'),
    assignedTo: text('assigned_to').references(() => userProfiles.id),
    status: text('status').notNull().default('open'), // followUpStatusValues
    dueDate: text('due_date'),
    completedAt: text('completed_at'),
    verifiedAt: text('verified_at'),
    verifiedBy: text('verified_by').references(() => userProfiles.id),
    createdBy: text('created_by')
      .notNull()
      .references(() => userProfiles.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_follow_up_records_org').on(table.organizationId),
    index('idx_follow_up_records_plan').on(table.auditPlanId),
    index('idx_follow_up_records_status').on(table.status),
  ]
)

export type FollowUpRecord = typeof followUpRecords.$inferSelect
export type FollowUpRecordInsert = typeof followUpRecords.$inferInsert

// =========================================
// Relations
// =========================================
export const iso27001RequirementsRelations = relations(iso27001Requirements, ({ one, many }) => ({
  parent: one(iso27001Requirements, {
    fields: [iso27001Requirements.parentId],
    references: [iso27001Requirements.id],
    relationName: 'requirementHierarchy',
  }),
  children: many(iso27001Requirements, {
    relationName: 'requirementHierarchy',
  }),
  checklists: many(auditChecklists),
}))

export const auditUnitsRelations = relations(auditUnits, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [auditUnits.organizationId],
    references: [organizations.id],
  }),
  auditPlans: many(auditPlans),
}))

export const auditPlansRelations = relations(auditPlans, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [auditPlans.organizationId],
    references: [organizations.id],
  }),
  leadAuditor: one(userProfiles, {
    fields: [auditPlans.leadAuditorId],
    references: [userProfiles.id],
  }),
  auditedUnit: one(auditUnits, {
    fields: [auditPlans.auditedUnitId],
    references: [auditUnits.id],
  }),
  teamMembers: many(auditTeamMembers),
  checklists: many(auditChecklists),
  reports: many(auditReports),
  followUpRecords: many(followUpRecords),
}))

export const auditTeamMembersRelations = relations(auditTeamMembers, ({ one }) => ({
  auditPlan: one(auditPlans, {
    fields: [auditTeamMembers.auditPlanId],
    references: [auditPlans.id],
  }),
  user: one(userProfiles, {
    fields: [auditTeamMembers.userId],
    references: [userProfiles.id],
  }),
}))

export const auditChecklistsRelations = relations(auditChecklists, ({ one, many }) => ({
  auditPlan: one(auditPlans, {
    fields: [auditChecklists.auditPlanId],
    references: [auditPlans.id],
  }),
  requirement: one(iso27001Requirements, {
    fields: [auditChecklists.requirementId],
    references: [iso27001Requirements.id],
  }),
  auditor: one(userProfiles, {
    fields: [auditChecklists.auditorId],
    references: [userProfiles.id],
  }),
  nonconformities: many(nonconformities),
  evidence: many(auditEvidence),
}))

export const nonconformitiesRelations = relations(nonconformities, ({ one, many }) => ({
  auditChecklist: one(auditChecklists, {
    fields: [nonconformities.auditChecklistId],
    references: [auditChecklists.id],
  }),
  responsible: one(userProfiles, {
    fields: [nonconformities.responsibleId],
    references: [userProfiles.id],
    relationName: 'ncResponsible',
  }),
  verifiedByUser: one(userProfiles, {
    fields: [nonconformities.verifiedBy],
    references: [userProfiles.id],
    relationName: 'ncVerifiedBy',
  }),
  correctiveActions: many(correctiveActions),
  followUpRecords: many(followUpRecords),
}))

export const correctiveActionsRelations = relations(correctiveActions, ({ one }) => ({
  nonconformity: one(nonconformities, {
    fields: [correctiveActions.nonconformityId],
    references: [nonconformities.id],
  }),
  responsible: one(userProfiles, {
    fields: [correctiveActions.responsibleId],
    references: [userProfiles.id],
    relationName: 'caResponsible',
  }),
  reviewedByUser: one(userProfiles, {
    fields: [correctiveActions.reviewedBy],
    references: [userProfiles.id],
    relationName: 'caReviewedBy',
  }),
}))

export const auditReportsRelations = relations(auditReports, ({ one }) => ({
  auditPlan: one(auditPlans, {
    fields: [auditReports.auditPlanId],
    references: [auditPlans.id],
  }),
}))

export const auditEvidenceRelations = relations(auditEvidence, ({ one }) => ({
  auditChecklist: one(auditChecklists, {
    fields: [auditEvidence.auditChecklistId],
    references: [auditChecklists.id],
  }),
  uploadedByUser: one(userProfiles, {
    fields: [auditEvidence.uploadedBy],
    references: [userProfiles.id],
  }),
}))

export const followUpRecordsRelations = relations(followUpRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [followUpRecords.organizationId],
    references: [organizations.id],
  }),
  auditPlan: one(auditPlans, {
    fields: [followUpRecords.auditPlanId],
    references: [auditPlans.id],
  }),
  nonconformity: one(nonconformities, {
    fields: [followUpRecords.nonconformityId],
    references: [nonconformities.id],
  }),
  assignedToUser: one(userProfiles, {
    fields: [followUpRecords.assignedTo],
    references: [userProfiles.id],
    relationName: 'followUpAssignedTo',
  }),
  verifiedByUser: one(userProfiles, {
    fields: [followUpRecords.verifiedBy],
    references: [userProfiles.id],
    relationName: 'followUpVerifiedBy',
  }),
  createdByUser: one(userProfiles, {
    fields: [followUpRecords.createdBy],
    references: [userProfiles.id],
    relationName: 'followUpCreatedBy',
  }),
}))
