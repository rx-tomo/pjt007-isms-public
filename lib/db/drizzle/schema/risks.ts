/**
 * Drizzle ORM Schema - Risks
 *
 * SQLite-compatible schema definitions for risk management related tables.
 * Includes: risks, risk_categories, risk_criteria, risk_treatments,
 *           risk_assessment_history, risk_assets, risk_control_links,
 *           information_assets, information_asset_import_jobs,
 *           information_asset_import_rows, iso_controls, control_templates
 *
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - Array types -> TEXT (JSON array string)
 * - ENUM -> TEXT with TypeScript type validation
 * - DECIMAL/NUMERIC -> real()
 * - GENERATED ALWAYS AS -> regular column (computed at app layer)
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================

// risk_criteria.type
export const riskCriteriaTypeValues = ['impact', 'likelihood'] as const
export type RiskCriteriaType = (typeof riskCriteriaTypeValues)[number]

// risks.status
export const riskStatusValues = ['identified', 'analyzing', 'treating', 'monitoring', 'closed'] as const
export type RiskStatus = (typeof riskStatusValues)[number]

// risk_treatments.treatment_type
export const treatmentTypeValues = ['avoid', 'reduce', 'transfer', 'accept'] as const
export type TreatmentType = (typeof treatmentTypeValues)[number]

// risk_treatments.status
export const treatmentStatusValues = ['planned', 'in_progress', 'completed', 'cancelled'] as const
export type TreatmentStatus = (typeof treatmentStatusValues)[number]

// information_assets.asset_type
export const assetTypeValues = ['hardware', 'software', 'data', 'service', 'facility', 'personnel', 'other'] as const
export type AssetType = (typeof assetTypeValues)[number]

// information_assets.classification
export const classificationValues = ['restricted', 'internal', 'public'] as const
export type Classification = (typeof classificationValues)[number]

// information_assets.criticality
export const criticalityValues = ['low', 'medium', 'high'] as const
export type Criticality = (typeof criticalityValues)[number]

// information_assets.status
export const assetStatusValues = ['in_use', 'retired', 'planned'] as const
export type AssetStatus = (typeof assetStatusValues)[number]

// information_asset_import_jobs.status
export const importJobStatusValues = ['pending', 'processing', 'completed', 'failed'] as const
export type ImportJobStatus = (typeof importJobStatusValues)[number]

// information_asset_import_jobs.mode
export const importModeValues = ['insert', 'upsert', 'replace'] as const
export type ImportMode = (typeof importModeValues)[number]

// information_asset_import_rows.status
export const importRowStatusValues = ['pending', 'imported', 'skipped', 'error'] as const
export type ImportRowStatus = (typeof importRowStatusValues)[number]

// =========================================
// Risk Categories Table
// =========================================
export const riskCategories = sqliteTable(
  'risk_categories',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color'),
    displayOrder: integer('display_order').default(0),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_risk_categories_org').on(table.organizationId),
  ]
)

export type RiskCategory = typeof riskCategories.$inferSelect
export type RiskCategoryInsert = typeof riskCategories.$inferInsert

// =========================================
// Risk Criteria Table
// =========================================
export const riskCriteria = sqliteTable(
  'risk_criteria',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'impact' | 'likelihood'
    level: integer('level').notNull(), // CHECK: 1-5 (enforced at app layer)
    label: text('label').notNull(),
    description: text('description'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_risk_criteria_org').on(table.organizationId),
  ]
)

export type RiskCriterion = typeof riskCriteria.$inferSelect
export type RiskCriterionInsert = typeof riskCriteria.$inferInsert

// =========================================
// Risks Table
// =========================================
export const risks = sqliteTable(
  'risks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => riskCategories.id),
    title: text('title').notNull(),
    description: text('description'),
    impactLevel: integer('impact_level'), // CHECK: 1-5 (enforced at app layer)
    likelihoodLevel: integer('likelihood_level'), // CHECK: 1-5 (enforced at app layer)
    // GENERATED ALWAYS AS (impact_level * likelihood_level) in PostgreSQL
    // Computed at application layer: riskScore = impactLevel * likelihoodLevel
    riskScore: integer('risk_score'),
    status: text('status').default('identified'), // riskStatusValues
    identifiedDate: text('identified_date'),
    identifiedBy: text('identified_by').references(() => userProfiles.id),
    ownerId: text('owner_id').references(() => userProfiles.id),
    // GENERATED ALWAYS AS (FY/Q calculation) in PostgreSQL
    // Computed at application layer from identified_date
    assessmentPeriod: text('assessment_period'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_risks_organization_id').on(table.organizationId),
    index('idx_risks_category_id').on(table.categoryId),
    index('idx_risks_status').on(table.status),
    index('idx_risks_risk_score').on(table.riskScore),
    index('idx_risks_assessment_period').on(table.assessmentPeriod),
    index('idx_risks_org_status').on(table.organizationId, table.status),
    index('idx_risks_org_assessment_period').on(table.organizationId, table.assessmentPeriod),
    index('idx_risks_org_risk_score').on(table.organizationId, table.riskScore),
  ]
)

export type Risk = typeof risks.$inferSelect
export type RiskInsert = typeof risks.$inferInsert

// =========================================
// Risk Treatments Table
// =========================================
export const riskTreatments = sqliteTable(
  'risk_treatments',
  {
    id: text('id').primaryKey(),
    riskId: text('risk_id').references(() => risks.id, { onDelete: 'cascade' }),
    treatmentType: text('treatment_type').notNull(), // treatmentTypeValues
    description: text('description').notNull(),
    responsibleId: text('responsible_id').references(() => userProfiles.id),
    dueDate: text('due_date'),
    status: text('status').default('planned'), // treatmentStatusValues
    residualApprovalStatus: text('residual_approval_status').default('draft'),
    residualApprovedBy: text('residual_approved_by').references(() => userProfiles.id),
    residualApprovedAt: text('residual_approved_at'),
    residualRejectionReason: text('residual_rejection_reason'),
    residualReviewDueDate: text('residual_review_due_date'),
    costEstimate: real('cost_estimate'),
    actualCost: real('actual_cost'),
    effectivenessRating: integer('effectiveness_rating'), // CHECK: 1-5 (enforced at app layer)
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_risk_treatments_risk_id').on(table.riskId),
    index('idx_risk_treatments_status').on(table.status),
  ]
)

export type RiskTreatment = typeof riskTreatments.$inferSelect
export type RiskTreatmentInsert = typeof riskTreatments.$inferInsert

// =========================================
// Risk Assessment History Table
// =========================================
export const riskAssessmentHistory = sqliteTable(
  'risk_assessment_history',
  {
    id: text('id').primaryKey(),
    riskId: text('risk_id').references(() => risks.id, { onDelete: 'cascade' }),
    assessedBy: text('assessed_by').references(() => userProfiles.id),
    assessmentDate: text('assessment_date').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    previousImpactLevel: integer('previous_impact_level'),
    newImpactLevel: integer('new_impact_level'),
    previousLikelihoodLevel: integer('previous_likelihood_level'),
    newLikelihoodLevel: integer('new_likelihood_level'),
    notes: text('notes'),
  },
  (table) => [
    index('idx_risk_assessment_history_risk_id').on(table.riskId),
  ]
)

export type RiskAssessmentHistory = typeof riskAssessmentHistory.$inferSelect
export type RiskAssessmentHistoryInsert = typeof riskAssessmentHistory.$inferInsert

// =========================================
// Information Assets Table
// =========================================
export const informationAssets = sqliteTable(
  'information_assets',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    assetType: text('asset_type').default('data'), // assetTypeValues
    classification: text('classification').default('internal'), // classificationValues
    criticality: text('criticality').default('medium'), // criticalityValues
    ownerId: text('owner_id').references(() => userProfiles.id),
    location: text('location'),
    status: text('status').default('in_use'), // assetStatusValues
    description: text('description'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_information_assets_org').on(table.organizationId),
    index('idx_information_assets_owner').on(table.ownerId),
    index('idx_information_assets_status').on(table.status),
  ]
)

export type InformationAsset = typeof informationAssets.$inferSelect
export type InformationAssetInsert = typeof informationAssets.$inferInsert

// =========================================
// Risk Assets (join table: risks <-> information_assets)
// =========================================
export const riskAssets = sqliteTable(
  'risk_assets',
  {
    id: text('id').primaryKey(),
    riskId: text('risk_id')
      .notNull()
      .references(() => risks.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => informationAssets.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('risk_assets_risk_asset_unique').on(table.riskId, table.assetId),
    index('idx_risk_assets_risk').on(table.riskId),
    index('idx_risk_assets_asset').on(table.assetId),
  ]
)

export type RiskAsset = typeof riskAssets.$inferSelect
export type RiskAssetInsert = typeof riskAssets.$inferInsert

// =========================================
// Information Asset Import Jobs Table
// =========================================
export const informationAssetImportJobs = sqliteTable(
  'information_asset_import_jobs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => userProfiles.id),
    originalFilename: text('original_filename'),
    status: text('status').notNull().default('pending'), // importJobStatusValues
    mode: text('mode').notNull().default('insert'), // importModeValues
    totalRows: integer('total_rows').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    errorSummary: text('error_summary'),
    backupSnapshot: text('backup_snapshot'), // JSON string
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_information_asset_import_jobs_org').on(table.organizationId),
  ]
)

export type InformationAssetImportJob = typeof informationAssetImportJobs.$inferSelect
export type InformationAssetImportJobInsert = typeof informationAssetImportJobs.$inferInsert

// =========================================
// Information Asset Import Rows Table
// =========================================
export const informationAssetImportRows = sqliteTable(
  'information_asset_import_rows',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => informationAssetImportJobs.id, { onDelete: 'cascade' }),
    lineNumber: integer('line_number').notNull(),
    rawData: text('raw_data').notNull(), // JSON string (JSONB in PostgreSQL)
    status: text('status').notNull().default('pending'), // importRowStatusValues
    message: text('message'),
    assetId: text('asset_id').references(() => informationAssets.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_information_asset_import_rows_job').on(table.jobId),
    index('idx_information_asset_import_rows_status').on(table.status),
  ]
)

export type InformationAssetImportRow = typeof informationAssetImportRows.$inferSelect
export type InformationAssetImportRowInsert = typeof informationAssetImportRows.$inferInsert

// =========================================
// ISO Controls Table
// =========================================
export const isoControls = sqliteTable(
  'iso_controls',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    controlCode: text('control_code'),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    tags: text('tags').default('[]'), // JSON array string (TEXT[] in PostgreSQL)
    templateKey: text('template_key'),
    soaStatus: text('soa_status').notNull().default('not_reviewed'),
    soaApplicabilityReason: text('soa_applicability_reason'),
    soaExclusionReason: text('soa_exclusion_reason'),
    soaReviewedBy: text('soa_reviewed_by').references(() => userProfiles.id),
    soaReviewedAt: text('soa_reviewed_at'),
    soaApprovalStatus: text('soa_approval_status').notNull().default('draft'),
    soaApprovedBy: text('soa_approved_by').references(() => userProfiles.id),
    soaApprovedAt: text('soa_approved_at'),
    soaRejectionReason: text('soa_rejection_reason'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('idx_iso_controls_org_code').on(table.organizationId, table.controlCode),
    uniqueIndex('idx_iso_controls_org_template_key').on(table.organizationId, table.templateKey),
    index('idx_iso_controls_org_category').on(table.organizationId, table.category),
    index('idx_iso_controls_org_title').on(table.organizationId, table.title),
  ]
)

export type IsoControl = typeof isoControls.$inferSelect
export type IsoControlInsert = typeof isoControls.$inferInsert

// =========================================
// SoA Versions Table
// =========================================
export const soaVersions = sqliteTable(
  'soa_versions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    title: text('title').notNull(),
    changeSummary: text('change_summary'),
    snapshot: text('snapshot').notNull(),
    controlCount: integer('control_count').notNull().default(0),
    approvedControlCount: integer('approved_control_count').notNull().default(0),
    publishedBy: text('published_by').references(() => userProfiles.id),
    publishedAt: text('published_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    reviewStatus: text('review_status').notNull().default('draft'),
    reviewedBy: text('reviewed_by').references(() => userProfiles.id),
    reviewedAt: text('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('soa_versions_org_version_unique').on(table.organizationId, table.versionNumber),
    index('idx_soa_versions_org').on(table.organizationId),
    index('idx_soa_versions_published_at').on(table.publishedAt),
  ]
)

export type SoaVersion = typeof soaVersions.$inferSelect
export type SoaVersionInsert = typeof soaVersions.$inferInsert

// =========================================
// Risk Control Links Table (join: risk_treatments <-> iso_controls)
// =========================================
export const riskControlLinks = sqliteTable(
  'risk_control_links',
  {
    id: text('id').primaryKey(),
    riskTreatmentId: text('risk_treatment_id')
      .notNull()
      .references(() => riskTreatments.id, { onDelete: 'cascade' }),
    isoControlId: text('iso_control_id')
      .notNull()
      .references(() => isoControls.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('risk_control_links_treatment_control_unique').on(table.riskTreatmentId, table.isoControlId),
    index('idx_risk_control_links_treatment').on(table.riskTreatmentId),
    index('idx_risk_control_links_control').on(table.isoControlId),
  ]
)

export type RiskControlLink = typeof riskControlLinks.$inferSelect
export type RiskControlLinkInsert = typeof riskControlLinks.$inferInsert

// =========================================
// Control Templates Table
// =========================================
export const controlTemplates = sqliteTable(
  'control_templates',
  {
    id: text('id').primaryKey(),
    templateKey: text('template_key').notNull(),
    locale: text('locale').notNull().default('ja'),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    controlCode: text('control_code'),
    annexReference: text('annex_reference'),
    defaultTags: text('default_tags').default('[]'), // JSON array string (TEXT[] in PostgreSQL)
    isDefaultSelected: integer('is_default_selected', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('control_templates_key_locale_unique').on(table.templateKey, table.locale),
    index('idx_control_templates_locale').on(table.locale),
  ]
)

export type ControlTemplate = typeof controlTemplates.$inferSelect
export type ControlTemplateInsert = typeof controlTemplates.$inferInsert

// =========================================
// Relations
// =========================================
export const riskCategoriesRelations = relations(riskCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [riskCategories.organizationId],
    references: [organizations.id],
  }),
  risks: many(risks),
}))

export const riskCriteriaRelations = relations(riskCriteria, ({ one }) => ({
  organization: one(organizations, {
    fields: [riskCriteria.organizationId],
    references: [organizations.id],
  }),
}))

export const risksRelations = relations(risks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [risks.organizationId],
    references: [organizations.id],
  }),
  category: one(riskCategories, {
    fields: [risks.categoryId],
    references: [riskCategories.id],
  }),
  identifiedByUser: one(userProfiles, {
    fields: [risks.identifiedBy],
    references: [userProfiles.id],
    relationName: 'riskIdentifiedBy',
  }),
  owner: one(userProfiles, {
    fields: [risks.ownerId],
    references: [userProfiles.id],
    relationName: 'riskOwner',
  }),
  treatments: many(riskTreatments),
  assessmentHistory: many(riskAssessmentHistory),
  riskAssets: many(riskAssets),
}))

export const riskTreatmentsRelations = relations(riskTreatments, ({ one, many }) => ({
  risk: one(risks, {
    fields: [riskTreatments.riskId],
    references: [risks.id],
  }),
  responsible: one(userProfiles, {
    fields: [riskTreatments.responsibleId],
    references: [userProfiles.id],
  }),
  controlLinks: many(riskControlLinks),
}))

export const riskAssessmentHistoryRelations = relations(riskAssessmentHistory, ({ one }) => ({
  risk: one(risks, {
    fields: [riskAssessmentHistory.riskId],
    references: [risks.id],
  }),
  assessedByUser: one(userProfiles, {
    fields: [riskAssessmentHistory.assessedBy],
    references: [userProfiles.id],
  }),
}))

export const informationAssetsRelations = relations(informationAssets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [informationAssets.organizationId],
    references: [organizations.id],
  }),
  owner: one(userProfiles, {
    fields: [informationAssets.ownerId],
    references: [userProfiles.id],
  }),
  riskAssets: many(riskAssets),
  importRows: many(informationAssetImportRows),
}))

export const riskAssetsRelations = relations(riskAssets, ({ one }) => ({
  risk: one(risks, {
    fields: [riskAssets.riskId],
    references: [risks.id],
  }),
  asset: one(informationAssets, {
    fields: [riskAssets.assetId],
    references: [informationAssets.id],
  }),
}))

export const informationAssetImportJobsRelations = relations(informationAssetImportJobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [informationAssetImportJobs.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [informationAssetImportJobs.createdBy],
    references: [userProfiles.id],
  }),
  rows: many(informationAssetImportRows),
}))

export const informationAssetImportRowsRelations = relations(informationAssetImportRows, ({ one }) => ({
  job: one(informationAssetImportJobs, {
    fields: [informationAssetImportRows.jobId],
    references: [informationAssetImportJobs.id],
  }),
  asset: one(informationAssets, {
    fields: [informationAssetImportRows.assetId],
    references: [informationAssets.id],
  }),
}))

export const isoControlsRelations = relations(isoControls, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [isoControls.organizationId],
    references: [organizations.id],
  }),
  controlLinks: many(riskControlLinks),
}))

export const soaVersionsRelations = relations(soaVersions, ({ one }) => ({
  organization: one(organizations, {
    fields: [soaVersions.organizationId],
    references: [organizations.id],
  }),
  publisher: one(userProfiles, {
    fields: [soaVersions.publishedBy],
    references: [userProfiles.id],
  }),
}))

export const riskControlLinksRelations = relations(riskControlLinks, ({ one }) => ({
  riskTreatment: one(riskTreatments, {
    fields: [riskControlLinks.riskTreatmentId],
    references: [riskTreatments.id],
  }),
  isoControl: one(isoControls, {
    fields: [riskControlLinks.isoControlId],
    references: [isoControls.id],
  }),
}))

export const controlTemplatesRelations = relations(controlTemplates, () => ({
  // control_templates is a reference/seed table with no direct FK relations
}))
