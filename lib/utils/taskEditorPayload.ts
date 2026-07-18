export type TaskEditorPayloadMode = 'create' | 'edit'

export interface TaskEditorPayloadValues {
  title: string
  description: string
  categoryId: string
  assigneeId: string
  status: string
  priority: string
  dueDate: string
  estimatedHours: string
  progress: number
  relatedDocumentId: string
  relatedRiskId: string
}

export interface TaskEditorCreatePayload {
  title: string
  description?: string | null
  category_id?: string | null
  assignee_id?: string | null
  status: string
  priority: string
  due_date?: string | null
  estimated_hours?: number | null
  progress: number
  related_document_id?: string | null
  related_risk_id?: string | null
}

export type TaskEditorUpdatePayload = Partial<TaskEditorCreatePayload>

function normalizeTaskEditorValues(
  mode: TaskEditorPayloadMode,
  values: TaskEditorPayloadValues,
): TaskEditorCreatePayload {
  const emptyValue = mode === 'edit' ? null : undefined
  const description = values.description.trim() ? values.description : emptyValue
  const categoryId = values.categoryId.trim() ? values.categoryId : emptyValue
  const assigneeId = values.assigneeId.trim() ? values.assigneeId : emptyValue
  const dueDate = values.dueDate.trim() ? values.dueDate : emptyValue
  const estimatedHours = values.estimatedHours.trim()
    ? Number.parseFloat(values.estimatedHours)
    : emptyValue
  const relatedDocumentId = values.relatedDocumentId.trim()
    ? values.relatedDocumentId
    : emptyValue
  const relatedRiskId = values.relatedRiskId.trim()
    ? values.relatedRiskId
    : emptyValue

  return {
    title: values.title,
    ...(description !== undefined ? { description } : {}),
    ...(categoryId !== undefined ? { category_id: categoryId } : {}),
    ...(assigneeId !== undefined ? { assignee_id: assigneeId } : {}),
    status: values.status,
    priority: values.priority,
    ...(dueDate !== undefined ? { due_date: dueDate } : {}),
    ...(estimatedHours !== undefined ? { estimated_hours: estimatedHours } : {}),
    progress: values.progress,
    ...(relatedDocumentId !== undefined
      ? { related_document_id: relatedDocumentId }
      : {}),
    ...(relatedRiskId !== undefined ? { related_risk_id: relatedRiskId } : {}),
  }
}

export function buildTaskEditorPayload(
  mode: 'create',
  values: TaskEditorPayloadValues,
): TaskEditorCreatePayload
export function buildTaskEditorPayload(
  mode: 'edit',
  values: TaskEditorPayloadValues,
  initialValues: TaskEditorPayloadValues,
): TaskEditorUpdatePayload
export function buildTaskEditorPayload(
  mode: TaskEditorPayloadMode,
  values: TaskEditorPayloadValues,
  initialValues?: TaskEditorPayloadValues,
): TaskEditorCreatePayload | TaskEditorUpdatePayload {
  const payload = normalizeTaskEditorValues(mode, values)
  if (mode === 'create') return payload
  if (!initialValues) {
    throw new Error('initialValues are required when building an edit payload')
  }

  const initialPayload = normalizeTaskEditorValues('edit', initialValues)
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => (
      !Object.is(value, initialPayload[key as keyof TaskEditorCreatePayload])
    )),
  ) as TaskEditorUpdatePayload
}
