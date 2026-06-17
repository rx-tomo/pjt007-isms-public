/**
 * SQLite Task Repository
 *
 * Implements ITaskRepository using Drizzle ORM with SQLite.
 * Handles all task-related data operations with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - All org-scoped queries include organization_id filtering for multi-tenant isolation
 * - completed_at auto-managed: set when status='done', cleared otherwise
 * - task_tag_relations uses composite PK (task_id, tag_id), no separate 'id' column
 * - Supports pagination via limit/offset
 * - Relations loaded via explicit JOINs (no nested select)
 *
 * @module lib/db/repositories/sqlite/TaskRepository
 */

import { eq, and, asc, desc, gte, lte, isNull, or } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  tasks,
  taskCategories,
  taskComments,
  taskAttachments,
  taskTags,
  taskTagRelations,
  taskHistory,
} from '@/lib/db/drizzle/schema/tasks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import type {
  ITaskRepository,
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskWithRelations,
  TaskCategory,
  TaskComment,
  TaskAttachment,
  TaskTag,
  TaskHistory,
  TaskFilters,
  TaskStatistics,
  TaskStatus,
  TaskPriority,
  TaskCommentCreateInput,
  TaskTagCreateInput,
  SubtaskCreateInput,
  TaskAttachmentCreateInput,
} from '../interfaces/ITaskRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteTaskRepository extends BaseSQLiteRepository implements ITaskRepository {
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
   * Find a task by its ID
   */
  async findById(id: string): Promise<Task | null> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))

    if (rows.length === 0) return null

    return this.mapTaskRowToEntity(rows[0])
  }

  /**
   * Find multiple tasks with optional filters
   */
  async findMany(filters?: Record<string, unknown>): Promise<Task[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db
        .select()
        .from(tasks)
        .orderBy(desc(tasks.createdAt))

      return rows.map(row => this.mapTaskRowToEntity(row))
    }

    const conditions = Object.entries(filters).map(([key, value]) => {
      const column = tasks[key as keyof typeof tasks.$inferSelect]
      if (column) {
        return eq(column as never, value as never)
      }
      return null
    }).filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db
        .select()
        .from(tasks)
        .orderBy(desc(tasks.createdAt))

      return rows.map(row => this.mapTaskRowToEntity(row))
    }

    const rows = await this.db
      .select()
      .from(tasks)
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions as never[]))
      .orderBy(desc(tasks.createdAt))

    return rows.map(row => this.mapTaskRowToEntity(row))
  }

  /**
   * Find tasks by organization ID
   */
  async findByOrganizationId(organizationId: string): Promise<Task[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId))
      .orderBy(desc(tasks.createdAt))

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length })

    return rows.map(row => this.mapTaskRowToEntity(row))
  }

  /**
   * Create a new task
   */
  async create(data: TaskCreateInput): Promise<Task> {
    this.requireOrganizationId(data.organization_id, 'create task')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id,
      title: data.title,
      description: data.description ?? null,
      categoryId: data.category_id ?? null,
      assigneeId: data.assignee_id ?? null,
      reporterId: data.reporter_id ?? null,
      status: data.status ?? 'todo',
      priority: data.priority ?? 'medium',
      dueDate: data.due_date ?? null,
      estimatedHours: data.estimated_hours ?? null,
      actualHours: data.actual_hours ?? null,
      progress: data.progress ?? 0,
      parentTaskId: data.parent_task_id ?? null,
      relatedDocumentId: data.related_document_id ?? null,
      relatedRiskId: data.related_risk_id ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: data.status === 'done' ? now : null,
    }

    await this.db.insert(tasks).values(row)

    this.logDataAccess('create task', data.organization_id, { id })

    return this.mapTaskRowToEntity(row)
  }

  /**
   * Update an existing task
   */
  async update(id: string, updates: TaskUpdateInput): Promise<Task | null> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = {
      updatedAt: now,
    }

    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.category_id !== undefined) setPayload.categoryId = updates.category_id
    if (updates.assignee_id !== undefined) setPayload.assigneeId = updates.assignee_id
    if (updates.reporter_id !== undefined) setPayload.reporterId = updates.reporter_id
    if (updates.due_date !== undefined) setPayload.dueDate = updates.due_date
    if (updates.estimated_hours !== undefined) setPayload.estimatedHours = updates.estimated_hours
    if (updates.actual_hours !== undefined) setPayload.actualHours = updates.actual_hours
    if (updates.progress !== undefined) setPayload.progress = updates.progress
    if (updates.parent_task_id !== undefined) setPayload.parentTaskId = updates.parent_task_id
    if (updates.related_document_id !== undefined) setPayload.relatedDocumentId = updates.related_document_id
    if (updates.related_risk_id !== undefined) setPayload.relatedRiskId = updates.related_risk_id
    if (updates.priority !== undefined) setPayload.priority = updates.priority

    // Handle completed_at based on status
    if (updates.status !== undefined) {
      setPayload.status = updates.status
      if (updates.status === 'done' && !updates.completed_at) {
        setPayload.completedAt = now
      } else if (updates.status !== 'done') {
        setPayload.completedAt = null
      }
    }

    if (updates.completed_at !== undefined) setPayload.completedAt = updates.completed_at

    await this.db
      .update(tasks)
      .set(setPayload)
      .where(eq(tasks.id, id))

    // Re-fetch the updated row
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))

    if (rows.length === 0) return null

    return this.mapTaskRowToEntity(rows[0])
  }

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(tasks)
      .where(eq(tasks.id, id))
  }

  // =========================================
  // Task Category operations
  // =========================================

  /**
   * Get task categories for an organization
   */
  async getCategories(organizationId?: string, options?: QueryOptions): Promise<TaskCategory[]> {
    if (organizationId) {
      this.requireOrganizationId(organizationId, 'getCategories')
    }

    const conditions = []
    if (organizationId) {
      conditions.push(eq(taskCategories.organizationId, organizationId))
    }

    let query = this.db
      .select()
      .from(taskCategories)

    if (conditions.length > 0) {
      query = query.where(conditions[0]) as typeof query
    }

    const rows = await query.orderBy(asc(taskCategories.displayOrder))

    if (options?.limit) {
      return rows.slice(0, options.limit).map(row => this.mapCategoryRowToEntity(row))
    }

    this.logDataAccess('getCategories', organizationId ?? 'all', { count: rows.length })

    return rows.map(row => this.mapCategoryRowToEntity(row))
  }

  /**
   * Create default task categories for an organization
   */
  async createDefaultCategories(organizationId: string): Promise<void> {
    this.requireOrganizationId(organizationId, 'createDefaultCategories')

    const now = new Date().toISOString()
    const defaults = [
      { name: 'ISMS構築', color: '#3B82F6', icon: 'shield', displayOrder: 1 },
      { name: '文書管理', color: '#10B981', icon: 'file-text', displayOrder: 2 },
      { name: 'リスク対応', color: '#EF4444', icon: 'alert-triangle', displayOrder: 3 },
      { name: '内部監査', color: '#F59E0B', icon: 'search', displayOrder: 4 },
      { name: '教育・訓練', color: '#8B5CF6', icon: 'book-open', displayOrder: 5 },
      { name: 'インシデント対応', color: '#EC4899', icon: 'zap', displayOrder: 6 },
      { name: 'その他', color: '#6B7280', icon: 'more-horizontal', displayOrder: 7 },
    ]

    for (const cat of defaults) {
      await this.db.insert(taskCategories).values({
        id: crypto.randomUUID(),
        organizationId,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        createdAt: now,
        updatedAt: now,
      })
    }

    this.logDataAccess('createDefaultCategories', organizationId, { count: defaults.length })
  }

  // =========================================
  // Task with relations
  // =========================================

  /**
   * Find a task by ID with all relations
   */
  async findWithRelations(taskId: string): Promise<TaskWithRelations | null> {
    // 1. Fetch the task itself
    const taskRows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))

    if (taskRows.length === 0) return null

    const task = this.mapTaskRowToEntity(taskRows[0])

    // 2. Fetch category
    let category: TaskCategory | null = null
    if (taskRows[0].categoryId) {
      const catRows = await this.db
        .select()
        .from(taskCategories)
        .where(eq(taskCategories.id, taskRows[0].categoryId))

      if (catRows.length > 0) {
        category = this.mapCategoryRowToEntity(catRows[0])
      }
    }

    // 3. Fetch assignee
    let assignee = null
    if (taskRows[0].assigneeId) {
      const assigneeRows = await this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, taskRows[0].assigneeId))

      if (assigneeRows.length > 0) {
        assignee = this.mapUserProfileRowToEntity(assigneeRows[0])
      }
    }

    // 4. Fetch reporter
    let reporter = null
    if (taskRows[0].reporterId) {
      const reporterRows = await this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, taskRows[0].reporterId))

      if (reporterRows.length > 0) {
        reporter = this.mapUserProfileRowToEntity(reporterRows[0])
      }
    }

    // 5. Fetch comments with user
    const comments = await this.getComments(taskId)

    // 6. Fetch attachments
    const attachments = await this.getAttachments(taskId)

    // 7. Fetch tags
    const tagRelRows = await this.db
      .select({
        tagId: taskTagRelations.tagId,
        displayOrder: taskTagRelations.displayOrder,
      })
      .from(taskTagRelations)
      .where(eq(taskTagRelations.taskId, taskId))
      .orderBy(asc(taskTagRelations.displayOrder))

    const tagList: TaskTag[] = []
    for (const rel of tagRelRows) {
      const tagRows = await this.db
        .select()
        .from(taskTags)
        .where(eq(taskTags.id, rel.tagId))

      if (tagRows.length > 0) {
        tagList.push({
          ...this.mapTagRowToEntity(tagRows[0]),
          display_order: rel.displayOrder,
        })
      }
    }

    // 8. Fetch subtasks
    const subtaskRows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, taskId))
      .orderBy(asc(tasks.createdAt))

    const subtasks = subtaskRows.map(row => this.mapTaskRowToEntity(row))

    return {
      ...task,
      category,
      assignee,
      reporter,
      comments,
      attachments,
      tags: tagList,
      subtasks,
    }
  }

  /**
   * Find tasks with relations, applying filters
   */
  async findManyWithRelations(filters?: TaskFilters): Promise<TaskWithRelations[]> {
    // Build conditions
    const conditions = []

    if (filters?.organizationId) {
      this.requireOrganizationId(filters.organizationId, 'findManyWithRelations')
      conditions.push(eq(tasks.organizationId, filters.organizationId))
    }

    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status))
    }

    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority))
    }

    if (filters?.assigneeId) {
      conditions.push(eq(tasks.assigneeId, filters.assigneeId))
    }

    if (filters?.categoryId) {
      conditions.push(eq(tasks.categoryId, filters.categoryId))
    }

    if (filters?.dueDate?.from) {
      conditions.push(gte(tasks.dueDate, filters.dueDate.from))
    }

    if (filters?.dueDate?.to) {
      conditions.push(lte(tasks.dueDate, filters.dueDate.to))
    }

    // Department filter
    if (filters?.departmentId !== undefined) {
      if (filters.departmentId === null) {
        conditions.push(isNull(tasks.parentTaskId) as never) // No department_id in SQLite schema; use null check pattern
      } else if (filters.includeNoDepartment) {
        // In SQLite schema, department_id is not present; skip this filter
      }
    }

    let query = this.db
      .select()
      .from(tasks)

    if (conditions.length > 0) {
      query = query.where(
        conditions.length === 1 ? conditions[0]! : and(...conditions as never[])
      ) as typeof query
    }

    const taskRows = await query.orderBy(desc(tasks.createdAt))

    this.logDataAccess('findManyWithRelations', filters?.organizationId ?? 'all', { count: taskRows.length })

    // Load relations for each task
    const results: TaskWithRelations[] = []

    for (const row of taskRows) {
      const task = this.mapTaskRowToEntity(row)

      // Category
      let category: TaskCategory | null = null
      if (row.categoryId) {
        const catRows = await this.db
          .select()
          .from(taskCategories)
          .where(eq(taskCategories.id, row.categoryId))

        if (catRows.length > 0) {
          category = this.mapCategoryRowToEntity(catRows[0])
        }
      }

      // Assignee
      let assignee = null
      if (row.assigneeId) {
        const assigneeRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.assigneeId))

        if (assigneeRows.length > 0) {
          assignee = this.mapUserProfileRowToEntity(assigneeRows[0])
        }
      }

      // Reporter
      let reporter = null
      if (row.reporterId) {
        const reporterRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.reporterId))

        if (reporterRows.length > 0) {
          reporter = this.mapUserProfileRowToEntity(reporterRows[0])
        }
      }

      // Tags
      const tagRelRows = await this.db
        .select({
          tagId: taskTagRelations.tagId,
          displayOrder: taskTagRelations.displayOrder,
        })
        .from(taskTagRelations)
        .where(eq(taskTagRelations.taskId, row.id))
        .orderBy(asc(taskTagRelations.displayOrder))

      const tagList: TaskTag[] = []
      for (const rel of tagRelRows) {
        const tagRows = await this.db
          .select()
          .from(taskTags)
          .where(eq(taskTags.id, rel.tagId))

        if (tagRows.length > 0) {
          tagList.push({
            ...this.mapTagRowToEntity(tagRows[0]),
            display_order: rel.displayOrder,
          })
        }
      }

      // Comments (latest 5)
      const commentRows = await this.db
        .select()
        .from(taskComments)
        .where(eq(taskComments.taskId, row.id))
        .orderBy(asc(taskComments.createdAt))

      const comments: TaskComment[] = commentRows.slice(0, 5).map(cr => this.mapCommentRowToEntity(cr))

      results.push({
        ...task,
        category,
        assignee,
        reporter,
        tags: tagList,
        comments,
      })
    }

    return results
  }

  // =========================================
  // Task Comment operations
  // =========================================

  /**
   * Get all comments for a task, ordered by created_at asc
   */
  async getComments(taskId: string): Promise<TaskComment[]> {
    const rows = await this.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt))

    const results: TaskComment[] = []

    for (const row of rows) {
      const comment = this.mapCommentRowToEntity(row)

      // Load user
      if (row.userId) {
        const userRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.userId))

        if (userRows.length > 0) {
          comment.user = this.mapUserProfileRowToEntity(userRows[0])
        }
      }

      results.push(comment)
    }

    return results
  }

  /**
   * Add a comment to a task
   */
  async addComment(input: TaskCommentCreateInput): Promise<TaskComment> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      taskId: input.task_id,
      userId: input.user_id,
      comment: input.comment,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(taskComments).values(row)

    const comment = this.mapCommentRowToEntity(row)

    // Load user
    if (input.user_id) {
      const userRows = await this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, input.user_id))

      if (userRows.length > 0) {
        comment.user = this.mapUserProfileRowToEntity(userRows[0])
      }
    }

    return comment
  }

  async updateComment(commentId: string, comment: string): Promise<TaskComment | null> {
    const now = new Date().toISOString()

    await this.db
      .update(taskComments)
      .set({
        comment,
        updatedAt: now,
      })
      .where(eq(taskComments.id, commentId))

    const rows = await this.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, commentId))
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return this.mapCommentRowToEntity(rows[0])
  }

  async deleteComment(commentId: string): Promise<TaskComment | null> {
    const rows = await this.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, commentId))
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    await this.db
      .delete(taskComments)
      .where(eq(taskComments.id, commentId))

    return this.mapCommentRowToEntity(rows[0])
  }

  // =========================================
  // Task Attachment operations
  // =========================================

  /**
   * Get all attachments for a task
   */
  async getAttachments(taskId: string): Promise<TaskAttachment[]> {
    const rows = await this.db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.uploadedAt))

    const results: TaskAttachment[] = []

    for (const row of rows) {
      const attachment = this.mapAttachmentRowToEntity(row)

      // Load uploader
      if (row.uploadedBy) {
        const userRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.uploadedBy))

        if (userRows.length > 0) {
          attachment.uploader = this.mapUserProfileRowToEntity(userRows[0])
        }
      }

      results.push(attachment)
    }

    return results
  }

  /**
   * Create a new attachment
   */
  async createAttachment(input: TaskAttachmentCreateInput): Promise<TaskAttachment> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      taskId: input.task_id,
      fileName: input.file_name,
      filePath: input.file_path,
      fileSize: input.file_size ?? null,
      mimeType: input.mime_type ?? null,
      uploadedBy: input.uploaded_by,
      uploadedAt: now,
    }

    await this.db.insert(taskAttachments).values(row)

    return this.mapAttachmentRowToEntity(row)
  }

  /**
   * Delete an attachment (returns its file_path for storage cleanup)
   */
  async deleteAttachment(attachmentId: string): Promise<{ filePath: string | null }> {
    // First fetch the attachment to get file_path
    const rows = await this.db
      .select({ filePath: taskAttachments.filePath })
      .from(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId))

    const filePath = rows.length > 0 ? rows[0].filePath : null

    // Delete from database
    await this.db
      .delete(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId))

    return { filePath }
  }

  // =========================================
  // Task Tag operations
  // =========================================

  /**
   * Get all tags for an organization
   */
  async getTags(organizationId: string): Promise<TaskTag[]> {
    this.requireOrganizationId(organizationId, 'getTags')

    const rows = await this.db
      .select()
      .from(taskTags)
      .where(eq(taskTags.organizationId, organizationId))
      .orderBy(asc(taskTags.name))

    this.logDataAccess('getTags', organizationId, { count: rows.length })

    return rows.map(row => this.mapTagRowToEntity(row))
  }

  /**
   * Create a new tag
   */
  async createTag(tag: TaskTagCreateInput): Promise<TaskTag> {
    this.requireOrganizationId(tag.organization_id, 'createTag')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: tag.organization_id,
      name: tag.name,
      color: tag.color ?? null,
      createdAt: now,
    }

    await this.db.insert(taskTags).values(row)

    this.logDataAccess('createTag', tag.organization_id, { id })

    return this.mapTagRowToEntity(row)
  }

  /**
   * Add a tag to a task (upsert-style: get max display_order and insert)
   */
  async addTagToTask(taskId: string, tagId: string): Promise<void> {
    // Get max display_order for this task
    const existingOrders = await this.db
      .select({ displayOrder: taskTagRelations.displayOrder })
      .from(taskTagRelations)
      .where(eq(taskTagRelations.taskId, taskId))
      .orderBy(desc(taskTagRelations.displayOrder))

    const nextOrder = existingOrders.length > 0
      ? (existingOrders[0]?.displayOrder ?? 0) + 1
      : 0

    // Delete existing (to implement upsert since SQLite composite PK)
    await this.db
      .delete(taskTagRelations)
      .where(
        and(
          eq(taskTagRelations.taskId, taskId),
          eq(taskTagRelations.tagId, tagId)
        )
      )

    // Insert
    await this.db.insert(taskTagRelations).values({
      taskId,
      tagId,
      displayOrder: nextOrder,
    })
  }

  /**
   * Remove a tag from a task
   */
  async removeTagFromTask(taskId: string, tagId: string): Promise<void> {
    await this.db
      .delete(taskTagRelations)
      .where(
        and(
          eq(taskTagRelations.taskId, taskId),
          eq(taskTagRelations.tagId, tagId)
        )
      )
  }

  /**
   * Set all tags for a task (replace existing)
   */
  async setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
    // Delete all existing tag relations
    await this.db
      .delete(taskTagRelations)
      .where(eq(taskTagRelations.taskId, taskId))

    // Insert new ones with display_order
    for (let i = 0; i < tagIds.length; i++) {
      await this.db.insert(taskTagRelations).values({
        taskId,
        tagId: tagIds[i],
        displayOrder: i,
      })
    }
  }

  // =========================================
  // Subtask operations
  // =========================================

  /**
   * Create a subtask
   */
  async createSubtask(input: SubtaskCreateInput): Promise<Task> {
    this.requireOrganizationId(input.organizationId, 'createSubtask')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: input.organizationId,
      title: input.title,
      description: null,
      categoryId: null,
      assigneeId: input.assigneeId ?? null,
      reporterId: input.reporterId,
      status: 'todo',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
      estimatedHours: null,
      actualHours: null,
      progress: 0,
      parentTaskId: input.parentTaskId,
      relatedDocumentId: null,
      relatedRiskId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }

    await this.db.insert(tasks).values(row)

    this.logDataAccess('createSubtask', input.organizationId, { id, parentTaskId: input.parentTaskId })

    return this.mapTaskRowToEntity(row)
  }

  // =========================================
  // Task History
  // =========================================

  /**
   * Get task history, ordered by created_at desc
   */
  async getHistory(taskId: string): Promise<TaskHistory[]> {
    const rows = await this.db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .orderBy(desc(taskHistory.createdAt))

    const results: TaskHistory[] = []

    for (const row of rows) {
      const entry = this.mapHistoryRowToEntity(row)

      // Load user
      if (row.userId) {
        const userRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.userId))

        if (userRows.length > 0) {
          entry.user = this.mapUserProfileRowToEntity(userRows[0])
        }
      }

      results.push(entry)
    }

    return results
  }

  // =========================================
  // Statistics
  // =========================================

  /**
   * Get task statistics for an organization
   */
  async getStatistics(organizationId: string): Promise<TaskStatistics> {
    this.requireOrganizationId(organizationId, 'getStatistics')

    const rows = await this.db
      .select({
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const stats: TaskStatistics = {
      total: rows.length,
      byStatus: {
        todo: 0,
        in_progress: 0,
        review: 0,
        done: 0,
        cancelled: 0,
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      },
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
    }

    rows.forEach(row => {
      const status = row.status as TaskStatus
      const priority = row.priority as TaskPriority

      if (status && stats.byStatus[status] !== undefined) {
        stats.byStatus[status]++
      }
      if (priority && stats.byPriority[priority] !== undefined) {
        stats.byPriority[priority]++
      }

      if (row.dueDate) {
        const dueDate = new Date(row.dueDate)
        if (dueDate < today && status !== 'done' && status !== 'cancelled') {
          stats.overdue++
        } else if (dueDate.toDateString() === today.toDateString()) {
          stats.dueToday++
        } else if (dueDate >= today && dueDate <= weekEnd) {
          stats.dueThisWeek++
        }
      }
    })

    this.logDataAccess('getStatistics', organizationId, { total: stats.total })

    return stats
  }

  // =========================================
  // Private: row-to-entity mappers
  // =========================================

  private mapTaskRowToEntity(row: {
    id: string
    organizationId: string | null
    title: string
    description: string | null
    categoryId: string | null
    assigneeId: string | null
    reporterId: string | null
    status: string | null
    priority: string | null
    dueDate: string | null
    estimatedHours: number | null
    actualHours: number | null
    progress: number | null
    parentTaskId: string | null
    relatedDocumentId: string | null
    relatedRiskId: string | null
    createdAt: string | null
    updatedAt: string | null
    completedAt: string | null
  }): Task {
    return {
      id: row.id,
      organization_id: row.organizationId ?? '',
      title: row.title,
      description: row.description,
      category_id: row.categoryId,
      assignee_id: row.assigneeId,
      reporter_id: row.reporterId,
      department_id: null, // Not in Drizzle SQLite schema
      status: (row.status ?? 'todo') as TaskStatus,
      priority: (row.priority ?? 'medium') as TaskPriority,
      due_date: row.dueDate,
      estimated_hours: row.estimatedHours,
      actual_hours: row.actualHours,
      progress: row.progress ?? 0,
      parent_task_id: row.parentTaskId,
      related_document_id: row.relatedDocumentId,
      related_risk_id: row.relatedRiskId,
      created_at: row.createdAt ?? new Date().toISOString(),
      updated_at: row.updatedAt ?? new Date().toISOString(),
      completed_at: row.completedAt,
    }
  }

  private mapCategoryRowToEntity(row: {
    id: string
    organizationId: string | null
    name: string
    color: string | null
    icon: string | null
    displayOrder: number | null
    createdAt: string | null
    updatedAt: string | null
  }): TaskCategory {
    return {
      id: row.id,
      organization_id: row.organizationId ?? '',
      name: row.name,
      color: row.color,
      icon: row.icon,
      display_order: row.displayOrder ?? 0,
      created_at: row.createdAt ?? new Date().toISOString(),
      updated_at: row.updatedAt ?? new Date().toISOString(),
    }
  }

  private mapCommentRowToEntity(row: {
    id: string
    taskId: string | null
    userId: string | null
    comment: string
    createdAt: string | null
    updatedAt: string | null
  }): TaskComment {
    return {
      id: row.id,
      task_id: row.taskId ?? '',
      user_id: row.userId ?? '',
      comment: row.comment,
      created_at: row.createdAt ?? new Date().toISOString(),
      updated_at: row.updatedAt ?? new Date().toISOString(),
    }
  }

  private mapAttachmentRowToEntity(row: {
    id: string
    taskId: string | null
    fileName: string
    filePath: string
    fileSize: number | null
    mimeType: string | null
    uploadedBy: string | null
    uploadedAt: string | null
  }): TaskAttachment {
    return {
      id: row.id,
      task_id: row.taskId ?? '',
      file_name: row.fileName,
      file_path: row.filePath,
      file_size: row.fileSize,
      mime_type: row.mimeType,
      uploaded_by: row.uploadedBy,
      uploaded_at: row.uploadedAt ?? new Date().toISOString(),
    }
  }

  private mapTagRowToEntity(row: {
    id: string
    organizationId: string | null
    name: string
    color: string | null
    createdAt: string | null
  }): TaskTag {
    return {
      id: row.id,
      organization_id: row.organizationId ?? '',
      name: row.name,
      color: row.color,
      created_at: row.createdAt ?? new Date().toISOString(),
      display_order: undefined,
    }
  }

  private mapHistoryRowToEntity(row: {
    id: string
    taskId: string | null
    userId: string | null
    action: string
    fieldName: string | null
    oldValue: string | null
    newValue: string | null
    createdAt: string | null
  }): TaskHistory {
    return {
      id: row.id,
      task_id: row.taskId ?? '',
      user_id: row.userId ?? '',
      action: row.action,
      field_name: row.fieldName,
      old_value: row.oldValue,
      new_value: row.newValue,
      created_at: row.createdAt ?? new Date().toISOString(),
    }
  }

  /**
   * Maps a Drizzle userProfiles row to a UserProfile-like entity (snake_case)
   */
  private mapUserProfileRowToEntity(row: {
    id: string
    organizationId: string | null
    email: string
    fullName: string
    fullNameEn: string | null
    role: string
    department: string | null
    position: string | null
    phone: string | null
    isActive: boolean | null
    avatarUrl: string | null
    languagePreference: string | null
    primaryDepartmentId: string | null
    isCiso: boolean | null
    isSecurityManager: boolean | null
    isOrgAdmin: boolean | null
    isAuditCommittee: boolean | null
    isIsmsPromoter: boolean | null
    createdAt: string | null
    updatedAt: string | null
    lastLoginAt: string | null
  }) {
    return {
      id: row.id,
      organization_id: row.organizationId,
      email: row.email,
      full_name: row.fullName,
      full_name_en: row.fullNameEn,
      role: row.role as 'super_admin' | 'system_operator' | 'org_admin' | 'user' | 'auditor' | 'approver',
      department: row.department,
      position: row.position,
      phone: row.phone,
      is_active: row.isActive,
      avatar_url: row.avatarUrl,
      language_preference: row.languagePreference,
      primary_department_id: row.primaryDepartmentId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      last_login_at: row.lastLoginAt,
    }
  }
}
