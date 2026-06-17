/**
 * SQLite Document Repository
 *
 * Implements IDocumentRepository using Drizzle ORM with SQLite.
 * Handles CRUD operations for documents, folders, versions, templates,
 * and approvals with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - All org-scoped queries include organization_id filtering for multi-tenant isolation
 * - tags: JSON array <-> SQLite JSON text string
 * - is_active: boolean <-> SQLite integer (0/1)
 * - Supports pagination via limit/offset
 * - Folder + approvals joined for DocumentWithFolder via LEFT JOINs
 *
 * @module lib/db/repositories/sqlite/DocumentRepository
 */

import { eq, and, or, sql, asc, desc, isNull, lte, gt, gte, inArray } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  documents,
  documentFolders,
  documentVersions,
  documentTemplates,
  documentApprovals,
} from '@/lib/db/drizzle/schema/documents'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import type {
  IDocumentRepository,
  Document,
  DocumentInsert,
  DocumentUpdate,
  DocumentWithFolder,
  DocumentFolder,
  DocumentFolderInsert,
  DocumentVersion,
  DocumentTemplate,
  DocumentApproval,
  DocumentApprovalUpdate,
  DocumentFilters,
  ApprovalCreationPayload,
  VersionCreationPayload,
  ApproverDashboardMetrics,
} from '../interfaces/IDocumentRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteDocumentRepository extends BaseSQLiteRepository implements IDocumentRepository {
  /**
   * Constructor accepts an optional db override for testing (dependency injection)
   */
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  // =========================================
  // Base repository methods
  // =========================================

  /**
   * Find a document by its ID
   */
  async findById(id: string): Promise<Document | null> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))

    if (rows.length === 0) return null

    return this.mapDocumentRowToEntity(rows[0])
  }

  /**
   * Find multiple documents with optional filters
   */
  async findMany(filters?: Record<string, unknown>): Promise<Document[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))

      return rows.map(row => this.mapDocumentRowToEntity(row))
    }

    const conditions = Object.entries(filters).map(([key, value]) => {
      const column = documents[key as keyof typeof documents.$inferSelect]
      if (column) {
        return eq(column as never, value as never)
      }
      return null
    }).filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))

      return rows.map(row => this.mapDocumentRowToEntity(row))
    }

    const rows = await this.db
      .select()
      .from(documents)
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions as never[]))
      .orderBy(desc(documents.createdAt))

    return rows.map(row => this.mapDocumentRowToEntity(row))
  }

  /**
   * Create a new document
   */
  async create(data: DocumentInsert): Promise<Document> {
    this.requireOrganizationId(data.organization_id, 'create document')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id,
      title: data.title,
      description: data.description ?? null,
      fileName: data.file_name ?? null,
      filePath: data.file_path ?? null,
      fileSize: data.file_size ?? null,
      mimeType: data.mime_type ?? null,
      versionNumber: data.version_number ?? 1,
      status: data.status ?? 'draft',
      category: data.category ?? null,
      tags: data.tags ? JSON.stringify(data.tags) : '[]',
      folderId: data.folder_id ?? null,
      createdBy: data.created_by,
      updatedBy: data.updated_by ?? null,
      approvedBy: data.approved_by ?? null,
      approvedAt: data.approved_at ?? null,
      retentionDeleteAt: data.retention_delete_at ?? null,
      createdAt: data.created_at ?? now,
      updatedAt: data.updated_at ?? now,
    }

    await this.db.insert(documents).values(row)

    this.logDataAccess('create document', data.organization_id, { id })

    return this.mapDocumentRowToEntity(row)
  }

  /**
   * Update an existing document
   */
  async update(id: string, updates: DocumentUpdate): Promise<Document | null> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = {
      updatedAt: now,
    }

    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.file_name !== undefined) setPayload.fileName = updates.file_name
    if (updates.file_path !== undefined) setPayload.filePath = updates.file_path
    if (updates.file_size !== undefined) setPayload.fileSize = updates.file_size
    if (updates.mime_type !== undefined) setPayload.mimeType = updates.mime_type
    if (updates.version_number !== undefined) setPayload.versionNumber = updates.version_number
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.category !== undefined) setPayload.category = updates.category
    if (updates.tags !== undefined) setPayload.tags = updates.tags ? JSON.stringify(updates.tags) : '[]'
    if (updates.folder_id !== undefined) setPayload.folderId = updates.folder_id
    if (updates.updated_by !== undefined) setPayload.updatedBy = updates.updated_by
    if (updates.approved_by !== undefined) setPayload.approvedBy = updates.approved_by
    if (updates.approved_at !== undefined) setPayload.approvedAt = updates.approved_at
    if (updates.retention_delete_at !== undefined) setPayload.retentionDeleteAt = updates.retention_delete_at

    await this.db
      .update(documents)
      .set(setPayload)
      .where(eq(documents.id, id))

    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))

    if (rows.length === 0) return null

    return this.mapDocumentRowToEntity(rows[0])
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(documents)
      .where(eq(documents.id, id))
  }

  // =========================================
  // Organization scoped methods
  // =========================================

  /**
   * Find documents by organization with optional filters, folder/approvals JOIN
   */
  async findByOrganizationId(
    organizationId: string,
    filters?: DocumentFilters,
    options?: QueryOptions
  ): Promise<DocumentWithFolder[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(documents.organizationId, organizationId),
    ]

    // Folder filter
    if (filters?.folderId !== undefined) {
      if (filters.folderId === null) {
        conditions.push(isNull(documents.folderId) as never)
      } else {
        conditions.push(eq(documents.folderId, filters.folderId) as never)
      }
    } else {
      // Default: root (no folder)
      conditions.push(isNull(documents.folderId) as never)
    }

    // Status filter
    if (filters?.status) {
      conditions.push(eq(documents.status, filters.status) as never)
    }

    // Department filter (via created_by user's primaryDepartmentId)
    const needsDepartmentJoin = filters?.departmentId !== undefined
    if (needsDepartmentJoin) {
      if (filters!.includeNoDepartment) {
        // Include documents where creator's department matches OR is NULL
        conditions.push(
          or(
            eq(userProfiles.primaryDepartmentId, filters!.departmentId!),
            isNull(userProfiles.primaryDepartmentId)
          ) as never
        )
      } else {
        conditions.push(eq(userProfiles.primaryDepartmentId, filters!.departmentId!) as never)
      }
    }

    // Query documents with folder LEFT JOIN (and optional userProfiles JOIN for department)
    const baseQuery = this.db
      .select({
        // Document fields
        id: documents.id,
        organization_id: documents.organizationId,
        title: documents.title,
        description: documents.description,
        file_name: documents.fileName,
        file_path: documents.filePath,
        file_size: documents.fileSize,
        mime_type: documents.mimeType,
        version_number: documents.versionNumber,
        status: documents.status,
        category: documents.category,
        tags: documents.tags,
        folder_id: documents.folderId,
        created_by: documents.createdBy,
        updated_by: documents.updatedBy,
        approved_by: documents.approvedBy,
        approved_at: documents.approvedAt,
        retention_delete_at: documents.retentionDeleteAt,
        created_at: documents.createdAt,
        updated_at: documents.updatedAt,
        // Folder fields
        folder_db_id: documentFolders.id,
        folder_organization_id: documentFolders.organizationId,
        folder_name: documentFolders.name,
        folder_parent_id: documentFolders.parentId,
        folder_path: documentFolders.path,
        folder_created_by: documentFolders.createdBy,
        folder_created_at: documentFolders.createdAt,
        folder_updated_at: documentFolders.updatedAt,
      })
      .from(documents)
      .leftJoin(documentFolders, eq(documents.folderId, documentFolders.id))

    // Conditionally add userProfiles JOIN for department filtering
    const queryWithJoins = needsDepartmentJoin
      ? baseQuery.leftJoin(userProfiles, eq(documents.createdBy, userProfiles.id))
      : baseQuery

    let query = queryWithJoins
      .where(and(...conditions as never[]))
      .orderBy(desc(documents.createdAt))

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query
    }

    if (options?.offset) {
      query = query.offset(options.offset) as typeof query
    }

    const docRows = await query

    // Collect document IDs for approval query
    const docIds = docRows.map(r => r.id)

    // Fetch approvals for all retrieved documents
    let approvalRows: Array<typeof documentApprovals.$inferSelect> = []
    if (docIds.length > 0) {
      approvalRows = await this.db
        .select()
        .from(documentApprovals)
        .where(inArray(documentApprovals.documentId, docIds))
        .orderBy(asc(documentApprovals.step))
    }

    // Group approvals by document_id
    const approvalsByDoc = new Map<string, DocumentApproval[]>()
    for (const a of approvalRows) {
      const mapped = this.mapApprovalRowToEntity(a)
      const list = approvalsByDoc.get(mapped.documentId) ?? []
      list.push(mapped)
      approvalsByDoc.set(mapped.documentId, list)
    }

    this.logDataAccess('findByOrganizationId', organizationId, { count: docRows.length })

    return docRows.map(row => {
      const tags = row.tags ? this.parseJsonArray(row.tags) : null
      const folder: DocumentFolder | null = row.folder_db_id
        ? {
            id: row.folder_db_id,
            organization_id: row.folder_organization_id!,
            name: row.folder_name!,
            parent_id: row.folder_parent_id ?? null,
            path: row.folder_path!,
            created_by: row.folder_created_by!,
            created_at: row.folder_created_at ?? null,
            updated_at: row.folder_updated_at ?? null,
          }
        : null

      return {
        id: row.id,
        organization_id: row.organization_id,
        title: row.title,
        description: row.description ?? null,
        file_name: row.file_name ?? null,
        file_path: row.file_path ?? null,
        file_size: row.file_size ?? null,
        mime_type: row.mime_type ?? null,
        version_number: row.version_number ?? null,
        status: row.status ?? null,
        category: row.category ?? null,
        tags,
        folder_id: row.folder_id ?? null,
        created_by: row.created_by,
        updated_by: row.updated_by ?? null,
        approved_by: row.approved_by ?? null,
        approved_at: row.approved_at ?? null,
        retention_delete_at: row.retention_delete_at ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        department_id: null,
        folder,
        approvals: approvalsByDoc.get(row.id) ?? [],
      } as DocumentWithFolder
    })
  }

  // =========================================
  // Document Version operations
  // =========================================

  /**
   * Get all versions for a document
   */
  async getVersions(documentId: string, options?: QueryOptions): Promise<DocumentVersion[]> {
    let query = this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query
    }

    const rows = await query

    return rows.map(row => this.mapVersionRowToEntity(row))
  }

  /**
   * Create a new document version (auto-increments version_number)
   */
  async createVersion(payload: VersionCreationPayload): Promise<DocumentVersion> {
    const latestVersion = await this.getLatestVersionNumber(payload.documentId)
    const newVersionNumber = latestVersion + 1

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      documentId: payload.documentId,
      versionNumber: newVersionNumber,
      title: payload.title,
      description: payload.description ?? null,
      fileName: payload.fileName ?? null,
      filePath: payload.filePath ?? null,
      fileSize: payload.fileSize ?? null,
      changes: payload.changes ?? null,
      createdBy: payload.createdBy,
      createdAt: now,
    }

    await this.db.insert(documentVersions).values(row)

    return this.mapVersionRowToEntity(row)
  }

  /**
   * Get the latest version number for a document
   */
  async getLatestVersionNumber(documentId: string): Promise<number> {
    const rows = await this.db
      .select({ versionNumber: documentVersions.versionNumber })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
      .limit(1)

    if (rows.length === 0) return 0

    return rows[0].versionNumber
  }

  // =========================================
  // Document Folder operations
  // =========================================

  /**
   * Get folders for an organization, optionally filtered by parent
   */
  async getFolders(organizationId: string, parentId?: string | null): Promise<DocumentFolder[]> {
    this.requireOrganizationId(organizationId, 'getFolders')

    const conditions: ReturnType<typeof eq>[] = [
      eq(documentFolders.organizationId, organizationId),
    ]

    if (parentId !== undefined) {
      if (parentId === null) {
        conditions.push(isNull(documentFolders.parentId) as never)
      } else {
        conditions.push(eq(documentFolders.parentId, parentId) as never)
      }
    } else {
      // Default: root folders only
      conditions.push(isNull(documentFolders.parentId) as never)
    }

    const rows = await this.db
      .select()
      .from(documentFolders)
      .where(and(...conditions as never[]))
      .orderBy(asc(documentFolders.name))

    this.logDataAccess('getFolders', organizationId, { count: rows.length })

    return rows.map(row => this.mapFolderRowToEntity(row))
  }

  /**
   * Create a new folder
   */
  async createFolder(data: DocumentFolderInsert): Promise<DocumentFolder> {
    this.requireOrganizationId(data.organization_id, 'createFolder')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id,
      name: data.name,
      parentId: data.parent_id ?? null,
      path: data.path,
      createdBy: data.created_by,
      createdAt: data.created_at ?? now,
      updatedAt: data.updated_at ?? now,
    }

    await this.db.insert(documentFolders).values(row)

    this.logDataAccess('createFolder', data.organization_id, { id })

    return this.mapFolderRowToEntity(row)
  }

  /**
   * Delete a folder by organization and folder ID
   */
  async deleteFolder(organizationId: string, folderId: string): Promise<void> {
    this.requireOrganizationId(organizationId, 'deleteFolder')

    await this.db
      .delete(documentFolders)
      .where(
        and(
          eq(documentFolders.organizationId, organizationId),
          eq(documentFolders.id, folderId)
        )
      )

    this.logDataAccess('deleteFolder', organizationId, { folderId })
  }

  /**
   * Count documents in a folder
   */
  async countDocumentsInFolder(folderId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documents)
      .where(eq(documents.folderId, folderId))

    return result[0]?.count ?? 0
  }

  /**
   * Count subfolders in a folder
   */
  async countSubfolders(folderId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documentFolders)
      .where(eq(documentFolders.parentId, folderId))

    return result[0]?.count ?? 0
  }

  // =========================================
  // Document Template operations
  // =========================================

  /**
   * Get active templates by language
   */
  async getTemplates(language: string = 'ja'): Promise<DocumentTemplate[]> {
    const rows = await this.db
      .select()
      .from(documentTemplates)
      .where(
        and(
          eq(documentTemplates.language, language),
          eq(documentTemplates.isActive, true)
        )
      )
      .orderBy(asc(documentTemplates.category), asc(documentTemplates.name))

    return rows.map(row => this.mapTemplateRowToEntity(row))
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(templateId: string): Promise<DocumentTemplate | null> {
    const rows = await this.db
      .select()
      .from(documentTemplates)
      .where(eq(documentTemplates.id, templateId))

    if (rows.length === 0) return null

    return this.mapTemplateRowToEntity(rows[0])
  }

  // =========================================
  // Document Approval operations
  // =========================================

  /**
   * Get all approvals for a document, ordered by step
   */
  async getApprovals(documentId: string): Promise<DocumentApproval[]> {
    const rows = await this.db
      .select()
      .from(documentApprovals)
      .where(eq(documentApprovals.documentId, documentId))
      .orderBy(asc(documentApprovals.step))

    return rows.map(row => this.mapApprovalRowToEntity(row))
  }

  /**
   * Create multiple approval records (batch insert)
   */
  async createApprovals(approvals: ApprovalCreationPayload[]): Promise<void> {
    if (approvals.length === 0) return

    const now = new Date().toISOString()

    const rows = approvals.map(a => ({
      id: crypto.randomUUID(),
      documentId: a.documentId,
      step: a.step,
      approverId: a.approverId,
      status: a.status,
      comment: null as string | null,
      actedAt: a.actedAt ?? null,
      createdBy: a.createdBy,
      createdAt: now,
    }))

    await this.db.insert(documentApprovals).values(rows)
  }

  /**
   * Update an approval record
   */
  async updateApproval(
    approvalId: string,
    updates: DocumentApprovalUpdate
  ): Promise<DocumentApproval | null> {
    const setPayload: Record<string, unknown> = {}

    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.comment !== undefined) setPayload.comment = updates.comment
    if (updates.actedAt !== undefined) setPayload.actedAt = updates.actedAt

    await this.db
      .update(documentApprovals)
      .set(setPayload)
      .where(eq(documentApprovals.id, approvalId))

    const rows = await this.db
      .select()
      .from(documentApprovals)
      .where(eq(documentApprovals.id, approvalId))

    if (rows.length === 0) return null

    return this.mapApprovalRowToEntity(rows[0])
  }

  /**
   * Get the first pending approval for a user on a document
   */
  async getPendingApprovalForUser(
    documentId: string,
    userId: string
  ): Promise<DocumentApproval | null> {
    const rows = await this.db
      .select()
      .from(documentApprovals)
      .where(
        and(
          eq(documentApprovals.documentId, documentId),
          eq(documentApprovals.approverId, userId),
          eq(documentApprovals.status, 'pending')
        )
      )
      .orderBy(asc(documentApprovals.step))
      .limit(1)

    if (rows.length === 0) return null

    return this.mapApprovalRowToEntity(rows[0])
  }

  // =========================================
  // Approval dashboard metrics
  // =========================================

  /**
   * Get aggregated approval metrics for a user's dashboard
   */
  async getApproverDashboardMetrics(
    userId: string,
    thresholds: {
      dueSoonHours: number
      escalationHours: number
      historyWindowDays: number
    }
  ): Promise<ApproverDashboardMetrics> {
    const now = new Date()
    const dueThresholdIso = new Date(
      now.getTime() - thresholds.dueSoonHours * 60 * 60 * 1000
    ).toISOString()
    const escalationThresholdIso = new Date(
      now.getTime() - thresholds.escalationHours * 60 * 60 * 1000
    ).toISOString()
    const historyThresholdIso = new Date(
      now.getTime() - thresholds.historyWindowDays * 24 * 60 * 60 * 1000
    ).toISOString()

    // Total pending count
    const [pendingResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documentApprovals)
      .where(
        and(
          eq(documentApprovals.approverId, userId),
          eq(documentApprovals.status, 'pending')
        )
      )

    // Due soon: pending, created_at <= dueThreshold AND created_at > escalationThreshold
    const [dueSoonResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documentApprovals)
      .where(
        and(
          eq(documentApprovals.approverId, userId),
          eq(documentApprovals.status, 'pending'),
          lte(documentApprovals.createdAt, dueThresholdIso),
          gt(documentApprovals.createdAt, escalationThresholdIso)
        )
      )

    // Escalation: pending, created_at <= escalationThreshold
    const [escalationResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documentApprovals)
      .where(
        and(
          eq(documentApprovals.approverId, userId),
          eq(documentApprovals.status, 'pending'),
          lte(documentApprovals.createdAt, escalationThresholdIso)
        )
      )

    // History: approved/rejected, acted_at is not null, acted_at >= historyThreshold
    const [historyResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documentApprovals)
      .where(
        and(
          eq(documentApprovals.approverId, userId),
          inArray(documentApprovals.status, ['approved', 'rejected']),
          sql`${documentApprovals.actedAt} IS NOT NULL`,
          gte(documentApprovals.actedAt, historyThresholdIso)
        )
      )

    return {
      pendingCount: pendingResult?.count ?? 0,
      dueSoonCount: dueSoonResult?.count ?? 0,
      escalationCount: escalationResult?.count ?? 0,
      historyCount: historyResult?.count ?? 0,
      dueSoonHours: thresholds.dueSoonHours,
      escalationHours: thresholds.escalationHours,
      historyWindowDays: thresholds.historyWindowDays,
      lastRefreshedAt: now.toISOString(),
    }
  }

  // =========================================
  // Private helpers
  // =========================================

  /**
   * Parse a JSON array string to string[], returning null on failure
   */
  private parseJsonArray(jsonStr: string): string[] | null {
    try {
      const parsed = JSON.parse(jsonStr)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  /**
   * Maps a Drizzle document row (camelCase) to the Document entity (snake_case)
   */
  private mapDocumentRowToEntity(row: {
    id: string
    organizationId: string
    title: string
    description: string | null
    fileName: string | null
    filePath: string | null
    fileSize: number | null
    mimeType: string | null
    versionNumber: number | null
    status: string | null
    category: string | null
    tags: string | null
    folderId: string | null
    createdBy: string
    updatedBy: string | null
    approvedBy: string | null
    approvedAt: string | null
    retentionDeleteAt: string | null
    createdAt: string | null
    updatedAt: string | null
  }): Document {
    return {
      id: row.id,
      organization_id: row.organizationId,
      title: row.title,
      description: row.description,
      file_name: row.fileName,
      file_path: row.filePath,
      file_size: row.fileSize,
      mime_type: row.mimeType,
      version_number: row.versionNumber,
      status: row.status,
      category: row.category,
      tags: row.tags ? this.parseJsonArray(row.tags) : null,
      folder_id: row.folderId,
      created_by: row.createdBy,
      updated_by: row.updatedBy,
      approved_by: row.approvedBy,
      approved_at: row.approvedAt,
      retention_delete_at: row.retentionDeleteAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      department_id: null,
    }
  }

  /**
   * Maps a Drizzle folder row (camelCase) to the DocumentFolder entity (snake_case)
   */
  private mapFolderRowToEntity(row: {
    id: string
    organizationId: string
    name: string
    parentId: string | null
    path: string
    createdBy: string
    createdAt: string | null
    updatedAt: string | null
  }): DocumentFolder {
    return {
      id: row.id,
      organization_id: row.organizationId,
      name: row.name,
      parent_id: row.parentId,
      path: row.path,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  /**
   * Maps a Drizzle version row (camelCase) to the DocumentVersion entity (snake_case)
   */
  private mapVersionRowToEntity(row: {
    id: string
    documentId: string
    versionNumber: number
    title: string
    description: string | null
    fileName: string | null
    filePath: string | null
    fileSize: number | null
    changes: string | null
    createdBy: string
    createdAt: string | null
  }): DocumentVersion {
    return {
      id: row.id,
      document_id: row.documentId,
      version_number: row.versionNumber,
      title: row.title,
      description: row.description,
      file_name: row.fileName,
      file_path: row.filePath,
      file_size: row.fileSize,
      changes: row.changes,
      created_by: row.createdBy,
      created_at: row.createdAt,
    }
  }

  /**
   * Maps a Drizzle approval row (camelCase) to the DocumentApproval entity (snake_case)
   */
  private mapApprovalRowToEntity(row: {
    id: string
    documentId: string
    step: number
    approverId: string
    status: string
    comment: string | null
    actedAt: string | null
    createdBy: string
    createdAt: string | null
  }): DocumentApproval {
    return {
      id: row.id,
      documentId: row.documentId,
      step: row.step,
      approverId: row.approverId,
      status: row.status,
      comment: row.comment,
      actedAt: row.actedAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    }
  }

  /**
   * Maps a Drizzle template row (camelCase) to the DocumentTemplate entity (snake_case)
   *
   * Note: is_active is stored as integer (0/1) in SQLite but as boolean in the interface
   */
  private mapTemplateRowToEntity(row: {
    id: string
    name: string
    description: string | null
    category: string
    isoReference: string | null
    contentTemplate: string
    language: string | null
    isActive: boolean | null
    createdAt: string | null
    updatedAt: string | null
  }): DocumentTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      iso_reference: row.isoReference,
      content_template: row.contentTemplate,
      language: row.language,
      is_active: row.isActive,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
