'use client'

import { useState, useEffect, useMemo, useCallback, Fragment, use } from 'react';
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { TaskService } from '@/lib/services/task'
import { UserService } from '@/lib/services/user'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type { TaskWithRelations, TaskStatus, TaskPriority, TaskCategory } from '@/lib/services/task'
import type { UserProfile } from '@/lib/services/user'
import { sanitizeTaskFileName } from '@/lib/utils/exporters/taskExport'
import { FilterBar, type FilterBarItem } from '@/components/filters/FilterBar'
import { StatusFilterBanner } from '@/components/filters/StatusFilterBanner'
import { canCreateTask } from '@/lib/constants/taskPermissions'
import { useAuth } from '@/lib/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

type ViewMode = 'list' | 'kanban' | 'calendar' | 'gantt'

interface TaskFilters {
  assigneeId: string
  status: TaskStatus | ''
  priority: TaskPriority | ''
  categoryId: string
  due: 'overdue' | ''
  tag: string
}

const VIEW_MODES: ViewMode[] = ['list', 'kanban', 'calendar', 'gantt']

const normalizeViewMode = (value: string | null): ViewMode => {
  if (!value) {
    return 'list'
  }

  return VIEW_MODES.includes(value as ViewMode) ? (value as ViewMode) : 'list'
}

const extractFiltersFromSearchParams = (params: URLSearchParams): TaskFilters => ({
  assigneeId: params.get('assigneeId') ?? '',
  status: (params.get('status') as TaskStatus | '') ?? '',
  priority: (params.get('priority') as TaskPriority | '') ?? '',
  categoryId: params.get('categoryId') ?? '',
  due: params.get('due') === 'overdue' ? 'overdue' : '',
  tag: params.get('tag') ?? ''
})

const areTaskFiltersEqual = (a: TaskFilters, b: TaskFilters) =>
  a.assigneeId === b.assigneeId &&
  a.status === b.status &&
  a.priority === b.priority &&
  a.categoryId === b.categoryId &&
  a.due === b.due &&
  a.tag === b.tag

const COMPLETION_KEYWORDS = ['完了条件', 'completion criteria', 'definition of done', 'acceptance criteria']

const stripCompletionPrefix = (value: string) =>
  value.replace(/^(?:完了条件|Completion criteria|Definition of done|Acceptance criteria)\s*[:：-]?\s*/i, '')

const normalizeSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim()

const truncateText = (value: string, limit = 140) =>
  value.length > limit ? `${value.slice(0, limit)}...` : value

const normalizeTaskTagValue = (value: string) => value.trim().toLowerCase()

const taskMatchesTagFilter = (task: TaskWithRelations, tagFilter: string) => {
  const normalizedTag = normalizeTaskTagValue(tagFilter)
  if (!normalizedTag) return true

  const tagCandidates = task.tags?.flatMap(tag => [
    normalizeTaskTagValue(tag.id),
    normalizeTaskTagValue(tag.name),
  ]) ?? []
  if (tagCandidates.some(candidate => candidate === normalizedTag || candidate.includes(normalizedTag))) {
    return true
  }

  if (normalizedTag === 'improvement') {
    const searchableText = normalizeTaskTagValue(`${task.title} ${task.description ?? ''} ${task.category?.name ?? ''}`)
    return ['改善', '是正', 'pdca', 'improvement'].some(keyword => searchableText.includes(keyword))
  }

  return false
}

const getUserDisplayName = (user?: UserProfile | null) =>
  user?.full_name?.trim() || user?.email?.trim() || '-'

const normalizeDateKey = (value: string) => value.split('T')[0]

const formatDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const DAY_IN_MS = 1000 * 60 * 60 * 24
const GANTT_CELL_WIDTH = 32
const GANTT_MIN_RANGE_DAYS = 14
const GANTT_META_COLUMN_WIDTH = 260

const toDateOnly = (value?: string | Date | null) => {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  next.setHours(0, 0, 0, 0)
  return next
}

const diffInDays = (start: Date, end: Date) => Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS)

interface GanttScheduledTask extends TaskWithRelations {
  ganttStart: Date
  ganttEnd: Date
}

const getStatusAccent = (status: TaskStatus) => {
  const accents: Record<TaskStatus, string> = {
    todo: 'border-gray-200',
    in_progress: 'border-blue-300',
    review: 'border-yellow-300',
    done: 'border-green-300',
    cancelled: 'border-red-300'
  }
  return accents[status]
}

