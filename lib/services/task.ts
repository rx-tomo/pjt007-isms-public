/**
 * Task Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to ITaskRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 */
import { getTaskRepository } from '@/lib/container'
import { StorageQuotaService } from '@/lib/services/storageQuota'
import { getStorageProvider, type IStorageProvider } from '@/lib/storage'
import {
  createTaskAttachmentStoragePath,
  isTaskAttachmentStoragePath,
  isTaskAttachmentSizeAllowed,
  validateTaskAttachment,
} from '@/lib/storage/taskAttachmentPolicy'
import type {
  ITaskRepository,
  Task,
  TaskAttachment,
  TaskCategory,
  TaskComment,
  TaskFilters,
  TaskHistory,
  TaskPriority,
  TaskStatus,
  TaskTag,
  TaskWithRelations
} from '@/lib/db/repositories/interfaces/ITaskRepository'

// Re-export types from the repository interface for backward compatibility
export type {
  TaskStatus,
  TaskPriority,
  TaskCategory,
  Task,
  TaskComment,
  TaskAttachment,
  TaskTag,
  TaskHistory,
  TaskWithRelations,
  TaskFilters,
  TaskStatistics
} from '@/lib/db/repositories/interfaces/ITaskRepository'

export class TaskService {
  private repositoryPromise: Promise<ITaskRepository> | null = null
  private storageQuota: Pick<StorageQuotaService, 'ensureUploadAllowed'>
  private storageProvider?: IStorageProvider

  constructor(dependencies?: {
    storageQuota?: Pick<StorageQuotaService, 'ensureUploadAllowed'>
    storageProvider?: IStorageProvider
  }) {
    this.storageQuota = dependencies?.storageQuota ?? new StorageQuotaService()
    this.storageProvider = dependencies?.storageProvider
  }

