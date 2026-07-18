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

import { eq, and, or, sql, asc, desc, isNull, isNotNull, lte, gt, gte, inArray, notInArray, ne } from 'drizzle-orm'
import type { Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '@/lib/db/drizzle/schema'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  documents,
  documentFolders,
  documentVersions,
  documentTemplates,
  documentStorageOperations,
} from '@/lib/db/drizzle/schema/documents'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { approvalEvents, approvalRequests } from '@/lib/db/drizzle/schema/approvals'
import { notifications } from '@/lib/db/drizzle/schema/notifications'
import {
  userDepartmentScopes,
  userMemberships,
  userProfiles,
  type UserRole,
} from '@/lib/db/drizzle/schema/users'
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
  DocumentFilters,
  ApproverDashboardMetrics,
  DocumentFileVersionPayload,
  DocumentDepartmentAccess,
  DocumentFolderCreatePayload,
  DocumentFolderUpdatePayload,
  DocumentUploadOperationPayload,
  DocumentDeleteOperationResult,
  DocumentApprovalRequestPayload,
  DocumentApprovalMutationResult,
  DocumentLifecycleAuditContext,
  DocumentTenantInvariantValidator,
} from '../interfaces/IDocumentRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { DocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'
import { isDocumentStoragePath } from '@/lib/storage/documentFilePolicy'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'
import { resolveApprovalEligibility } from '@/lib/server/approvals/approvalEligibility'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { resolveDocumentApprovalResourceScope } from '@/lib/server/approvals/approvalResourceScope'

let documentWriteQueue: Promise<void> = Promise.resolve()

