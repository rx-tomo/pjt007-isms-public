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

import { eq, and, asc, desc, gte, lte, inArray, isNull, or } from 'drizzle-orm'
import type { Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '@/lib/db/drizzle/schema'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  tasks,
  taskCategories,
  taskComments,
  taskAttachments,
  taskTags,
  taskTagRelations,
  taskHistory,
  taskReminders,
} from '@/lib/db/drizzle/schema/tasks'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { documents } from '@/lib/db/drizzle/schema/documents'
import { risks } from '@/lib/db/drizzle/schema/risks'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema/users'
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
  TaskImportMutationInput,
  TaskImportMutationResult,
  TaskLifecycleAuditContext,
  TaskTenantInvariantValidator,
} from '../interfaces/ITaskRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'
import {
  assertTaskImportReferencesBelongToOrganization,
  TaskImportRowError,
  TaskTenantInvariantError,
} from '@/lib/services/taskTenantInvariant'
import { isTaskAttachmentStoragePath } from '@/lib/storage/taskAttachmentPolicy'

type TaskRow = typeof tasks.$inferSelect
type UserProfileRow = typeof userProfiles.$inferSelect
type EligibleUser = {
  profile: Pick<
    UserProfileRow,
    'id' | 'organizationId' | 'email' | 'fullName' | 'role' | 'isActive'
  >
  membershipRole: string
}

