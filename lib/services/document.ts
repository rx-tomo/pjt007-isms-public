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
import { getDocumentRepository, getAuditLogRepository, getAuthProvider, getUserRepository } from '@/lib/container'
import { NotificationService } from '@/lib/services/notification'
import { StorageQuotaService } from '@/lib/services/storageQuota'
import { ApprovalService } from '@/lib/services/approval'
import { getStorageProvider } from '@/lib/storage'
import type { IUserRepository, UserProfile } from '@/lib/db/repositories/interfaces/IUserRepository'
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
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'

export interface DocumentApprovalProgress {
  currentStep: number
  totalSteps: number
  currentStatus: 'pending' | 'approved' | 'rejected' | 'none'
  overallStatus: 'not_submitted' | 'in_review' | 'approved' | 'rejected'
  currentApprover?: string
  dueAt?: string
}

export interface DocumentWithFolder extends RepoDocumentWithFolder {
  approvalProgress?: DocumentApprovalProgress
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

export { ApproverDashboardMetrics }

export class DocumentService {
  private storageQuota: StorageQuotaService
  private fetcher: typeof fetch
  private approvalService: ApprovalService
  private repositoryPromise: Promise<IDocumentRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null
  private userRepositoryPromise: Promise<IUserRepository> | null = null

  constructor(options?: DocumentServiceOptions) {
    const defaultFetcher: typeof fetch = (...args) => fetch(...args)
    this.fetcher = options?.fetcher ?? defaultFetcher
    this.storageQuota = options?.storageQuotaService ?? new StorageQuotaService()
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

  private async getUserRepository(): Promise<IUserRepository> {
    if (!this.userRepositoryPromise) {
      this.userRepositoryPromise = getUserRepository()
    }
    return this.userRepositoryPromise
  }

  private async getCurrentUser(): Promise<{ id: string } | null> {
    const auth = await this.getAuth()
    return auth.getUser()
  }

  private async getRequestingUserProfile(requestingUserId: string): Promise<UserProfile | null> {
    const userRepository = await this.getUserRepository()
    return userRepository.findById(requestingUserId)
  }

  /**
   * approval_requests テーブルから、指定リソースの現在のpending承認リクエストを
   * step_number 順で解決する。
   */
  private resolveCurrentPendingApprovalRequest(
    requests: Array<{ id: string; step_number: number | null; approver_id: string | null; status: string }>
  ): { id: string; step_number: number | null; approver_id: string | null } | null {
    const current = requests
      .filter(r => r.status === 'pending')
      .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))[0]

    if (!current) return null
    return {
      id: current.id,
      step_number: current.step_number,
      approver_id: current.approver_id
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

    const repo = await this.getRepository()
    return repo.getVersions(documentId)
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
    requestingUserId: string,
    folderId?: string
  ): Promise<DocumentWithFolder[]> {
    if (typeof window !== 'undefined') {
      return this.fetchDocumentsApi<DocumentWithFolder[]>({
        action: 'documentsScoped',
        organizationId,
        requestingUserId,
        folderId,
      })
    }

    const requestingUser = await this.getRequestingUserProfile(requestingUserId)
    if (!requestingUser) {
      throw new Error('Requesting user not found')
    }

    if (hasFullDepartmentAccess(requestingUser.role)) {
      return this.getDocuments(organizationId, folderId)
    }

    const departmentId = requestingUser.primary_department_id ?? DEPARTMENT_UNASSIGNED_VALUE
    return this.getDocuments(organizationId, folderId, {
      departmentId,
      includeNoDepartment: true
    })
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
          document,
          userId: user.id
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

    const repo = await this.getRepository()
    const data = await repo.update(id, {
      ...updates,
      updated_by: user.id
    })

    if (data) {
      await this.logAudit({
        action: 'document.updated',
        resourceType: 'document',
        resourceId: id,
        changes: updates as Record<string, unknown>
      })
    }

    return data
  }

  /**
   * 文書を削除
   */
  async deleteDocument(id: string): Promise<void> {
    const repo = await this.getRepository()

    // まず文書情報を取得
    const document = await repo.findById(id)

    if (document?.file_path) {
      // ストレージからファイルを削除
      const storage = getStorageProvider()
      const { error: storageError } = await storage.remove('documents', [document.file_path])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
      }
    }

    // データベースから削除
    await repo.delete(id)