async function runDocumentWriteExclusive<T>(operation: () => Promise<T>): Promise<T> {
  let release: () => void = () => undefined
  const previous = documentWriteQueue
  documentWriteQueue = new Promise<void>(resolve => {
    release = resolve
  })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

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

  async findOrganizationIdByDocumentId(documentId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ organizationId: documents.organizationId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)
    return row?.organizationId ?? null
  }

  async findByIdAndOrganizationId(
    documentId: string,
    organizationId: string
  ): Promise<Document | null> {
    this.requireOrganizationId(organizationId, 'findByIdAndOrganizationId')
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId)
      ))
      .limit(1)
    if (!row) return null
    const projected = await this.projectDocumentRowForTenant(this.db, row, organizationId)
    return this.mapDocumentRowToEntity(projected)
  }

  async findByIdForDepartmentAccess(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess
  ): Promise<Document | null> {
    this.requireOrganizationId(organizationId, 'findByIdForDepartmentAccess')
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId)
      ))
      .limit(1)
    if (!row) return null
    try {
      await this.assertDocumentDepartmentAccess(
        this.db,
        row.createdBy,
        organizationId,
        departmentAccess
      )
    } catch (error) {
      if (error instanceof DocumentTenantInvariantError && error.status === 404) {
        return null
      }
      throw error
    }
    const projected = await this.projectDocumentRowForTenant(this.db, row, organizationId)
    return this.mapDocumentRowToEntity(projected)
  }

  async createWithTenantInvariant(
    data: DocumentInsert,
    validate: DocumentTenantInvariantValidator,
    audit: DocumentLifecycleAuditContext
  ): Promise<Document> {
    this.requireOrganizationId(data.organization_id, 'createWithTenantInvariant')
    if (
      data.created_by !== audit.userId
      || (data.updated_by !== undefined && data.updated_by !== null && data.updated_by !== audit.userId)
      || (data.status !== undefined && data.status !== null && data.status !== 'draft')
      || data.file_name
      || data.file_path
      || data.file_size
      || data.mime_type
      || data.approved_by
      || data.approved_at
    ) {
      throw new DocumentTenantInvariantError(400, 'Unsupported document field')
    }
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, data.organization_id)
      await validate(tx)
      const id = data.id ?? crypto.randomUUID()
      const now = new Date().toISOString()
      const row = this.buildDocumentInsertRow(data, id, now)
      await tx.insert(documents).values(row)
      await this.insertDocumentAudit(tx, data.organization_id, id, audit, 'document.created', {
        title: data.title,
        status: data.status ?? 'draft',
        folder_id: data.folder_id ?? null,
      })
      return this.mapDocumentRowToEntity(row)
    })
  }

  async updateWithTenantInvariant(
    documentId: string,
    organizationId: string,
    data: DocumentUpdate,
    departmentAccess: DocumentDepartmentAccess,
    validate: DocumentTenantInvariantValidator,
    audit: DocumentLifecycleAuditContext
  ): Promise<Document | null> {
    this.requireOrganizationId(organizationId, 'updateWithTenantInvariant')
    return this.withTenantTransaction(async tx => {
      const [existing] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!existing) return null

      await this.assertActiveMembership(tx, audit.userId, organizationId)
      await this.assertDocumentDepartmentAccess(
        tx,
        existing.createdBy,
        organizationId,
        departmentAccess
      )
      if (existing.status !== 'draft') {
        throw new DocumentTenantInvariantError(409, 'Document is not editable')
      }
      await validate(tx)
      const setPayload = this.buildDocumentUpdateSet(data)
      await tx
        .update(documents)
        .set(setPayload)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
      await this.insertDocumentAudit(tx, organizationId, documentId, audit, 'document.updated', data)
      const [updated] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      return updated ? this.mapDocumentRowToEntity(updated) : null
    })
  }

  async prepareFileUploadOperationForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentUploadOperationPayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<{ operation: typeof documentStorageOperations.$inferSelect; replay: boolean }> {
    this.requireOrganizationId(organizationId, 'prepareFileUploadOperationForTenant')
    return this.withTenantTransaction(async tx => {
      const [existing] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!existing) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      await this.assertDocumentDepartmentAccess(
        tx,
        existing.createdBy,
        organizationId,
        departmentAccess
      )
      const [existingOperation] = await tx
        .select()
        .from(documentStorageOperations)
        .where(and(
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.operationKey, payload.operationKey)
        ))
        .limit(1)
      if (existingOperation) {
        if (
          existingOperation.documentId !== documentId
          || existingOperation.kind !== 'upload'
          || existingOperation.operationMode !== payload.mode
          || existingOperation.requestFingerprint !== payload.requestFingerprint
          || existingOperation.createdBy !== audit.userId
        ) {
          throw new DocumentTenantInvariantError(409, 'Idempotency key is already in use')
        }
        if (existingOperation.status === 'completed' && existingOperation.versionId) {
          return { operation: existingOperation, replay: true }
        }
        if (existingOperation.status === 'cleaned') {
          if (
            (payload.mode === 'normal' && existing.status !== 'draft')
            || (
              payload.mode === 'revision'
              && existing.status !== 'approved'
              && existing.status !== 'obsolete'
            )
          ) {
            throw new DocumentTenantInvariantError(409, 'Document is not editable')
          }
          const now = new Date().toISOString()
          const [restarted] = await tx
            .update(documentStorageOperations)
            .set({
              status: 'pending',
              filePaths: JSON.stringify([payload.filePath]),
              versionId: null,
              lastError: null,
              leaseToken: null,
              leaseExpiresAt: null,
              updatedAt: now,
            })
            .where(and(
              eq(documentStorageOperations.id, existingOperation.id),
              eq(documentStorageOperations.status, 'cleaned')
            ))
            .returning()
          if (!restarted) {
            throw new DocumentTenantInvariantError(409, 'Document upload is already in progress')
          }
          return { operation: restarted, replay: false }
        }
        throw new DocumentTenantInvariantError(409, 'Document upload is already in progress')
      }
      if (
        (payload.mode === 'normal' && existing.status !== 'draft')
        || (
          payload.mode === 'revision'
          && existing.status !== 'approved'
          && existing.status !== 'obsolete'
        )
      ) {
        throw new DocumentTenantInvariantError(409, 'Document is not editable')
      }

      const now = new Date().toISOString()
      const operation = {
        id: crypto.randomUUID(),
        organizationId,
        documentId,
        operationKey: payload.operationKey,
        kind: 'upload',
        operationMode: payload.mode,
        status: 'pending',
        requestFingerprint: payload.requestFingerprint,
        filePaths: JSON.stringify([payload.filePath]),
        versionId: null,
        createdBy: audit.userId,
        attempts: 0,
        lastError: null,
        leaseToken: null,
        leaseExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      }
      await tx.insert(documentStorageOperations).values(operation)
      return { operation, replay: false }
    })
  }

  async completeFileUploadOperationForTenant(
    operationId: string,
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentFileVersionPayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<{ document: Document; version: DocumentVersion }> {
    this.requireOrganizationId(organizationId, 'completeFileUploadOperationForTenant')
    return this.withTenantTransaction(async tx => {
      const [operation] = await tx
        .select()
        .from(documentStorageOperations)
        .where(and(
          eq(documentStorageOperations.id, operationId),
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.documentId, documentId),
          eq(documentStorageOperations.kind, 'upload')
        ))
        .limit(1)
      if (!operation || operation.createdBy !== audit.userId) {
        throw new DocumentTenantInvariantError(404, 'Document upload operation not found')
      }
      if (operation.status === 'completed' && operation.versionId) {
        const [stored] = await tx
          .select({ document: documents, version: documentVersions })
          .from(documentVersions)
          .innerJoin(documents, and(
            eq(documents.id, documentVersions.documentId),
            eq(documents.organizationId, organizationId)
          ))
          .where(and(
            eq(documentVersions.id, operation.versionId),
            eq(documentVersions.documentId, documentId)
          ))
          .limit(1)
        if (!stored) {
          throw new DocumentTenantInvariantError(409, 'Document upload result is unavailable')
        }
        return {
          document: this.mapDocumentRowToEntity(stored.document),
          version: this.mapVersionRowToEntity(stored.version),
        }
      }
      const mode = payload.mode ?? 'normal'
      if (
        operation.status !== 'pending'
        || operation.operationMode !== mode
        || this.parseStorageOperationFilePaths(operation.filePaths)[0] !== payload.filePath
      ) {
        throw new DocumentTenantInvariantError(409, 'Document upload operation is not completable')
      }

      const [existing] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!existing) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      await this.assertDocumentDepartmentAccess(
        tx,
        existing.createdBy,
        organizationId,
        departmentAccess
      )
      if (
        (mode === 'normal' && existing.status !== 'draft')
        || (
          mode === 'revision'
          && existing.status !== 'approved'
          && existing.status !== 'obsolete'
        )
      ) {
        throw new DocumentTenantInvariantError(409, 'Document is not editable')
      }

      const [latest] = await tx
        .select({ versionNumber: documentVersions.versionNumber })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
        .orderBy(desc(documentVersions.versionNumber))
        .limit(1)
      const versionNumber = (latest?.versionNumber ?? 0) + 1
      const now = new Date().toISOString()
      const versionRow = {
        id: crypto.randomUUID(),
        documentId,
        versionNumber,
        title: payload.title,
        description: payload.description ?? null,
        fileName: payload.fileName,
        filePath: payload.filePath,
        fileSize: payload.fileSize,
        changes: payload.changes ?? null,
        createdBy: audit.userId,
        createdAt: now,
      }
      await tx.insert(documentVersions).values(versionRow)
      await tx
        .update(documents)
        .set({
          fileName: payload.fileName,
          filePath: payload.filePath,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
          versionNumber,
          ...(mode === 'revision'
            ? { status: 'draft', approvedBy: null, approvedAt: null }
            : {}),
          updatedBy: audit.userId,
          updatedAt: now,
        })
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
      await this.insertDocumentAudit(
        tx,
        organizationId,
        documentId,
        audit,
        mode === 'revision' ? 'document.revision_started' : 'document.version_created',
        {
          version_number: versionNumber,
          file_name: payload.fileName,
          ...(mode === 'revision' ? { previous_status: existing.status } : {}),
        }
      )
      const [updated] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!updated) {
        throw new Error('Document update failed')
      }
      const [completedOperation] = await tx
        .update(documentStorageOperations)
        .set({
          status: 'completed',
          versionId: versionRow.id,
          lastError: null,
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(and(
          eq(documentStorageOperations.id, operationId),
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.documentId, documentId),
          eq(documentStorageOperations.status, 'pending')
        ))
        .returning({ id: documentStorageOperations.id })
      if (!completedOperation) {
        throw new DocumentTenantInvariantError(409, 'Document upload operation was claimed for cleanup')
      }
      return {
        document: this.mapDocumentRowToEntity(updated),
        version: this.mapVersionRowToEntity(versionRow),
      }
    })
  }

  async deleteDocumentWithStorageForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    operationKey: string,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentDeleteOperationResult> {
    this.requireOrganizationId(organizationId, 'deleteDocumentWithStorageForTenant')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      const [existingOperation] = await tx
        .select()
        .from(documentStorageOperations)
        .where(and(
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.operationKey, operationKey)
        ))
        .limit(1)
      if (existingOperation) {
        if (
          existingOperation.documentId !== documentId
          || existingOperation.kind !== 'delete'
          || existingOperation.createdBy !== audit.userId
        ) {
          throw new DocumentTenantInvariantError(409, 'Idempotency key is already in use')
        }
        return {
          operation: existingOperation,
          filePaths: this.parseStorageOperationFilePaths(existingOperation.filePaths),
        }
      }

      const [document] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!document) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      await this.assertDocumentDepartmentAccess(
        tx,
        document.createdBy,
        organizationId,
        departmentAccess
      )
      if (document.status !== 'draft') {
        throw new DocumentTenantInvariantError(409, 'Document is not deletable')
      }
      const versionRows = await tx
        .select({ filePath: documentVersions.filePath })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
      const filePaths = [...new Set([
        document.filePath,
        ...versionRows.map(version => version.filePath),
      ].filter((path): path is string => Boolean(path)))]
      if (filePaths.some(path => !isDocumentStoragePath(path, organizationId, documentId))) {
        throw new DocumentTenantInvariantError(409, 'Document contains an invalid file reference')
      }

      const now = new Date().toISOString()
      const operation = {
        id: crypto.randomUUID(),
        organizationId,
        documentId,
        operationKey,
        kind: 'delete',
        operationMode: 'normal',
        status: filePaths.length > 0 ? 'cleanup_pending' : 'cleaned',
        requestFingerprint: null,
        filePaths: JSON.stringify(filePaths),
        versionId: null,
        createdBy: audit.userId,
        attempts: 0,
        lastError: null,
        leaseToken: null,
        leaseExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      }
      await tx.insert(documentStorageOperations).values(operation)
      await this.insertDocumentAudit(tx, organizationId, documentId, audit, 'document.deleted', {
        title: document.title,
        storage_operation_id: operation.id,
        file_count: filePaths.length,
      })
      await tx
        .delete(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
      return { operation, filePaths }
    })
  }

  async deleteDocumentVersionWithStorageForTenant(
    documentId: string,
    versionId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    operationKey: string,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentDeleteOperationResult> {
    this.requireOrganizationId(organizationId, 'deleteDocumentVersionWithStorageForTenant')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      const [existingOperation] = await tx
        .select()
        .from(documentStorageOperations)
        .where(and(
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.operationKey, operationKey)
        ))
        .limit(1)
      if (existingOperation) {
        if (
          existingOperation.documentId !== documentId
          || existingOperation.versionId !== versionId
          || existingOperation.kind !== 'version_delete'
          || existingOperation.createdBy !== audit.userId
        ) {
          throw new DocumentTenantInvariantError(409, 'Idempotency key is already in use')
        }
        return {
          operation: existingOperation,
          filePaths: this.parseStorageOperationFilePaths(existingOperation.filePaths),
        }
      }

      const [row] = await tx
        .select({ document: documents, version: documentVersions })
        .from(documentVersions)
        .innerJoin(documents, and(
          eq(documents.id, documentVersions.documentId),
          eq(documents.organizationId, organizationId)
        ))
        .where(and(
          eq(documentVersions.id, versionId),
          eq(documentVersions.documentId, documentId)
        ))
        .limit(1)
      if (!row) {
        throw new DocumentTenantInvariantError(404, 'Document version not found')
      }
      await this.assertDocumentDepartmentAccess(
        tx,
        row.document.createdBy,
        organizationId,
        departmentAccess
      )
      if (row.document.status !== 'draft') {
        throw new DocumentTenantInvariantError(409, 'Document version is not deletable')
      }
      if (row.version.versionNumber >= (row.document.versionNumber ?? 0)) {
        throw new DocumentTenantInvariantError(409, 'Current document version cannot be deleted')
      }

      const filePaths = row.version.filePath ? [row.version.filePath] : []
      if (filePaths.some(path => !isDocumentStoragePath(path, organizationId, documentId))) {
        throw new DocumentTenantInvariantError(409, 'Document version contains an invalid file reference')
      }
      if (row.version.filePath) {
        const [sharedReference] = await tx
          .select({ id: documentVersions.id })
          .from(documentVersions)
          .where(and(
            eq(documentVersions.documentId, documentId),
            eq(documentVersions.filePath, row.version.filePath),
            ne(documentVersions.id, versionId)
          ))
          .limit(1)
        if (sharedReference || row.document.filePath === row.version.filePath) {
          throw new DocumentTenantInvariantError(409, 'Document file is still referenced')
        }
      }

      const now = new Date().toISOString()
      const operation = {
        id: crypto.randomUUID(),
        organizationId,
        documentId,
        operationKey,
        kind: 'version_delete',
        operationMode: 'normal',
        status: filePaths.length > 0 ? 'cleanup_pending' : 'cleaned',
        requestFingerprint: null,
        filePaths: JSON.stringify(filePaths),
        versionId,
        createdBy: audit.userId,
        attempts: 0,
        lastError: null,
        leaseToken: null,
        leaseExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      }
      await tx.insert(documentStorageOperations).values(operation)
      await this.insertDocumentAudit(
        tx,
        organizationId,
        documentId,
        audit,
        'document.version_deleted',
        {
          version_id: versionId,
          version_number: row.version.versionNumber,
          storage_operation_id: operation.id,
          file_count: filePaths.length,
        }
      )
      await tx
        .delete(documentVersions)
        .where(and(
          eq(documentVersions.id, versionId),
          eq(documentVersions.documentId, documentId)
        ))
      return { operation, filePaths }
    })
  }

  async markStorageOperationCleanupOutcome(
    operationId: string,
    organizationId: string,
    leaseToken: string,
    outcome: { success: boolean; errorMessage?: string | null }
  ): Promise<boolean> {
    this.requireOrganizationId(organizationId, 'markStorageOperationCleanupOutcome')
    return this.withTenantTransaction(async tx => {
      const [operation] = await tx
        .select({ id: documentStorageOperations.id, attempts: documentStorageOperations.attempts })
        .from(documentStorageOperations)
        .where(and(
          eq(documentStorageOperations.id, operationId),
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.status, 'cleanup_claimed'),
          eq(documentStorageOperations.leaseToken, leaseToken)
        ))
        .limit(1)
      if (!operation) return false
      const [updated] = await tx
        .update(documentStorageOperations)
        .set({
          status: outcome.success ? 'cleaned' : 'cleanup_pending',
          attempts: operation.attempts + 1,
          lastError: outcome.success
            ? null
            : (outcome.errorMessage?.slice(0, 500) || 'storage_remove_failed'),
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(documentStorageOperations.id, operationId),
          eq(documentStorageOperations.organizationId, organizationId),
          eq(documentStorageOperations.status, 'cleanup_claimed'),
          eq(documentStorageOperations.leaseToken, leaseToken)
        ))
        .returning({ id: documentStorageOperations.id })
      return Boolean(updated)
    })
  }

  async claimStorageOperationForCleanup(
    operationId: string,
    organizationId: string,
    audit: DocumentLifecycleAuditContext,
    stalePendingBefore: string
  ): Promise<typeof documentStorageOperations.$inferSelect | null> {
    this.requireOrganizationId(organizationId, 'claimStorageOperationForCleanup')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      return this.claimStorageOperation(
        tx,
        operationId,
        organizationId,
        stalePendingBefore,
        new Date().toISOString()
      )
    })
  }

  async claimStorageOperationsForCleanup(
    organizationId: string,
    audit: DocumentLifecycleAuditContext,
    stalePendingBefore: string,
    limit: number
  ): Promise<Array<typeof documentStorageOperations.$inferSelect>> {
    this.requireOrganizationId(organizationId, 'claimStorageOperationsForCleanup')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      const now = new Date().toISOString()
      const candidates = await tx
        .select({ id: documentStorageOperations.id })
        .from(documentStorageOperations)
        .where(and(
          eq(documentStorageOperations.organizationId, organizationId),
          or(
            eq(documentStorageOperations.status, 'cleanup_pending'),
            and(
              eq(documentStorageOperations.status, 'pending'),
              lte(documentStorageOperations.updatedAt, stalePendingBefore)
            ),
            and(
              eq(documentStorageOperations.status, 'cleanup_claimed'),
              lte(documentStorageOperations.leaseExpiresAt, now)
            )
          )
        ))
        .orderBy(asc(documentStorageOperations.updatedAt))
        .limit(Math.max(1, Math.min(limit, 100)))
      const claimed: Array<typeof documentStorageOperations.$inferSelect> = []
      for (const candidate of candidates) {
        const operation = await this.claimStorageOperation(
          tx,
          candidate.id,
          organizationId,
          stalePendingBefore,
          now
        )
        if (operation) claimed.push(operation)
      }
      return claimed
    })
  }

  async requestApprovalForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentApprovalRequestPayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentApprovalMutationResult> {
    this.requireOrganizationId(organizationId, 'requestApprovalForTenant')
    return this.withTenantTransaction(async tx => {
      const requesterAuthorization = await resolveTenantAuthorizationContext(
        tx,
        audit.userId,
        organizationId
      )
      if (!requesterAuthorization.ok) {
        throw new DocumentTenantInvariantError(404, 'User not found')
      }
      const approverEligibility = await resolveApprovalEligibility(
        tx,
        payload.approverId,
        organizationId
      )
      if (!approverEligibility) {
        throw new DocumentTenantInvariantError(404, 'User not found')
      }
      if (payload.approverId === audit.userId) {
        throw new DocumentTenantInvariantError(409, 'Requester and approver must be different')
      }
      const [document] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!document) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      const resourceDepartmentId = await this.resolveApprovalResourceDepartmentOrNotFound(
        tx,
        organizationId,
        documentId
      )
      this.assertApprovalResourceDepartmentAccess(resourceDepartmentId, departmentAccess)
      this.assertApprovalResourceDepartmentAccess(
        resourceDepartmentId,
        requesterAuthorization.context.departmentAccess
      )
      this.assertApprovalResourceDepartmentAccess(
        resourceDepartmentId,
        approverEligibility.departmentAccess
      )
      if (document.status !== 'draft') {
        throw new DocumentTenantInvariantError(409, 'Document is not awaiting submission')
      }
      const [pending] = await tx
        .select({ id: approvalRequests.id })
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.resourceId, documentId),
          eq(approvalRequests.status, 'pending')
        ))
        .limit(1)
      if (pending) {
        throw new DocumentTenantInvariantError(409, 'Document approval is already in progress')
      }

      const now = new Date().toISOString()
      const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const approvalRequest = {
        id: crypto.randomUUID(),
        organizationId,
        resourceType: 'document',
        resourceId: documentId,
        status: 'pending',
        requestedBy: audit.userId,
        requestedAt: now,
        approverId: payload.approverId,
        approvedAt: null,
        rejectionReason: null,
        dueAt,
        notifiedAt: null,
        escalationNotifiedAt: null,
        stepNumber: 1,
        revertedAt: null,
        revertReason: null,
        createdAt: now,
        updatedAt: now,
      }
      await tx.insert(approvalRequests).values(approvalRequest)
      await this.insertApprovalEvent(
        tx,
        approvalRequest.id,
        'requested',
        audit.userId,
        { approver_id: approvalRequest.approverId, due_at: dueAt },
        now
      )
      const [updatedRequestDocument] = await tx
        .update(documents)
        .set({
          status: 'in_review',
          approvedBy: null,
          approvedAt: null,
          updatedBy: audit.userId,
          updatedAt: now,
        })
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          eq(documents.status, 'draft')
        ))
        .returning({ id: documents.id })
      if (!updatedRequestDocument) {
        throw new DocumentTenantInvariantError(409, 'Document approval state changed')
      }
      await this.insertDocumentAudit(
        tx,
        organizationId,
        documentId,
        audit,
        'document.approval_requested',
        { approver_id: payload.approverId }
      )
      await this.insertDocumentApprovalNotification(
        tx,
        organizationId,
        payload.approverId,
        document.title,
        documentId,
        audit.userId,
        now
      )
      return {
        document: this.mapDocumentRowToEntity({
          ...document,
          status: 'in_review',
          approvedBy: null,
          approvedAt: null,
          updatedBy: audit.userId,
          updatedAt: now,
        }),
        currentApproverId: payload.approverId,
      }
    })
  }

  async approveForAssignedApprover(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    comment: string | null,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ): Promise<DocumentApprovalMutationResult> {
    this.requireOrganizationId(organizationId, 'approveForAssignedApprover')
    if (!expectedRequestId.trim()) {
      throw new DocumentTenantInvariantError(400, 'Approval request ID is required')
    }
    return this.withTenantTransaction(async tx => {
      const actorEligibility = await resolveApprovalEligibility(
        tx,
        audit.userId,
        organizationId
      )
      if (!actorEligibility) {
        throw new DocumentTenantInvariantError(404, 'User not found')
      }
      const [document] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!document) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      const resourceDepartmentId = await this.resolveApprovalResourceDepartmentOrNotFound(
        tx,
        organizationId,
        documentId
      )
      this.assertApprovalResourceDepartmentAccess(resourceDepartmentId, departmentAccess)
      this.assertApprovalResourceDepartmentAccess(
        resourceDepartmentId,
        actorEligibility.departmentAccess
      )
      if (document.status !== 'in_review') {
        throw new DocumentTenantInvariantError(409, 'Document is not in review')
      }
      const pending = await tx
        .select()
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.resourceId, documentId),
          eq(approvalRequests.status, 'pending')
        ))
        .orderBy(asc(approvalRequests.stepNumber), asc(approvalRequests.requestedAt))
      const current = pending[0]
      if (!current) {
        throw new DocumentTenantInvariantError(409, 'Document approval request not found')
      }
      if (pending.length !== 1) {
        throw new DocumentTenantInvariantError(409, 'Document approval request state is invalid')
      }
      if (current.id !== expectedRequestId) {
        throw new DocumentTenantInvariantError(409, 'Approval request is no longer current')
      }
      if (current.approverId !== audit.userId) {
        throw new DocumentTenantInvariantError(403, 'Current approval step is assigned to another user')
      }
      if (current.requestedBy === audit.userId) {
        throw new DocumentTenantInvariantError(403, 'Requester cannot decide their own approval')
      }

      const now = new Date().toISOString()
      const [updatedRequest] = await tx
        .update(approvalRequests)
        .set({
          status: 'approved',
          approvedAt: now,
          rejectionReason: null,
          updatedAt: now,
        })
        .where(and(
          eq(approvalRequests.id, current.id),
          eq(approvalRequests.status, 'pending')
        ))
        .returning({ id: approvalRequests.id })
      if (!updatedRequest) {
        throw new DocumentTenantInvariantError(409, 'Document approval request changed')
      }
      await this.insertApprovalEvent(
        tx,
        current.id,
        'approved',
        audit.userId,
        comment ? { comment } : {},
        now
      )
      const [updatedDocumentRow] = await tx
        .update(documents)
        .set({
          status: 'approved',
          approvedBy: audit.userId,
          approvedAt: now,
          updatedBy: audit.userId,
          updatedAt: now,
        })
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          eq(documents.status, 'in_review')
        ))
        .returning({ id: documents.id })
      if (!updatedDocumentRow) {
        throw new DocumentTenantInvariantError(409, 'Document approval state changed')
      }
      await this.insertDocumentAudit(
        tx,
        organizationId,
        documentId,
        audit,
        'document.approved',
        { approved_by: audit.userId }
      )
      const updatedDocument = {
        ...document,
        status: 'approved',
        approvedBy: audit.userId,
        approvedAt: now,
        updatedBy: audit.userId,
        updatedAt: now,
      }
      return {
        document: this.mapDocumentRowToEntity(updatedDocument),
        currentApproverId: null,
      }
    })
  }

  async rejectForAssignedApprover(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    reason: string,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ): Promise<DocumentApprovalMutationResult> {
    this.requireOrganizationId(organizationId, 'rejectForAssignedApprover')
    if (!expectedRequestId.trim()) {
      throw new DocumentTenantInvariantError(400, 'Approval request ID is required')
    }
    return this.withTenantTransaction(async tx => {
      const actorEligibility = await resolveApprovalEligibility(
        tx,
        audit.userId,
        organizationId
      )
      if (!actorEligibility) {
        throw new DocumentTenantInvariantError(404, 'User not found')
      }
      const [document] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!document) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      const resourceDepartmentId = await this.resolveApprovalResourceDepartmentOrNotFound(
        tx,
        organizationId,
        documentId
      )
      this.assertApprovalResourceDepartmentAccess(resourceDepartmentId, departmentAccess)
      this.assertApprovalResourceDepartmentAccess(
        resourceDepartmentId,
        actorEligibility.departmentAccess
      )
      if (document.status !== 'in_review') {
        throw new DocumentTenantInvariantError(409, 'Document is not in review')
      }
      const pending = await tx
        .select()
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.resourceId, documentId),
          eq(approvalRequests.status, 'pending')
        ))
        .orderBy(asc(approvalRequests.stepNumber), asc(approvalRequests.requestedAt))
      const current = pending[0]
      if (!current) {
        throw new DocumentTenantInvariantError(409, 'Document approval request not found')
      }
      if (pending.length !== 1) {
        throw new DocumentTenantInvariantError(409, 'Document approval request state is invalid')
      }
      if (current.id !== expectedRequestId) {
        throw new DocumentTenantInvariantError(409, 'Approval request is no longer current')
      }
      if (current.approverId !== audit.userId) {
        throw new DocumentTenantInvariantError(403, 'Current approval step is assigned to another user')
      }
      if (current.requestedBy === audit.userId) {
        throw new DocumentTenantInvariantError(403, 'Requester cannot decide their own approval')
      }

      const now = new Date().toISOString()
      for (const approvalRequest of pending) {
        const [updatedRequest] = await tx
          .update(approvalRequests)
          .set({
            status: 'rejected',
            approvedAt: null,
            rejectionReason: reason,
            updatedAt: now,
          })
          .where(and(
            eq(approvalRequests.id, approvalRequest.id),
            eq(approvalRequests.status, 'pending')
          ))
          .returning({ id: approvalRequests.id })
        if (!updatedRequest) {
          throw new DocumentTenantInvariantError(409, 'Document approval request changed')
        }
        await this.insertApprovalEvent(
          tx,
          approvalRequest.id,
          'rejected',
          audit.userId,
          {
            reason,
            cancelled_later_step: approvalRequest.id !== current.id,
          },
          now
        )
      }
      const [updatedDocument] = await tx
        .update(documents)
        .set({
          status: 'draft',
          approvedBy: null,
          approvedAt: null,
          updatedBy: audit.userId,
          updatedAt: now,
        })
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          eq(documents.status, 'in_review')
        ))
        .returning({ id: documents.id })
      if (!updatedDocument) {
        throw new DocumentTenantInvariantError(409, 'Document approval state changed')
      }
      await this.insertDocumentAudit(
        tx,
        organizationId,
        documentId,
        audit,
        'document.rejected',
        { reason }
      )
      return {
        document: this.mapDocumentRowToEntity({
          ...document,
          status: 'draft',
          approvedBy: null,
          approvedAt: null,
          updatedBy: audit.userId,
          updatedAt: now,
        }),
        currentApproverId: null,
      }
    })
  }

  async revertTerminalApprovalForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    reason: string,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ): Promise<DocumentApprovalMutationResult> {
    this.requireOrganizationId(organizationId, 'revertTerminalApprovalForTenant')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveDocumentRevertActor(tx, audit.userId, organizationId)
      const [document] = await tx
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId)
        ))
        .limit(1)
      if (!document) {
        throw new DocumentTenantInvariantError(404, 'Document not found')
      }
      const resourceDepartmentId = await this.resolveApprovalResourceDepartmentOrNotFound(
        tx,
        organizationId,
        documentId
      )
      this.assertApprovalResourceDepartmentAccess(resourceDepartmentId, departmentAccess)

      const documentRequests = await tx
        .select()
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.resourceId, documentId)
        ))
        .orderBy(desc(approvalRequests.requestedAt), desc(approvalRequests.createdAt))
      const approvalRequest = documentRequests[0]
      if (!approvalRequest) {
        throw new DocumentTenantInvariantError(404, 'Approval request not found')
      }
      if (approvalRequest.id !== expectedRequestId) {
        throw new DocumentTenantInvariantError(409, 'Approval request is no longer current')
      }
      if (approvalRequest.approverId === audit.userId) {
        throw new DocumentTenantInvariantError(
          409,
          '自分が処理した承認を差し戻すことはできません'
        )
      }

      const previousStatus = approvalRequest.status
      const isApprovedPair = previousStatus === 'approved' && document.status === 'approved'
      const isRejectedPair = previousStatus === 'rejected' && document.status === 'draft'
      if (!isApprovedPair && !isRejectedPair) {
        throw new DocumentTenantInvariantError(409, 'Document approval state is inconsistent')
      }
      const previousDocumentStatus = isApprovedPair ? 'approved' : 'draft'

      const now = new Date().toISOString()
      const [updatedRequest] = await tx
        .update(approvalRequests)
        .set({
          status: 'pending',
          approvedAt: null,
          rejectionReason: null,
          revertedAt: now,
          revertReason: reason,
          updatedAt: now,
        })
        .where(and(
          eq(approvalRequests.id, approvalRequest.id),
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.resourceId, documentId),
          eq(approvalRequests.status, previousStatus)
        ))
        .returning({ id: approvalRequests.id })
      if (!updatedRequest) {
        throw new DocumentTenantInvariantError(409, 'Document approval request changed')
      }

      const [updatedDocument] = await tx
        .update(documents)
        .set({
          status: 'in_review',
          approvedBy: null,
          approvedAt: null,
          updatedBy: audit.userId,
          updatedAt: now,
        })
        .where(and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          eq(documents.status, previousDocumentStatus)
        ))
        .returning({ id: documents.id })
      if (!updatedDocument) {
        throw new DocumentTenantInvariantError(409, 'Document approval state changed')
      }

      const changes = { reason, previous_status: previousStatus }
      await this.insertApprovalEvent(
        tx,
        approvalRequest.id,
        'reverted',
        audit.userId,
        changes,
        now
      )
      await this.insertDocumentAudit(
        tx,
        organizationId,
        documentId,
        audit,
        'document.approval_reverted',
        changes
      )

      return {
        document: this.mapDocumentRowToEntity({
          ...document,
          status: 'in_review',
          approvedBy: null,
          approvedAt: null,
          updatedBy: audit.userId,
          updatedAt: now,
        }),
        currentApproverId: approvalRequest.approverId,
      }
    })
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

    const folderRows = await this.db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.organizationId, organizationId))
    const projectedFolderRows = await this.projectFolderRowsForTenant(
      this.db,
      folderRows,
      organizationId
    )
    const projectedFoldersById = new Map(projectedFolderRows.map(folder => [folder.id, folder]))
    const projectedFolderIds = [...projectedFoldersById.keys()]

    if (typeof filters?.folderId === 'string') {
      if (!projectedFoldersById.has(filters.folderId)) return []
    }

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(documents.organizationId, organizationId),
    ]

    // Folder filter
    if (filters?.folderId !== undefined) {
      if (filters.folderId === null) {
        if (projectedFolderIds.length > 0) {
          conditions.push(or(
            isNull(documents.folderId),
            notInArray(documents.folderId, projectedFolderIds)
          ) as never)
        }
      } else {
        conditions.push(eq(documents.folderId, filters.folderId) as never)
      }
    } else {
      // Default: projected root. Broken/foreign folder relations are treated as unassigned.
      if (projectedFolderIds.length > 0) {
        conditions.push(or(
          isNull(documents.folderId),
          notInArray(documents.folderId, projectedFolderIds)
        ) as never)
      }
    }

    // Status filter
    if (filters?.status) {
      conditions.push(eq(documents.status, filters.status) as never)
    }

    // Department filter (temporary inference via creator's primaryDepartmentId; BL-022)
    const departmentIds = filters?.departmentIds !== undefined
      ? [...new Set(filters.departmentIds)]
      : typeof filters?.departmentId === 'string' && filters.departmentId !== DEPARTMENT_UNASSIGNED_VALUE
        ? [filters.departmentId]
        : []
    const includeNoDepartment = filters?.includeNoDepartment === true
      || filters?.departmentId === null
      || filters?.departmentId === DEPARTMENT_UNASSIGNED_VALUE
    const needsDepartmentJoin = filters?.departmentIds !== undefined
      || filters?.departmentId !== undefined
      || filters?.includeNoDepartment === true

    if (needsDepartmentJoin && departmentIds.length === 0 && !includeNoDepartment) {
      return []
    }

    if (needsDepartmentJoin) {
      conditions.push(isNotNull(userProfiles.id) as never)
      if (departmentIds.length > 0 && includeNoDepartment) {
        conditions.push(
          or(
            inArray(userProfiles.primaryDepartmentId, departmentIds),
            isNull(userProfiles.primaryDepartmentId)
          ) as never
        )
      } else if (departmentIds.length > 0) {
        conditions.push(inArray(userProfiles.primaryDepartmentId, departmentIds) as never)
      } else {
        conditions.push(isNull(userProfiles.primaryDepartmentId) as never)
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
      .leftJoin(documentFolders, and(
        eq(documents.folderId, documentFolders.id),
        eq(documentFolders.organizationId, organizationId)
      ))

    // Conditionally add userProfiles JOIN for department filtering
    const queryWithJoins = needsDepartmentJoin
      ? baseQuery.leftJoin(
          userProfiles,
          and(
            eq(documents.createdBy, userProfiles.id),
            eq(userProfiles.organizationId, organizationId)
          )
        )
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

    this.logDataAccess('findByOrganizationId', organizationId, { count: docRows.length })

    return Promise.all(docRows.map(async row => {
      const projectedRow = await this.projectDocumentRowForTenant(
        this.db,
        {
          id: row.id,
          organizationId: row.organization_id,
          title: row.title,
          description: row.description,
          fileName: row.file_name,
          filePath: row.file_path,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          versionNumber: row.version_number,
          status: row.status,
          category: row.category,
          tags: row.tags,
          folderId: row.folder_id,
          createdBy: row.created_by,
          updatedBy: row.updated_by,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          retentionDeleteAt: row.retention_delete_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        organizationId,
        new Set(projectedFolderIds)
      )
      const tags = projectedRow.tags ? this.parseJsonArray(projectedRow.tags) : null
      const folderRow = projectedRow.folderId
        ? projectedFoldersById.get(projectedRow.folderId) ?? null
        : null
      const folder: DocumentFolder | null = folderRow
        ? this.mapFolderRowToEntity(folderRow)
        : null

      return {
        id: projectedRow.id,
        organization_id: projectedRow.organizationId,
        title: projectedRow.title,
        description: projectedRow.description ?? null,
        file_name: projectedRow.fileName ?? null,
        file_path: projectedRow.filePath ?? null,
        file_size: projectedRow.fileSize ?? null,
        mime_type: projectedRow.mimeType ?? null,
        version_number: projectedRow.versionNumber ?? null,
        status: projectedRow.status ?? null,
        category: projectedRow.category ?? null,
        tags,
        folder_id: folder?.id ?? null,
        created_by: projectedRow.createdBy,
        updated_by: projectedRow.updatedBy ?? null,
        approved_by: projectedRow.approvedBy ?? null,
        approved_at: projectedRow.approvedAt ?? null,
        retention_delete_at: projectedRow.retentionDeleteAt ?? null,
        created_at: projectedRow.createdAt ?? null,
        updated_at: projectedRow.updatedAt ?? null,
        department_id: null,
        folder,
        approvals: [],
      } as DocumentWithFolder
    }))
  }

  // =========================================
  // Document Version operations
  // =========================================

  async getVersionsForTenant(
    documentId: string,
    organizationId: string
  ): Promise<DocumentVersion[]> {
    this.requireOrganizationId(organizationId, 'getVersionsForTenant')
    const rows = await this.db
      .select({ version: documentVersions })
      .from(documentVersions)
      .innerJoin(documents, and(
        eq(documents.id, documentVersions.documentId),
        eq(documents.organizationId, organizationId)
      ))
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
    return Promise.all(rows.map(async row => this.mapVersionRowToEntity(
      await this.projectVersionRowForTenant(
        this.db,
        row.version,
        organizationId,
        documentId
      )
    )))
  }

  async getVersionForTenant(
    documentId: string,
    versionId: string,
    organizationId: string
  ): Promise<DocumentVersion | null> {
    this.requireOrganizationId(organizationId, 'getVersionForTenant')
    const [row] = await this.db
      .select({ version: documentVersions })
      .from(documentVersions)
      .innerJoin(documents, and(
        eq(documents.id, documentVersions.documentId),
        eq(documents.organizationId, organizationId)
      ))
      .where(and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.documentId, documentId)
      ))
      .limit(1)
    if (!row) return null
    const projected = await this.projectVersionRowForTenant(
      this.db,
      row.version,
      organizationId,
      documentId
    )
    return this.mapVersionRowToEntity(projected)
  }

  // =========================================
  // Document Folder operations
  // =========================================

  /**
   * Get folders for an organization, optionally filtered by parent
   */
  async getFolders(organizationId: string, parentId?: string | null): Promise<DocumentFolder[]> {
    this.requireOrganizationId(organizationId, 'getFolders')
    const rows = await this.db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.organizationId, organizationId))
      .orderBy(asc(documentFolders.name))
    const projected = await this.projectFolderRowsForTenant(this.db, rows, organizationId)
    if (
      parentId !== undefined
      && parentId !== null
      && !projected.some(folder => folder.id === parentId)
    ) {
      return []
    }
    const visible = parentId === undefined
      ? projected
      : projected.filter(folder => folder.parentId === parentId)

    this.logDataAccess('getFolders', organizationId, { count: visible.length })

    return visible.map(row => this.mapFolderRowToEntity(row))
  }

  async createFolderForTenant(
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentFolderCreatePayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentFolder> {
    this.requireOrganizationId(organizationId, 'createFolderForTenant')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      this.assertFullDepartmentAccessForFolderMutation(departmentAccess)
      const parent = payload.parentId
        ? await this.findFolderRowForTenant(tx, payload.parentId, organizationId)
        : null
      await this.assertSiblingFolderNameAvailable(
        tx,
        organizationId,
        payload.parentId,
        payload.name
      )
      const now = new Date().toISOString()
      const row = {
        id: crypto.randomUUID(),
        organizationId,
        name: payload.name,
        parentId: payload.parentId,
        path: `${parent?.path ?? ''}/${payload.name}`,
        createdBy: audit.userId,
        createdAt: now,
        updatedAt: now,
      }
      await tx.insert(documentFolders).values(row)
      await this.insertFolderAudit(
        tx,
        organizationId,
        row.id,
        audit,
        'document.folder_created',
        { name: payload.name, parent_id: payload.parentId }
      )
      return this.mapFolderRowToEntity(row)
    })
  }

  async updateFolderForTenant(
    folderId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentFolderUpdatePayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentFolder> {
    this.requireOrganizationId(organizationId, 'updateFolderForTenant')
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      this.assertFullDepartmentAccessForFolderMutation(departmentAccess)
      const existing = await this.findFolderRowForTenant(tx, folderId, organizationId)
      const name = payload.name ?? existing.name
      const parentId = payload.parentId === undefined ? existing.parentId : payload.parentId
      if (parentId === folderId) {
        throw new DocumentTenantInvariantError(409, 'Invalid document folder hierarchy')
      }
      const parent = parentId
        ? await this.findFolderRowForTenant(tx, parentId, organizationId)
        : null
      if (parentId) {
        await this.assertFolderCanBeReparented(tx, folderId, parentId, organizationId)
      }
      await this.assertSiblingFolderNameAvailable(
        tx,
        organizationId,
        parentId,
        name,
        folderId
      )

      const now = new Date().toISOString()
      const path = `${parent?.path ?? ''}/${name}`
      await tx
        .update(documentFolders)
        .set({ name, parentId, path, updatedAt: now })
        .where(and(
          eq(documentFolders.id, folderId),
          eq(documentFolders.organizationId, organizationId)
        ))
      await this.updateDescendantFolderPaths(tx, folderId, organizationId, path, now)
      await this.insertFolderAudit(
        tx,
        organizationId,
        folderId,
        audit,
        'document.folder_updated',
        {
          name: { from: existing.name, to: name },
          parent_id: { from: existing.parentId, to: parentId },
        }
      )
      return this.mapFolderRowToEntity({
        ...existing,
        name,
        parentId,
        path,
        updatedAt: now,
      })
    })
  }

  async deleteFolderForTenant(
    folderId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    audit: DocumentLifecycleAuditContext
  ): Promise<void> {
    this.requireOrganizationId(organizationId, 'deleteFolderForTenant')
    await this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      this.assertFullDepartmentAccessForFolderMutation(departmentAccess)
      const existing = await this.findFolderRowForTenant(tx, folderId, organizationId)
      const [[child], [document]] = await Promise.all([
        tx
          .select({ id: documentFolders.id })
          .from(documentFolders)
          .where(and(
            eq(documentFolders.organizationId, organizationId),
            eq(documentFolders.parentId, folderId)
          ))
          .limit(1),
        tx
          .select({ id: documents.id })
          .from(documents)
          .where(and(
            eq(documents.organizationId, organizationId),
            eq(documents.folderId, folderId)
          ))
          .limit(1),
      ])
      if (child || document) {
        throw new DocumentTenantInvariantError(409, 'Document folder is not empty')
      }
      await this.insertFolderAudit(
        tx,
        organizationId,
        folderId,
        audit,
        'document.folder_deleted',
        { name: existing.name, parent_id: existing.parentId }
      )
      await tx
        .delete(documentFolders)
        .where(and(
          eq(documentFolders.id, folderId),
          eq(documentFolders.organizationId, organizationId)
        ))
    })
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
  // Approval dashboard metrics
  // =========================================

  /**
   * Get aggregated approval metrics for a user's dashboard
   */
  async getApproverDashboardMetrics(
    userId: string,
    organizationId: string,
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

    this.requireOrganizationId(organizationId, 'getApproverDashboardMetrics')
    const departmentAccess = await this.resolveDocumentDepartmentAccessForUser(
      userId,
      organizationId
    )
    const isCurrentPendingStep = sql`${approvalRequests.stepNumber} = (
      SELECT MIN(prior.step_number)
      FROM approval_requests AS prior
      WHERE prior.organization_id = ${organizationId}
        AND prior.resource_type = 'document'
        AND prior.resource_id = ${approvalRequests.resourceId}
        AND prior.status = 'pending'
    )`
    const documentIsVisible = departmentAccess.mode === 'all'
      ? sql`EXISTS (
          SELECT 1
          FROM documents AS metric_document
          WHERE metric_document.id = ${approvalRequests.resourceId}
            AND metric_document.organization_id = ${organizationId}
        )`
      : this.buildScopedApprovalDocumentVisibility(
          organizationId,
          departmentAccess.departmentIds
        )

    // Total pending count
    const [pendingResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.approverId, userId),
          eq(approvalRequests.status, 'pending'),
          documentIsVisible,
          isCurrentPendingStep
        )
      )

    // Due soon: pending, created_at <= dueThreshold AND created_at > escalationThreshold
    const [dueSoonResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.approverId, userId),
          eq(approvalRequests.status, 'pending'),
          documentIsVisible,
          isCurrentPendingStep,
          lte(approvalRequests.requestedAt, dueThresholdIso),
          gt(approvalRequests.requestedAt, escalationThresholdIso)
        )
      )

    // Escalation: pending, created_at <= escalationThreshold
    const [escalationResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.approverId, userId),
          eq(approvalRequests.status, 'pending'),
          documentIsVisible,
          isCurrentPendingStep,
          lte(approvalRequests.requestedAt, escalationThresholdIso)
        )
      )

    // History: approved/rejected, acted_at is not null, acted_at >= historyThreshold
    const [historyResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, 'document'),
          eq(approvalRequests.approverId, userId),
          inArray(approvalRequests.status, ['approved', 'rejected']),
          documentIsVisible,
          gte(approvalRequests.updatedAt, historyThresholdIso)
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

  private async projectTenantUserIds(
    db: DrizzleDb,
    organizationId: string,
    userIds: Array<string | null | undefined>
  ): Promise<Set<string>> {
    const candidates = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
    if (candidates.length === 0) return new Set()
    const rows = await db
      .select({ userId: userMemberships.userId })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.organizationId, organizationId),
        inArray(userMemberships.userId, candidates)
      ))
    return new Set(rows.map(row => row.userId))
  }

  private async projectDocumentRowForTenant(
    db: DrizzleDb,
    row: typeof documents.$inferSelect,
    organizationId: string,
    projectedFolderIds?: ReadonlySet<string>
  ): Promise<typeof documents.$inferSelect> {
    const [tenantUserIds, validFolderIds] = await Promise.all([
      this.projectTenantUserIds(
        db,
        organizationId,
        [row.createdBy, row.updatedBy, row.approvedBy]
      ),
      projectedFolderIds
        ? Promise.resolve(projectedFolderIds)
        : db
            .select()
            .from(documentFolders)
            .where(eq(documentFolders.organizationId, organizationId))
            .then(async folders => new Set(
              (await this.projectFolderRowsForTenant(db, folders, organizationId))
                .map(folder => folder.id)
            )),
    ])
    return {
      ...row,
      filePath: row.filePath && isDocumentStoragePath(row.filePath, organizationId, row.id)
        ? row.filePath
        : null,
      folderId: row.folderId && validFolderIds.has(row.folderId) ? row.folderId : null,
      createdBy: tenantUserIds.has(row.createdBy) ? row.createdBy : '',
      updatedBy: row.updatedBy && tenantUserIds.has(row.updatedBy) ? row.updatedBy : null,
      approvedBy: row.approvedBy && tenantUserIds.has(row.approvedBy) ? row.approvedBy : null,
    }
  }

  private async projectVersionRowForTenant(
    db: DrizzleDb,
    row: typeof documentVersions.$inferSelect,
    organizationId: string,
    documentId: string
  ): Promise<typeof documentVersions.$inferSelect> {
    const tenantUserIds = await this.projectTenantUserIds(
      db,
      organizationId,
      [row.createdBy]
    )
    return {
      ...row,
      filePath: row.filePath && isDocumentStoragePath(row.filePath, organizationId, documentId)
        ? row.filePath
        : null,
      createdBy: tenantUserIds.has(row.createdBy) ? row.createdBy : '',
    }
  }

  private async projectFolderRowsForTenant(
    db: DrizzleDb,
    rows: Array<typeof documentFolders.$inferSelect>,
    organizationId: string
  ): Promise<Array<typeof documentFolders.$inferSelect>> {
    const foldersById = new Map(rows.map(row => [row.id, row]))
    const pathCache = new Map<string, string | null>()
    const resolvePath = (folderId: string, visiting = new Set<string>()): string | null => {
      if (pathCache.has(folderId)) return pathCache.get(folderId) ?? null
      const folder = foldersById.get(folderId)
      if (!folder || visiting.has(folderId) || !this.isSafeFolderName(folder.name)) {
        pathCache.set(folderId, null)
        return null
      }
      const nextVisiting = new Set(visiting)
      nextVisiting.add(folderId)
      const parentPath = folder.parentId
        ? resolvePath(folder.parentId, nextVisiting)
        : ''
      if (parentPath === null) {
        pathCache.set(folderId, null)
        return null
      }
      const path = `${parentPath}/${folder.name}`
      pathCache.set(folderId, path)
      return path
    }
    const tenantUserIds = await this.projectTenantUserIds(
      db,
      organizationId,
      rows.map(row => row.createdBy)
    )
    return rows.flatMap(row => {
      const path = resolvePath(row.id)
      if (path === null) return []
      return [{
        ...row,
        path,
        createdBy: tenantUserIds.has(row.createdBy) ? row.createdBy : '',
      }]
    })
  }

  private isSafeFolderName(name: string): boolean {
    return Boolean(
      name
      && name.length <= 100
      && !name.includes('/')
      && !name.includes('\\')
      && ![...name].some(character => (character.codePointAt(0) ?? 0) < 0x20)
    )
  }

  private parseStorageOperationFilePaths(value: string): string[] {
    try {
      const parsed: unknown = JSON.parse(value)
      if (
        Array.isArray(parsed)
        && parsed.every(path => typeof path === 'string')
      ) {
        return parsed
      }
    } catch {
      // Fall through to fail closed.
    }
    throw new DocumentTenantInvariantError(409, 'Invalid document storage operation')
  }

  private async claimStorageOperation(
    db: DrizzleDb,
    operationId: string,
    organizationId: string,
    stalePendingBefore: string,
    now: string
  ): Promise<typeof documentStorageOperations.$inferSelect | null> {
    const leaseToken = crypto.randomUUID()
    const leaseExpiresAt = new Date(Date.parse(now) + 2 * 60 * 1000).toISOString()
    const [claimed] = await db
      .update(documentStorageOperations)
      .set({
        status: 'cleanup_claimed',
        leaseToken,
        leaseExpiresAt,
        updatedAt: now,
      })
      .where(and(
        eq(documentStorageOperations.id, operationId),
        eq(documentStorageOperations.organizationId, organizationId),
        or(
          eq(documentStorageOperations.status, 'cleanup_pending'),
          and(
            eq(documentStorageOperations.status, 'pending'),
            lte(documentStorageOperations.updatedAt, stalePendingBefore)
          ),
          and(
            eq(documentStorageOperations.status, 'cleanup_claimed'),
            lte(documentStorageOperations.leaseExpiresAt, now)
          )
        )
      ))
      .returning()
    return claimed ?? null
  }

  private async findFolderRowForTenant(
    db: DrizzleDb,
    folderId: string,
    organizationId: string
  ): Promise<typeof documentFolders.$inferSelect> {
    const rows = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.organizationId, organizationId))
    const projected = await this.projectFolderRowsForTenant(db, rows, organizationId)
    const folder = projected.find(candidate => candidate.id === folderId)
    if (!folder) {
      throw new DocumentTenantInvariantError(404, 'Document folder not found')
    }
    return folder
  }

  private async assertSiblingFolderNameAvailable(
    db: DrizzleDb,
    organizationId: string,
    parentId: string | null,
    name: string,
    excludedFolderId?: string
  ): Promise<void> {
    const conditions = [
      eq(documentFolders.organizationId, organizationId),
      eq(documentFolders.name, name),
      parentId === null
        ? isNull(documentFolders.parentId)
        : eq(documentFolders.parentId, parentId),
    ]
    if (excludedFolderId) conditions.push(ne(documentFolders.id, excludedFolderId))
    const [duplicate] = await db
      .select({ id: documentFolders.id })
      .from(documentFolders)
      .where(and(...conditions))
      .limit(1)
    if (duplicate) {
      throw new DocumentTenantInvariantError(409, 'Document folder already exists')
    }
  }

  private async assertFolderCanBeReparented(
    db: DrizzleDb,
    folderId: string,
    parentId: string,
    organizationId: string
  ): Promise<void> {
    const visited = new Set<string>()
    let currentId: string | null = parentId
    while (currentId) {
      if (currentId === folderId || visited.has(currentId)) {
        throw new DocumentTenantInvariantError(409, 'Invalid document folder hierarchy')
      }
      visited.add(currentId)
      const current = await this.findFolderRowForTenant(db, currentId, organizationId)
      currentId = current.parentId
    }
  }

  private async updateDescendantFolderPaths(
    db: DrizzleDb,
    folderId: string,
    organizationId: string,
    folderPath: string,
    updatedAt: string
  ): Promise<void> {
    const rows = await db
      .select({
        id: documentFolders.id,
        name: documentFolders.name,
        parentId: documentFolders.parentId,
      })
      .from(documentFolders)
      .where(eq(documentFolders.organizationId, organizationId))
    const children = new Map<string, typeof rows>()
    for (const row of rows) {
      if (!row.parentId) continue
      const siblings = children.get(row.parentId) ?? []
      siblings.push(row)
      children.set(row.parentId, siblings)
    }

    const visited = new Set([folderId])
    const queue = (children.get(folderId) ?? []).map(row => ({ row, parentPath: folderPath }))
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.row.id)) {
        throw new DocumentTenantInvariantError(409, 'Invalid document folder hierarchy')
      }
      visited.add(current.row.id)
      const path = `${current.parentPath}/${current.row.name}`
      await db
        .update(documentFolders)
        .set({ path, updatedAt })
        .where(and(
          eq(documentFolders.id, current.row.id),
          eq(documentFolders.organizationId, organizationId)
        ))
      for (const child of children.get(current.row.id) ?? []) {
        queue.push({ row: child, parentPath: path })
      }
    }
  }

  private async insertFolderAudit(
    db: DrizzleDb,
    organizationId: string,
    folderId: string,
    audit: DocumentLifecycleAuditContext,
    action:
      | 'document.folder_created'
      | 'document.folder_updated'
      | 'document.folder_deleted',
    changes: unknown
  ): Promise<void> {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: audit.userId,
      action,
      resourceType: 'document_folder',
      resourceId: folderId,
      changes: JSON.stringify(changes),
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
      scope: 'tenant',
      createdAt: new Date().toISOString(),
    })
  }

  private buildDocumentInsertRow(data: DocumentInsert, id: string, now: string) {
    return {
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
  }

  private buildDocumentUpdateSet(updates: DocumentUpdate): Record<string, unknown> {
    const setPayload: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.category !== undefined) setPayload.category = updates.category
    if (updates.tags !== undefined) setPayload.tags = updates.tags ? JSON.stringify(updates.tags) : '[]'
    if (updates.folder_id !== undefined) setPayload.folderId = updates.folder_id
    if (updates.updated_by !== undefined) setPayload.updatedBy = updates.updated_by
    if (updates.retention_delete_at !== undefined) setPayload.retentionDeleteAt = updates.retention_delete_at
    return setPayload
  }

  private async assertActiveMembership(
    db: DrizzleDb,
    userId: string,
    organizationId: string
  ): Promise<void> {
    const [membership] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1)
    if (!membership) {
      throw new DocumentTenantInvariantError(404, 'Document not found')
    }
  }

  private async assertActiveDocumentRevertActor(
    db: DrizzleDb,
    userId: string,
    organizationId: string
  ): Promise<void> {
    const [actor] = await db
      .select({ role: userMemberships.role })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active'),
        eq(userProfiles.isActive, true)
      ))
      .limit(1)
    if (!actor) {
      throw new DocumentTenantInvariantError(404, 'User not found')
    }
    if (!['org_admin', 'system_operator'].includes(actor.role)) {
      throw new DocumentTenantInvariantError(403, 'Document approval revert is forbidden')
    }
  }

  private async resolveApprovalResourceDepartmentOrNotFound(
    db: DrizzleDb,
    organizationId: string,
    documentId: string
  ): Promise<string | null> {
    const scope = await resolveDocumentApprovalResourceScope(
      db,
      organizationId,
      documentId
    )
    if (!scope.ok) {
      throw new DocumentTenantInvariantError(404, 'Document not found')
    }
    return scope.departmentId
  }

  private assertApprovalResourceDepartmentAccess(
    departmentId: string | null,
    departmentAccess: DocumentDepartmentAccess
  ): void {
    if (
      departmentAccess.mode === 'all'
      || (departmentId === null && departmentAccess.includeUnassigned)
      || (departmentId !== null && departmentAccess.departmentIds.includes(departmentId))
    ) {
      return
    }
    throw new DocumentTenantInvariantError(404, 'Document not found')
  }

  private async assertDocumentDepartmentAccess(
    db: DrizzleDb,
    creatorId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess
  ): Promise<void> {
    if (departmentAccess.mode === 'all') return
    const [profile] = await db
      .select({
        profileOrganizationId: userProfiles.organizationId,
        departmentId: userProfiles.primaryDepartmentId,
      })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.userId, creatorId),
        eq(userMemberships.organizationId, organizationId)
      ))
      .limit(1)
    if (!profile) {
      throw new DocumentTenantInvariantError(404, 'Document not found')
    }
    const departmentId = profile.profileOrganizationId === organizationId
      ? profile.departmentId ?? null
      : null
    if (
      departmentId === null
      || departmentAccess.departmentIds.includes(departmentId)
    ) {
      return
    }
    throw new DocumentTenantInvariantError(404, 'Document not found')
  }

  private assertFullDepartmentAccessForFolderMutation(
    departmentAccess: DocumentDepartmentAccess
  ): void {
    if (departmentAccess.mode !== 'all') {
      throw new DocumentTenantInvariantError(
        403,
        'Document folder mutation requires full department access'
      )
    }
  }

  private async resolveDocumentDepartmentAccessForUser(
    userId: string,
    organizationId: string
  ): Promise<DocumentDepartmentAccess> {
    const [actor] = await this.db
      .select({
        role: userMemberships.role,
        departmentScope: userMemberships.departmentScope,
      })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active'),
        eq(userProfiles.isActive, true)
      ))
      .limit(1)
    if (!actor) {
      throw new DocumentTenantInvariantError(404, 'User not found')
    }
    if (
      hasFullDepartmentAccess(actor.role as UserRole)
      || actor.departmentScope === 'all'
    ) {
      return { mode: 'all' }
    }
    const scopes = await this.db
      .select({ departmentId: userDepartmentScopes.departmentId })
      .from(userDepartmentScopes)
      .where(and(
        eq(userDepartmentScopes.userId, userId),
        eq(userDepartmentScopes.organizationId, organizationId)
      ))
    return {
      mode: 'scoped',
      departmentIds: [...new Set(scopes.map(scope => scope.departmentId))],
      includeUnassigned: true,
    }
  }

  private buildScopedApprovalDocumentVisibility(
    organizationId: string,
    departmentIds: string[]
  ) {
    const departmentCondition = departmentIds.length > 0
      ? sql`(
          CASE
            WHEN metric_creator.organization_id = ${organizationId}
              THEN metric_creator.primary_department_id
            ELSE NULL
          END IS NULL
          OR metric_creator.primary_department_id IN (
            ${sql.join(departmentIds.map(id => sql`${id}`), sql`, `)}
          )
        )`
      : sql`CASE
          WHEN metric_creator.organization_id = ${organizationId}
            THEN metric_creator.primary_department_id
          ELSE NULL
        END IS NULL`
    return sql`EXISTS (
      SELECT 1
      FROM documents AS metric_document
      INNER JOIN user_profiles AS metric_creator
        ON metric_creator.id = metric_document.created_by
      INNER JOIN user_memberships AS metric_creator_membership
        ON metric_creator_membership.user_id = metric_document.created_by
       AND metric_creator_membership.organization_id = ${organizationId}
      WHERE metric_document.id = ${approvalRequests.resourceId}
        AND metric_document.organization_id = ${organizationId}
        AND ${departmentCondition}
    )`
  }

  private async insertDocumentAudit(
    db: DrizzleDb,
    organizationId: string,
    documentId: string,
    audit: DocumentLifecycleAuditContext,
    action:
      | 'document.created'
      | 'document.updated'
      | 'document.deleted'
      | 'document.version_created'
      | 'document.version_deleted'
      | 'document.revision_started'
      | 'document.approval_requested'
      | 'document.approved'
      | 'document.rejected'
      | 'document.approval_reverted',
    changes: unknown
  ): Promise<void> {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: audit.userId,
      action,
      resourceType: 'document',
      resourceId: documentId,
      changes: JSON.stringify(changes),
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
      scope: 'tenant',
      createdAt: new Date().toISOString(),
    })
  }

  private async insertApprovalEvent(
    db: DrizzleDb,
    approvalRequestId: string,
    eventType: 'requested' | 'approved' | 'rejected' | 'reverted',
    actorId: string,
    payload: Record<string, unknown>,
    createdAt: string
  ): Promise<void> {
    await db.insert(approvalEvents).values({
      id: crypto.randomUUID(),
      approvalRequestId,
      eventType,
      actorId,
      payload: JSON.stringify(payload),
      createdAt,
    })
  }

  private async insertDocumentApprovalNotification(
    db: DrizzleDb,
    organizationId: string,
    approverId: string,
    documentTitle: string,
    documentId: string,
    requesterId: string,
    createdAt: string
  ): Promise<void> {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: approverId,
      title: '文書承認依頼',
      message: `文書「${documentTitle}」の承認が必要です。`,
      type: 'document_approval',
      priority: 'high',
      status: 'unread',
      link: `/documents/${documentId}`,
      metadata: JSON.stringify({ document_id: documentId, requester_id: requesterId }),
      createdAt,
    })
  }

  private async withTenantTransaction<T>(operation: (tx: DrizzleDb) => Promise<T>): Promise<T> {
    return runDocumentWriteExclusive(async () => {
      const client = (this.db as unknown as { $client: Client }).$client
      const retryDelaysMs = [10, 20, 40, 80, 160, 320]

      for (let attempt = 0; ; attempt += 1) {
        let transaction: Awaited<ReturnType<Client['transaction']>> | null = null
        try {
          transaction = await client.transaction('write')
          const tx = drizzle(transaction as unknown as Client, { schema }) as DrizzleDb
          const result = await operation(tx)
          await transaction.commit()
          return result
        } catch (error) {
          if (transaction) {
            await transaction.rollback()
          }
          const retryDelay = retryDelaysMs[attempt]
          if (retryDelay === undefined || !this.isDatabaseBusyError(error)) {
            throw error
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        } finally {
          transaction?.close()
        }
      }
    })
  }

  private isDatabaseBusyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const candidate = error as { code?: unknown; message?: unknown }
    return candidate.code === 'SQLITE_BUSY'
      || (typeof candidate.message === 'string' && candidate.message.includes('SQLITE_BUSY'))
  }

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
