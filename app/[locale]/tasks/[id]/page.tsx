'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TaskService } from '@/lib/services/task'
import { UserService } from '@/lib/services/user'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type {
  Task,
  TaskAttachment,
  TaskComment,
  TaskHistory,
  TaskPriority,
  TaskStatus,
  TaskTag,
  TaskWithRelations
} from '@/lib/services/task'
import type { UserRole } from '@/lib/services/user'
import { canEditTask } from '@/lib/constants/taskPermissions'
import { useAuth } from '@/lib/hooks/useAuth'

export default function TaskDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>
  }
) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('tasks')
  const router = useRouter()
  const { user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'attachments' | 'history'>('overview')
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [availableTags, setAvailableTags] = useState<TaskTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagEditorLoading, setTagEditorLoading] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [creatingTag, setCreatingTag] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [creatingSubtask, setCreatingSubtask] = useState(false)
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null)
  const [deletingSubtaskId, setDeletingSubtaskId] = useState<string | null>(null)
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [subtaskDraftTitles, setSubtaskDraftTitles] = useState<Record<string, string>>({})

  const taskService = useMemo(() => new TaskService(), [])
  const userService = useMemo(() => new UserService(), [])

  const loadTaskDetails = useCallback(async () => {
    setLoading(true)
    try {
      // Load task details
      const taskData = await taskService.getTaskById(id)
      if (!taskData) {
        throw new Error('Task not found')
      }
      setTask(taskData)

      // Check user role
      if (authUser) {
        const profile = await userService.getUserProfile()
        if (profile) {
          setUserRole(profile.role as UserRole)
        }
      }
    } catch (err) {
      console.error('Error loading task details:', err)
    } finally {
      setLoading(false)
    }
  }, [authUser, id, taskService, userService])

  useEffect(() => {
    loadTaskDetails()
  }, [loadTaskDetails])

  useEffect(() => {
    if (task?.tags && !editingTags) {
      setSelectedTagIds(task.tags.map(tag => tag.id))
    }
  }, [task?.tags, editingTags])

  const getStatusColor = (status: TaskStatus) => {
    const colors: Record<TaskStatus, string> = {
      todo: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      review: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status]
  }

  const getPriorityColor = (priority: TaskPriority) => {
    const colors: Record<TaskPriority, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    }
    return colors[priority]
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task || !newComment.trim()) return

    setSubmittingComment(true)
    try {
      if (!authUser) {
        throw new Error('User not authenticated')
      }

      await taskService.addComment(task.id, newComment, authUser.id)
      setNewComment('')
      await loadTaskDetails()
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleStartEditComment = (comment: TaskComment) => {
    setEditingCommentId(comment.id)
    setCommentDrafts(prev => ({ ...prev, [comment.id]: comment.comment }))
  }

  const handleCancelEditComment = (commentId: string) => {
    setEditingCommentId(null)
    setCommentDrafts(prev => {
      const next = { ...prev }
      delete next[commentId]
      return next
    })
  }

  const handleSaveComment = async (commentId: string) => {
    if (!task) return
    const draft = commentDrafts[commentId]?.trim()
    if (!draft) return

    setSavingCommentId(commentId)
    try {
      await taskService.updateComment(task.id, commentId, draft)
      handleCancelEditComment(commentId)
      await loadTaskDetails()
    } catch (err) {
      console.error('Error updating comment:', err)
      alert('コメントの更新に失敗しました')
    } finally {
      setSavingCommentId(null)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!task) return
    if (!confirm('このコメントを削除してもよろしいですか？')) return

    setDeletingCommentId(commentId)
    try {
      await taskService.deleteComment(task.id, commentId)
      handleCancelEditComment(commentId)
      await loadTaskDetails()
    } catch (err) {
      console.error('Error deleting comment:', err)
      alert('コメントの削除に失敗しました')
    } finally {
      setDeletingCommentId(null)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !task) return

    setUploadingFile(true)
    try {
      if (!authUser) {
        throw new Error('User not authenticated')
      }

      await taskService.uploadAttachment(task.id, file, authUser.id)
      await loadTaskDetails()
    } catch (err) {
      console.error('Error uploading file:', err)
      const message = err instanceof Error ? err.message : t('errors.uploadFailed')
      alert(message)
    } finally {
      setUploadingFile(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!task) return
    if (!confirm(t('confirmDeleteAttachment'))) return

    try {
      await taskService.deleteAttachment(attachmentId, task.id)
      await loadTaskDetails()
    } catch (err) {
      console.error('Error deleting attachment:', err)
    }
  }

  const openTagEditor = useCallback(async () => {
    if (!task) return
    setTagEditorLoading(true)
    try {
      const tags = await taskService.getTaskTags(task.organization_id)
      setAvailableTags(tags)
      setSelectedTagIds(task.tags?.map(tag => tag.id) ?? [])
      setEditingTags(true)
    } catch (err) {
      console.error('Error loading tags:', err)
      alert(t('errors.loadTags'))
    } finally {
      setTagEditorLoading(false)
    }
  }, [task, taskService, t])

  const handleAddTagToSelection = (tagId: string) => {
    setSelectedTagIds(prev => (prev.includes(tagId) ? prev : [...prev, tagId]))
  }

  const handleRemoveTagFromSelection = (tagId: string) => {
    setSelectedTagIds(prev => prev.filter(id => id !== tagId))
  }

  const handleMoveTag = (index: number, direction: 'up' | 'down') => {
    setSelectedTagIds(prev => {
      const next = [...prev]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= next.length) {
        return prev
      }
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }

  const handleSaveTags = async () => {
    if (!task) return
    setSavingTags(true)
    try {
      await taskService.setTaskTags(task.id, selectedTagIds)
      await loadTaskDetails()
      setEditingTags(false)
    } catch (err) {
      console.error('Error saving tags:', err)
      alert(t('errors.saveTags'))
    } finally {
      setSavingTags(false)
    }
  }

  const handleCancelTagEditing = () => {
    setEditingTags(false)
    setNewTagName('')
    setNewTagColor('#3b82f6')
  }

  const handleCreateTag = async () => {
    if (!task) return
    const trimmedName = newTagName.trim()
    if (!trimmedName) return

    setCreatingTag(true)
    try {
      const created = await taskService.createTaskTag({
        organization_id: task.organization_id,
        name: trimmedName,
        color: newTagColor || undefined
      })
      setAvailableTags(prev => [...prev, created])
      setSelectedTagIds(prev => [...prev, created.id])
      setNewTagName('')
    } catch (err) {
      console.error('Error creating tag:', err)
      alert(t('errors.createTag'))
    } finally {
      setCreatingTag(false)
    }
  }

  const handleAddSubtask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!task) return
    const title = newSubtaskTitle.trim()
    if (!title) return

    setCreatingSubtask(true)
    try {
      await taskService.createSubtask({
        parentTaskId: task.id,
        organizationId: task.organization_id,
        title,
        assigneeId: task.assignee_id ?? undefined,
        dueDate: task.due_date ?? undefined,
        priority: task.priority
      })
      setNewSubtaskTitle('')
      await loadTaskDetails()
    } catch (err) {
      console.error('Error creating subtask:', err)
      alert(t('errors.createSubtask'))
    } finally {
      setCreatingSubtask(false)
    }
  }

  const handleToggleSubtask = async (subtask: Task) => {
    const newStatus: TaskStatus = subtask.status === 'done' ? 'todo' : 'done'
    setUpdatingSubtaskId(subtask.id)
    try {
      await taskService.updateSubtask(subtask.id, {
        status: newStatus,
        progress: newStatus === 'done' ? 100 : 0
      })
      await loadTaskDetails()
    } catch (err) {
      console.error('Error updating subtask status:', err)
      alert(t('errors.updateSubtask'))
    } finally {
      setUpdatingSubtaskId(null)
    }
  }

  const handleStartEditSubtask = (subtask: Task) => {
    setEditingSubtaskId(subtask.id)
    setSubtaskDraftTitles(prev => ({ ...prev, [subtask.id]: subtask.title }))
  }

  const handleCancelEditSubtask = (subtaskId: string) => {
    setEditingSubtaskId(null)
    setSubtaskDraftTitles(prev => {
      const next = { ...prev }
      delete next[subtaskId]
      return next
    })
  }

  const handleSaveSubtaskTitle = async (subtaskId: string) => {
    const draft = subtaskDraftTitles[subtaskId]?.trim()
    if (!draft) return
    setUpdatingSubtaskId(subtaskId)
    try {
      await taskService.updateSubtask(subtaskId, { title: draft })
      handleCancelEditSubtask(subtaskId)
      await loadTaskDetails()
    } catch (err) {
      console.error('Error updating subtask title:', err)
      alert(t('errors.updateSubtask'))
    } finally {
      setUpdatingSubtaskId(null)
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task) return
    if (!confirm(t('subtasks.confirmDelete'))) return
    setDeletingSubtaskId(subtaskId)
    try {
      await taskService.deleteSubtask(subtaskId)
      await loadTaskDetails()
      setSubtaskDraftTitles(prev => {
        const next = { ...prev }
        delete next[subtaskId]
        return next
      })
      if (editingSubtaskId === subtaskId) {
        setEditingSubtaskId(null)
      }
    } catch (err) {
      console.error('Error deleting subtask:', err)
      alert(t('errors.deleteSubtask'))
    } finally {
      setDeletingSubtaskId(null)
    }
  }

  const selectedTags = selectedTagIds
    .map(tagId => availableTags.find(tag => tag.id === tagId) ?? task?.tags?.find(tag => tag.id === tagId))
    .filter((tag): tag is TaskTag => Boolean(tag))

  const availableTagOptions = useMemo(
    () => availableTags.filter(tag => !selectedTagIds.includes(tag.id)),
    [availableTags, selectedTagIds]
  )

  const canEdit = canEditTask(userRole)

  if (loading) {
    return (
      <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-surface shadow-sm rounded-lg p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-surface-elevated rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-surface-elevated rounded w-1/2 mb-8"></div>
              <div className="space-y-4">
                <div className="h-20 bg-surface-elevated rounded"></div>
                <div className="h-32 bg-surface-elevated rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DashboardLayout>
    )
  }

  if (!task) {
    return (
      <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-6">
            <p className="text-red-700">{t('errors.notFound')}</p>
            <Link href={`/${locale}/tasks`} className="text-blue-600 hover:underline mt-2 inline-block">
              {t('list.backToList')}
            </Link>
          </div>
        </div>
      </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{task.title}</h1>
              <div className="flex gap-2 items-center">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
                  {t(`list.status.${task.status}`)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(task.priority)}`}>
                  {t(`list.priority.${task.priority}`)}
                </span>
                {task.category && (
                  <span className="flex items-center text-sm text-text-secondary">
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-1"
                      style={{ backgroundColor: task.category.color || '#6B7280' }}
                    />
                    {task.category.name}
                  </span>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Link
                  href={`/${locale}/tasks/${task.id}/edit`}
                  className="px-4 py-2 text-sm bg-surface border border-border rounded-md hover:bg-surface-elevated"
                >
                  {t('actions.edit')}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="col-span-2">
            {/* Tabs */}
            <div className="border-b border-border mb-6">
              <nav className="-mb-px flex space-x-8">
                {(['overview', 'comments', 'attachments', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      py-2 px-1 border-b-2 font-medium text-sm
                      ${activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border'
                      }
                    `}
                  >
                    {t(`detail.${tab}`)}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-surface shadow-sm rounded-lg p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {task.description && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">{t('form.description')}</h3>
                      <p className="text-text-secondary whitespace-pre-wrap">{task.description}</p>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-lg font-medium">{t('detail.subtasks')}</h3>
                    </div>
                    {canEdit && (
                      <form onSubmit={handleAddSubtask} className="mb-4 flex w-full gap-2">
                        <input
                          type="text"
                          data-testid="subtask-title-input"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={t('subtasks.newPlaceholder')}
                          disabled={creatingSubtask}
                        />
                        <button
                          type="submit"
                          data-testid="subtask-add-button"
                          disabled={creatingSubtask || !newSubtaskTitle.trim()}
                          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingSubtask ? t('subtasks.creating') : t('subtasks.addButton')}
                        </button>
                      </form>
                    )}
                    {task.subtasks && task.subtasks.length > 0 ? (
                      <ul className="space-y-2">
                        {task.subtasks.map((subtask) => {
                          const isUpdating = updatingSubtaskId === subtask.id
                          const isDeleting = deletingSubtaskId === subtask.id
                          const isEditing = editingSubtaskId === subtask.id
                          const draftTitle = subtaskDraftTitles[subtask.id] ?? subtask.title

                          return (
                            <li
                              key={subtask.id}
                              className="flex items-center justify-between gap-3 rounded border border-border bg-surface-elevated px-3 py-2"
                            >
                              <div className="flex flex-1 items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={subtask.status === 'done'}
                                  onChange={() => handleToggleSubtask(subtask)}
                                  disabled={isUpdating || isDeleting}
                                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                                />
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={draftTitle}
                                    onChange={(e) =>
                                      setSubtaskDraftTitles(prev => ({ ...prev, [subtask.id]: e.target.value }))
                                    }
                                    className="flex-1 rounded-md border border-border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isUpdating}
                                  />
                                ) : (
                                  <span
                                    className={`flex-1 text-sm ${
                                      subtask.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'
                                    }`}
                                  >
                                    {subtask.title}
                                  </span>
                                )}
                                <span className="text-xs text-text-muted">
                                  {t(`list.status.${subtask.status}`)}
                                </span>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveSubtaskTitle(subtask.id)}
                                        disabled={isUpdating}
                                        className="rounded-md border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {t('form.save')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelEditSubtask(subtask.id)}
                                        disabled={isUpdating}
                                        className="rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {t('form.cancel')}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditSubtask(subtask)}
                                        disabled={isUpdating || isDeleting}
                                        className="rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {t('actions.edit')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSubtask(subtask.id)}
                                        disabled={isDeleting || isUpdating}
                                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {isDeleting ? t('subtasks.deleting') : t('actions.delete')}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-text-muted">{t('subtasks.empty')}</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => (
                      <div
                        key={comment.id}
                        data-testid="task-comment-item"
                        className="border-b pb-4"
                      >
                        <div className="flex items-start">
                          <div className="w-10 h-10 bg-surface-elevated rounded-full flex items-center justify-center text-sm font-medium text-text-secondary">
                            {comment.user?.full_name?.[0] || comment.user?.email?.[0] || '?'}
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center">
                              <span className="font-medium text-sm">
                                {comment.user?.full_name || comment.user?.email}
                              </span>
                              <span className="ml-2 text-xs text-text-muted">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  data-testid="task-comment-edit-input"
                                  value={commentDrafts[comment.id] ?? comment.comment}
                                  onChange={(event) => setCommentDrafts(prev => ({
                                    ...prev,
                                    [comment.id]: event.target.value,
                                  }))}
                                  rows={3}
                                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  disabled={savingCommentId === comment.id}
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelEditComment(comment.id)}
                                    className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-elevated"
                                    disabled={savingCommentId === comment.id}
                                  >
                                    キャンセル
                                  </button>
                                  <button
                                    type="button"
                                    data-testid="task-comment-save-button"
                                    onClick={() => handleSaveComment(comment.id)}
                                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={savingCommentId === comment.id || !commentDrafts[comment.id]?.trim()}
                                  >
                                    {savingCommentId === comment.id ? '保存中...' : '保存'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1">
                                <p className="text-sm text-text-secondary">{comment.comment}</p>
                                {canEdit && (
                                  <div className="mt-2 flex gap-3">
                                    <button
                                      type="button"
                                      data-testid="task-comment-edit-button"
                                      onClick={() => handleStartEditComment(comment)}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      編集
                                    </button>
                                    <button
                                      type="button"
                                      data-testid="task-comment-delete-button"
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                                      disabled={deletingCommentId === comment.id}
                                    >
                                      {deletingCommentId === comment.id ? '削除中...' : '削除'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted">{t('detail.noComments')}</p>
                  )}

                  <form onSubmit={handleAddComment} className="mt-4">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('detail.addComment')}
                      disabled={submittingComment}
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingComment || !newComment.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submittingComment ? '送信中...' : '送信'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'attachments' && (
                <div className="space-y-4">
                  {task.attachments && task.attachments.length > 0 ? (
                    task.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        data-testid="task-attachment-item"
                        className="flex items-center justify-between p-3 border border-border rounded-md"
                      >
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-text-muted mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium">{attachment.file_name}</p>
                            <p className="text-xs text-text-muted">
                              {attachment.file_size && `${(attachment.file_size / 1024).toFixed(1)} KB`}
                              {attachment.uploaded_at && ` • ${new Date(attachment.uploaded_at).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/storage/task-attachments/${attachment.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            ダウンロード
                          </a>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted">{t('detail.noAttachments')}</p>
                  )}

                  <div className="mt-4">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {uploadingFile ? 'アップロード中...' : t('detail.addAttachment')}
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {task.id ? (
                    <TaskHistoryList taskId={task.id} />
                  ) : (
                    <p className="text-text-muted">{t('detail.noHistory')}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Task Info */}
          <div className="space-y-6">
            <div className="bg-surface shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">{t('form.title')}</h3>

              <dl className="space-y-4">
                {task.assignee && (
                  <div>
                    <dt className="text-sm text-text-secondary">{t('form.assignee')}</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {task.assignee.full_name || task.assignee.email}
                    </dd>
                  </div>
                )}

                {task.reporter && (
                  <div>
                    <dt className="text-sm text-text-secondary">{t('form.reporter')}</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {task.reporter.full_name || task.reporter.email}
                    </dd>
                  </div>
                )}

                {task.due_date && (
                  <div>
                    <dt className="text-sm text-text-secondary">{t('form.dueDate')}</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {new Date(task.due_date).toLocaleDateString()}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm text-text-secondary">{t('form.progress')}</dt>
                  <dd className="mt-1">
                    <div className="flex items-center">
                      <div className="flex-1 bg-surface-elevated rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="ml-2 text-sm font-medium">{task.progress}%</span>
                    </div>
                  </dd>
                </div>

                {(task.estimated_hours || task.actual_hours) && (
                  <div>
                    <dt className="text-sm text-text-secondary">工数</dt>
                    <dd className="mt-1 text-sm">
                      {task.estimated_hours && (
                        <span>見積: {task.estimated_hours}h</span>
                      )}
                      {task.actual_hours && (
                        <span className="ml-2">実績: {task.actual_hours}h</span>
                      )}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm text-text-secondary">作成日</dt>
                  <dd className="mt-1 text-sm">
                    {new Date(task.created_at).toLocaleDateString()}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-text-secondary">更新日</dt>
                  <dd className="mt-1 text-sm">
                    {new Date(task.updated_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Tags */}
            <div className="bg-surface shadow-sm rounded-lg p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">{t('form.tags')}</h3>
                {canEdit && !editingTags && (
                  <button
                    type="button"
                    onClick={openTagEditor}
                    className="rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-elevated"
                  >
                    {t('tagEditor.editButton')}
                  </button>
                )}
              </div>
              {editingTags ? (
                tagEditorLoading ? (
                  <p className="text-sm text-text-muted">{t('tagEditor.loading')}</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary">{t('tagEditor.selectedTitle')}</h4>
                      {selectedTags.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {selectedTags.map((tag, index) => (
                            <li
                              key={tag.id}
                              className="flex items-center justify-between gap-2 rounded border border-border bg-surface-elevated px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                                  style={{
                                    backgroundColor: tag.color ? `${tag.color}20` : '#f3f4f6',
                                    color: tag.color || '#374151'
                                  }}
                                >
                                  {tag.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveTag(index, 'up')}
                                  disabled={index === 0}
                                  className="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {t('tagEditor.moveUp')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveTag(index, 'down')}
                                  disabled={index === selectedTags.length - 1}
                                  className="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {t('tagEditor.moveDown')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTagFromSelection(tag.id)}
                                  className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                                >
                                  {t('tagEditor.remove')}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-text-muted">{t('tagEditor.noSelected')}</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary">{t('tagEditor.availableTitle')}</h4>
                      {availableTagOptions.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {availableTagOptions.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleAddTagToSelection(tag.id)}
                              className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-text-muted">{t('tagEditor.noAvailable')}</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary">{t('tagEditor.createTitle')}</h4>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          className="w-44 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={t('tagEditor.namePlaceholder')}
                          disabled={creatingTag}
                        />
                        <label className="flex items-center gap-2 text-xs text-text-secondary">
                          <span>{t('tagEditor.colorLabel')}</span>
                          <input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            disabled={creatingTag}
                            className="h-8 w-10 cursor-pointer border border-border"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={creatingTag || !newTagName.trim()}
                          className="rounded-md border border-blue-600 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingTag ? t('tagEditor.creating') : t('tagEditor.createButton')}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelTagEditing}
                        className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated"
                      >
                        {t('form.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTags}
                        disabled={savingTags}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingTags ? t('form.saving') : t('form.save')}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  {task.tags && task.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.tags.map((tag) => (
                        <span
                          key={tag.id}
                          data-testid="task-tag-chip"
                          className="rounded-full px-2 py-1 text-xs"
                          style={{
                            backgroundColor: tag.color ? `${tag.color}20` : '#f3f4f6',
                            color: tag.color || '#374151'
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">{t('tagEditor.noSelected')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  )
}

// Task History Component
function TaskHistoryList({ taskId }: { taskId: string }) {
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [loading, setLoading] = useState(true)

  const taskService = useMemo(() => new TaskService(), [])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const historyData = await taskService.getTaskHistory(taskId)
      setHistory(historyData)
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoading(false)
    }
  }, [taskId, taskService])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  if (loading) {
    return <div className="animate-pulse h-20 bg-surface-elevated rounded"></div>
  }

  if (history.length === 0) {
    return <p className="text-text-muted">変更履歴はありません</p>
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div key={item.id} className="flex items-start">
          <div className="w-2 h-2 bg-text-muted rounded-full mt-2 mr-3"></div>
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium">
                {item.user?.full_name || item.user?.email || 'システム'}
              </span>
              {' が '}
              {item.field_name && (
                <>
                  <span className="font-medium">{getFieldName(item.field_name)}</span>
                  {' を '}
                  {item.old_value && <span className="line-through text-text-muted">{item.old_value}</span>}
                  {' から '}
                  {item.new_value && <span className="font-medium">{item.new_value}</span>}
                  {' に変更'}
                </>
              )}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {new Date(item.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function getFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    status: 'ステータス',
    priority: '優先度',
    assignee_id: '担当者',
    due_date: '期限',
    progress: '進捗率'
  }
  return fieldNames[field] || field
}