    await this.logAudit({
      action: 'document.deleted',
      resourceType: 'document',
      resourceId: id
    })
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(
    organizationId: string,
    file: File,
    documentId: string
  ): Promise<{ path: string; url: string }> {
    await this.storageQuota.ensureUploadAllowed(organizationId, file)

    const originalName = file.name.trim()
    const extension = originalName.includes('.')
      ? originalName.split('.').pop() ?? null
      : null
    const safeExtension = extension ? extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : null
    const fileName = safeExtension ? `${documentId}.${safeExtension}` : documentId
    const filePath = `${organizationId}/documents/${documentId}/${fileName}`

    const storage = getStorageProvider()
    const { error: uploadError } = await storage.upload('documents', filePath, file, {
      cacheControl: '3600',
      upsert: true
    })

    if (uploadError) {
      console.error('File upload error:', uploadError)
      throw new Error('ファイルのアップロードに失敗しました')
    }

    const publicUrl = storage.getPublicUrl('documents', filePath)

    return { path: filePath, url: publicUrl }
  }

  /**
   * ファイルをダウンロード
   */
  async downloadFile(filePath: string): Promise<Blob> {
    const storage = getStorageProvider()
    const { data, error } = await storage.download('documents', filePath)

    if (error || !data) {
      console.error('File download error:', error)
      throw new Error('ファイルのダウンロードに失敗しました')
    }

    return data
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
      const message = (body as { error?: string }).error ?? '文書のエクスポートに失敗しました'
      throw new Error(message)
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
    return repo.getFolders(organizationId, parentId ?? null)
  }

  /**
   * フォルダーを作成
   */
  async createFolder(
    organizationId: string,
    name: string,
    parentId?: string
  ): Promise<DocumentFolder | null> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    const data = await repo.createFolder({
      organization_id: organizationId,
      name,
      parent_id: parentId || null,
      created_by: user.id,
      path: '' // トリガーで自動設定される
    })

    if (data) {
      await this.logAudit({
        action: 'document.folder_created',
        resourceType: 'document_folder',
        resourceId: data.id,
        changes: {
          name,
          parent_id: parentId ?? null
        }
      })
    }

    return data
  }

