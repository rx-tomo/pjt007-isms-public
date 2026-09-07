/**
 * Task Repository Interface
 *
 * Handles all task-related data operations including:
 * - Task CRUD operations
 * - Task categories and tags
 * - Task comments and attachments
 * - Task history and statistics
 */
import type { Database } from '@/types/database.types'
import type { IOrganizationScopedRepository, QueryOptions } from './IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

// Database types
type TaskRow = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']
type TaskUpdate = Database['public']['Tables']['tasks']['Update']
type TaskCategoryRow = Database['public']['Tables']['task_categories']['Row']
type TaskCommentRow = Database['public']['Tables']['task_comments']['Row']
type TaskAttachmentRow = Database['public']['Tables']['task_attachments']['Row']
type TaskTagRow = Database['public']['Tables']['task_tags']['Row']
type TaskHistoryRow = Database['public']['Tables']['task_history']['Row']
type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']

// Re-export for convenience
export type {
  TaskRow,
  TaskInsert,
  TaskUpdate,
  TaskCategoryRow,
  TaskCommentRow,
  TaskAttachmentRow,
  TaskTagRow,
  TaskHistoryRow
}

/**
 * Task status enum
 */
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'

/**
 * Task priority enum
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Task category with typed fields
 */
export interface TaskCategory {
  id: string
  organization_id: string
  name: string
  color?: string | null
  icon?: string | null
  display_order: number
  created_at: string
  updated_at: string
}

/**
 * Task entity with typed fields
 */
export interface Task {
  id: string
  organization_id: string
  title: string
  description?: string | null
  category_id?: string | null
  assignee_id?: string | null
  reporter_id?: string | null
  department_id?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  progress: number
  parent_task_id?: string | null
  related_document_id?: string | null
  related_risk_id?: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

/**
 * Task comment with user relation
 */
export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  comment: string
  created_at: string
  updated_at: string
  user?: UserProfileRow | null
}

/**
 * Task attachment with uploader relation
 */
export interface TaskAttachment {
  id: string
  task_id: string
  file_name: string
  file_path: string
  file_size?: number | null
  mime_type?: string | null
  uploaded_by?: string | null
  uploaded_at: string
  uploader?: UserProfileRow | null
}

/**
 * Task tag entity
 */
export interface TaskTag {
  id: string
  organization_id: string
  name: string
  color?: string | null
  created_at: string
  display_order?: number
}

/**
 * Task history entry with user relation
 */
export interface TaskHistory {
  id: string
  task_id: string
  user_id: string
  action: string
  field_name?: string | null
  old_value?: string | null
  new_value?: string | null
  created_at: string
  user?: UserProfileRow | null
}

/**
 * Task with all relations loaded
 */
export interface TaskWithRelations extends Task {
  category?: TaskCategory | null
  assignee?: UserProfileRow | null
  reporter?: UserProfileRow | null
  comments?: TaskComment[]
  attachments?: TaskAttachment[]
  tags?: TaskTag[]
  subtasks?: Task[]
}

/**
 * Filters for task queries
 */
export interface TaskFilters {
  organizationId: string
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  categoryId?: string
  dueDate?: { from?: string; to?: string }
  departmentId?: string | null
  includeNoDepartment?: boolean
}

/**
 * Task statistics
 */
export interface TaskStatistics {
  total: number
  byStatus: Record<TaskStatus, number>
  byPriority: Record<TaskPriority, number>
  overdue: number
  dueToday: number
  dueThisWeek: number
}

/**
 * Create task input
 */
export type TaskCreateInput = Omit<Task, 'id' | 'created_at' | 'updated_at'>

/**
 * Update task input
 */
export type TaskUpdateInput = Partial<Task>

export type TaskTenantInvariantValidator = (db: DrizzleDb) => Promise<void>

export interface TaskLifecycleAuditContext {
  userId: string
  userAgent?: string | null
  ipAddress?: string | null
}