const taskHistoryFields: Array<{
  input: keyof TaskUpdateInput
  row: keyof TaskRow
}> = [
  { input: 'title', row: 'title' },
  { input: 'description', row: 'description' },
  { input: 'category_id', row: 'categoryId' },
  { input: 'assignee_id', row: 'assigneeId' },
  { input: 'reporter_id', row: 'reporterId' },
  { input: 'status', row: 'status' },
  { input: 'priority', row: 'priority' },
  { input: 'due_date', row: 'dueDate' },
  { input: 'estimated_hours', row: 'estimatedHours' },
  { input: 'actual_hours', row: 'actualHours' },
  { input: 'progress', row: 'progress' },
  { input: 'parent_task_id', row: 'parentTaskId' },
  { input: 'related_document_id', row: 'relatedDocumentId' },
  { input: 'related_risk_id', row: 'relatedRiskId' },
]

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

  async findOrganizationIdByTaskId(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ organizationId: tasks.organizationId })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1)

    return row?.organizationId ?? null
  }

  async findByIdAndOrganizationId(id: string, organizationId: string): Promise<Task | null> {
    this.requireOrganizationId(organizationId, 'findByIdAndOrganizationId')
    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
      .limit(1)

    return rows[0] ? (await this.projectTaskCore(rows[0])).task : null
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
    return this.createUsingDb(this.db, data)
  }

  private async createUsingDb(db: DrizzleDb, data: TaskCreateInput): Promise<Task> {
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

    await db.insert(tasks).values(row)

    this.logDataAccess('create task', data.organization_id, { id })

    return this.mapTaskRowToEntity(row)
  }

  /**
   * Update an existing task
   */
  async update(id: string, updates: TaskUpdateInput): Promise<Task | null> {
    const existing = await this.findById(id)
    if (!existing) return null
    return this.updateByOrganizationId(id, existing.organization_id, updates)
  }

  async updateByOrganizationId(
    id: string,
    organizationId: string,
    updates: TaskUpdateInput
  ): Promise<Task | null> {
    return this.updateUsingDb(this.db, id, organizationId, updates)
  }

  private async updateUsingDb(
    db: DrizzleDb,
    id: string,
    organizationId: string,
    updates: TaskUpdateInput,
    existingRow?: TaskRow
  ): Promise<Task | null> {
    this.requireOrganizationId(organizationId, 'updateByOrganizationId')
    const existing = existingRow ?? (await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
      .limit(1))[0]
    if (!existing) return null

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

    // completed_at is derived exclusively from status on the server.
    if (updates.status !== undefined) {
      setPayload.status = updates.status
      if (updates.status === 'done') {
        setPayload.completedAt = existing.completedAt ?? now
      } else {
        setPayload.completedAt = null
      }
    }

    await db
      .update(tasks)
      .set(setPayload)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))

    // Re-fetch the updated row
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))

    if (rows.length === 0) return null

    return (await this.projectTaskCore(rows[0], db)).task
  }

  async createWithTenantInvariant(
    data: TaskCreateInput,
    validate: TaskTenantInvariantValidator,
    audit: TaskLifecycleAuditContext
  ): Promise<Task> {
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, data.organization_id)
      await validate(tx)
      const task = await this.createUsingDb(tx, data)
      await this.insertTaskAudit(tx, data.organization_id, task.id, audit, 'task.created', {
        title: task.title,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
      })
      return task
    })
  }

  async updateWithTenantInvariant(
    id: string,
    organizationId: string,
    updates: TaskUpdateInput,
    validate: TaskTenantInvariantValidator,
    audit: TaskLifecycleAuditContext
  ): Promise<Task | null> {
    return this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      const [existing] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
        .limit(1)
      if (!existing) return null
      await validate(tx)
      const changedFields = this.getChangedTaskFields(existing, updates)
      const task = await this.updateUsingDb(tx, id, organizationId, updates, existing)
      if (!task) return null

      await this.insertTaskHistory(tx, organizationId, id, audit.userId, changedFields)
      await this.insertTaskAudit(
        tx,
        organizationId,
        id,
        audit,
        'task.updated',
        updates
      )
      return task
    })
  }

  async importTaskRow(input: TaskImportMutationInput): Promise<TaskImportMutationResult> {
    this.requireOrganizationId(input.organizationId, 'importTaskRow')

    return this.withTenantTransaction(async tx => {
      const matchingTasks = await tx
        .select()
        .from(tasks)
        .where(and(
          eq(tasks.organizationId, input.organizationId),
          eq(tasks.title, input.title)
        ))

      if (matchingTasks.length > 1) {
        throw new TaskImportRowError(
          'ambiguous_task',
          'Multiple tasks match this title in the organization'
        )
      }

      const categoryId = await this.resolveImportCategoryId(
        tx,
        input.organizationId,
        input.categoryName
      )
      const assigneeId = await this.resolveImportAssigneeId(
        tx,
        input.organizationId,
        input.assigneeEmail
      )
      const tagIds = await this.resolveImportTagIds(
        tx,
        input.organizationId,
        input.tagNames
      )

      await assertTaskImportReferencesBelongToOrganization(tx, input.organizationId, {
        categoryId,
        assigneeId,
        tagIds,
      })

      const existing = matchingTasks[0]
      if (existing) {
        const updates: TaskUpdateInput = {}
        if (input.description !== undefined) updates.description = input.description
        if (categoryId !== undefined) updates.category_id = categoryId
        if (assigneeId !== undefined) updates.assignee_id = assigneeId
        if (input.status !== undefined) updates.status = input.status
        if (input.priority !== undefined) updates.priority = input.priority
        if (input.dueDate !== undefined) updates.due_date = input.dueDate
        if (input.estimatedHours !== undefined) updates.estimated_hours = input.estimatedHours

        const task = await this.updateUsingDb(
          tx,
          existing.id,
          input.organizationId,
          updates
        )
        if (!task) {
          throw new TaskImportRowError(
            'ambiguous_task',
            'The task could not be updated safely'
          )
        }
        if (tagIds !== undefined) {
          await this.replaceImportTaskTags(tx, existing.id, tagIds)
        }
        return { action: 'updated', task }
      }

      const task = await this.createUsingDb(tx, {
        organization_id: input.organizationId,
        title: input.title,
        description: input.description ?? null,
        category_id: categoryId ?? null,
        assignee_id: assigneeId ?? null,
        reporter_id: input.reporterId,
        department_id: null,
        status: input.status ?? 'todo',
        priority: input.priority ?? 'medium',
        due_date: input.dueDate ?? null,
        estimated_hours: input.estimatedHours ?? null,
        actual_hours: null,
        progress: 0,
        parent_task_id: null,
        related_document_id: null,
        related_risk_id: null,
      })
      if (tagIds !== undefined) {
        await this.replaceImportTaskTags(tx, task.id, tagIds)
      }
      return { action: 'created', task }
    })
  }

  private async resolveImportCategoryId(
    db: DrizzleDb,
    organizationId: string,
    categoryName: string | null | undefined
  ): Promise<string | null | undefined> {
    if (categoryName === undefined || categoryName === null) return categoryName
    const normalizedName = categoryName.toLowerCase()
    const categories = await db
      .select({ id: taskCategories.id, name: taskCategories.name })
      .from(taskCategories)
      .where(eq(taskCategories.organizationId, organizationId))
    const matches = categories.filter(category => (
      category.name.trim().toLowerCase() === normalizedName
    ))

    if (matches.length === 0) {
      throw new TaskImportRowError('unresolved_category', 'Category was not found in the organization')
    }
    if (matches.length > 1) {
      throw new TaskImportRowError(
        'ambiguous_category',
        'Multiple categories match this name in the organization'
      )
    }
    return matches[0]!.id
  }

  private async resolveImportAssigneeId(
    db: DrizzleDb,
    organizationId: string,
    assigneeEmail: string | null | undefined
  ): Promise<string | null | undefined> {
    if (assigneeEmail === undefined || assigneeEmail === null) return assigneeEmail
    const normalizedEmail = assigneeEmail.toLowerCase()
    const members = await db
      .select({ id: userProfiles.id, email: userProfiles.email })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
    const matches = members.filter(member => (
      member.email.trim().toLowerCase() === normalizedEmail
    ))

    if (matches.length === 0) {
      throw new TaskImportRowError(
        'unresolved_assignee',
        'Assignee is not an active member of the organization'
      )
    }
    if (matches.length > 1) {
      throw new TaskImportRowError(
        'ambiguous_assignee',
        'Multiple active members match this assignee email'
      )
    }
    return matches[0]!.id
  }

  private async resolveImportTagIds(
    db: DrizzleDb,
    organizationId: string,
    tagNames: string[] | undefined
  ): Promise<string[] | undefined> {
    if (tagNames === undefined) return undefined

    const normalizedTagNames = new Map<string, string>()
    for (const tagName of tagNames) {
      const trimmed = tagName.trim()
      if (trimmed) normalizedTagNames.set(trimmed.toLowerCase(), trimmed)
    }
    if (normalizedTagNames.size > 50) {
      throw new TaskImportRowError('invalid_input', 'A task can have at most 50 tags')
    }
    if (normalizedTagNames.size === 0) return []

    const tags = await db
      .select({ id: taskTags.id, name: taskTags.name })
      .from(taskTags)
      .where(eq(taskTags.organizationId, organizationId))
    const tagIds: string[] = []
    for (const normalizedName of normalizedTagNames.keys()) {
      const matches = tags.filter(tag => tag.name.trim().toLowerCase() === normalizedName)
      if (matches.length === 0) {
        throw new TaskImportRowError('unresolved_tag', 'Tag was not found in the organization')
      }
      if (matches.length > 1) {
        throw new TaskImportRowError(
          'ambiguous_tag',
          'Multiple tags match this name in the organization'
        )
      }
      tagIds.push(matches[0]!.id)
    }
    return tagIds
  }

  private async replaceImportTaskTags(
    db: DrizzleDb,
    taskId: string,
    tagIds: string[]
  ): Promise<void> {
    await db.delete(taskTagRelations).where(eq(taskTagRelations.taskId, taskId))
    if (tagIds.length === 0) return
    await db.insert(taskTagRelations).values(tagIds.map((tagId, displayOrder) => ({
      taskId,
      tagId,
      displayOrder,
    })))
  }

  private getChangedTaskFields(existing: TaskRow, updates: TaskUpdateInput) {
    return taskHistoryFields.flatMap(({ input, row }) => {
      if (!Object.prototype.hasOwnProperty.call(updates, input)) return []
      const oldValue = existing[row] ?? null
      const newValue = updates[input] ?? null
      if (Object.is(oldValue, newValue)) return []
      return [{ fieldName: input, oldValue, newValue }]
    })
  }

  private async formatTaskHistoryValue(
    db: DrizzleDb,
    organizationId: string,
    fieldName: keyof TaskUpdateInput,
    value: unknown
  ): Promise<string | null> {
    if (value === null || value === undefined || value === '') return null
    if (fieldName === 'assignee_id' || fieldName === 'reporter_id') {
      if (typeof value !== 'string') return String(value)
      const user = await this.findEligibleUser(value, organizationId, db)
      return user?.profile.fullName || user?.profile.email || value
    }
    return String(value)
  }

  private async insertTaskHistory(
    db: DrizzleDb,
    organizationId: string,
    taskId: string,
    userId: string,
    changedFields: Array<{
      fieldName: keyof TaskUpdateInput
      oldValue: unknown
      newValue: unknown
    }>
  ): Promise<void> {
    if (changedFields.length === 0) return
    const createdAt = new Date().toISOString()
    const values = await Promise.all(changedFields.map(async change => ({
      id: crypto.randomUUID(),
      taskId,
      userId,
      action: 'updated',
      fieldName: change.fieldName,
      oldValue: await this.formatTaskHistoryValue(
        db,
        organizationId,
        change.fieldName,
        change.oldValue
      ),
      newValue: await this.formatTaskHistoryValue(
        db,
        organizationId,
        change.fieldName,
        change.newValue
      ),
      createdAt,
    })))
    await db.insert(taskHistory).values(values)
  }

  private async insertTaskAudit(
    db: DrizzleDb,
    organizationId: string,
    taskId: string,
    audit: TaskLifecycleAuditContext,
    action: 'task.created' | 'task.updated' | 'task.tags.updated' | 'task.deleted',
    changes: unknown
  ): Promise<void> {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: audit.userId,
      action,
      resourceType: 'task',
      resourceId: taskId,
      changes: JSON.stringify(changes),
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
      scope: 'tenant',
      createdAt: new Date().toISOString(),
    })
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
      throw new TaskTenantInvariantError(404, 'Task not found')
    }
  }

  private async withTenantTransaction<T>(operation: (tx: DrizzleDb) => Promise<T>): Promise<T> {
    const client = (this.db as unknown as { $client: Client }).$client
    const transaction = await client.transaction('write')
    const tx = drizzle(transaction as unknown as Client, { schema }) as DrizzleDb
    try {
      const result = await operation(tx)
      await transaction.commit()
      return result
    } catch (error) {
      await transaction.rollback()
      throw error
    } finally {
      transaction.close()
    }
  }

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(tasks)
      .where(eq(tasks.id, id))
  }

  async deleteTaskForTenant(
    id: string,
    organizationId: string,
    audit: TaskLifecycleAuditContext
  ): Promise<void> {
    this.requireOrganizationId(organizationId, 'deleteTaskForTenant')
    await this.withTenantTransaction(async tx => {
      const [task] = await tx
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
        .limit(1)
      if (!task) {
        throw new TaskTenantInvariantError(404, 'Task not found')
      }

      await this.assertActiveMembership(tx, audit.userId, organizationId)

      const blockers = [
        await tx.select({ id: tasks.id }).from(tasks)
          .where(and(eq(tasks.parentTaskId, id), eq(tasks.organizationId, organizationId))).limit(1),
        await tx.select({ id: taskAttachments.id }).from(taskAttachments)
          .where(eq(taskAttachments.taskId, id)).limit(1),
        await tx.select({ id: taskComments.id }).from(taskComments)
          .where(eq(taskComments.taskId, id)).limit(1),
        await tx.select({ id: taskHistory.id }).from(taskHistory)
          .where(eq(taskHistory.taskId, id)).limit(1),
        await tx.select({ id: taskReminders.id }).from(taskReminders)
          .where(eq(taskReminders.taskId, id)).limit(1),
      ]
      if (blockers.some(rows => rows.length > 0)) {
        throw new TaskTenantInvariantError(409, 'Task has related records')
      }

      await tx.delete(taskTagRelations).where(eq(taskTagRelations.taskId, id))
      await this.insertTaskAudit(tx, organizationId, id, audit, 'task.deleted', {
        title: task.title,
      })
      await tx.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
    })
  }

  // =========================================
  // Task Category operations
  // =========================================

  /**
   * Get task categories for an organization
   */
  async getCategories(organizationId: string, options?: QueryOptions): Promise<TaskCategory[]> {
    this.requireOrganizationId(organizationId, 'getCategories')

    const rows = await this.db
      .select()
      .from(taskCategories)
      .where(eq(taskCategories.organizationId, organizationId))
      .orderBy(asc(taskCategories.displayOrder))

    if (options?.limit) {
      return rows.slice(0, options.limit).map(row => this.mapCategoryRowToEntity(row))
    }

    this.logDataAccess('getCategories', organizationId, { count: rows.length })

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
    const [taskRow] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    return taskRow ? this.projectTaskWithRelations(taskRow, true) : null
  }

  async findWithRelationsByOrganizationId(
    taskId: string,
    organizationId: string
  ): Promise<TaskWithRelations | null> {
    this.requireOrganizationId(organizationId, 'findWithRelationsByOrganizationId')
    const [taskRow] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
      .limit(1)

    return taskRow ? this.projectTaskWithRelations(taskRow, true) : null
  }

  /**
   * Find tasks with relations, applying filters
   */
  async findManyWithRelations(filters: TaskFilters): Promise<TaskWithRelations[]> {
    this.requireOrganizationId(filters?.organizationId, 'findManyWithRelations')
    const organizationId = filters.organizationId

    if (filters.categoryId) {
      const [category] = await this.db
        .select({ id: taskCategories.id })
        .from(taskCategories)
        .where(and(
          eq(taskCategories.id, filters.categoryId),
          eq(taskCategories.organizationId, organizationId)
        ))
        .limit(1)
      if (!category) return []
    }

    if (filters.assigneeId) {
      const assignee = await this.findEligibleUser(filters.assigneeId, organizationId)
      if (!assignee) return []
    }

    // Build conditions
    const conditions = [eq(tasks.organizationId, organizationId)]

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

    const query = this.db
      .select()
      .from(tasks)
      .where(
        conditions.length === 1 ? conditions[0]! : and(...conditions as never[])
      )

    const taskRows = await query.orderBy(desc(tasks.createdAt))

    this.logDataAccess('findManyWithRelations', organizationId, { count: taskRows.length })

    // Load relations for each task
    const results: TaskWithRelations[] = []

    for (const row of taskRows) {
      results.push(await this.projectTaskWithRelations(row, false))
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
    const organizationId = await this.findTaskOrganizationForProjection(taskId)
    if (!organizationId) return []
    return this.getCommentsForOrganization(taskId, organizationId)
  }

  private async getCommentsForOrganization(
    taskId: string,
    organizationId: string
  ): Promise<TaskComment[]> {
    const rows = await this.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt))

    const results: TaskComment[] = []

    for (const row of rows) {
      const comment = this.mapCommentRowToEntity(row)
      if (row.userId) {
        const user = await this.findEligibleUser(row.userId, organizationId)
        if (user) {
          comment.user = this.mapEligibleUserToEntity(user, organizationId)
        } else if (!(await this.hasTenantMembership(row.userId, organizationId))) {
          continue
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
    const organizationId = await this.findTaskOrganizationForProjection(taskId)
    if (!organizationId) return []
    return this.getAttachmentsForOrganization(taskId, organizationId)
  }

  private async getAttachmentsForOrganization(
    taskId: string,
    organizationId: string
  ): Promise<TaskAttachment[]> {
    const rows = await this.db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.uploadedAt))

    const results: TaskAttachment[] = []

    for (const row of rows) {
      const attachment = this.mapAttachmentRowToEntity(row)

      if (row.uploadedBy) {
        const uploader = await this.findEligibleUser(row.uploadedBy, organizationId)
        if (uploader) {
          attachment.uploader = this.mapEligibleUserToEntity(uploader, organizationId)
        } else if (!(await this.hasTenantMembership(row.uploadedBy, organizationId))) {
          continue
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
  async deleteAttachment(
    attachmentId: string,
    taskId?: string,
    organizationId?: string
  ): Promise<{ filePath: string | null }> {
    if (!taskId || !organizationId) {
      return { filePath: null }
    }

    const rows = await this.db
      .select({ filePath: taskAttachments.filePath })
      .from(taskAttachments)
      .innerJoin(tasks, and(
        eq(tasks.id, taskAttachments.taskId),
        eq(tasks.organizationId, organizationId)
      ))
      .where(and(
        eq(taskAttachments.id, attachmentId),
        eq(taskAttachments.taskId, taskId)
      ))

    const filePath = rows.length > 0 ? rows[0].filePath : null
    if (!filePath || !isTaskAttachmentStoragePath(filePath, organizationId, taskId)) {
      return { filePath: null }
    }

    await this.db
      .delete(taskAttachments)
      .where(and(
        eq(taskAttachments.id, attachmentId),
        eq(taskAttachments.taskId, taskId)
      ))

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

  async setTaskTagsForTenant(
    taskId: string,
    organizationId: string,
    tagIds: string[],
    audit: TaskLifecycleAuditContext
  ): Promise<void> {
    this.requireOrganizationId(organizationId, 'setTaskTagsForTenant')
    const normalizedTagIds = Array.from(new Set(tagIds.map(tagId => tagId.trim()).filter(Boolean)))
    if (normalizedTagIds.length > 50) {
      throw new TaskTenantInvariantError(400, 'A task can have at most 50 tags')
    }

    await this.withTenantTransaction(async tx => {
      await this.assertActiveMembership(tx, audit.userId, organizationId)
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1)
      if (!task) {
        throw new TaskTenantInvariantError(404, 'Task not found')
      }

      if (normalizedTagIds.length > 0) {
        const matchingTags = await tx
          .select({ id: taskTags.id })
          .from(taskTags)
          .where(and(
            inArray(taskTags.id, normalizedTagIds),
            eq(taskTags.organizationId, organizationId)
          ))
        if (matchingTags.length !== normalizedTagIds.length) {
          throw new TaskTenantInvariantError(404, 'Tag not found')
        }
      }

      await tx.delete(taskTagRelations).where(eq(taskTagRelations.taskId, taskId))
      if (normalizedTagIds.length > 0) {
        await tx.insert(taskTagRelations).values(normalizedTagIds.map((tagId, displayOrder) => ({
          taskId,
          tagId,
          displayOrder,
        })))
      }
      await this.insertTaskAudit(
        tx,
        organizationId,
        taskId,
        audit,
        'task.tags.updated',
        { tagIds: normalizedTagIds }
      )
    })
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
    const organizationId = await this.findTaskOrganizationForProjection(taskId)
    if (!organizationId) return []

    const rows = await this.db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .orderBy(desc(taskHistory.createdAt))

    const results: TaskHistory[] = []

    for (const row of rows) {
      const entry = this.mapHistoryRowToEntity(row)
      if (row.userId) {
        const user = await this.findEligibleUser(row.userId, organizationId)
        if (user) {
          entry.user = this.mapEligibleUserToEntity(user, organizationId)
        } else if (!(await this.hasTenantMembership(row.userId, organizationId))) {
          continue
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

  private async findTaskOrganizationForProjection(taskId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ organizationId: tasks.organizationId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    return row?.organizationId ?? null
  }

  private async findEligibleUser(
    userId: string,
    organizationId: string,
    db: DrizzleDb = this.db
  ): Promise<EligibleUser | null> {
    const [user] = await db
      .select({
        profile: {
          id: userProfiles.id,
          organizationId: userProfiles.organizationId,
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          role: userProfiles.role,
          isActive: userProfiles.isActive,
        },
        membershipRole: userMemberships.role,
      })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1)

    return user ?? null
  }

  private async hasTenantMembership(
    userId: string,
    organizationId: string,
    db: DrizzleDb = this.db
  ): Promise<boolean> {
    const [membership] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId)
      ))
      .limit(1)
    return Boolean(membership)
  }

  private async projectTaskCore(row: TaskRow, db: DrizzleDb = this.db) {
    const organizationId = row.organizationId ?? ''
    if (!organizationId) {
      const task = this.mapTaskRowToEntity(row)
      task.category_id = null
      task.assignee_id = null
      task.reporter_id = null
      task.parent_task_id = null
      task.related_document_id = null
      task.related_risk_id = null
      return { task, category: null, assignee: null, reporter: null }
    }

    const [categoryRows, assignee, reporter, parentRows, documentRows, riskRows] = await Promise.all([
      row.categoryId
        ? db.select().from(taskCategories).where(and(
            eq(taskCategories.id, row.categoryId),
            eq(taskCategories.organizationId, organizationId)
          )).limit(1)
        : Promise.resolve([]),
      row.assigneeId ? this.findEligibleUser(row.assigneeId, organizationId, db) : Promise.resolve(null),
      row.reporterId ? this.findEligibleUser(row.reporterId, organizationId, db) : Promise.resolve(null),
      row.parentTaskId
        ? db.select({ id: tasks.id }).from(tasks).where(and(
            eq(tasks.id, row.parentTaskId),
            eq(tasks.organizationId, organizationId)
          )).limit(1)
        : Promise.resolve([]),
      row.relatedDocumentId
        ? db.select({ id: documents.id }).from(documents).where(and(
            eq(documents.id, row.relatedDocumentId),
            eq(documents.organizationId, organizationId)
          )).limit(1)
        : Promise.resolve([]),
      row.relatedRiskId
        ? db.select({ id: risks.id }).from(risks).where(and(
            eq(risks.id, row.relatedRiskId),
            eq(risks.organizationId, organizationId)
          )).limit(1)
        : Promise.resolve([]),
    ])

    const task = this.mapTaskRowToEntity(row)
    task.category_id = categoryRows[0]?.id ?? null
    task.assignee_id = assignee?.profile.id ?? null
    task.reporter_id = reporter?.profile.id ?? null
    task.parent_task_id = parentRows[0]?.id ?? null
    task.related_document_id = documentRows[0]?.id ?? null
    task.related_risk_id = riskRows[0]?.id ?? null

    return {
      task,
      category: categoryRows[0] ? this.mapCategoryRowToEntity(categoryRows[0]) : null,
      assignee: assignee ? this.mapEligibleUserToEntity(assignee, organizationId) : null,
      reporter: reporter ? this.mapEligibleUserToEntity(reporter, organizationId) : null,
    }
  }

  private async getTaskTagsForOrganization(
    taskId: string,
    organizationId: string
  ): Promise<TaskTag[]> {
    const rows = await this.db
      .select({
        tag: taskTags,
        displayOrder: taskTagRelations.displayOrder,
      })
      .from(taskTagRelations)
      .innerJoin(taskTags, and(
        eq(taskTags.id, taskTagRelations.tagId),
        eq(taskTags.organizationId, organizationId)
      ))
      .where(eq(taskTagRelations.taskId, taskId))
      .orderBy(asc(taskTagRelations.displayOrder))

    return rows.map(row => ({
      ...this.mapTagRowToEntity(row.tag),
      display_order: row.displayOrder,
    }))
  }

  private async projectTaskWithRelations(
    row: TaskRow,
    includeDetailRelations: boolean
  ): Promise<TaskWithRelations> {
    const organizationId = row.organizationId ?? ''
    if (!organizationId) {
      const { task, category, assignee, reporter } = await this.projectTaskCore(row)
      return {
        ...task,
        category,
        assignee,
        reporter,
        comments: [],
        tags: [],
        ...(includeDetailRelations ? { attachments: [], subtasks: [] } : {}),
      }
    }

    const [{ task, category, assignee, reporter }, tags, comments] = await Promise.all([
      this.projectTaskCore(row),
      this.getTaskTagsForOrganization(row.id, organizationId),
      this.getCommentsForOrganization(row.id, organizationId),
    ])

    if (!includeDetailRelations) {
      return {
        ...task,
        category,
        assignee,
        reporter,
        tags,
        comments: comments.slice(0, 5),
      }
    }

    const [attachments, subtaskRows] = await Promise.all([
      this.getAttachmentsForOrganization(row.id, organizationId),
      this.db
        .select()
        .from(tasks)
        .where(and(
          eq(tasks.parentTaskId, row.id),
          eq(tasks.organizationId, organizationId)
        ))
        .orderBy(asc(tasks.createdAt)),
    ])
    const subtasks = await Promise.all(subtaskRows.map(async subtask => (
      await this.projectTaskCore(subtask)
    ).task))

    return {
      ...task,
      category,
      assignee,
      reporter,
      comments,
      attachments,
      tags,
      subtasks,
    }
  }

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

  private mapEligibleUserToEntity(user: EligibleUser, organizationId: string) {
    return {
      id: user.profile.id,
      organization_id: organizationId,
      email: user.profile.email,
      full_name: user.profile.fullName,
      full_name_en: null,
      role: user.membershipRole as 'super_admin' | 'system_operator' | 'org_admin' | 'user' | 'auditor' | 'approver',
      department: null,
      position: null,
      phone: null,
      is_active: user.profile.isActive,
      avatar_url: null,
      language_preference: null,
      primary_department_id: null,
      created_at: null,
      updated_at: null,
      last_login_at: null,
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