  /**
   * フォルダーを削除
   */
  async deleteFolder(organizationId: string, id: string): Promise<void> {
    const repo = await this.getRepository()

    // フォルダー内の文書を確認
    const documentCount = await repo.countDocumentsInFolder(id)
    if (documentCount > 0) {
      throw new Error('フォルダー内に文書が存在するため削除できません')
    }

    // サブフォルダーを確認
    const subfolderCount = await repo.countSubfolders(id)
    if (subfolderCount > 0) {
      throw new Error('サブフォルダーが存在するため削除できません')
    }

    await repo.deleteFolder(organizationId, id)

    await this.logAudit({
      action: 'document.folder_deleted',
      resourceType: 'document_folder',
      resourceId: id,
      changes: null
    })
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
      status: options.status ?? 'draft',
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

      const { path } = await this.uploadFile(organizationId, file, document.id)

      await this.updateDocument(document.id, {
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type
      })

      await this.createDocumentVersion(document.id, {
        title: trimmedTitle,
        description: template.description,
        fileName: file.name,
        filePath: path,
        fileSize: file.size,
        changes: 'template_initialized'
      })

      const refreshedDocument = await repo.findById(document.id)
      return refreshedDocument ?? document
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
    const status = options.status
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
        status
      })

      if (!document) {
        throw new Error('文書の作成に失敗しました')
      }

      const { path } = await this.uploadFile(organizationId, file, document.id)

      await this.updateDocument(document.id, {
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type
      })

      await this.createDocumentVersion(document.id, {
        title: trimmedTitle,
        description,
        fileName: file.name,
        filePath: path,
        fileSize: file.size,
        changes: status === 'in_review' ? 'initial_submission' : 'initial_draft'
      })

      const repo = await this.getRepository()
      const refreshedDocument = await repo.findById(document.id)

      return refreshedDocument ?? {
        ...document,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type
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
   * 文書バージョンを作成
   */
  async createDocumentVersion(
    documentId: string,
    versionData: {
      title: string
      description?: string | null
      fileName?: string | null
      filePath?: string | null
      fileSize?: number | null
      changes?: string | null
    }
  ): Promise<void> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const response = await this.fetcher(`/api/documents/${documentId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: versionData.title,
        description: versionData.description ?? null,
        fileName: versionData.fileName ?? null,
        filePath: versionData.filePath ?? null,
        fileSize: versionData.fileSize ?? null,
        changes: versionData.changes ?? null,
        userId: user.id
      })
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const message = (body as { error?: string }).error ?? '文書バージョンの作成に失敗しました'
      throw new Error(message)
    }
  }

  /**
   * 文書の承認フローを開始
   *
   * approval_requests テーブルのみを使用して承認フローを管理する。
   * document_approvals テーブルへの書き込みは行わない。
   */
  async submitApprovalRequest(
    documentId: string,
    step1ApproverId: string,
    step2ApproverId: string
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await this.fetcher(`/api/documents/${documentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'request',
          step1ApproverId,
          step2ApproverId,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? '承認依頼に失敗しました')
      }
      return
    }

    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    if (!step1ApproverId || !step2ApproverId) {
      throw new Error('承認者を選択してください')
    }

    const repo = await this.getRepository()
    const document = await repo.findById(documentId)

    if (!document) {
      throw new Error('文書が見つかりません')
    }

    if (document.status !== 'draft') {
      throw new Error('下書き状態の文書のみ承認依頼できます')
    }

    // 既存の approval_requests を確認
    const existingRequests = await this.approvalService.listRequestsByResource(
      document.organization_id,
      'document',
      documentId
    )

    if (existingRequests.some(r => r.status === 'pending')) {
      throw new Error('承認フローが既に開始されています')
    }

    // 既存リクエストがある場合はリセット（reject all pending）
    if (existingRequests.length > 0) {
      await this.approvalService.rejectAllPendingForResource(
        document.organization_id,
        'document',
        documentId,
        user.id,
        'Resubmitted approval workflow'
      )
    }

    // approval_requests に step_number 付きでリクエストを作成
    if (step1ApproverId === step2ApproverId) {
      // 同一承認者の場合、step 1 を approved 状態で作成（スキップ扱い）
      await this.approvalService.createRequest({
        organization_id: document.organization_id,
        resource_type: 'document',
        resource_id: documentId,
        requested_by: user.id,
        approver_id: step1ApproverId,
        step_number: 1,
        status: 'approved'
      })
      await this.approvalService.createRequest({
        organization_id: document.organization_id,
        resource_type: 'document',
        resource_id: documentId,
        requested_by: user.id,
        approver_id: step2ApproverId,
        step_number: 2
      })
    } else {
      await this.approvalService.createRequest({
        organization_id: document.organization_id,
        resource_type: 'document',
        resource_id: documentId,
        requested_by: user.id,
        approver_id: step1ApproverId,
        step_number: 1
      })
      await this.approvalService.createRequest({
        organization_id: document.organization_id,
        resource_type: 'document',
        resource_id: documentId,
        requested_by: user.id,
        approver_id: step2ApproverId,
        step_number: 2
      })
    }

    await repo.update(documentId, {
      status: 'in_review',
      approved_by: null,
      approved_at: null,
      updated_by: user.id
    })

    await this.logAudit({
      action: 'document.approval_requested',
      resourceType: 'document',
      resourceId: documentId,
      changes: {
        step1_approver: step1ApproverId,
        step2_approver: step2ApproverId,
        skipped_step1: step1ApproverId === step2ApproverId
      }
    })

    // 最初の pending リクエストの承認者に通知
    const freshRequests = await this.approvalService.listRequestsByResource(
      document.organization_id,
      'document',
      documentId
    )
    const firstPending = this.resolveCurrentPendingApprovalRequest(freshRequests)

    if (firstPending?.approver_id) {
      await NotificationService.createDocumentApprovalRequest(
        document.organization_id,
        firstPending.approver_id,
        document.title,
        documentId,
        user.id
      )
    }
  }

  /**
   * 現在の承認者として承認を実行
   *
   * approval_requests テーブルのみを使用。
   */
  async approveDocument(documentId: string, comment?: string): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await this.fetcher(`/api/documents/${documentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          comment,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? '承認処理に失敗しました')
      }
      return
    }

    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    const document = await repo.findById(documentId)

    if (!document) {
      throw new Error('文書が見つかりません')
    }

    const requests = await this.approvalService.listRequestsByResource(
      document.organization_id,
      'document',
      documentId
    )
    const currentRequest = this.resolveCurrentPendingApprovalRequest(requests)
    if (!currentRequest || currentRequest.approver_id !== user.id) {
      throw new Error('現在の承認ステップではありません')
    }

    const approvalComment = comment?.trim() ? comment.trim() : null

    await this.approvalService.approveRequest({
      requestId: currentRequest.id,
      actorId: user.id,
      comment: approvalComment ?? undefined
    })

    // 承認後の残りの pending リクエストを確認
    const refreshedRequests = await this.approvalService.listRequestsByResource(
      document.organization_id,
      'document',
      documentId
    )
    const pendingRequests = refreshedRequests.filter(r => r.status === 'pending')

    if (pendingRequests.length === 0) {
      const nowIso = new Date().toISOString()
      await repo.update(documentId, {
        status: 'approved',
        approved_by: user.id,
        approved_at: nowIso,
        updated_by: user.id
      })

      await this.logAudit({
        action: 'document.approved',
        resourceType: 'document',
        resourceId: documentId,
        changes: { approved_by: user.id }
      })
    } else {
      const nextRequest = pendingRequests.sort(
        (a, b) => (a.step_number ?? 0) - (b.step_number ?? 0)
      )[0]

      if (nextRequest.approver_id) {
        await NotificationService.createDocumentApprovalRequest(
          document.organization_id,
          nextRequest.approver_id,
          document.title,
          documentId,
          user.id
        )
      }
    }
  }

  /**
   * 現在の承認者として却下を実行
   *
   * approval_requests テーブルのみを使用。
   */
  async rejectDocument(documentId: string, reason?: string): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await this.fetcher(`/api/documents/${documentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          reason,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? '却下処理に失敗しました')
      }
      return
    }

    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    const document = await repo.findById(documentId)
    if (!document) {
      throw new Error('文書が見つかりません')
    }

    const requests = await this.approvalService.listRequestsByResource(
      document.organization_id,
      'document',
      documentId
    )
    const currentRequest = this.resolveCurrentPendingApprovalRequest(requests)
    if (!currentRequest || currentRequest.approver_id !== user.id) {
      throw new Error('現在の承認ステップではありません')
    }

    const rejectionReason = reason?.trim() ? reason.trim() : 'No reason provided'

    // 現在のリクエストを reject
    await this.approvalService.rejectRequest({
      requestId: currentRequest.id,
      actorId: user.id,
      reason: rejectionReason
    })

    // 残りの pending リクエストも全て reject（後続ステップのキャンセル）
    await this.approvalService.rejectAllPendingForResource(
      document.organization_id,
      'document',
      documentId,
      user.id,
      'Cancelled due to rejection at earlier step'
    )

    await repo.update(documentId, {
      status: 'draft',
      approved_by: null,
      approved_at: null,
      updated_by: user.id
    })

    await this.logAudit({
      action: 'document.rejected',
      resourceType: 'document',
      resourceId: documentId,
      changes: { reason: rejectionReason }
    })
  }

  async getApproverDashboardMetrics(_organizationId?: string): Promise<ApproverDashboardMetrics> {
    if (typeof window !== 'undefined') {
      if (!_organizationId) throw new Error('organizationId is required')
      return this.fetchApproverMetricsApi(_organizationId)
    }

    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    return repo.getApproverDashboardMetrics(user.id, {
      dueSoonHours: APPROVER_DUE_SOON_THRESHOLD_HOURS,
      escalationHours: APPROVER_ESCALATION_THRESHOLD_HOURS,
      historyWindowDays: APPROVER_HISTORY_WINDOW_DAYS
    })
  }

  /**
   * approval_requests ベースで文書の承認進捗を取得
   */
  async getDocumentApprovalProgress(
    organizationId: string,
    documentId: string
  ): Promise<DocumentApprovalProgress> {
    const requests = await this.approvalService.listRequests(organizationId, {
      resourceType: 'document'
    }).then(all => all.filter(r => r.resource_id === documentId))

    if (requests.length === 0) {
      return {
        currentStep: 0,
        totalSteps: 2,
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
    const pendingRequest = requests.find(r => r.status === 'pending')

    if (rejectedEvents.length > 0 && !pendingRequest) {
      const latestRejected = requests.find(r => r.status === 'rejected')
      return {
        currentStep: approvedEvents.length >= 1 ? 2 : 1,
        totalSteps: 2,
        currentStatus: 'rejected',
        overallStatus: 'rejected',
        currentApprover: latestRejected?.approver_id ?? undefined,
        dueAt: latestRejected?.due_at ?? undefined
      }
    }

    if (!pendingRequest && approvedEvents.length > 0) {
      return {
        currentStep: 2,
        totalSteps: 2,
        currentStatus: 'approved',
        overallStatus: 'approved'
      }
    }

    if (pendingRequest) {
      const step = approvedEvents.length >= 1 ? 2 : 1
      return {
        currentStep: step,
        totalSteps: 2,
        currentStatus: 'pending',
        overallStatus: 'in_review',
        currentApprover: pendingRequest.approver_id ?? undefined,
        dueAt: pendingRequest.due_at ?? undefined
      }
    }

    return {
      currentStep: 0,
      totalSteps: 2,
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
              totalSteps: 2,
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
              totalSteps: 2,
              currentStatus: 'none' as const,
              overallStatus: 'not_submitted' as const
            }
          }
        }
        try {
          const progress = await this.getDocumentApprovalProgress(organizationId, doc.id)
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