  private async getRepository(): Promise<ITaskRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getTaskRepository()
    }
    return this.repositoryPromise
  }

  private async fetchTasksApi<T>(params: Record<string, string | undefined>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchTasksApi must only be called from the browser')
    }

    const url = new URL('/api/tasks', window.location.origin)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    })

    const response = await fetch(url.toString(), {
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

  private async fetchTaskApi<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchTaskApi must only be called from the browser')
    }

    const response = await fetch(new URL(path, window.location.origin).toString(), {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  // ============================================
  // Task Category Management
  // ============================================

  async getTaskCategories(organizationId?: string) {
    if (typeof window !== 'undefined') {
      return this.fetchTasksApi<TaskCategory[]>({
        action: 'categories',
        organizationId,
      })
    }

    if (!organizationId?.trim()) {
      throw new Error('Organization ID is required to load task categories')
    }

    const repo = await this.getRepository()
    return repo.getCategories(organizationId)
  }

  async createDefaultTaskCategories(organizationId: string): Promise<void> {
    const repo = await this.getRepository()
    return repo.createDefaultCategories(organizationId)
  }

  // ============================================
  // Task CRUD Operations
  // ============================================

  async getTasks(filters?: {
    organizationId?: string
    status?: string
    priority?: string
    assigneeId?: string
    categoryId?: string
    dueDate?: { from?: string; to?: string }
    departmentId?: string | null
    includeNoDepartment?: boolean
  }) {
    if (typeof window !== 'undefined') {
      return this.fetchTasksApi<TaskWithRelations[]>({
        action: 'tasks',
        organizationId: filters?.organizationId,
        status: filters?.status,
        priority: filters?.priority,
        assigneeId: filters?.assigneeId,
        categoryId: filters?.categoryId,
        departmentId: filters?.departmentId ?? undefined,
        includeNoDepartment: filters?.includeNoDepartment ? 'true' : undefined,
      })
    }

    if (!filters?.organizationId?.trim()) {
      throw new Error('Organization ID is required to load tasks')
    }

    const repo = await this.getRepository()
    return repo.findManyWithRelations({
      ...filters,
      organizationId: filters.organizationId,
    } as Parameters<ITaskRepository['findManyWithRelations']>[0])
  }

  async getTaskById(taskId: string) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskWithRelations }>(`/api/tasks/${taskId}`)
      return response.data
    }

    throw new Error(
      'TaskService.getTaskById is browser-only; use getTaskByIdForOrganization on the server'
    )
  }

  async getTaskByIdForOrganization(taskId: string, organizationId: string) {
    const repo = await this.getRepository()
    return repo.findWithRelationsByOrganizationId(taskId, organizationId)
  }

  async getTaskOrganizationId(taskId: string) {
    const repo = await this.getRepository()
    return repo.findOrganizationIdByTaskId(taskId)
  }

  async createTask(task: {
    organization_id: string
    title: string
    description?: string | null
    category_id?: string | null
    assignee_id?: string | null
    reporter_id?: string | null
    department_id?: string | null
    status?: string
    priority?: string
    due_date?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    progress?: number
    parent_task_id?: string | null
    related_document_id?: string | null
    related_risk_id?: string | null
  }) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: Task }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      })
      return response.data
    }

    throw new Error('TaskService.createTask is browser-only; use TaskTenantMutationService on the server')
  }

  async updateTask(taskId: string, updates: {
    title?: string
    description?: string | null
    category_id?: string | null
    assignee_id?: string | null
    reporter_id?: string | null
    department_id?: string | null
    status?: string
    priority?: string
    due_date?: string | null
    estimated_hours?: number | null
    actual_hours?: number | null
    progress?: number
    parent_task_id?: string | null
    related_document_id?: string | null
    related_risk_id?: string | null
    completed_at?: string | null
  }) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: Task }>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      return response.data
    }

    throw new Error('TaskService.updateTask is browser-only; use TaskTenantMutationService on the server')
  }

  async deleteTask(taskId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchTaskApi<Record<string, never>>(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })
      return
    }

    throw new Error(
      'TaskService.deleteTask is browser-only; use TaskTenantMutationService on the server'
    )
  }

  // ============================================
  // Comment Management
  // ============================================

  async addComment(taskId: string, comment: string, userId: string) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskComment }>(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      })
      return response.data
    }

    const repo = await this.getRepository()
    return repo.addComment({
      task_id: taskId,
      user_id: userId,
      comment
    })
  }

  async getTaskComments(taskId: string) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskComment[] }>(`/api/tasks/${taskId}/comments`)
      return response.data
    }

    const repo = await this.getRepository()
    return repo.getComments(taskId)
  }

  async updateComment(taskId: string, commentId: string, comment: string) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskComment }>(`/api/tasks/${taskId}/comments`, {
        method: 'PATCH',
        body: JSON.stringify({ commentId, comment }),
      })
      return response.data
    }

    const repo = await this.getRepository()
    const updated = await repo.updateComment(commentId, comment)
    if (!updated) {
      throw new Error('コメントの更新に失敗しました')
    }
    return updated
  }

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchTaskApi<{ data: { id: string } }>(`/api/tasks/${taskId}/comments`, {
        method: 'DELETE',
        body: JSON.stringify({ commentId }),
      })
      return
    }

    const repo = await this.getRepository()
    const deleted = await repo.deleteComment(commentId)
    if (!deleted) {
      throw new Error('コメントの削除に失敗しました')
    }
  }

  // ============================================
  // Attachment Management
  // ============================================

  async uploadAttachment(
    taskId: string,
    file: File,
    uploadedBy: string,
    organizationId?: string
  ) {
    if (typeof window !== 'undefined') {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(new URL(`/api/tasks/${taskId}/attachments`, window.location.origin).toString(), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? `API error ${response.status}`)
      }

      const payload = await response.json() as { data: TaskAttachment }
      return payload.data
    }

    const repo = await this.getRepository()
    if (!organizationId) {
      throw new Error('organizationId is required for server-side task attachment upload')
    }
    if (!isTaskAttachmentSizeAllowed(file.size)) {
      throw new Error('Task attachment is too large')
    }

    const validation = validateTaskAttachment(file.name, file.type)
    if (!validation.ok) {
      throw new Error('Unsupported task attachment')
    }

    // Get task to retrieve organization_id
    const task = await repo.findByIdAndOrganizationId(taskId, organizationId)
    if (!task) {
      throw new Error('タスク情報の取得に失敗しました。再読み込みしてからやり直してください。')
    }

    // Check storage quota
    await this.storageQuota.ensureUploadAllowed(task.organization_id, file)

    const filePath = createTaskAttachmentStoragePath(
      task.organization_id,
      taskId,
      validation.extension
    )

    const storage = this.storageProvider ?? getStorageProvider()
    const { error: uploadError } = await storage.upload('task-attachments', filePath, file, {
      contentType: validation.mimeType,
    })

    if (uploadError) {
      throw uploadError
    }

    // Create attachment record
    return repo.createAttachment({
      task_id: taskId,
      file_name: validation.displayName,
      file_path: filePath,
      file_size: file.size,
      mime_type: validation.mimeType,
      uploaded_by: uploadedBy
    })
  }

  async deleteAttachment(
    attachmentId: string,
    taskId?: string,
    organizationId?: string
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      if (!taskId) {
        throw new Error('taskId is required to delete an attachment from the browser')
      }

      await this.fetchTaskApi<{ data: { id: string } }>(
        `/api/tasks/${taskId}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE' }
      )
      return
    }

    if (!taskId || !organizationId) {
      throw new Error('taskId and organizationId are required to delete an attachment')
    }

    const repo = await this.getRepository()
    const { filePath } = await repo.deleteAttachment(
      attachmentId,
      taskId,
      organizationId
    )

    // Delete from storage
    if (!filePath) return
    if (!isTaskAttachmentStoragePath(filePath, organizationId, taskId)) {
      throw new Error('Attachment storage path is outside its tenant task boundary')
    }

    const storage = this.storageProvider ?? getStorageProvider()
    const { error: deleteStorageError } = await storage.remove('task-attachments', [filePath])

    if (deleteStorageError) {
      console.error('Failed to delete file from storage:', deleteStorageError)
    }
  }

  async getAttachmentUrl(taskId: string, attachmentId: string): Promise<string> {
    return `/api/tasks/${encodeURIComponent(taskId)}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`
  }

  // ============================================
  // Tag Management
  // ============================================

  async getTaskTags(organizationId: string) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskTag[] }>(
        `/api/tasks/tags?organizationId=${encodeURIComponent(organizationId)}`
      )
      return response.data
    }

    const repo = await this.getRepository()
    return repo.getTags(organizationId)
  }

  async createTaskTag(tag: { organization_id: string; name: string; color?: string | null }) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskTag }>('/api/tasks/tags', {
        method: 'POST',
        body: JSON.stringify(tag),
      })
      return response.data
    }

    const repo = await this.getRepository()
    return repo.createTag({
      organization_id: tag.organization_id,
      name: tag.name,
      color: tag.color
    })
  }

  async addTagToTask(taskId: string, tagId: string): Promise<void> {
    const repo = await this.getRepository()
    return repo.addTagToTask(taskId, tagId)
  }

  async removeTagFromTask(taskId: string, tagId: string): Promise<void> {
    const repo = await this.getRepository()
    return repo.removeTagFromTask(taskId, tagId)
  }

  async setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchTaskApi<{ data: TaskTag[] }>(`/api/tasks/${taskId}/tags`, {
        method: 'PUT',
        body: JSON.stringify({ tagIds }),
      })
      return
    }

    throw new Error(
      'TaskService.setTaskTags is browser-only; use TaskTenantMutationService on the server'
    )
  }

  // ============================================
  // Subtask Operations
  // ============================================

  async createSubtask(params: {
    parentTaskId: string
    organizationId: string
    title: string
    assigneeId?: string
    dueDate?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  }) {
    if (typeof window !== 'undefined') {
      return this.createTask({
        organization_id: params.organizationId,
        title: params.title,
        assignee_id: params.assigneeId,
        due_date: params.dueDate,
        priority: params.priority,
        parent_task_id: params.parentTaskId,
      })
    }

    throw new Error('TaskService.createSubtask is browser-only; use TaskTenantMutationService on the server')
  }

  async updateSubtask(subtaskId: string, updates: Parameters<typeof this.updateTask>[1]) {
    return this.updateTask(subtaskId, updates)
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    return this.deleteTask(subtaskId)
  }

  // ============================================
  // Task History
  // ============================================

  async getTaskHistory(taskId: string) {
    if (typeof window !== 'undefined') {
      const response = await this.fetchTaskApi<{ data: TaskHistory[] }>(`/api/tasks/${taskId}/history`)
      return response.data
    }

    const repo = await this.getRepository()
    return repo.getHistory(taskId)
  }

  // ============================================
  // Statistics
  // ============================================

  async getTaskStatistics(organizationId: string) {
    const repo = await this.getRepository()
    return repo.getStatistics(organizationId)
  }
}
