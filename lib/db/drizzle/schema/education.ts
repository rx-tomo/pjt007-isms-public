/**
 * Drizzle ORM Schema - Education & Training
 *
 * SQLite-compatible schema definitions for education/training management tables.
 * Includes: education_plans, education_records, education_materials,
 *           education_plan_materials
 *
 * Follows the same SQLite adaptations as other schema files:
 * - UUID -> TEXT (using crypto.randomUUID())
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - Array types -> TEXT (JSON array string)
 * - ENUM -> TEXT with TypeScript type validation
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================

// education_plans.status
export const educationPlanStatusValues = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const
export type EducationPlanStatus = (typeof educationPlanStatusValues)[number]

// education_records.result
export const educationRecordResultValues = ['pending', 'passed', 'failed', 'incomplete'] as const
export type EducationRecordResult = (typeof educationRecordResultValues)[number]

// education_materials.material_type
export const educationMaterialTypeValues = ['document', 'video', 'slide', 'link', 'other'] as const
export type EducationMaterialType = (typeof educationMaterialTypeValues)[number]

// =========================================
// Education Plans Table
// =========================================
export const educationPlans = sqliteTable(
  'education_plans',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    targetAudience: text('target_audience'), // JSON array string
    startDate: text('start_date'),
    endDate: text('end_date'),
    status: text('status').default('draft'), // educationPlanStatusValues
    createdBy: text('created_by').references(() => userProfiles.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_education_plans_org').on(table.organizationId),
    index('idx_education_plans_status').on(table.status),
  ]
)

export type EducationPlan = typeof educationPlans.$inferSelect
export type EducationPlanInsert = typeof educationPlans.$inferInsert

// =========================================
// Education Records Table
// =========================================
export const educationRecords = sqliteTable(
  'education_records',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').references(() => educationPlans.id, { onDelete: 'cascade' }),
    attendeeId: text('attendee_id').references(() => userProfiles.id),
    attendedAt: text('attended_at'),
    completedAt: text('completed_at'),
    score: integer('score'), // 0-100, enforced at app layer
    result: text('result').default('pending'), // educationRecordResultValues
    feedback: text('feedback'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('education_records_plan_attendee_unique').on(table.planId, table.attendeeId),
    index('idx_education_records_plan').on(table.planId),
    index('idx_education_records_attendee').on(table.attendeeId),
  ]
)

export type EducationRecord = typeof educationRecords.$inferSelect
export type EducationRecordInsert = typeof educationRecords.$inferInsert

// =========================================
// Education Materials Table
// =========================================
export const educationMaterials = sqliteTable(
  'education_materials',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    materialType: text('material_type').default('document'), // educationMaterialTypeValues
    url: text('url'),
    fileReference: text('file_reference'),
    description: text('description'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_education_materials_org').on(table.organizationId),
  ]
)

export type EducationMaterial = typeof educationMaterials.$inferSelect
export type EducationMaterialInsert = typeof educationMaterials.$inferInsert

// =========================================
// Education Plan Materials (join table)
// =========================================
export const educationPlanMaterials = sqliteTable(
  'education_plan_materials',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => educationPlans.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => educationMaterials.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').default(0),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('education_plan_materials_plan_material_unique').on(table.planId, table.materialId),
    index('idx_education_plan_materials_plan').on(table.planId),
    index('idx_education_plan_materials_material').on(table.materialId),
  ]
)

export type EducationPlanMaterial = typeof educationPlanMaterials.$inferSelect
export type EducationPlanMaterialInsert = typeof educationPlanMaterials.$inferInsert

// =========================================
// Relations
// =========================================
export const educationPlansRelations = relations(educationPlans, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [educationPlans.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [educationPlans.createdBy],
    references: [userProfiles.id],
  }),
  records: many(educationRecords),
  planMaterials: many(educationPlanMaterials),
}))

export const educationRecordsRelations = relations(educationRecords, ({ one }) => ({
  plan: one(educationPlans, {
    fields: [educationRecords.planId],
    references: [educationPlans.id],
  }),
  attendee: one(userProfiles, {
    fields: [educationRecords.attendeeId],
    references: [userProfiles.id],
  }),
}))

export const educationMaterialsRelations = relations(educationMaterials, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [educationMaterials.organizationId],
    references: [organizations.id],
  }),
  planMaterials: many(educationPlanMaterials),
}))

export const educationPlanMaterialsRelations = relations(educationPlanMaterials, ({ one }) => ({
  plan: one(educationPlans, {
    fields: [educationPlanMaterials.planId],
    references: [educationPlans.id],
  }),
  material: one(educationMaterials, {
    fields: [educationPlanMaterials.materialId],
    references: [educationMaterials.id],
  }),
}))
