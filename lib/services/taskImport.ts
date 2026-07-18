import type {
  ITaskRepository,
  TaskImportMutationInput,
  TaskImportMutationResult,
  TaskPriority,
  TaskStatus,
} from '@/lib/db/repositories/interfaces/ITaskRepository'
import { splitList } from '@/lib/utils/importers/csv'
import { TaskImportRowError } from '@/lib/services/taskTenantInvariant'

export { TaskImportRowError, isTaskImportRowError } from '@/lib/services/taskTenantInvariant'

export const TASK_IMPORT_DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const TASK_IMPORT_MULTIPART_OVERHEAD_BYTES = 1024 * 1024
export const TASK_IMPORT_MAX_ROWS = 5000
export const TASK_IMPORT_MAX_COLUMNS = 64
export const TASK_IMPORT_MAX_TOTAL_CELLS = (
  TASK_IMPORT_MAX_ROWS + 1
) * TASK_IMPORT_MAX_COLUMNS
export const TASK_IMPORT_MAX_CELL_LENGTH = 50000
export const TASK_IMPORT_MAX_TAGS = 50

const VALID_STATUSES = new Set<TaskStatus>([
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
])
const VALID_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])

export interface TaskImportRowRequest {
  organizationId: string
  reporterId: string
  row: Record<string, string | undefined>
}

function hasColumn(row: Record<string, string | undefined>, column: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, column)
}

function invalidInput(message: string): never {
  throw new TaskImportRowError('invalid_input', message)
}

function parseDate(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) invalidInput('due_date must use YYYY-MM-DD format')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) {
    invalidInput('due_date is invalid')
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > lastDay) invalidInput('due_date is invalid')
  return value
}

function parseEstimatedHours(raw: string): number | null {
  const value = raw.trim()
  if (value === '') return null
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0) {
    invalidInput('estimated_hours must be a positive number')
  }
  return hours
}

function parseTagNames(raw: string): string[] {
  const uniqueNames = new Map<string, string>()
  for (const name of splitList(raw)) {
    const normalized = name.toLowerCase()
    if (!uniqueNames.has(normalized)) uniqueNames.set(normalized, name)
  }
  if (uniqueNames.size > TASK_IMPORT_MAX_TAGS) {
    invalidInput(`tags must contain at most ${TASK_IMPORT_MAX_TAGS} unique values`)
  }
  return [...uniqueNames.values()]
}

export function getTaskImportMaxFileSizeBytes(
  rawValue = process.env.TASK_IMPORT_MAX_FILE_SIZE_BYTES
): number {
  if (!rawValue || !/^\d+$/.test(rawValue)) return TASK_IMPORT_DEFAULT_MAX_FILE_SIZE_BYTES
  const parsed = Number(rawValue)
  if (
    !Number.isSafeInteger(parsed)
    || parsed <= 0
    || parsed > TASK_IMPORT_DEFAULT_MAX_FILE_SIZE_BYTES
  ) {
    return TASK_IMPORT_DEFAULT_MAX_FILE_SIZE_BYTES
  }
  return parsed
}

export function getTaskImportMaxRequestSizeBytes(
  rawValue = process.env.TASK_IMPORT_MAX_FILE_SIZE_BYTES
): number {
  return getTaskImportMaxFileSizeBytes(rawValue) + TASK_IMPORT_MULTIPART_OVERHEAD_BYTES
}

export function parseTaskImportMutation(
  request: TaskImportRowRequest
): TaskImportMutationInput {
  const { organizationId, reporterId, row } = request
  const title = (row.title ?? '').trim()
  if (!title) invalidInput('title is required')
  if (title.length > 200) invalidInput('title must be 200 characters or fewer')

  if (hasColumn(row, 'department_id') && (row.department_id ?? '').trim() !== '') {
    invalidInput('department_id is not supported for task import')
  }

  const input: TaskImportMutationInput = {
    organizationId,
    reporterId,
    title,
  }

  if (hasColumn(row, 'description')) {
    input.description = (row.description ?? '').trim() || null
  }
  if (hasColumn(row, 'category')) {
    input.categoryName = (row.category ?? '').trim() || null
  }
  if (hasColumn(row, 'assignee_email')) {
    input.assigneeEmail = (row.assignee_email ?? '').trim() || null
  }
  if (hasColumn(row, 'status')) {
    const status = (row.status ?? '').trim().toLowerCase() as TaskStatus
    if (!VALID_STATUSES.has(status)) invalidInput('status is invalid')
    input.status = status
  }
  if (hasColumn(row, 'priority')) {
    const priority = (row.priority ?? '').trim().toLowerCase() as TaskPriority
    if (!VALID_PRIORITIES.has(priority)) invalidInput('priority is invalid')
    input.priority = priority
  }
  if (hasColumn(row, 'due_date')) {
    input.dueDate = parseDate(row.due_date ?? '')
  }
  if (hasColumn(row, 'estimated_hours')) {
    input.estimatedHours = parseEstimatedHours(row.estimated_hours ?? '')
  }
  if (hasColumn(row, 'tags')) {
    input.tagNames = parseTagNames(row.tags ?? '')
  }

  return input
}

export class TaskImportService {
  constructor(private readonly repository: ITaskRepository) {}

  async importRow(request: TaskImportRowRequest): Promise<TaskImportMutationResult> {
    return this.repository.importTaskRow(parseTaskImportMutation(request))
  }
}
