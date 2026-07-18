import { and, eq } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  documents,
  risks,
  taskCategories,
  taskTags,
  tasks,
  userMemberships,
} from '@/lib/db/drizzle/schema'
import type {
  TaskCreateInput,
  TaskPriority,
  TaskStatus,
  TaskUpdateInput,
} from '@/lib/db/repositories/interfaces/ITaskRepository'

type TaskDb = ReturnType<typeof getDb>
type TaskReadDb = Pick<TaskDb, 'select'>

export class TaskTenantInvariantError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'TaskTenantInvariantError'
  }
}

export function isTaskTenantInvariantError(error: unknown): error is TaskTenantInvariantError {
  return error instanceof TaskTenantInvariantError
}

export type TaskImportRowErrorCode =
  | 'invalid_input'
  | 'ambiguous_task'
  | 'unresolved_category'
  | 'ambiguous_category'
  | 'unresolved_assignee'
  | 'ambiguous_assignee'
  | 'unresolved_tag'
  | 'ambiguous_tag'
  | 'reference_changed'

export class TaskImportRowError extends Error {
  constructor(
    public readonly code: TaskImportRowErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TaskImportRowError'
  }
}

export function isTaskImportRowError(error: unknown): error is TaskImportRowError {
  return error instanceof TaskImportRowError
}

