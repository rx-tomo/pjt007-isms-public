/**
 * Document Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IDocumentRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 *
 * Note: File storage operations (upload, download) use IStorageProvider
 * abstraction, allowing seamless switching between different storage backends.
 */
import { getDb } from '@/lib/db/drizzle/client'
import { organizations, userProfiles } from '@/lib/db/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getDocumentRepository, getAuditLogRepository, getAuthProvider } from '@/lib/container'
import type { StorageQuotaService } from '@/lib/services/storageQuota'
import { ApprovalService } from '@/lib/services/approval'
import type {
  IDocumentRepository,
  DocumentFilters,
  ApproverDashboardMetrics,
  Document,
  DocumentInsert,
  DocumentUpdate,
  DocumentFolder,
  DocumentApproval,
  DocumentTemplate,
  DocumentVersion,
  DocumentWithFolder as RepoDocumentWithFolder,
} from '@/lib/db/repositories/interfaces/IDocumentRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { Json } from '@/types/database.types'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { applyDepartmentAccessFilters } from '@/lib/server/auth/departmentAccessFilters'
import {
  DOCUMENT_APPROVAL_TOTAL_STEPS,
  LEGACY_DOCUMENT_APPROVAL_TOTAL_STEPS,
  isFinalDocumentApprovalStep,
  normalizeDocumentApprovalStep,
} from '@/lib/approvals/documentApprovalSteps'

export interface DocumentApprovalProgress {
  currentStep: number
  totalSteps: number
  currentStatus: 'pending' | 'approved' | 'rejected' | 'none'
  overallStatus: 'not_submitted' | 'in_review' | 'approved' | 'rejected'
  currentRequestId?: string
  currentApprover?: string
  dueAt?: string
}

export interface DocumentWithFolder extends RepoDocumentWithFolder {
  approvalProgress?: DocumentApprovalProgress
}

export class DocumentExportError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
    this.name = 'DocumentExportError'
  }
}

export type {
  Document,
  DocumentInsert,
  DocumentUpdate,
  DocumentFolder,
  DocumentTemplate,
  DocumentVersion
}

interface DocumentServiceOptions {
  fetcher?: typeof fetch
  storageQuotaService?: StorageQuotaService
}

export const APPROVER_DUE_SOON_THRESHOLD_HOURS = 48
export const APPROVER_ESCALATION_THRESHOLD_HOURS = 96
export const APPROVER_HISTORY_WINDOW_DAYS = 30
const DOCUMENT_APPROVER_ROLES = new Set(['approver', 'org_admin', 'system_operator'])

export function isEligibleDocumentApproverCandidate(
  candidate: { id: string; role: string; is_active?: boolean | null },
  currentUserId?: string | null
): boolean {
  return candidate.id !== currentUserId
    && candidate.is_active === true
    && DOCUMENT_APPROVER_ROLES.has(candidate.role)
}

export { ApproverDashboardMetrics }

export class DocumentService {
  private fetcher: typeof fetch
  private approvalService: ApprovalService
  private repositoryPromise: Promise<IDocumentRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null

  constructor(options?: DocumentServiceOptions) {
    const defaultFetcher: typeof fetch = (...args) => fetch(...args)
    this.fetcher = options?.fetcher ?? defaultFetcher
    this.approvalService = new ApprovalService()
  }

  private async fetchDocumentsApi<T>(params: Record<string, string | undefined>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchDocumentsApi must only be called from the browser')
    }