export interface TaskImportMutationInput {
  organizationId: string
  reporterId: string
  title: string
  description?: string | null
  categoryName?: string | null
  assigneeEmail?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string | null
  estimatedHours?: number | null
  tagNames?: string[]
}

export interface TaskImportMutationResult {
  action: 'created' | 'updated'
  task: Task
}

/**
 * Create tag input
 */
export type TaskTagCreateInput = Omit<TaskTag, 'id' | 'created_at'>

/**
 * Create comment input
 */
export interface TaskCommentCreateInput {
  task_id: string
  user_id: string
  comment: string
}

/**
 * Create subtask input
 */
export interface SubtaskCreateInput {
  parentTaskId: string
  organizationId: string
  title: string
  assigneeId?: string
  dueDate?: string
  priority?: TaskPriority
  reporterId: string
}

/**
 * Create attachment input
 */
export interface TaskAttachmentCreateInput {
  task_id: string
  file_name: string
  file_path: string
  file_size?: number
  mime_type?: string
  uploaded_by: string
}

/**
 * Task Repository Interface
 */
export interface ITaskRepository extends IOrganizationScopedRepository<Task, TaskCreateInput, TaskUpdateInput> {
  // Task Category operations
  getCategories(organizationId: string, options?: QueryOptions): Promise<TaskCategory[]>
  createDefaultCategories(organizationId: string): Promise<void>

  // Task CRUD with relations
  findOrganizationIdByTaskId(taskId: string): Promise<string | null>
  findByIdAndOrganizationId(taskId: string, organizationId: string): Promise<Task | null>
  findWithRelations(taskId: string): Promise<TaskWithRelations | null>
  findWithRelationsByOrganizationId(taskId: string, organizationId: string): Promise<TaskWithRelations | null>
  findManyWithRelations(filters: TaskFilters): Promise<TaskWithRelations[]>
  updateByOrganizationId(taskId: string, organizationId: string, data: TaskUpdateInput): Promise<Task | null>
  createWithTenantInvariant(
    data: TaskCreateInput,
    validate: TaskTenantInvariantValidator,
    audit: TaskLifecycleAuditContext
  ): Promise<Task>
  updateWithTenantInvariant(
    taskId: string,
    organizationId: string,
    data: TaskUpdateInput,
    validate: TaskTenantInvariantValidator,
    audit: TaskLifecycleAuditContext
  ): Promise<Task | null>
  deleteTaskForTenant(
    taskId: string,
    organizationId: string,
    audit: TaskLifecycleAuditContext
  ): Promise<void>
  importTaskRow(input: TaskImportMutationInput): Promise<TaskImportMutationResult>

  // Task Comment operations
  getComments(taskId: string): Promise<TaskComment[]>
  addComment(input: TaskCommentCreateInput): Promise<TaskComment>
  updateComment(commentId: string, comment: string): Promise<TaskComment | null>
  deleteComment(commentId: string): Promise<TaskComment | null>

  // Task Attachment operations
  getAttachments(taskId: string): Promise<TaskAttachment[]>
  createAttachment(input: TaskAttachmentCreateInput): Promise<TaskAttachment>
  deleteAttachment(
    attachmentId: string,
    taskId?: string,
    organizationId?: string
  ): Promise<{ filePath: string | null }>

  // Task Tag operations
  getTags(organizationId: string): Promise<TaskTag[]>
  createTag(tag: TaskTagCreateInput): Promise<TaskTag>
  addTagToTask(taskId: string, tagId: string): Promise<void>
  removeTagFromTask(taskId: string, tagId: string): Promise<void>
  setTaskTags(taskId: string, tagIds: string[]): Promise<void>
  setTaskTagsForTenant(
    taskId: string,
    organizationId: string,
    tagIds: string[],
    audit: TaskLifecycleAuditContext
  ): Promise<void>

  // Subtask operations
  createSubtask(input: SubtaskCreateInput): Promise<Task>

  // Task History
  getHistory(taskId: string): Promise<TaskHistory[]>

  // Statistics
  getStatistics(organizationId: string): Promise<TaskStatistics>
}