function badRequest(message: string): never {
  throw new TaskTenantInvariantError(400, message)
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim() === '') {
    badRequest(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function optionalString(body: Record<string, unknown>, field: string): string | null | undefined {
  if (!(field in body)) return undefined
  const value = body[field]
  if (value === null) return null
  if (typeof value !== 'string') badRequest(`${field} must be a string or null`)
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

function optionalNumber(body: Record<string, unknown>, field: string): number | null | undefined {
  if (!(field in body)) return undefined
  const value = body[field]
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    badRequest(`${field} must be a finite number or null`)
  }
  return value
}

const taskStatuses: readonly TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled']
const taskPriorities: readonly TaskPriority[] = ['low', 'medium', 'high', 'urgent']

function optionalStatus(body: Record<string, unknown>): TaskStatus | undefined {
  if (!('status' in body)) return undefined
  const value = body.status
  if (typeof value !== 'string' || !taskStatuses.includes(value as TaskStatus)) {
    badRequest('status is invalid')
  }
  return value as TaskStatus
}

function optionalPriority(body: Record<string, unknown>): TaskPriority | undefined {
  if (!('priority' in body)) return undefined
  const value = body.priority
  if (typeof value !== 'string' || !taskPriorities.includes(value as TaskPriority)) {
    badRequest('priority is invalid')
  }
  return value as TaskPriority
}

function optionalProgress(body: Record<string, unknown>): number | undefined {
  if (!('progress' in body)) return undefined
  const value = body.progress
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    badRequest('progress must be a finite number between 0 and 100')
  }
  return Math.round(value)
}

function assertDepartmentNotPersisted(body: Record<string, unknown>): void {
  if ('department_id' in body && body.department_id !== null && body.department_id !== undefined) {
    badRequest('department_id is not supported for tasks')
  }
}

const createFields = new Set([
  'organization_id',
  'title',
  'description',
  'category_id',
  'assignee_id',
  'reporter_id',
  'department_id',
  'status',
  'priority',
  'due_date',
  'estimated_hours',
  'actual_hours',
  'progress',
  'parent_task_id',
  'related_document_id',
  'related_risk_id',
])

const updateFields = new Set([
  ...createFields,
  'completed_at',
])

function assertKnownFields(body: Record<string, unknown>, allowedFields: Set<string>): void {
  const unknownField = Object.keys(body).find(field => !allowedFields.has(field))
  if (unknownField) badRequest(`Unknown task field: ${unknownField}`)
}

export function normalizeTaskCreateInput(
  body: Record<string, unknown>,
  organizationId: string,
  sessionUserId: string
): TaskCreateInput {
  assertKnownFields(body, createFields)
  assertDepartmentNotPersisted(body)
  return {
    organization_id: organizationId,
    title: requiredString(body, 'title'),
    description: optionalString(body, 'description'),
    category_id: optionalString(body, 'category_id'),
    assignee_id: optionalString(body, 'assignee_id'),
    reporter_id: sessionUserId,
    status: optionalStatus(body) ?? 'todo',
    priority: optionalPriority(body) ?? 'medium',
    due_date: optionalString(body, 'due_date'),
    estimated_hours: optionalNumber(body, 'estimated_hours'),
    actual_hours: optionalNumber(body, 'actual_hours'),
    progress: optionalProgress(body) ?? 0,
    parent_task_id: optionalString(body, 'parent_task_id'),
    related_document_id: optionalString(body, 'related_document_id'),
    related_risk_id: optionalString(body, 'related_risk_id'),
  }
}

export function normalizeTaskUpdateInput(body: Record<string, unknown>): TaskUpdateInput {
  if ('completed_at' in body) badRequest('completed_at is managed by the server')
  assertKnownFields(body, updateFields)
  if ('organization_id' in body) badRequest('organization_id cannot be changed')
  if ('reporter_id' in body) badRequest('reporter_id cannot be changed')
  assertDepartmentNotPersisted(body)

  const updates: TaskUpdateInput = {}
  if ('title' in body) updates.title = requiredString(body, 'title')
  const stringFields = [
    'description',
    'category_id',
    'assignee_id',
    'due_date',
    'parent_task_id',
    'related_document_id',
    'related_risk_id',
  ] as const
  for (const field of stringFields) {
    const value = optionalString(body, field)
    if (value !== undefined) updates[field] = value
  }
  for (const field of ['estimated_hours', 'actual_hours'] as const) {
    const value = optionalNumber(body, field)
    if (value !== undefined) updates[field] = value
  }
  const status = optionalStatus(body)
  if (status !== undefined) updates.status = status
  const priority = optionalPriority(body)
  if (priority !== undefined) updates.priority = priority
  const progress = optionalProgress(body)
  if (progress !== undefined) updates.progress = progress
  return updates
}

interface RelatedTaskIds {
  category_id?: string | null
  assignee_id?: string | null
  parent_task_id?: string | null
  related_document_id?: string | null
  related_risk_id?: string | null
}

async function exists(query: PromiseLike<unknown[]>): Promise<boolean> {
  return (await query).length > 0
}

export async function assertTaskRelationsBelongToOrganization(
  db: TaskReadDb,
  organizationId: string,
  input: RelatedTaskIds
): Promise<void> {
  const checks: Promise<boolean>[] = []
  if (input.category_id) {
    checks.push(exists(db.select({ id: taskCategories.id }).from(taskCategories).where(and(
      eq(taskCategories.id, input.category_id),
      eq(taskCategories.organizationId, organizationId)
    )).limit(1)))
  }
  if (input.assignee_id) {
    checks.push(exists(db.select({ id: userMemberships.id }).from(userMemberships).where(and(
      eq(userMemberships.userId, input.assignee_id),
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active')
    )).limit(1)))
  }
  if (input.parent_task_id) {
    checks.push(exists(db.select({ id: tasks.id }).from(tasks).where(and(
      eq(tasks.id, input.parent_task_id),
      eq(tasks.organizationId, organizationId)
    )).limit(1)))
  }
  if (input.related_document_id) {
    checks.push(exists(db.select({ id: documents.id }).from(documents).where(and(
      eq(documents.id, input.related_document_id),
      eq(documents.organizationId, organizationId)
    )).limit(1)))
  }
  if (input.related_risk_id) {
    checks.push(exists(db.select({ id: risks.id }).from(risks).where(and(
      eq(risks.id, input.related_risk_id),
      eq(risks.organizationId, organizationId)
    )).limit(1)))
  }

  const results = await Promise.all(checks)
  if (results.some(result => !result)) {
    throw new TaskTenantInvariantError(404, 'Related resource not found')
  }
}

export async function assertTaskImportReferencesBelongToOrganization(
  db: TaskReadDb,
  organizationId: string,
  references: {
    categoryId?: string | null
    assigneeId?: string | null
    tagIds?: string[]
  }
): Promise<void> {
  const checks: Promise<boolean>[] = []
  if (references.categoryId) {
    checks.push(exists(db.select({ id: taskCategories.id }).from(taskCategories).where(and(
      eq(taskCategories.id, references.categoryId),
      eq(taskCategories.organizationId, organizationId)
    )).limit(1)))
  }
  if (references.assigneeId) {
    checks.push(exists(db.select({ id: userMemberships.id }).from(userMemberships).where(and(
      eq(userMemberships.userId, references.assigneeId),
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active')
    )).limit(1)))
  }
  for (const tagId of new Set(references.tagIds ?? [])) {
    checks.push(exists(db.select({ id: taskTags.id }).from(taskTags).where(and(
      eq(taskTags.id, tagId),
      eq(taskTags.organizationId, organizationId)
    )).limit(1)))
  }

  const results = await Promise.all(checks)
  if (results.some(result => !result)) {
    throw new TaskImportRowError(
      'reference_changed',
      'A referenced category, assignee, or tag is no longer available'
    )
  }
}

export async function assertTaskParentDoesNotCycle(
  db: TaskReadDb,
  organizationId: string,
  taskId: string,
  parentTaskId: string | null | undefined
): Promise<void> {
  if (!parentTaskId) return
  const visited = new Set<string>()
  let cursor: string | null = parentTaskId

  while (cursor) {
    if (cursor === taskId || visited.has(cursor)) {
      throw new TaskTenantInvariantError(409, 'Task parent would create a cycle')
    }
    visited.add(cursor)
    const [row] = await db
      .select({ parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(and(eq(tasks.id, cursor), eq(tasks.organizationId, organizationId)))
      .limit(1)
    if (!row) throw new TaskTenantInvariantError(404, 'Related resource not found')
    cursor = row.parentTaskId
  }
}

export async function assertTaskParentChainIsAcyclic(
  db: TaskReadDb,
  organizationId: string,
  parentTaskId: string | null | undefined
): Promise<void> {
  if (!parentTaskId) return
  const visited = new Set<string>()
  let cursor: string | null = parentTaskId

  while (cursor) {
    if (visited.has(cursor)) {
      throw new TaskTenantInvariantError(409, 'Task parent chain contains a cycle')
    }
    visited.add(cursor)
    const [row] = await db
      .select({ parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(and(eq(tasks.id, cursor), eq(tasks.organizationId, organizationId)))
      .limit(1)
    if (!row) throw new TaskTenantInvariantError(404, 'Related resource not found')
    cursor = row.parentTaskId
  }
}
