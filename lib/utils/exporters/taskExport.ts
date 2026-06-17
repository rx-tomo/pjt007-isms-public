export function escapeTaskCsvField(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function sanitizeTaskFileName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tasks-export'
  )
}

type TaskExportUser = {
  full_name?: string | null
  email?: string | null
}

type TaskExportComment = {
  comment?: string | null
}

export type TaskExportRecord = {
  id: string
  title: string
  status: string
  priority: string
  due_date?: string | null
  description?: string | null
  assignee?: TaskExportUser | null
  reporter?: TaskExportUser | null
  comments?: TaskExportComment[] | null
}

const COMPLETION_KEYWORDS = ['完了条件', 'completion criteria', 'definition of done', 'acceptance criteria']

const stripCompletionPrefix = (value: string) =>
  value.replace(/^(?:完了条件|Completion criteria|Definition of done|Acceptance criteria)\s*[:：-]?\s*/i, '')

const normalizeSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim()

const truncateText = (value: string, limit = 140) =>
  value.length > limit ? `${value.slice(0, limit)}...` : value

export function getTaskExportUserName(user?: TaskExportUser | null) {
  return user?.full_name?.trim() || user?.email?.trim() || '-'
}

export function deriveTaskCompletionCriteria(task: TaskExportRecord, fallback = '-') {
  const target = task.comments?.find(comment => {
    const normalized = comment.comment?.toLowerCase() ?? ''
    return COMPLETION_KEYWORDS.some(keyword => normalized.includes(keyword.toLowerCase()))
  })

  if (target?.comment) {
    const stripped = normalizeSingleLine(stripCompletionPrefix(target.comment))
    return stripped ? truncateText(stripped) : truncateText(normalizeSingleLine(target.comment))
  }

  if (task.description) {
    return truncateText(normalizeSingleLine(task.description))
  }

  return fallback
}

export function buildTaskCsv(records: TaskExportRecord[], options?: { bom?: boolean; completionFallback?: string }) {
  const header = ['id', 'title', 'status', 'priority', 'assignee', 'owner', 'completion_criteria', 'due_date']
  const rows = records.map(task => [
    task.id,
    task.title,
    task.status,
    task.priority,
    getTaskExportUserName(task.assignee),
    getTaskExportUserName(task.reporter),
    deriveTaskCompletionCriteria(task, options?.completionFallback ?? '-'),
    task.due_date ?? ''
  ])

  const csv = [header, ...rows]
    .map(columns => columns.map(column => escapeTaskCsvField(String(column))).join(','))
    .join('\n')

  return options?.bom ? `\uFEFF${csv}\n` : `${csv}\n`
}
