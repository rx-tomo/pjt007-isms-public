/**
 * Drizzle ORM Schema - Suppliers
 *
 * SQLite-compatible schema definitions for supplier-related tables.
 */

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const supplierTypeValues = ['cloud_service', 'outsourcing', 'consulting', 'hardware', 'software', 'other'] as const
export type SupplierType = (typeof supplierTypeValues)[number]

export const supplierStatusValues = ['active', 'inactive', 'under_review', 'terminated'] as const
export type SupplierStatus = (typeof supplierStatusValues)[number]

export const supplierRiskLevelValues = ['low', 'medium', 'high', 'critical'] as const
export type SupplierRiskLevel = (typeof supplierRiskLevelValues)[number]

export const supplierAssessmentResultValues = ['pass', 'fail', 'conditional', 'pending'] as const
export type SupplierAssessmentResult = (typeof supplierAssessmentResultValues)[number]

export const supplierContractStatusValues = ['draft', 'active', 'expired', 'terminated'] as const
export type SupplierContractStatus = (typeof supplierContractStatusValues)[number]

export const supplierIncidentSeverityValues = ['low', 'medium', 'high', 'critical'] as const
export type SupplierIncidentSeverity = (typeof supplierIncidentSeverityValues)[number]

export const supplierIncidentStatusValues = ['open', 'investigating', 'resolved', 'closed'] as const
export type SupplierIncidentStatus = (typeof supplierIncidentStatusValues)[number]

// =========================================
// Suppliers Table
// =========================================
export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    website: text('website'),
    description: text('description'),
    status: text('status').notNull().default('active'),
    riskLevel: text('risk_level').notNull().default('medium'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_suppliers_organization_id').on(table.organizationId),
    index('idx_suppliers_status').on(table.status),
    index('idx_suppliers_risk_level').on(table.riskLevel),
  ]
)

export type Supplier = typeof suppliers.$inferSelect
export type SupplierInsert = typeof suppliers.$inferInsert

// =========================================
// Supplier Assessments Table
// =========================================
export const supplierAssessments = sqliteTable(
  'supplier_assessments',
  {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    assessmentDate: text('assessment_date').notNull(),
    assessor: text('assessor'),
    overallScore: text('overall_score'),
    result: text('result').notNull(),
    findings: text('findings'),
    nextAssessmentDate: text('next_assessment_date'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_supplier_assessments_supplier_id').on(table.supplierId),
    index('idx_supplier_assessments_assessment_date').on(table.assessmentDate),
  ]
)

export type SupplierAssessment = typeof supplierAssessments.$inferSelect
export type SupplierAssessmentInsert = typeof supplierAssessments.$inferInsert

// =========================================
// Supplier Contracts Table
// =========================================
export const supplierContracts = sqliteTable(
  'supplier_contracts',
  {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    contractNumber: text('contract_number'),
    title: text('title').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    slaDetails: text('sla_details'),
    securityRequirements: text('security_requirements'),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_supplier_contracts_supplier_id').on(table.supplierId),
    index('idx_supplier_contracts_status').on(table.status),
  ]
)

export type SupplierContract = typeof supplierContracts.$inferSelect
export type SupplierContractInsert = typeof supplierContracts.$inferInsert

// =========================================
// Supplier Incidents Table
// =========================================
export const supplierIncidents = sqliteTable(
  'supplier_incidents',
  {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    occurredAt: text('occurred_at').notNull(),
    severity: text('severity').notNull(),
    status: text('status').notNull().default('open'),
    resolution: text('resolution'),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_supplier_incidents_supplier_id').on(table.supplierId),
    index('idx_supplier_incidents_organization_id').on(table.organizationId),
    index('idx_supplier_incidents_status').on(table.status),
  ]
)

export type SupplierIncident = typeof supplierIncidents.$inferSelect
export type SupplierIncidentInsert = typeof supplierIncidents.$inferInsert

// =========================================
// Relations
// =========================================
export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [suppliers.organizationId],
    references: [organizations.id],
  }),
  assessments: many(supplierAssessments),
  contracts: many(supplierContracts),
  incidents: many(supplierIncidents),
}))

export const supplierAssessmentsRelations = relations(supplierAssessments, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierAssessments.supplierId],
    references: [suppliers.id],
  }),
}))

export const supplierContractsRelations = relations(supplierContracts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierContracts.supplierId],
    references: [suppliers.id],
  }),
}))

export const supplierIncidentsRelations = relations(supplierIncidents, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierIncidents.supplierId],
    references: [suppliers.id],
  }),
  organization: one(organizations, {
    fields: [supplierIncidents.organizationId],
    references: [organizations.id],
  }),
}))
