/**
 * Drizzle ORM Schema - Documents
 *
 * SQLite-compatible schema definitions for document-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - JSONB -> TEXT (JSON string)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 * - TEXT[] -> TEXT (JSON array string)
 * - BIGINT -> integer (SQLite has no separate BIGINT)
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const documentStatusValues = ['draft', 'in_review', 'approved', 'obsolete'] as const
export type DocumentStatus = (typeof documentStatusValues)[number]

export const documentTemplateCategoryValues = ['policy', 'procedure', 'form', 'checklist'] as const
export type DocumentTemplateCategory = (typeof documentTemplateCategoryValues)[number]

export const documentApprovalStatusValues = ['pending', 'approved', 'rejected', 'skipped'] as const
export type DocumentApprovalStatus = (typeof documentApprovalStatusValues)[number]

// =========================================
// Document Folders Table
// =========================================
export const documentFolders = sqliteTable(
  'document_folders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Self-referencing FK; .references() omitted to avoid circular type inference (same pattern as organizationDepartments)
    parentId: text('parent_id'),
    path: text('path').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => userProfiles.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_document_folders_organization').on(table.organizationId),
    index('idx_document_folders_parent').on(table.parentId),
    index('idx_document_folders_path').on(table.path),
  ]
)

export type DocumentFolder = typeof documentFolders.$inferSelect
export type DocumentFolderInsert = typeof documentFolders.$inferInsert

// =========================================
// Documents Table
// =========================================
export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    fileName: text('file_name'),
    filePath: text('file_path'),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    versionNumber: integer('version_number').default(1),
    status: text('status').default('draft'),
    category: text('category'),
    // TEXT[] stored as JSON array string
    tags: text('tags').default('[]'),
    folderId: text('folder_id').references(() => documentFolders.id, { onDelete: 'set null' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => userProfiles.id),
    updatedBy: text('updated_by').references(() => userProfiles.id),
    approvedBy: text('approved_by').references(() => userProfiles.id),
    approvedAt: text('approved_at'),
    retentionDeleteAt: text('retention_delete_at'),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_documents_organization').on(table.organizationId),
    index('idx_documents_status').on(table.status),
    index('idx_documents_category').on(table.category),
    index('idx_documents_created_at').on(table.createdAt),
    index('idx_documents_folder').on(table.folderId),
  ]
)

export type Document = typeof documents.$inferSelect
export type DocumentInsert = typeof documents.$inferInsert

// =========================================
// Document Versions Table
// =========================================
export const documentVersions = sqliteTable(
  'document_versions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    fileName: text('file_name'),
    filePath: text('file_path'),
    fileSize: integer('file_size'),
    changes: text('changes'),
    createdBy: text('created_by')
      .notNull()
      .references(() => userProfiles.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_document_versions_document').on(table.documentId),
    index('idx_document_versions_created_at').on(table.createdAt),
  ]
)

export type DocumentVersion = typeof documentVersions.$inferSelect
export type DocumentVersionInsert = typeof documentVersions.$inferInsert

// =========================================
// Document Templates Table
// =========================================
export const documentTemplates = sqliteTable(
  'document_templates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    isoReference: text('iso_reference'),
    contentTemplate: text('content_template').notNull(),
    language: text('language').default('ja'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  }
)

export type DocumentTemplate = typeof documentTemplates.$inferSelect
export type DocumentTemplateInsert = typeof documentTemplates.$inferInsert

// =========================================
// Document Approvals Table
// =========================================
export const documentApprovals = sqliteTable(
  'document_approvals',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    step: integer('step').notNull(),
    approverId: text('approver_id')
      .notNull()
      .references(() => userProfiles.id),
    status: text('status').notNull().default('pending'),
    comment: text('comment'),
    actedAt: text('acted_at'),
    createdBy: text('created_by')
      .notNull()
      .references(() => userProfiles.id),
    createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('idx_document_approvals_unique_step').on(table.documentId, table.step),
    index('idx_document_approvals_document').on(table.documentId),
    index('idx_document_approvals_approver').on(table.approverId),
  ]
)

export type DocumentApproval = typeof documentApprovals.$inferSelect
export type DocumentApprovalInsert = typeof documentApprovals.$inferInsert

// =========================================
// Relations
// =========================================
export const documentFoldersRelations = relations(documentFolders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [documentFolders.organizationId],
    references: [organizations.id],
  }),
  parent: one(documentFolders, {
    fields: [documentFolders.parentId],
    references: [documentFolders.id],
    relationName: 'folderHierarchy',
  }),
  children: many(documentFolders, {
    relationName: 'folderHierarchy',
  }),
  createdByUser: one(userProfiles, {
    fields: [documentFolders.createdBy],
    references: [userProfiles.id],
  }),
  documents: many(documents),
}))

export const documentsRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  folder: one(documentFolders, {
    fields: [documents.folderId],
    references: [documentFolders.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [documents.createdBy],
    references: [userProfiles.id],
    relationName: 'documentCreatedBy',
  }),
  updatedByUser: one(userProfiles, {
    fields: [documents.updatedBy],
    references: [userProfiles.id],
    relationName: 'documentUpdatedBy',
  }),
  approvedByUser: one(userProfiles, {
    fields: [documents.approvedBy],
    references: [userProfiles.id],
    relationName: 'documentApprovedBy',
  }),
  versions: many(documentVersions),
  approvals: many(documentApprovals),
}))

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [documentVersions.createdBy],
    references: [userProfiles.id],
  }),
}))

export const documentTemplatesRelations = relations(documentTemplates, () => ({
  // Document templates are system-wide; no FK relations
}))

export const documentApprovalsRelations = relations(documentApprovals, ({ one }) => ({
  document: one(documents, {
    fields: [documentApprovals.documentId],
    references: [documents.id],
  }),
  approver: one(userProfiles, {
    fields: [documentApprovals.approverId],
    references: [userProfiles.id],
    relationName: 'documentApprovalApprover',
  }),
  createdByUser: one(userProfiles, {
    fields: [documentApprovals.createdBy],
    references: [userProfiles.id],
    relationName: 'documentApprovalCreatedBy',
  }),
}))