    const url = new URL('/api/documents', window.location.origin)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    })

    const response = await this.fetcher(url.toString(), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  private async fetchApproverMetricsApi(organizationId: string): Promise<ApproverDashboardMetrics> {
    if (typeof window === 'undefined') {
      throw new Error('fetchApproverMetricsApi must only be called from the browser')
    }

    const data = await this.fetchDocumentsApi<{ data: ApproverDashboardMetrics }>({
      action: 'approverMetrics',
      organizationId,
    })

    return data.data
  }

  private async getRepository(): Promise<IDocumentRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getDocumentRepository()
    }
    return this.repositoryPromise
  }

  private async getAuditLog(): Promise<IAuditLogRepository> {
    if (!this.auditLogPromise) {
      this.auditLogPromise = getAuditLogRepository()
    }
    return this.auditLogPromise
  }

  private async getAuth(): Promise<IAuthProvider> {
    if (!this.authProviderPromise) {
      this.authProviderPromise = getAuthProvider()
    }
    return this.authProviderPromise
  }

  private async getCurrentUser(): Promise<{ id: string } | null> {
    const auth = await this.getAuth()
    return auth.getUser()
  }

  /**
   * approval_requests テーブルから、指定リソースの現在のpending承認リクエストを
   * step_number 順で解決する。
   */
  private resolveCurrentPendingApprovalRequest(
    requests: Array<{
      id: string
      step_number: number | null
      approver_id: string | null
      status: string
      due_at?: string | null
    }>
  ): {
    id: string
    step_number: number | null
    approver_id: string | null
    due_at?: string | null
  } | null {
    const current = requests
      .filter(r => r.status === 'pending')
      .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))[0]

    if (!current) return null
    return {
      id: current.id,
      step_number: current.step_number,
      approver_id: current.approver_id,
      due_at: current.due_at,
    }
  }

  private async logAudit(params: {
    organizationId?: string
    action: string
    resourceType: string
    resourceId?: string
    changes?: Record<string, unknown> | null
  }): Promise<void> {
    try {
      const [auditLog, user] = await Promise.all([
        this.getAuditLog(),
        this.getCurrentUser()
      ])

      // organizationId が提供されていない場合は空文字列を使用
      // これはドキュメント操作のように組織コンテキストが明確でない場合に発生する可能性がある
      await auditLog.log({
        organizationId: params.organizationId ?? '',
        userId: user?.id ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        changes: params.changes as Json
      })
    } catch (err) {
      console.error('Audit logging failed:', err)
    }
  }

  /**
   * 文書バージョンを取得
   */
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const response = await this.fetcher(`/api/documents/${documentId}/versions`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? '文書バージョンの取得に失敗しました')
    }
    const body = await response.json() as { data?: DocumentVersion[] }
    return body.data ?? []
  }

  /**
   * 文書一覧を取得
   */
  async getDocuments(
    organizationId: string,
    folderId?: string,
    options?: {
      departmentId?: string | null
      includeNoDepartment?: boolean
    }
  ): Promise<DocumentWithFolder[]> {
    if (typeof window !== 'undefined') {
      return this.fetchDocumentsApi<DocumentWithFolder[]>({
        action: 'documents',
        organizationId,
        folderId,
        departmentId: options?.departmentId ?? undefined,
        includeNoDepartment: options?.includeNoDepartment ? 'true' : undefined,
      })
    }

    const repo = await this.getRepository()
    const filters: DocumentFilters = {
      folderId: folderId ?? null,
      departmentId: options?.departmentId,
      includeNoDepartment: options?.includeNoDepartment
    }
    return repo.findByOrganizationId(organizationId, filters)
  }

  /**
   * 文書一覧を部門スコープ付きで取得
   */
  async getDocumentsScoped(
    organizationId: string,
    _requestingUserId: string,
    folderId?: string
  ): Promise<DocumentWithFolder[]> {
    if (typeof window !== 'undefined') {
      return this.fetchDocumentsApi<DocumentWithFolder[]>({
        action: 'documentsScoped',
        organizationId,
        folderId,
      })
    }

    throw new Error('getDocumentsScoped is browser-only; use getDocumentsForDepartmentAccess on the server')
  }

  async getDocumentsForDepartmentAccess(
    organizationId: string,
    departmentAccess: TenantAuthorizationContext['departmentAccess'],
    folderId?: string,
    filters?: Omit<DocumentFilters, 'folderId'>
  ): Promise<DocumentWithFolder[]> {
    if (typeof window !== 'undefined') {
      throw new Error('getDocumentsForDepartmentAccess must only be called from the server')
    }

    const repo = await this.getRepository()
    const effectiveFilters = applyDepartmentAccessFilters({
      ...(filters ?? {}),
      folderId: folderId ?? null,
    }, departmentAccess)
    return repo.findByOrganizationId(organizationId, effectiveFilters)
  }

  /**
   * 文書を作成
   */
  async createDocument(document: Omit<DocumentInsert, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>): Promise<Document | null> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    try {
      const response = await this.fetcher('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            organization_id: document.organization_id,
            title: document.title,
            description: document.description ?? null,
            category: document.category ?? null,
            folder_id: document.folder_id ?? null,
            tags: document.tags ?? null,
            retention_delete_at: document.retention_delete_at ?? null,
            status: document.status ?? 'draft',
          },
        })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const message = errorBody?.error || '文書の作成に失敗しました'
        throw new Error(message)
      }

      const body = await response.json() as { data?: Document | null }
      return body.data ?? null
    } catch (error) {
      console.error('Document creation error:', error)
      throw error instanceof Error ? error : new Error('文書の作成に失敗しました')
    }
  }

  /**
   * 文書を更新
   */
  async updateDocument(id: string, updates: DocumentUpdate): Promise<Document | null> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const response = await this.fetcher(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? '文書の更新に失敗しました')
    }
    const body = await response.json() as { data?: Document | null }
    return body.data ?? null
  }

  /**
   * 文書を削除
   */
  async deleteDocument(id: string, organizationId: string): Promise<void> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const response = await this.fetcher(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
        'X-Organization-Id': organizationId,
      },
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? '文書の削除に失敗しました')
    }
  }

  async deleteDocumentVersion(
    documentId: string,
    versionId: string
  ): Promise<void> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const params = new URLSearchParams({ versionId })
    const response = await this.fetcher(`/api/documents/${documentId}/versions?${params}`, {
      method: 'DELETE',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? '文書版の削除に失敗しました')
    }
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(
    _organizationId: string,
    file: File,
    documentId: string,
    version?: {
      title?: string
      description?: string | null
      changes?: string | null
      mode?: 'normal' | 'revision'
    }
  ): Promise<{ versionNumber: number }> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const formData = new FormData()
    formData.set('file', file)
    if (version?.title) formData.set('title', version.title)
    if (version?.description !== undefined && version.description !== null) {
      formData.set('description', version.description)
    }
    if (version?.changes) formData.set('changes', version.changes)
    if (version?.mode) formData.set('mode', version.mode)
    const response = await this.fetcher(`/api/documents/${documentId}/file`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      credentials: 'include',
      body: formData,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? 'ファイルのアップロードに失敗しました')
    }
    const body = await response.json() as { data?: { version_number?: number } }
    return { versionNumber: body.data?.version_number ?? 0 }
  }

  async downloadDocumentFile(documentId: string, versionId?: string): Promise<Blob> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const suffix = versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''
    const response = await this.fetcher(`/api/documents/${documentId}/file${suffix}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? 'ファイルのダウンロードに失敗しました')
    }
    return response.blob()
  }

  /**
   * 文書を指定形式でエクスポート
   */
  async exportDocument(documentId: string, format: 'pdf' | 'word'): Promise<Blob> {
    const response = await this.fetcher(`/api/documents/${documentId}/export?format=${format}`, {
      method: 'GET'
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const errorBody = body as { error?: string; errorCode?: string }
      const message = errorBody.error ?? '文書のエクスポートに失敗しました'
      throw new DocumentExportError(message, errorBody.errorCode)
    }

    return response.blob()
  }

  /**
   * フォルダー一覧を取得
   */
  async getFolders(organizationId: string, parentId?: string): Promise<DocumentFolder[]> {
    if (typeof window !== 'undefined') {
      return this.fetchDocumentsApi<DocumentFolder[]>({
        action: 'folders',
        organizationId,
        parentId,
      })
    }

    const repo = await this.getRepository()
    return repo.getFolders(organizationId, parentId)
  }

  /**
   * フォルダーを作成
   */
  async createFolder(
    organizationId: string,
    name: string,
    parentId?: string
  ): Promise<DocumentFolder | null> {
    const response = await this.fetcher('/api/documents/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        organizationId,
        folder: { name, parentId: parentId ?? null },
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'フォルダーの作成に失敗しました')
    }
    return (body as { data?: DocumentFolder }).data ?? null
  }

  /**
   * フォルダーを削除
   */
  async deleteFolder(organizationId: string, id: string): Promise<void> {
    const params = new URLSearchParams({ organizationId, folderId: id })
    const response = await this.fetcher(`/api/documents/folders?${params.toString()}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? 'フォルダーの削除に失敗しました')
    }
  }

  /**
   * 文書テンプレート一覧を取得
   */
  async getTemplates(language: string = 'ja'): Promise<DocumentTemplate[]> {
    const repo = await this.getRepository()
    return repo.getTemplates(language)
  }

  /**
   * テンプレートから文書を作成
   */
  async createFromTemplate(
    organizationId: string,
    templateId: string,
    options: {
      title: string
      folderId?: string | null
      status?: 'draft' | 'in_review'
      placeholders?: Record<string, string>
    }
  ): Promise<Document | null> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const trimmedTitle = options.title.trim()
    if (!trimmedTitle) {
      throw new Error('タイトルを入力してください')
    }

    const repo = await this.getRepository()
    const template = await repo.getTemplateById(templateId)

    if (!template) {
      throw new Error('テンプレートが見つかりません')
    }

    const document = await this.createDocument({
      organization_id: organizationId,
      title: trimmedTitle,
      description: template.description,
      category: template.category,
      folder_id: options.folderId ?? null,
      status: 'draft',
      tags: null,
      file_name: null,
      file_path: null,
      file_size: null,
      mime_type: null,
      retention_delete_at: null,
      approved_at: null,
      approved_by: null
    })

    if (!document) {
      throw new Error('文書の作成に失敗しました')
    }

    try {
      const replacements = await this.buildTemplatePlaceholders(
        organizationId,
        user.id,
        options.placeholders
      )

      const filledContent = this.applyTemplatePlaceholders(
        template.content_template,
        replacements
      )

      const fileName = this.generateMarkdownFileName(trimmedTitle, template.language)
      const file = new File([filledContent], fileName, {
        type: 'text/markdown;charset=utf-8'
      })

      const uploaded = await this.uploadFile(organizationId, file, document.id, {
        title: trimmedTitle,
        description: template.description,
        changes: 'template_initialized'
      })
      return {
        ...document,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        version_number: uploaded.versionNumber,
      }
    } catch (error) {
      console.error('Failed to create document from template', error)
      throw error instanceof Error
        ? error
        : new Error('テンプレートの適用に失敗しました')
    }
  }

  /**
   * エディターから文書を作成
   */
  async createDocumentFromContent(
    organizationId: string,
    options: {
      title: string
      description?: string | null
      category?: string | null
      folderId?: string | null
      status: 'draft' | 'in_review'
      content: string
      language?: string | null
    }
  ): Promise<Document | null> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const trimmedTitle = options.title.trim()
    if (!trimmedTitle) {
      throw new Error('タイトルを入力してください')
    }

    const content = options.content.trim()
    if (!content) {
      throw new Error('本文は必須です')
    }

    const description = options.description?.trim() || null
    const category = options.category ?? null
    const folderId = options.folderId ?? null
    const language = options.language ?? 'ja'

    try {
      const fileName = this.generateMarkdownFileName(trimmedTitle, language)
      const file = new File([content], fileName, {
        type: 'text/markdown;charset=utf-8'
      })

      const document = await this.createDocument({
        organization_id: organizationId,
        title: trimmedTitle,
        description,
        category,
        folder_id: folderId,
        tags: null,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        file_path: null,
        retention_delete_at: null,
        approved_by: null,
        approved_at: null,
        status: 'draft'
      })

      if (!document) {
        throw new Error('文書の作成に失敗しました')
      }

      const uploaded = await this.uploadFile(organizationId, file, document.id, {
        title: trimmedTitle,
        description,
        changes: 'initial_draft'
      })
      return {
        ...document,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        version_number: uploaded.versionNumber,
      }
    } catch (error) {
      console.error('Failed to create document from editor', error)
      throw error instanceof Error ? error : new Error('文書の作成に失敗しました')
    }
  }

  private async buildTemplatePlaceholders(
    organizationId: string,
    userId: string,
    overrides?: Record<string, string>
  ): Promise<Record<string, string>> {
    const db = getDb()

    let organizationName = ''
    let approverName = ''

    try {
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
      organizationName = org?.name ?? ''
    } catch (err) {
      console.error('Failed to load organization for template placeholders', err)
    }

    try {
      const [profile] = await db
        .select({ fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      approverName = profile?.fullName ?? ''
    } catch (err) {
      console.error('Failed to load user profile for template placeholders', err)
    }

    const today = new Date().toISOString().slice(0, 10)

    const base: Record<string, string> = {
      組織名: organizationName,
      'Organization Name': organizationName,
      制定日: today,
      改訂日: today,
      'Establishment Date': today,
      'Revision Date': today,
      承認者名: approverName,
      'Approver Name': approverName
    }

    if (!overrides) {
      return base
    }

    return { ...base, ...overrides }
  }

  private applyTemplatePlaceholders(
    content: string,
    placeholders: Record<string, string>
  ): string {
    return content.replace(/{{\s*([^}]+?)\s*}}/g, (match, key) => {
      const replacement = placeholders[key as string]
      return typeof replacement === 'string' ? replacement : match
    })
  }

  private generateMarkdownFileName(title: string, language?: string | null): string {
    const normalized = title
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/gi, '-')
      .replace(/^-+|-+$/g, '')

    const baseName = normalized || 'document'
    const suffix = language === 'en' ? 'en' : 'ja'
    return `${baseName}.${suffix}.md`
  }

  /**
   * 文書の承認フローを開始
   *
   * approval_requests テーブルのみを使用して承認フローを管理する。
   * document_approvals テーブルへの書き込みは行わない。
   */
  async submitApprovalRequest(
    documentId: string,
    approverId: string
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await this.fetcher(`/api/documents/${documentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'request',
          approverId,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? '承認依頼に失敗しました')
      }
      return
    }

    throw new Error('submitApprovalRequest must only be called from the browser')
  }

  /**
   * 現在の承認者として承認を実行
   *
   * approval_requests テーブルのみを使用。
   */
  async approveDocument(
    documentId: string,
    expectedRequestId: string,
    comment?: string
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await this.fetcher(`/api/documents/${documentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          expectedRequestId,
          comment,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? '承認処理に失敗しました')
      }
      return
    }

    throw new Error('approveDocument must only be called from the browser')
  }

  /**
   * 現在の承認者として却下を実行
   *
   * approval_requests テーブルのみを使用。
   */
  async rejectDocument(
    documentId: string,
    expectedRequestId: string,
    reason?: string
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await this.fetcher(`/api/documents/${documentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          expectedRequestId,
          reason,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? '却下処理に失敗しました')
      }
      return
    }

    throw new Error('rejectDocument must only be called from the browser')
  }

  async getApproverDashboardMetrics(organizationId?: string): Promise<ApproverDashboardMetrics> {
    if (typeof window !== 'undefined') {
      if (!organizationId) throw new Error('organizationId is required')
      return this.fetchApproverMetricsApi(organizationId)
    }

    if (!organizationId) throw new Error('organizationId is required')

    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    return repo.getApproverDashboardMetrics(user.id, organizationId, {
      dueSoonHours: APPROVER_DUE_SOON_THRESHOLD_HOURS,
      escalationHours: APPROVER_ESCALATION_THRESHOLD_HOURS,
      historyWindowDays: APPROVER_HISTORY_WINDOW_DAYS
    })
  }

  private async resolveDocumentStatus(
    organizationId: string,
    documentId: string
  ): Promise<string | null> {
    try {
      const repo = await this.getRepository()
      const document = await repo.findByIdAndOrganizationId(documentId, organizationId)
      return document?.status ?? null
    } catch {
      return null
    }
  }

  /**
   * 発行完了済み文書の進捗。レガシー判定（設計 §5.3）はここに閉じる。
   * `documents.status = 'approved'` かつ step2 レコードが1件も無い場合に限り 1段表示。
   */
  private buildApprovedApprovalProgress(
    requests: Array<{ step_number: number | null }>
  ): DocumentApprovalProgress {
    const hasFinalStepRequest = requests.some(
      request => isFinalDocumentApprovalStep(request.step_number)
    )
    const totalSteps = hasFinalStepRequest
      ? DOCUMENT_APPROVAL_TOTAL_STEPS
      : LEGACY_DOCUMENT_APPROVAL_TOTAL_STEPS
    return {
      currentStep: totalSteps,
      totalSteps,
      currentStatus: 'approved',
      overallStatus: 'approved'
    }
  }

  /**
   * approval_requests ベースで文書の承認進捗を取得
   */
  async getDocumentApprovalProgress(
    organizationId: string,
    documentId: string,
    /**
     * 既知の `documents.status`。未指定ならリポジトリから引く。
     * §5.3 の完了/レガシー判定は文書側の状態を必ず参照する必要がある
     * （step2 が expired だと pending 消失 + approved イベント有になるが、文書は in_review）。
     */
    knownDocumentStatus?: string | null
  ): Promise<DocumentApprovalProgress> {
    const requests = await this.approvalService.listRequests(organizationId, {
      resourceType: 'document'
    }).then(all => all.filter(r => r.resource_id === documentId))

    if (requests.length === 0) {
      return {
        currentStep: 0,
        totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
        currentStatus: 'none',
        overallStatus: 'not_submitted'
      }
    }

    const allEvents: Array<{ event_type: string; created_at: string }> = []
    for (const request of requests) {
      const events = await this.approvalService.listEvents(request.id)
      allEvents.push(...events)
    }

    const approvedEvents = allEvents.filter(e => e.event_type === 'approved')
    const rejectedEvents = allEvents.filter(e => e.event_type === 'rejected')
    const pendingRequest = this.resolveCurrentPendingApprovalRequest(requests)

    if (rejectedEvents.length > 0 && !pendingRequest) {
      const latestRejected = requests.find(r => r.status === 'rejected')
      return {
        currentStep: normalizeDocumentApprovalStep(latestRejected?.step_number),
        totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
        currentStatus: 'rejected',
        overallStatus: 'rejected',
        currentApprover: latestRejected?.approver_id ?? undefined,
        dueAt: latestRejected?.due_at ?? undefined
      }
    }

    if (!pendingRequest && approvedEvents.length > 0) {
      const documentStatus = knownDocumentStatus !== undefined
        ? knownDocumentStatus
        : await this.resolveDocumentStatus(organizationId, documentId)
      if (documentStatus === 'approved') {
        return this.buildApprovedApprovalProgress(requests)
      }
      // 文書が approved でないのに pending が無い = 決裁が中断している
      // （典型: step の expired）。承認済みと偽表示しない。
      const latestRequest = requests[requests.length - 1]
      return {
        currentStep: normalizeDocumentApprovalStep(latestRequest?.step_number),
        totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
        currentStatus: 'none',
        overallStatus: documentStatus === 'draft' ? 'not_submitted' : 'in_review',
        currentApprover: latestRequest?.approver_id ?? undefined,
        dueAt: latestRequest?.due_at ?? undefined
      }
    }

    if (pendingRequest) {
      return {
        currentStep: normalizeDocumentApprovalStep(pendingRequest.step_number),
        totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
        currentStatus: 'pending',
        overallStatus: 'in_review',
        currentRequestId: pendingRequest.id,
        currentApprover: pendingRequest.approver_id ?? undefined,
        dueAt: pendingRequest.due_at ?? undefined
      }
    }

    return {
      currentStep: 0,
      totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
      currentStatus: 'none',
      overallStatus: 'not_submitted'
    }
  }

  /**
   * 文書一覧に承認進捗情報をバッチ付与
   */
  async enrichDocumentsWithApprovalProgress(
    organizationId: string,
    documents: DocumentWithFolder[]
  ): Promise<DocumentWithFolder[]> {
    if (typeof window !== 'undefined') {
      return documents.map((doc) => {
        if (doc.status === 'draft' && (!doc.approvals || doc.approvals.length === 0)) {
          return {
            ...doc,
            approvalProgress: {
              currentStep: 0,
              totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
              currentStatus: 'none' as const,
              overallStatus: 'not_submitted' as const
            }
          }
        }
        return doc
      })
    }

    const results = await Promise.all(
      documents.map(async (doc) => {
        if (doc.status === 'draft' && (!doc.approvals || doc.approvals.length === 0)) {
          return {
            ...doc,
            approvalProgress: {
              currentStep: 0,
              totalSteps: DOCUMENT_APPROVAL_TOTAL_STEPS,
              currentStatus: 'none' as const,
              overallStatus: 'not_submitted' as const
            }
          }
        }
        try {
          const progress = await this.getDocumentApprovalProgress(
            organizationId,
            doc.id,
            doc.status ?? null
          )
          return { ...doc, approvalProgress: progress }
        } catch {
          return doc
        }
      })
    )
    return results
  }
}

export type { DocumentApproval }
