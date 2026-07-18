import type { Database } from '@/types/database.types'
import type { QueryOptions } from './IBaseRepository'
import type {
  DocumentApproval as DrizzleDocumentApproval,
  DocumentStorageOperation as DrizzleDocumentStorageOperation,
} from '@/lib/db/drizzle/schema/documents'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

// Database types
type Document = Database['public']['Tables']['documents']['Row']
type DocumentInsert = Database['public']['Tables']['documents']['Insert']
type DocumentUpdate = Database['public']['Tables']['documents']['Update']
type DocumentFolder = Database['public']['Tables']['document_folders']['Row']
type DocumentFolderInsert = Database['public']['Tables']['document_folders']['Insert']
type DocumentApproval = DrizzleDocumentApproval
type DocumentTemplate = Database['public']['Tables']['document_templates']['Row']
type DocumentVersion = Database['public']['Tables']['document_versions']['Row']
type DocumentStorageOperation = DrizzleDocumentStorageOperation

// Re-export for convenience
export type {
  Document,
  DocumentInsert,
  DocumentUpdate,
  DocumentFolder,
  DocumentFolderInsert,
  DocumentApproval,
  DocumentTemplate,
  DocumentVersion,
  DocumentStorageOperation
}

/**
 * Extended document type with related data
 */
export interface DocumentWithFolder extends Document {
  folder?: DocumentFolder | null
  approvals?: DocumentApproval[]
}

/**
 * Document filter options
 */
export interface DocumentFilters {
  folderId?: string | null
  departmentId?: string | null
  departmentIds?: string[]
  includeNoDepartment?: boolean
  status?: string
}

export type DocumentTenantInvariantValidator = (db: DrizzleDb) => Promise<void>

export type DocumentDepartmentAccess =
  | { mode: 'all' }
  | { mode: 'scoped'; departmentIds: string[]; includeUnassigned: true }

export interface DocumentLifecycleAuditContext {
  userId: string
  userAgent?: string | null
  ipAddress?: string | null
}

export interface DocumentFileVersionPayload {
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  title: string
  description?: string | null
  changes?: string | null
  mode?: 'normal' | 'revision'
}

export interface DocumentFolderCreatePayload {
  name: string
  parentId: string | null
}

export interface DocumentFolderUpdatePayload {
  name?: string
  parentId?: string | null
}

export interface DocumentUploadOperationPayload {
  operationKey: string
  filePath: string
  requestFingerprint: string
  mode: 'normal' | 'revision'
}

export interface DocumentDeleteOperationResult {
  operation: DocumentStorageOperation
  filePaths: string[]
}

export interface DocumentApprovalRequestPayload {
  approverId: string
}

export interface DocumentApprovalMutationResult {
  document: Document
  currentApproverId: string | null
}

/**
 * Approval dashboard metrics
 */
export interface ApproverDashboardMetrics {
  pendingCount: number
  dueSoonCount: number
  escalationCount: number
  historyCount: number
  dueSoonHours: number
  escalationHours: number
  historyWindowDays: number
  lastRefreshedAt: string
}

/**
 * Document Repository Interface
 *
 * Handles all document-related data operations including:
 * - Document CRUD
 * - Document folders
 * - Document versions
 * - Document approvals
 * - Document templates
 *
 * Note: File storage operations (upload, download) are handled separately
 * through local filesystem storage and are not part of this repository.
 */
export interface IDocumentRepository {
  findOrganizationIdByDocumentId(documentId: string): Promise<string | null>
  findByIdAndOrganizationId(documentId: string, organizationId: string): Promise<Document | null>
  findByIdForDepartmentAccess(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess
  ): Promise<Document | null>
  findByOrganizationId(
    organizationId: string,
    filters?: DocumentFilters,
    options?: QueryOptions
  ): Promise<DocumentWithFolder[]>
  createWithTenantInvariant(
    data: DocumentInsert,
    validate: DocumentTenantInvariantValidator,
    audit: DocumentLifecycleAuditContext
  ): Promise<Document>
  updateWithTenantInvariant(
    documentId: string,
    organizationId: string,
    data: DocumentUpdate,
    departmentAccess: DocumentDepartmentAccess,
    validate: DocumentTenantInvariantValidator,
    audit: DocumentLifecycleAuditContext
  ): Promise<Document | null>
  prepareFileUploadOperationForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentUploadOperationPayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<{ operation: DocumentStorageOperation; replay: boolean }>
  completeFileUploadOperationForTenant(
    operationId: string,
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentFileVersionPayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<{ document: Document; version: DocumentVersion }>
  deleteDocumentWithStorageForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    operationKey: string,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentDeleteOperationResult>
  deleteDocumentVersionWithStorageForTenant(
    documentId: string,
    versionId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    operationKey: string,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentDeleteOperationResult>
  markStorageOperationCleanupOutcome(
    operationId: string,
    organizationId: string,
    leaseToken: string,
    outcome: { success: boolean; errorMessage?: string | null }
  ): Promise<boolean>
  claimStorageOperationForCleanup(
    operationId: string,
    organizationId: string,
    audit: DocumentLifecycleAuditContext,
    stalePendingBefore: string
  ): Promise<DocumentStorageOperation | null>
  claimStorageOperationsForCleanup(
    organizationId: string,
    audit: DocumentLifecycleAuditContext,
    stalePendingBefore: string,
    limit: number
  ): Promise<DocumentStorageOperation[]>

  getVersionsForTenant(documentId: string, organizationId: string): Promise<DocumentVersion[]>
  getVersionForTenant(
    documentId: string,
    versionId: string,
    organizationId: string
  ): Promise<DocumentVersion | null>

  requestApprovalForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentApprovalRequestPayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentApprovalMutationResult>
  approveForAssignedApprover(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    comment: string | null,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ): Promise<DocumentApprovalMutationResult>
  rejectForAssignedApprover(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    reason: string,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ): Promise<DocumentApprovalMutationResult>
  revertTerminalApprovalForTenant(
    documentId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    reason: string,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ): Promise<DocumentApprovalMutationResult>

  // Document Folder operations
  getFolders(organizationId: string, parentId?: string | null): Promise<DocumentFolder[]>
  createFolderForTenant(
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentFolderCreatePayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentFolder>
  updateFolderForTenant(
    folderId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    payload: DocumentFolderUpdatePayload,
    audit: DocumentLifecycleAuditContext
  ): Promise<DocumentFolder>
  deleteFolderForTenant(
    folderId: string,
    organizationId: string,
    departmentAccess: DocumentDepartmentAccess,
    audit: DocumentLifecycleAuditContext
  ): Promise<void>

  // Document Template operations
  getTemplates(language?: string): Promise<DocumentTemplate[]>
  getTemplateById(templateId: string): Promise<DocumentTemplate | null>

  // Approval dashboard metrics
  getApproverDashboardMetrics(
    userId: string,
    organizationId: string,
    thresholds: {
      dueSoonHours: number
      escalationHours: number
      historyWindowDays: number
    }
  ): Promise<ApproverDashboardMetrics>
}
