import type { Database } from '@/types/database.types'
import type { IBaseRepository, IOrganizationScopedRepository, QueryOptions } from './IBaseRepository'
import type {
  DocumentApproval as DrizzleDocumentApproval,
  DocumentApprovalInsert as DrizzleDocumentApprovalInsert
} from '@/lib/db/drizzle/schema/documents'

// Database types
type Document = Database['public']['Tables']['documents']['Row']
type DocumentInsert = Database['public']['Tables']['documents']['Insert']
type DocumentUpdate = Database['public']['Tables']['documents']['Update']
type DocumentFolder = Database['public']['Tables']['document_folders']['Row']
type DocumentFolderInsert = Database['public']['Tables']['document_folders']['Insert']
type DocumentApproval = DrizzleDocumentApproval
type DocumentApprovalInsert = DrizzleDocumentApprovalInsert
type DocumentApprovalUpdate = Partial<DrizzleDocumentApprovalInsert>
type DocumentTemplate = Database['public']['Tables']['document_templates']['Row']
type DocumentVersion = Database['public']['Tables']['document_versions']['Row']
type DocumentVersionInsert = Database['public']['Tables']['document_versions']['Insert']

// Re-export for convenience
export type {
  Document,
  DocumentInsert,
  DocumentUpdate,
  DocumentFolder,
  DocumentFolderInsert,
  DocumentApproval,
  DocumentApprovalInsert,
  DocumentApprovalUpdate,
  DocumentTemplate,
  DocumentVersion,
  DocumentVersionInsert
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
  includeNoDepartment?: boolean
  status?: string
}

/**
 * Approval creation payload
 */
export interface ApprovalCreationPayload {
  documentId: string
  step: number
  approverId: string
  status: 'pending' | 'skipped'
  actedAt?: string | null
  createdBy: string
}

/**
 * Version creation payload
 */
export interface VersionCreationPayload {
  documentId: string
  title: string
  description?: string | null
  fileName?: string | null
  filePath?: string | null
  fileSize?: number | null
  changes?: string | null
  createdBy: string
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
export interface IDocumentRepository extends IOrganizationScopedRepository<Document, DocumentInsert, DocumentUpdate> {
  // Document operations (enhanced from base repository)
  findByOrganizationId(
    organizationId: string,
    filters?: DocumentFilters,
    options?: QueryOptions
  ): Promise<DocumentWithFolder[]>

  // Document Version operations
  getVersions(documentId: string, options?: QueryOptions): Promise<DocumentVersion[]>
  createVersion(payload: VersionCreationPayload): Promise<DocumentVersion>
  getLatestVersionNumber(documentId: string): Promise<number>

  // Document Folder operations
  getFolders(organizationId: string, parentId?: string | null): Promise<DocumentFolder[]>
  createFolder(data: DocumentFolderInsert): Promise<DocumentFolder>
  deleteFolder(organizationId: string, folderId: string): Promise<void>
  countDocumentsInFolder(folderId: string): Promise<number>
  countSubfolders(folderId: string): Promise<number>

  // Document Template operations
  getTemplates(language?: string): Promise<DocumentTemplate[]>
  getTemplateById(templateId: string): Promise<DocumentTemplate | null>

  // Document Approval operations
  getApprovals(documentId: string): Promise<DocumentApproval[]>
  createApprovals(approvals: ApprovalCreationPayload[]): Promise<void>
  updateApproval(
    approvalId: string,
    updates: DocumentApprovalUpdate
  ): Promise<DocumentApproval | null>
  getPendingApprovalForUser(
    documentId: string,
    userId: string
  ): Promise<DocumentApproval | null>

  // Approval dashboard metrics
  getApproverDashboardMetrics(
    userId: string,
    thresholds: {
      dueSoonHours: number
      escalationHours: number
      historyWindowDays: number
    }
  ): Promise<ApproverDashboardMetrics>
}