const deriveCompletionCriteria = (task: TaskWithRelations, fallback: string) => {
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

const formatShortDate = (value: string, locale: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
}

export default function TasksPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('tasks')
  const router = useRouter()
  const { user: authUser } = useAuth()
  const searchParams = useSearchParams()
  const basePath = `/${locale}/tasks`
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => searchParams?.get('q') ?? '')
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const initial = (searchParams?.get('view') as ViewMode) || 'list'
    return VIEW_MODES.includes(initial) ? initial : 'list'
  })
  const [calendarDate, setCalendarDate] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [filters, setFilters] = useState<TaskFilters>(() => ({
    assigneeId: searchParams?.get('assigneeId') ?? '',
    status: (searchParams?.get('status') as TaskStatus | '') ?? '',
    priority: (searchParams?.get('priority') as TaskPriority | '') ?? '',
    categoryId: searchParams?.get('categoryId') ?? '',
    due: searchParams?.get('due') === 'overdue' ? 'overdue' : '',
    tag: searchParams?.get('tag') ?? ''
  }))

  const updateQueryParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      mutator(params)
      const target = params.toString()
      router.replace(target ? `${basePath}?${target}` : basePath, { scroll: false })
    },
    [basePath, router, searchParams]
  )

  const syncFilterParam = useCallback(
    (key: string, value: string) => {
      updateQueryParams(params => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
    },
    [updateQueryParams]
  )

  const handleFilterChange = useCallback(
    (key: keyof TaskFilters, value: string) => {
      setFilters(current => ({
        ...current,
        [key]: value
      }))
      syncFilterParam(key, value)
    },
    [syncFilterParam]
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value)
      const normalized = value.trim()
      syncFilterParam('q', normalized)
    },
    [syncFilterParam]
  )

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode)
      updateQueryParams(params => {
        if (mode === 'list') {
          params.delete('view')
        } else {
          params.set('view', mode)
        }
      })
    },
    [updateQueryParams]
  )

  const taskService = useMemo(() => new TaskService(), [])
  const userService = useMemo(() => new UserService(), [])
  const personalView = searchParams?.get('view') === 'personal'

  const handleClearStatusFilter = useCallback(() => {
    handleFilterChange('status', '')
  }, [handleFilterChange])

  const handleClearDueFilter = useCallback(() => {
    handleFilterChange('due', '')
  }, [handleFilterChange])

  const handleClearPersonalView = useCallback(() => {
    updateQueryParams(params => {
      params.delete('view')
    })
  }, [updateQueryParams])

  const handleClearTagFilter = useCallback(() => {
    handleFilterChange('tag', '')
  }, [handleFilterChange])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Get current user and organization
      if (!authUser) return

      const profile = await userService.getUserProfile()
      if (!profile?.organization_id) return
      setOrganizationId(profile.organization_id)
      setCurrentUserRole(profile.role)
      setCurrentUserId(profile.id)

      // Load categories
      const categoriesData = await taskService.getTaskCategories(profile.organization_id)
      setCategories(categoriesData)

      // Members may not be allowed to browse the full user directory.
      // Keep the personal task view usable with the current profile as fallback.
      const usersData = await userService.getOrganizationUsers(profile.organization_id).catch(() => {
        return [profile]
      })
      setUsers(usersData)

      const effectiveAssigneeId = filters.assigneeId || (personalView ? profile.id : '')

      // Load tasks with filters
      const tasksData = await taskService.getTasks({
        organizationId: profile.organization_id,
        ...(filters.status && { status: filters.status as TaskStatus }),
        ...(filters.priority && { priority: filters.priority as TaskPriority }),
        ...(effectiveAssigneeId && { assigneeId: effectiveAssigneeId }),
        ...(filters.categoryId && { categoryId: filters.categoryId })
      })
      setTasks(tasksData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [authUser, filters, personalView, taskService, userService])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!searchParams) {
      return
    }

    const nextFilters = extractFiltersFromSearchParams(searchParams)
    setFilters(current => (areTaskFiltersEqual(current, nextFilters) ? current : nextFilters))

    const nextSearchTerm = searchParams.get('q') ?? ''
    setSearchTerm(current => (current === nextSearchTerm ? current : nextSearchTerm))

    const nextViewMode = normalizeViewMode(searchParams.get('view'))
    setViewMode(current => (current === nextViewMode ? current : nextViewMode))
  }, [searchParams])

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskService.updateTask(taskId, { status: newStatus })
      await loadData()
    } catch (error) {
      console.error('Error updating task status:', error)
      alert('タスクの更新に失敗しました')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm(t('confirmDelete'))) return

    try {
      await taskService.deleteTask(taskId)
      await loadData()
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('タスクの削除に失敗しました')
    }
  }

  const activeStatusFilter = filters.status as TaskStatus | ''
  const activeDueFilter = filters.due
  const activeTagFilter = filters.tag
  const activePersonalView = personalView && Boolean(currentUserId)
  const statusFilterBannerLabel = activeStatusFilter
    ? t('list.activeFilters.status', { status: t(`list.status.${activeStatusFilter}`) })
    : ''
  const dueFilterBannerLabel = activeDueFilter === 'overdue'
    ? t('list.activeFilters.overdue')
    : ''
  const tagFilterBannerLabel = activeTagFilter
    ? t('list.activeFilters.tag', { tag: activeTagFilter })
    : ''
  const personalFilterBannerLabel = activePersonalView ? t('list.activeFilters.personal') : ''

  // Filter tasks based on search term
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      !normalizedSearch ||
      task.title.toLowerCase().includes(normalizedSearch) ||
      task.description?.toLowerCase().includes(normalizedSearch)
    const matchesStatus = !filters.status || task.status === filters.status
    const matchesPriority = !filters.priority || task.priority === filters.priority
    const effectiveAssigneeId = filters.assigneeId || (activePersonalView ? currentUserId : '')
    const matchesAssignee = !effectiveAssigneeId || task.assignee_id === effectiveAssigneeId
    const matchesCategory = !filters.categoryId || task.category_id === filters.categoryId
    const matchesTag = taskMatchesTagFilter(task, filters.tag)
    const dueDate = toDateOnly(task.due_date)
    const today = toDateOnly(new Date())
    const matchesDue =
      filters.due !== 'overdue' ||
      Boolean(
        dueDate &&
        today &&
        dueDate < today &&
        !['done', 'cancelled'].includes(task.status)
      )
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesCategory && matchesTag && matchesDue
  })

  const completionFallbackText = t('list.noCompletionCriteria')
  const noDueDateLabel = t('list.noDueDate')
  const canAuthorTasks = canCreateTask(currentUserRole)

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }), [locale])

  const weekdayLabels = useMemo(() => {
    const base = new Date(2023, 0, 1)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base)
      date.setDate(base.getDate() + index)
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
    })
  }, [locale])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>()
    filteredTasks.forEach(task => {
      if (!task.due_date) return
      const key = normalizeDateKey(task.due_date)
      const existing = map.get(key) ?? []
      existing.push(task)
      map.set(key, existing)
    })
    return map
  }, [filteredTasks])

  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(calendarDate)
    const startDay = startOfMonth.getDay()
    const calendarStart = new Date(startOfMonth)
    calendarStart.setDate(startOfMonth.getDate() - startDay)

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(calendarStart)
      date.setDate(calendarStart.getDate() + index)
      const key = formatDateKey(date)
      return {
        date,
        key,
        isCurrentMonth: date.getMonth() === startOfMonth.getMonth(),
        tasks: tasksByDate.get(key) ?? []
      }
    })
  }, [calendarDate, tasksByDate])

  const unscheduledTasks = useMemo(() => filteredTasks.filter(task => !task.due_date), [filteredTasks])

  const ganttRangeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale]
  )

  const ganttData = useMemo(() => {
    const scheduled = filteredTasks
      .filter(task => task.due_date)
      .map(task => {
        const ganttEnd = toDateOnly(task.due_date)
        if (!ganttEnd) return null
        const derivedStart = toDateOnly(task.created_at) ?? new Date(ganttEnd)
        const ganttStart = derivedStart.getTime() > ganttEnd.getTime() ? new Date(ganttEnd) : derivedStart
        return { ...task, ganttStart, ganttEnd }
      })
      .filter((task): task is GanttScheduledTask => Boolean(task))

    if (scheduled.length === 0) {
      return {
        scheduledTasks: [] as GanttScheduledTask[],
        range: null as { start: Date; end: Date } | null,
        days: [] as { date: Date; key: string; isWeekend: boolean }[],
        monthSegments: [] as { key: string; label: string; days: number }[],
        timelineWidth: 0,
        todayMarkerLeft: null as number | null
      }
    }

    scheduled.sort((a, b) => a.ganttStart.getTime() - b.ganttStart.getTime())

    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' })

    let minDate = new Date(scheduled[0].ganttStart)
    let maxDate = new Date(scheduled[0].ganttEnd)
    scheduled.forEach(task => {
      if (task.ganttStart.getTime() < minDate.getTime()) {
        minDate = new Date(task.ganttStart)
      }
      if (task.ganttEnd.getTime() > maxDate.getTime()) {
        maxDate = new Date(task.ganttEnd)
      }
    })

    let rangeStart = addDays(minDate, -1)
    let rangeEnd = addDays(maxDate, 1)
    const minimumRangeEnd = addDays(rangeStart, GANTT_MIN_RANGE_DAYS - 1)
    if (rangeEnd.getTime() < minimumRangeEnd.getTime()) {
      rangeEnd = minimumRangeEnd
    }

    const days: { date: Date; key: string; isWeekend: boolean }[] = []
    let cursor = new Date(rangeStart)
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const datePoint = new Date(cursor)
      days.push({
        date: datePoint,
        key: formatDateKey(datePoint),
        isWeekend: datePoint.getDay() === 0 || datePoint.getDay() === 6
      })
      cursor = addDays(cursor, 1)
    }

    const monthSegments = days.reduce<{ key: string; label: string; days: number }[]>((acc, day) => {
      const key = `${day.date.getFullYear()}-${day.date.getMonth()}`
      const existing = acc[acc.length - 1]
      if (!existing || existing.key !== key) {
        acc.push({ key, label: monthFormatter.format(day.date), days: 1 })
      } else {
        existing.days += 1
      }
      return acc
    }, [])

    const today = toDateOnly(new Date())
    let todayMarkerLeft: number | null = null
    if (today && today.getTime() >= rangeStart.getTime() && today.getTime() <= rangeEnd.getTime()) {
      const offset = diffInDays(rangeStart, today)
      todayMarkerLeft = offset * GANTT_CELL_WIDTH + GANTT_CELL_WIDTH / 2
    }

    return {
      scheduledTasks: scheduled,
      range: { start: rangeStart, end: rangeEnd },
      days,
      monthSegments,
      timelineWidth: days.length * GANTT_CELL_WIDTH,
      todayMarkerLeft
    }
  }, [filteredTasks, locale])

  const calendarHeaderLabel = monthFormatter.format(calendarDate)
  const calendarSummary = t('list.calendar.totalTasks', { count: filteredTasks.length })
  const todayKey = formatDateKey(new Date())

  const handleCalendarMonthChange = useCallback((offset: number) => {
    setCalendarDate(prev => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + offset, 1)
      next.setHours(0, 0, 0, 0)
      return next
    })
  }, [])

  const handleCalendarToday = useCallback(() => {
    const now = new Date()
    setCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [])

  const handleExportCsv = async () => {
    if (filteredTasks.length === 0 || !organizationId || exportingCsv) {
      return
    }

    const params = new URLSearchParams({ organizationId })
    if (filters.status) params.set('status', filters.status)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.assigneeId || activePersonalView) params.set('assigneeId', filters.assigneeId || currentUserId || '')
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (filters.due) params.set('due', filters.due)
    if (filters.tag) params.set('tag', filters.tag)

    setExportingCsv(true)
    try {
      const response = await fetch(`/api/tasks/export?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`Task export failed with ${response.status}`)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const filename =
        contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] ??
        `${sanitizeTaskFileName('tasks-export')}.csv`
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting tasks:', error)
      alert(t('list.exportFailed'))
    } finally {
      setExportingCsv(false)
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      todo: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      review: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status]
  }

  const getPriorityColor = (priority: TaskPriority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    }
    return colors[priority]
  }

  const getGanttBarColor = (status: TaskStatus) => {
    const colors = {
      todo: 'bg-gray-400',
      in_progress: 'bg-blue-500',
      review: 'bg-yellow-500',
      done: 'bg-green-500',
      cancelled: 'bg-red-400'
    }
    return colors[status]
  }

  const filterBarItems = useMemo<FilterBarItem[]>(() => {
    return [
      {
        key: 'search',
        type: 'search',
        placeholder: t('list.search'),
        value: searchTerm,
        onChange: handleSearchChange,
        className: 'flex-1 min-w-[220px]'
      },
      {
        key: 'assignee',
        type: 'select',
        placeholder: t('list.filters.assignee'),
        value: filters.assigneeId,
        onChange: value => handleFilterChange('assigneeId', value),
        options: users.map(user => ({
          value: user.id,
          label: user.full_name || user.email || t('list.filters.assignee')
        }))
      },
      {
        key: 'status',
        type: 'select',
        placeholder: t('list.filters.status'),
        value: filters.status,
        onChange: value => handleFilterChange('status', value),
        options: [
          { value: 'todo', label: t('list.status.todo') },
          { value: 'in_progress', label: t('list.status.in_progress') },
          { value: 'review', label: t('list.status.review') },
          { value: 'done', label: t('list.status.done') },
          { value: 'cancelled', label: t('list.status.cancelled') }
        ]
      },
      {
        key: 'priority',
        type: 'select',
        placeholder: t('list.filters.priority'),
        value: filters.priority,
        onChange: value => handleFilterChange('priority', value),
        options: [
          { value: 'low', label: t('list.priority.low') },
          { value: 'medium', label: t('list.priority.medium') },
          { value: 'high', label: t('list.priority.high') },
          { value: 'urgent', label: t('list.priority.urgent') }
        ]
      },
      {
        key: 'category',
        type: 'select',
        placeholder: t('list.filters.category'),
        value: filters.categoryId,
        onChange: value => handleFilterChange('categoryId', value),
        options: categories.map(category => ({
          value: category.id,
          label: category.name
        }))
      }
    ]
  }, [categories, filters.assigneeId, filters.categoryId, filters.priority, filters.status, handleFilterChange, handleSearchChange, searchTerm, t, users])

  const formatDueDate = (dueDate?: string | null) => {
    if (!dueDate) return '-'

    const date = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return <span className="text-red-600">{date.toLocaleDateString()} ({Math.abs(diffDays)}日超過)</span>
    }
    if (diffDays === 0) {
      return <span className="text-orange-600">{date.toLocaleDateString()} (今日)</span>
    }
    if (diffDays <= 3) {
      return <span className="text-yellow-600">{date.toLocaleDateString()} (あと{diffDays}日)</span>
    }
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="flex gap-3">
          {['org_admin', 'system_operator'].includes(currentUserRole ?? '') && (
            <Link
              href={`/${locale}/settings/setup`}
              className="inline-flex items-center px-4 py-2 rounded-md border border-border bg-surface text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {t('importCsv')}
            </Link>
          )}
          {canAuthorTasks && (
            <Link
              href={`/${locale}/tasks/new`}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {t('list.newTask')}
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <FilterBar items={filterBarItems} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleViewModeChange('kanban')}
              className={`px-4 py-2 border rounded-md ${
                viewMode === 'kanban'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-border hover:bg-surface-elevated'
              }`}
            >
              {t('list.view.kanban')}
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-4 py-2 border rounded-md ${
                viewMode === 'list'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-border hover:bg-surface-elevated'
              }`}
            >
              {t('list.view.list')}
            </button>
            <button
              onClick={() => handleViewModeChange('calendar')}
              className={`px-4 py-2 border rounded-md ${
                viewMode === 'calendar'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-border hover:bg-surface-elevated'
              }`}
            >
              {t('list.view.calendar')}
            </button>
            <button
              onClick={() => handleViewModeChange('gantt')}
              className={`px-4 py-2 border rounded-md ${
                viewMode === 'gantt'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-border hover:bg-surface-elevated'
              }`}
            >
              {t('list.view.gantt')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredTasks.length === 0 || !organizationId || exportingCsv}
            className="ml-auto px-4 py-2 rounded-md border border-border bg-surface text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingCsv ? t('list.exportingCsv') : t('list.exportCsv')}
          </button>
        </div>
      </div>

      {(activeStatusFilter || activeDueFilter || activePersonalView || activeTagFilter) && (
        <div className="mb-4 space-y-2">
          {activePersonalView && (
            <StatusFilterBanner
              label={personalFilterBannerLabel}
              clearLabel={t('list.activeFilters.clear')}
              onClear={handleClearPersonalView}
            />
          )}
          {activeStatusFilter && (
          <StatusFilterBanner
            label={statusFilterBannerLabel}
            clearLabel={t('list.activeFilters.clear')}
            onClear={handleClearStatusFilter}
          />
          )}
          {activeDueFilter && (
            <StatusFilterBanner
              label={dueFilterBannerLabel}
              clearLabel={t('list.activeFilters.clear')}
              onClear={handleClearDueFilter}
            />
          )}
          {activeTagFilter && (
            <StatusFilterBanner
              label={tagFilterBannerLabel}
              clearLabel={t('list.activeFilters.clear')}
              onClear={handleClearTagFilter}
            />
          )}
        </div>
      )}

      {viewMode === 'list' ? (
        filteredTasks.length === 0 ? (
          <EmptyState title={t('list.noTasks')} />
        ) : (
        <div className="bg-surface shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.title')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.owner')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.assignee')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.completionCriteria')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.priority')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.dueDate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.progress')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t('list.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {filteredTasks.map((task) => {
                const completionText = deriveCompletionCriteria(task, completionFallbackText)
                return (
                  <tr key={task.id} data-testid={`task-row-${task.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/${locale}/tasks/${task.id}`} className="block hover:bg-surface-elevated -m-2 p-2 rounded">
                        <div>
                          <div className="text-sm font-medium text-text-primary hover:text-blue-600">
                            {task.title}
                          </div>
                          {task.category && (
                            <div className="text-xs text-text-muted">
                              <span
                                className="inline-block w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: task.category.color || '#6B7280' }}
                              />
                              {task.category.name}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {getUserDisplayName(task.reporter)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">
                        {getUserDisplayName(task.assignee)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm text-text-secondary">
                      <span title={completionText}>
                        {completionText}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(task.status)}`}
                        disabled={!canAuthorTasks}
                      >
                        <option value="todo">{t('list.status.todo')}</option>
                        <option value="in_progress">{t('list.status.in_progress')}</option>
                        <option value="review">{t('list.status.review')}</option>
                        <option value="done">{t('list.status.done')}</option>
                        <option value="cancelled">{t('list.status.cancelled')}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {t(`list.priority.${task.priority}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {formatDueDate(task.due_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-surface-elevated rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-text-muted mt-1">{task.progress}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {canAuthorTasks ? (
                          <>
                            <Link
                              href={`/${locale}/tasks/${task.id}/edit`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              {t('actions.edit')}
                            </Link>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              {t('actions.delete')}
                            </button>
                          </>
                        ) : (
                          <Link
                            href={`/${locale}/tasks/${task.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {t('detail.overview')}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['todo', 'in_progress', 'review', 'done'] as TaskStatus[]).map((status) => (
            <div key={status} className="bg-surface-elevated rounded-lg p-4">
              <h3 className="font-medium text-text-primary mb-4">
                {t(`list.status.${status}`)} ({filteredTasks.filter(t => t.status === status).length})
              </h3>
              <div className="space-y-3">
                {filteredTasks
                  .filter(task => task.status === status)
                  .map((task) => {
                    const ownerName = getUserDisplayName(task.reporter)
                    const assigneeName = getUserDisplayName(task.assignee)
                    const completionText = deriveCompletionCriteria(task, completionFallbackText)
                    return (
                      <Link key={task.id} href={`/${locale}/tasks/${task.id}`}>
                        <div className="bg-surface p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-2">
                        <div>
                          <h4 className="font-medium text-sm text-text-primary">{task.title}</h4>
                          {task.category && (
                            <p className="text-xs text-text-muted">
                              {task.category.name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-secondary">
                          <span className="font-medium">{ownerName}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                            {t(`list.priority.${task.priority}`)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          {t('list.columns.assignee')}: {assigneeName}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {t('list.columns.completionCriteria')}: <span className="text-text-primary">{completionText}</span>
                        </p>
                        <p className="text-xs text-text-muted">
                          {task.due_date
                            ? `${t('list.columns.dueDate')}: ${formatShortDate(task.due_date, locale)}`
                            : noDueDateLabel}
                        </p>
                      </div>
                    </Link>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'gantt' ? (
        <div className="bg-surface shadow-sm rounded-lg p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xl font-semibold text-text-primary">{t('list.view.gantt')}</p>
              {ganttData.range && (
                <p className="text-sm text-text-muted">
                  {t('list.gantt.summary', {
                    from: ganttRangeFormatter.format(ganttData.range.start),
                    to: ganttRangeFormatter.format(ganttData.range.end),
                    count: ganttData.scheduledTasks.length
                  })}
                </p>
              )}
            </div>
            {ganttData.todayMarkerLeft !== null && (
              <div className="flex items-center text-xs text-text-muted gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                {t('list.gantt.legend.today')}
              </div>
            )}
          </div>

          {ganttData.scheduledTasks.length === 0 ? (
            <p className="text-sm text-text-muted">{t('list.gantt.noScheduledTasks')}</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <div style={{ minWidth: `${GANTT_META_COLUMN_WIDTH + ganttData.timelineWidth}px` }}>
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `${GANTT_META_COLUMN_WIDTH}px ${ganttData.timelineWidth}px` }}
                  >
                    <div className="bg-surface-elevated border-b border-border px-4 py-2 text-xs font-semibold text-text-secondary">
                      {t('list.gantt.taskColumn')}
                    </div>
                    <div className="bg-surface-elevated border-b border-border">
                      <div className="relative" style={{ width: `${ganttData.timelineWidth}px` }}>
                        <div className="flex border-b border-border">
                          {ganttData.monthSegments.map(segment => (
                            <div
                              key={segment.key}
                              className="text-xs text-text-secondary font-medium text-center border-r border-border px-2 py-1"
                              style={{ width: `${segment.days * GANTT_CELL_WIDTH}px` }}
                            >
                              {segment.label}
                            </div>
                          ))}
                        </div>
                        <div className="flex">
                          {ganttData.days.map(day => (
                            <div
                              key={day.key}
                              className={`text-[11px] text-text-muted border-r border-border text-center py-1 ${
                                day.isWeekend ? 'bg-surface-elevated' : 'bg-surface'
                              }`}
                              style={{ width: `${GANTT_CELL_WIDTH}px` }}
                            >
                              {day.date.getDate()}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {ganttData.scheduledTasks.map(task => {
                      const ownerName = getUserDisplayName(task.reporter)
                      const assigneeName = getUserDisplayName(task.assignee)
                      const offsetDays = Math.max(0, diffInDays(ganttData.range!.start, task.ganttStart))
                      const durationDays = Math.max(1, diffInDays(task.ganttStart, task.ganttEnd) + 1)
                      const barLeft = offsetDays * GANTT_CELL_WIDTH
                      const barWidth = Math.max(durationDays * GANTT_CELL_WIDTH, GANTT_CELL_WIDTH)
                      return (
                        <Fragment key={task.id}>
                          <div className="border-b border-border px-4 py-3 bg-surface">
                            <Link
                              href={`/${locale}/tasks/${task.id}`}
                              className="text-sm font-medium text-text-primary hover:text-blue-600"
                            >
                              {task.title}
                            </Link>
                            <div className="mt-1 text-xs text-text-secondary space-y-0.5">
                              <p>
                                {t('list.columns.owner')}: {ownerName}
                              </p>
                              <p>
                                {t('list.columns.assignee')}: {assigneeName}
                              </p>
                              <p>
                                {t('list.columns.dueDate')}: {ganttRangeFormatter.format(task.ganttEnd)}
                              </p>
                            </div>
                          </div>
                          <div className="border-b border-border px-0 py-3 bg-surface">
                            <div
                              className="relative h-12"
                              style={{
                                width: `${ganttData.timelineWidth}px`,
                                backgroundImage:
                                  'linear-gradient(to right, rgba(229,231,235,0.7) 1px, transparent 1px)',
                                backgroundSize: `${GANTT_CELL_WIDTH}px 100%`
                              }}
                            >
                              {ganttData.todayMarkerLeft !== null && (
                                <div
                                  className="absolute top-0 bottom-0 w-px bg-blue-400/60"
                                  style={{ left: `${ganttData.todayMarkerLeft}px` }}
                                />
                              )}
                              <div
                                className={`absolute h-8 rounded-md text-xs text-white font-medium flex items-center gap-2 px-2 ${getGanttBarColor(task.status)}`}
                                style={{ left: `${barLeft}px`, width: `${barWidth}px` }}
                                title={`${ganttRangeFormatter.format(task.ganttStart)} - ${ganttRangeFormatter.format(
                                  task.ganttEnd
                                )}`}
                              >
                                <span className="truncate">{formatShortDate(task.due_date!, locale)}</span>
                                <span className="ml-auto">{task.progress}%</span>
                              </div>
                            </div>
                          </div>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {unscheduledTasks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-text-primary">{t('list.gantt.unscheduledHeading')}</h3>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {unscheduledTasks.map(task => {
                  const ownerName = getUserDisplayName(task.reporter)
                  const completionText = deriveCompletionCriteria(task, completionFallbackText)
                  return (
                    <Link key={task.id} href={`/${locale}/tasks/${task.id}`} className="block">
                      <div className="border border-border rounded-lg p-4 hover:bg-surface-elevated">
                        <p className="text-sm font-medium text-text-primary">{task.title}</p>
                        <p className="text-xs text-text-secondary">{ownerName}</p>
                        <p className="text-xs text-text-muted">{completionText}</p>
                        <p className="text-xs text-text-muted">{noDueDateLabel}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface shadow-sm rounded-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xl font-semibold text-text-primary">{calendarHeaderLabel}</p>
              <p className="text-sm text-text-muted">{calendarSummary}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCalendarMonthChange(-1)}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface-elevated"
              >
                {t('list.calendar.previousMonth')}
              </button>
              <button
                type="button"
                onClick={handleCalendarToday}
                className="px-3 py-1.5 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50"
              >
                {t('list.calendar.today')}
              </button>
              <button
                type="button"
                onClick={() => handleCalendarMonthChange(1)}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface-elevated"
              >
                {t('list.calendar.nextMonth')}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 text-xs font-medium text-text-muted uppercase tracking-wide">
            {weekdayLabels.map((label, index) => (
              <div key={`${label}-${index}`} className="p-2 text-center">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 text-xs">
            {calendarDays.map(day => (
              <div
                key={day.key}
                className={`min-h-[140px] border border-border rounded-lg p-2 flex flex-col ${
                  day.isCurrentMonth ? 'bg-surface text-text-primary' : 'bg-surface-elevated text-text-muted'
                } ${day.key === todayKey ? 'ring-1 ring-blue-400' : ''}`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{day.date.getDate()}</span>
                  {day.tasks.length > 0 && (
                    <span className="text-text-muted">{day.tasks.length}</span>
                  )}
                </div>
                <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
                  {day.tasks.length === 0 ? (
                    <p className="text-[11px] text-text-muted">{t('list.calendar.empty')}</p>
                  ) : (
                    day.tasks.map(task => {
                      const ownerName = getUserDisplayName(task.reporter)
                      const completionText = deriveCompletionCriteria(task, completionFallbackText)
                      return (
                        <Link key={task.id} href={`/${locale}/tasks/${task.id}`} className="block">
                          <div className={`border-l-4 ${getStatusAccent(task.status)} bg-surface/90 rounded p-2 hover:bg-blue-50`}>
                            <p className="text-[11px] font-medium text-text-primary truncate">{task.title}</p>
                            <p className="text-[11px] text-text-secondary truncate">{ownerName}</p>
                            <p className="text-[11px] text-text-muted truncate">{completionText}</p>
                          </div>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          {unscheduledTasks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-text-primary">{t('list.calendar.unscheduledHeading')}</h3>
              <div className="mt-2 space-y-2">
                {unscheduledTasks.map(task => {
                  const ownerName = getUserDisplayName(task.reporter)
                  const completionText = deriveCompletionCriteria(task, completionFallbackText)
                  return (
                    <Link key={task.id} href={`/${locale}/tasks/${task.id}`} className="block">
                      <div className="border border-border rounded-lg p-3 hover:bg-surface-elevated">
                        <p className="text-sm font-medium text-text-primary">{task.title}</p>
                        <p className="text-xs text-text-secondary">{ownerName}</p>
                        <p className="text-xs text-text-muted">{completionText}</p>
                        <p className="text-xs text-text-muted">{noDueDateLabel}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </DashboardLayout>
  )
}
