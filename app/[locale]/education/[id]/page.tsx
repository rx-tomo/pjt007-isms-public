'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { EducationService } from '@/lib/services/education'
import { UserService, type UserProfile } from '@/lib/services/user'
import type {
  EducationMaterialEntity,
  EducationPlanWithRelations,
  EducationRecordWithAttendee,
} from '@/lib/services/education'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-surface-elevated text-text-primary',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const RESULT_COLORS: Record<string, string> = {
  pending: 'bg-surface-elevated text-text-primary',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  incomplete: 'bg-yellow-100 text-yellow-800',
}

type EducationNextAction = 'add_records' | 'follow_up' | 'review_overdue' | 'ready'
type EducationTargetMode = 'all' | 'role' | 'department' | 'users'

const EDUCATION_MANAGER_ROLES = new Set([
  'super_admin',
  'system_operator',
  'org_admin',
])

const ALL_TARGET_LABELS = new Set([
  '全社員',
  '全員',
  '全従業員',
  'all',
  'all employees',
  'everyone',
])

const ROLE_TARGET_LABELS: Record<string, string[]> = {
  org_admin: ['組織管理者', '管理者', 'org_admin', 'organization admin'],
  auditor: ['監査員', '内部監査員', 'auditor'],
  approver: ['承認者', 'approver'],
  user: ['メンバー', '一般ユーザー', 'user', 'member'],
  system_operator: ['システム運営者', 'system_operator', 'system operator'],
}

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  org_admin: '組織管理者',
  auditor: '監査員',
  approver: '承認者',
  user: 'メンバー',
  system_operator: 'システム運営者',
  super_admin: 'スーパー管理者',
}

function isUserTargetLabel(label: string) {
  return label.startsWith('user:')
}

function getUserIdFromTargetLabel(label: string) {
  return isUserTargetLabel(label) ? label.slice('user:'.length) : null
}

function isRoleTargetLabel(label: string) {
  return label.startsWith('role:')
}

function getRoleFromTargetLabel(label: string) {
  return isRoleTargetLabel(label) ? label.slice('role:'.length) : null
}

function isDepartmentTargetLabel(label: string) {
  return label.startsWith('department:')
}

function getDepartmentFromTargetLabel(label: string) {
  return isDepartmentTargetLabel(label) ? label.slice('department:'.length) : null
}

function parseTargetAudience(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    }
  } catch {
    // target_audience is also used as a free-text field in existing plans.
  }
  return value
    .split(/[,\n、]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function formatTargetAudience(value: string | null | undefined, users: UserProfile[] = []) {
  const labels = parseTargetAudience(value)
  if (labels.length === 0) return null

  const userNameById = new Map(users.map(user => [user.id, user.full_name || user.email]))
  return labels
    .map(label => {
      if (ALL_TARGET_LABELS.has(label.toLowerCase())) return '全社員'
      const role = getRoleFromTargetLabel(label)
      if (role) return `ロール: ${ROLE_DISPLAY_LABELS[role] ?? role}`
      const department = getDepartmentFromTargetLabel(label)
      if (department) return `部門: ${department}`
      const userId = getUserIdFromTargetLabel(label)
      return userId ? userNameById.get(userId) ?? label : label
    })
    .join(', ')
}

function targetLabelMatchesUser(label: string, user: UserProfile) {
  const selectedUserId = getUserIdFromTargetLabel(label)
  if (selectedUserId) {
    return selectedUserId === user.id
  }

  const selectedRole = getRoleFromTargetLabel(label)
  if (selectedRole) {
    return selectedRole === user.role
  }

  const selectedDepartment = getDepartmentFromTargetLabel(label)
  if (selectedDepartment) {
    return selectedDepartment.toLowerCase() === (user.department ?? '').toLowerCase()
  }

  const normalized = label.toLowerCase()
  const values = [
    user.department,
    user.position,
    user.role,
    user.full_name,
    user.email,
  ]
    .filter((item): item is string => Boolean(item))
    .map(item => item.toLowerCase())

  if (values.some(value => value.includes(normalized) || normalized.includes(value))) {
    return true
  }

  return (ROLE_TARGET_LABELS[user.role ?? ''] ?? [])
    .some(roleLabel => roleLabel.toLowerCase() === normalized)
}

function resolveTargetUsers(activeUsers: UserProfile[], targetAudience: string | null | undefined) {
  const labels = parseTargetAudience(targetAudience)
  if (labels.length === 0) {
    return { users: activeUsers, mode: 'fallback' as const }
  }

  if (labels.some(label => ALL_TARGET_LABELS.has(label.toLowerCase()))) {
    return { users: activeUsers, mode: 'all' as const }
  }

  const matchedUsers = activeUsers.filter(user =>
    labels.some(label => targetLabelMatchesUser(label, user))
  )

  return matchedUsers.length > 0
    ? { users: matchedUsers, mode: 'matched' as const }
    : { users: activeUsers, mode: 'fallback' as const }
}

export default function EducationPlanDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>
  }
) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('education')
  const commonT = useTranslations('common')
  const router = useRouter()
  const [plan, setPlan] = useState<EducationPlanWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [materialLibrary, setMaterialLibrary] = useState<EducationMaterialEntity[]>([])

  // Record form state
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [showMaterialLibrary, setShowMaterialLibrary] = useState(false)
  const [showTargetForm, setShowTargetForm] = useState(false)
  const [recordForm, setRecordForm] = useState({
    attendee_id: '',
    attended_at: '',
    score: '',
    result: 'pending',
    feedback: '',
  })
  const [materialForm, setMaterialForm] = useState({
    title: '',
    material_type: 'document',
    url: '',
    description: '',
  })
  const [materialEditForm, setMaterialEditForm] = useState({
    title: '',
    material_type: 'document',
    url: '',
    description: '',
  })
  const [recordLoading, setRecordLoading] = useState(false)
  const [materialLoading, setMaterialLoading] = useState(false)
  const [materialLibraryLoading, setMaterialLibraryLoading] = useState(false)
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([])
  const [targetLoading, setTargetLoading] = useState(false)
  const [selfCompletionLoading, setSelfCompletionLoading] = useState(false)
  const [selfCompletionFeedback, setSelfCompletionFeedback] = useState('')
  const [targetMode, setTargetMode] = useState<EducationTargetMode>('users')
  const [targetRole, setTargetRole] = useState('')
  const [targetDepartment, setTargetDepartment] = useState('')
  const [targetUserIds, setTargetUserIds] = useState<string[]>([])

  const educationService = useMemo(() => new EducationService(), [])
  const userService = useMemo(() => new UserService(), [])
  const canManageEducation = Boolean(
    currentUser?.role && EDUCATION_MANAGER_ROLES.has(currentUser.role)
  )
  const isMemberUser = currentUser?.role === 'user'

  const trainingSummary = useMemo(() => {
    const records = plan?.records ?? []
    const total = records.length
    const passed = records.filter(record => record.result === 'passed').length
    const failed = records.filter(record => record.result === 'failed').length
    const incomplete = records.filter(record => record.result === 'incomplete').length
    const pending = records.filter(record => !record.result || record.result === 'pending').length
    const scores = records
      .map(record => record.score)
      .filter((score): score is number => typeof score === 'number')
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = plan?.end_date ? new Date(`${plan.end_date}T00:00:00`) : null
    const isOverdue = Boolean(endDate && endDate < today && total > 0 && passed < total)

    let nextAction: EducationNextAction = 'ready'
    if (total === 0) {
      nextAction = 'add_records'
    } else if (isOverdue) {
      nextAction = 'review_overdue'
    } else if (pending + failed + incomplete > 0) {
      nextAction = 'follow_up'
    }

    return {
      total,
      passed,
      pending,
      failed,
      incomplete,
      averageScore,
      completionRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      issueCount: pending + failed + incomplete,
      isOverdue,
      nextAction,
    }
  }, [plan?.end_date, plan?.records])

  const targetCoverage = useMemo(() => {
    const activeUsers = users.filter(user => user.is_active !== false)
    const resolvedTargets = resolveTargetUsers(activeUsers, plan?.target_audience)
    const recordedAttendees = new Set((plan?.records ?? [])
      .map(record => record.attendee_id)
      .filter((id): id is string => Boolean(id)))
    const missingUsers = resolvedTargets.users.filter(user => !recordedAttendees.has(user.id))

    return {
      targetLabel: formatTargetAudience(plan?.target_audience, users),
      mode: resolvedTargets.mode,
      totalTargets: resolvedTargets.users.length,
      recordedTargets: resolvedTargets.users.length - missingUsers.length,
      missingTargets: missingUsers.length,
      missingUsers: missingUsers.slice(0, 5),
    }
  }, [plan?.records, plan?.target_audience, users])

  const myEducationRecord = useMemo(() => {
    if (!currentUser) return null
    return (plan?.records ?? []).find(record => record.attendee_id === currentUser.id) ?? null
  }, [currentUser, plan?.records])

  const isCurrentUserTarget = useMemo(() => {
    if (!currentUser) return false
    return resolveTargetUsers([currentUser], plan?.target_audience).users
      .some(user => user.id === currentUser.id)
  }, [currentUser, plan?.target_audience])

  useEffect(() => {
    const labels = parseTargetAudience(plan?.target_audience)
    const selectedRole = labels.map(getRoleFromTargetLabel).find(Boolean)
    const selectedDepartment = labels.map(getDepartmentFromTargetLabel).find(Boolean)
    const selectedIds = labels
      .map(getUserIdFromTargetLabel)
      .filter((id): id is string => Boolean(id))

    if (labels.some(label => ALL_TARGET_LABELS.has(label.toLowerCase()))) {
      setTargetMode('all')
      setTargetRole('')
      setTargetDepartment('')
      setTargetUserIds([])
      return
    }

    if (selectedRole) {
      setTargetMode('role')
      setTargetRole(selectedRole)
      setTargetDepartment('')
      setTargetUserIds([])
      return
    }

    if (selectedDepartment) {
      setTargetMode('department')
      setTargetRole('')
      setTargetDepartment(selectedDepartment)
      setTargetUserIds([])
      return
    }

    setTargetMode('users')
    setTargetRole('')
    setTargetDepartment('')
    setTargetUserIds(selectedIds)
  }, [plan?.target_audience])

  const materialSummary = useMemo(() => {
    const materials = plan?.materials ?? []
    const byType = materials.reduce<Record<string, number>>((acc, material: EducationMaterialEntity) => {
      const type = material.material_type ?? 'document'
      acc[type] = (acc[type] ?? 0) + 1
      return acc
    }, {})

    return {
      total: materials.length,
      byType,
      hasMaterials: materials.length > 0,
    }
  }, [plan?.materials])

  const activeUsers = useMemo(
    () => users.filter(user => user.is_active !== false),
    [users]
  )

  const availableRoles = useMemo(
    () => Array.from(new Set(activeUsers
      .map(user => user.role)
      .filter(Boolean)))
      .sort(),
    [activeUsers]
  )

  const availableDepartments = useMemo(
    () => Array.from(new Set(activeUsers
      .map(user => user.department)
      .filter((department): department is string => Boolean(department))))
      .sort(),
    [activeUsers]
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const planData = await educationService.getPlanById(id)
      setPlan(planData)

      // Load users for the record form
      const profile = await userService.getCurrentUser()
      setCurrentUser(profile)
      if (profile?.organization_id && profile.role && EDUCATION_MANAGER_ROLES.has(profile.role)) {
        const [orgUsers, orgMaterials] = await Promise.all([
          userService.getOrganizationUsers(profile.organization_id),
          educationService.getMaterials(profile.organization_id),
        ])
        setUsers(orgUsers)
        setMaterialLibrary(orgMaterials)
      } else {
        setUsers(profile ? [profile] : [])
        setMaterialLibrary([])
      }
    } catch (error) {
      console.error('Failed to load education plan:', error)
    } finally {
      setIsLoading(false)
    }
  }, [educationService, userService, id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async () => {
    if (!confirm(t('plans.deleteConfirm'))) return

    setDeleting(true)
    try {
      await educationService.deletePlan(id)
      router.push(`/${locale}/education`)
    } catch (error) {
      console.error('Failed to delete plan:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordForm.attendee_id) return

    setRecordLoading(true)
    try {
      await educationService.createRecord({
        plan_id: id,
        attendee_id: recordForm.attendee_id,
        attended_at: recordForm.attended_at || null,
        score: recordForm.score ? parseInt(recordForm.score, 10) : null,
        result: recordForm.result,
        feedback: recordForm.feedback || null,
      })

      setRecordForm({
        attendee_id: '',
        attended_at: '',
        score: '',
        result: 'pending',
        feedback: '',
      })
      setShowRecordForm(false)
      await loadData()
    } catch (error) {
      console.error('Failed to add record:', error)
    } finally {
      setRecordLoading(false)
    }
  }

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!materialForm.title.trim()) return

    setMaterialLoading(true)
    try {
      await educationService.createMaterialForPlan(id, {
        title: materialForm.title.trim(),
        material_type: materialForm.material_type,
        url: materialForm.url.trim() || null,
        description: materialForm.description.trim() || null,
      })

      setMaterialForm({
        title: '',
        material_type: 'document',
        url: '',
        description: '',
      })
      setShowMaterialForm(false)
      await loadData()
    } catch (error) {
      console.error('Failed to add material:', error)
    } finally {
      setMaterialLoading(false)
    }
  }

  const handleAttachExistingMaterials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedMaterialIds.length === 0) return

    setMaterialLibraryLoading(true)
    try {
      const existingMaterialIds = (plan?.materials ?? []).map(material => material.id)
      await educationService.setPlanMaterials(id, Array.from(new Set([
        ...existingMaterialIds,
        ...selectedMaterialIds,
      ])))
      setSelectedMaterialIds([])
      setShowMaterialLibrary(false)
      await loadData()
    } catch (error) {
      console.error('Failed to attach existing materials:', error)
    } finally {
      setMaterialLibraryLoading(false)
    }
  }

  const handleToggleMaterialLibrary = async () => {
    if (showMaterialLibrary) {
      setShowMaterialLibrary(false)
      setSelectedMaterialIds([])
      return
    }

    if (!currentUser?.organization_id) {
      setShowMaterialLibrary(true)
      return
    }

    setMaterialLibraryLoading(true)
    try {
      const orgMaterials = await educationService.getMaterials(currentUser.organization_id)
      setMaterialLibrary(orgMaterials)
      setSelectedMaterialIds([])
      setShowMaterialLibrary(true)
    } catch (error) {
      console.error('Failed to refresh material library:', error)
      setShowMaterialLibrary(true)
    } finally {
      setMaterialLibraryLoading(false)
    }
  }

  const startEditingMaterial = (material: EducationMaterialEntity) => {
    setEditingMaterialId(material.id)
    setMaterialEditForm({
      title: material.title,
      material_type: material.material_type ?? 'document',
      url: material.url ?? '',
      description: material.description ?? '',
    })
  }

  const handleUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMaterialId || !materialEditForm.title.trim()) return

    setMaterialLoading(true)
    try {
      await educationService.updateMaterial(editingMaterialId, {
        title: materialEditForm.title.trim(),
        material_type: materialEditForm.material_type,
        url: materialEditForm.url.trim() || null,
        description: materialEditForm.description.trim() || null,
      })
      setEditingMaterialId(null)
      await loadData()
    } catch (error) {
      console.error('Failed to update material:', error)
    } finally {
      setMaterialLoading(false)
    }
  }

  const handleDeleteMaterial = async (material: EducationMaterialEntity) => {
    if (!confirm(t('materials.deleteConfirm', { title: material.title }))) return

    setMaterialLoading(true)
    try {
      await educationService.deleteMaterial(material.id)
      setEditingMaterialId(null)
      await loadData()
    } catch (error) {
      console.error('Failed to delete material:', error)
    } finally {
      setMaterialLoading(false)
    }
  }

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault()

    setTargetLoading(true)
    try {
      let targetLabels: string[] = []
      if (targetMode === 'all') {
        targetLabels = ['all']
      } else if (targetMode === 'role' && targetRole) {
        targetLabels = [`role:${targetRole}`]
      } else if (targetMode === 'department' && targetDepartment) {
        targetLabels = [`department:${targetDepartment}`]
      } else if (targetMode === 'users') {
        targetLabels = targetUserIds.map(userId => `user:${userId}`)
      }

      const nextTargetAudience = targetLabels.length > 0
        ? JSON.stringify(targetLabels)
        : null
      await educationService.updatePlan(id, {
        target_audience: nextTargetAudience,
      })
      setShowTargetForm(false)
      await loadData()
    } catch (error) {
      console.error('Failed to update education targets:', error)
    } finally {
      setTargetLoading(false)
    }
  }

  const handleCompleteMyTraining = async (e: React.FormEvent) => {
    e.preventDefault()
    setSelfCompletionLoading(true)
    try {
      await fetch(`/api/education/${id}/my-record`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: selfCompletionFeedback,
        }),
      }).then(async response => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))
          throw new Error(errorBody?.error ?? `API error ${response.status}`)
        }
      })

      setSelfCompletionFeedback('')
      await loadData()
    } catch (error) {
      console.error('Failed to complete my training:', error)
    } finally {
      setSelfCompletionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (!plan) {
    return (
      <DashboardLayout locale={locale}>
        <div className="text-center py-12">
          <p className="text-text-muted">Education plan not found</p>
          <Link
            href={`/${locale}/education`}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            {t('plans.title')}
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${locale}/education`}
              className="text-sm text-text-muted hover:text-text-secondary"
            >
              &larr; {t('plans.title')}
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-text-primary">{plan.title}</h1>
          </div>
          {canManageEducation && (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-surface hover:bg-red-50 disabled:opacity-50"
              >
                {t('plans.delete')}
              </button>
            </div>
          )}
        </div>

        {/* Plan Details */}
        <section
          className="grid gap-4 md:grid-cols-4"
          data-testid="education-training-summary"
        >
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium text-text-muted">{t('stats.totalRecords')}</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{trainingSummary.total}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-green-700">{t('records.resultValues.passed')}</p>
            <p className="mt-2 text-2xl font-semibold text-green-900">{trainingSummary.passed}</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-yellow-700">{t('stats.attentionRecords')}</p>
            <p className="mt-2 text-2xl font-semibold text-yellow-900">{trainingSummary.issueCount}</p>
          </div>
          <div className={`rounded-lg border p-4 shadow-sm ${
            trainingSummary.isOverdue
              ? 'border-red-200 bg-red-50'
              : 'border-blue-200 bg-blue-50'
          }`}>
            <p className={`text-xs font-medium ${
              trainingSummary.isOverdue ? 'text-red-700' : 'text-blue-700'
            }`}>
              {t('stats.completionRate')}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${
              trainingSummary.isOverdue ? 'text-red-900' : 'text-blue-900'
            }`}>
              {trainingSummary.completionRate}%
            </p>
          </div>
        </section>

        <section
          className={`rounded-lg border p-4 ${
            trainingSummary.nextAction === 'ready'
              ? 'border-green-200 bg-green-50'
              : trainingSummary.nextAction === 'review_overdue'
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-amber-50'
          }`}
          data-testid="education-next-action"
        >
          <p className="text-sm font-semibold text-text-primary">
            {t(`nextAction.${trainingSummary.nextAction}.title`)}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {t(`nextAction.${trainingSummary.nextAction}.description`, {
              total: trainingSummary.total,
              passed: trainingSummary.passed,
              issues: trainingSummary.issueCount,
              completionRate: trainingSummary.completionRate,
            })}
          </p>
          {trainingSummary.averageScore !== null && (
            <p className="mt-2 text-xs text-text-secondary">
              {t('stats.averageScore')}: {trainingSummary.averageScore}
            </p>
          )}
        </section>

        <section
          className="rounded-lg border border-border bg-surface p-4 shadow-sm"
          data-testid="education-target-coverage"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {t('targetCoverage.title')}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {targetCoverage.targetLabel
                  ? t('targetCoverage.descriptionWithLabel', { label: targetCoverage.targetLabel })
                  : t('targetCoverage.descriptionFallback')}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-app px-3 py-2">
                  <p className="text-xs text-text-muted">{t('targetCoverage.total')}</p>
                  <p
                    className="text-lg font-semibold text-text-primary"
                    data-testid="education-target-total"
                  >
                    {targetCoverage.totalTargets}
                  </p>
                </div>
                <div className="rounded-md bg-green-50 px-3 py-2">
                  <p className="text-xs text-green-600">{t('targetCoverage.recorded')}</p>
                  <p
                    className="text-lg font-semibold text-green-900"
                    data-testid="education-target-recorded"
                  >
                    {targetCoverage.recordedTargets}
                  </p>
                </div>
                <div className="rounded-md bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-600">{t('targetCoverage.missing')}</p>
                  <p
                    className="text-lg font-semibold text-amber-900"
                    data-testid="education-target-missing"
                  >
                    {targetCoverage.missingTargets}
                  </p>
                </div>
              </div>
              {canManageEducation && (
                <button
                  type="button"
                  onClick={() => setShowTargetForm(!showTargetForm)}
                  className="inline-flex w-fit items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated"
                >
                  {t('targetAssignment.edit')}
                </button>
              )}
            </div>
          </div>
          {canManageEducation && showTargetForm && (
            <form
              onSubmit={handleSaveTargets}
              className="mt-4 rounded-lg border border-border bg-surface-elevated p-4"
              data-testid="education-target-assignment-form"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {t('targetAssignment.title')}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t('targetAssignment.description')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {(['all', 'role', 'department', 'users'] as EducationTargetMode[]).map(mode => (
                  <label
                    key={mode}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      targetMode === mode
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="education-target-mode"
                      value={mode}
                      checked={targetMode === mode}
                      onChange={() => setTargetMode(mode)}
                      className="mr-2 h-4 w-4 border-border text-indigo-600"
                    />
                    {t(`targetAssignment.modes.${mode}`)}
                  </label>
                ))}
              </div>

              {targetMode === 'all' && (
                <p className="mt-3 rounded-md border border-indigo-100 bg-surface px-3 py-2 text-sm text-text-secondary">
                  {t('targetAssignment.allDescription', { count: activeUsers.length })}
                </p>
              )}

              {targetMode === 'role' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('targetAssignment.roleLabel')}
                  </label>
                  <select
                    aria-label={t('targetAssignment.roleLabel')}
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <option value="">--</option>
                    {availableRoles.map(role => (
                      <option key={role} value={role}>
                        {ROLE_DISPLAY_LABELS[role] ?? role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetMode === 'department' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('targetAssignment.departmentLabel')}
                  </label>
                  <select
                    aria-label={t('targetAssignment.departmentLabel')}
                    value={targetDepartment}
                    onChange={(e) => setTargetDepartment(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <option value="">--</option>
                    {availableDepartments.map(department => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetMode === 'users' && (
                <>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const activeIds = activeUsers.map(user => user.id)
                        setTargetUserIds(activeIds)
                      }}
                      className="w-fit text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {t('targetAssignment.selectAll')}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {activeUsers.map(user => (
                      <label
                        key={user.id}
                        className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-border text-indigo-600"
                          checked={targetUserIds.includes(user.id)}
                          onChange={(e) => {
                            setTargetUserIds(prev =>
                              e.target.checked
                                ? Array.from(new Set([...prev, user.id]))
                                : prev.filter(id => id !== user.id)
                            )
                          }}
                        />
                        <span>
                          <span className="block font-medium text-text-primary">
                            {user.full_name || user.email}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {[user.department, user.role].filter(Boolean).join(' / ') || user.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTargetForm(false)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-surface-elevated"
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={
                    targetLoading
                    || (targetMode === 'role' && !targetRole)
                    || (targetMode === 'department' && !targetDepartment)
                  }
                  className="px-3 py-1.5 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {targetLoading ? t('form.updating') : t('targetAssignment.save')}
                </button>
              </div>
            </form>
          )}
          {targetCoverage.missingUsers.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-text-muted">
                {t('targetCoverage.missingPreview')}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {targetCoverage.missingUsers.map(user => (
                  <li
                    key={user.id}
                    className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800"
                  >
                    {user.full_name || user.email}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="bg-surface shadow rounded-lg p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-text-muted">{t('form.status')}</h3>
              <span
                className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  STATUS_COLORS[plan.status ?? 'draft'] ?? STATUS_COLORS.draft
                }`}
              >
                {t(`status.${plan.status ?? 'draft'}`)}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-muted">{t('form.targetAudience')}</h3>
              <p className="mt-1 text-sm text-text-primary">
                {formatTargetAudience(plan.target_audience, users) ?? '-'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-muted">{t('form.startDate')}</h3>
              <p className="mt-1 text-sm text-text-primary">{plan.start_date ?? '-'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-muted">{t('form.endDate')}</h3>
              <p className="mt-1 text-sm text-text-primary">{plan.end_date ?? '-'}</p>
            </div>
          </div>
          {plan.description && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-text-muted">{t('form.description')}</h3>
              <p className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{plan.description}</p>
            </div>
          )}
          {plan.created_by_user && (
            <div className="mt-4 text-xs text-text-muted">
              Created by {plan.created_by_user.full_name} ({plan.created_by_user.email})
            </div>
          )}
        </div>

        {/* Materials */}
        <div className="bg-surface shadow rounded-lg p-6" data-testid="education-materials-section">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-text-primary">{t('materials.title')}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {t('materials.summary', { total: materialSummary.total })}
              </p>
            </div>
            {canManageEducation && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={handleToggleMaterialLibrary}
                  disabled={materialLibraryLoading}
                  className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
                >
                  {materialLibraryLoading ? t('form.updating') : t('materials.attachExisting')}
                </button>
                <button
                  onClick={() => setShowMaterialForm(!showMaterialForm)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  {t('materials.add')}
                </button>
              </div>
            )}
          </div>

          {canManageEducation && showMaterialLibrary && (
            <form
              onSubmit={handleAttachExistingMaterials}
              className="mb-6 rounded-lg border border-border bg-surface-elevated p-4"
              data-testid="education-material-library-form"
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-text-primary">{t('materials.attachExistingTitle')}</p>
                <p className="text-xs text-text-muted">{t('materials.attachExistingDescription')}</p>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {materialLibrary
                  .filter(material => !(plan.materials ?? []).some(attached => attached.id === material.id))
                  .map(material => (
                    <label
                      key={material.id}
                      className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border text-blue-600"
                        checked={selectedMaterialIds.includes(material.id)}
                        onChange={(e) => {
                          setSelectedMaterialIds(prev =>
                            e.target.checked
                              ? Array.from(new Set([...prev, material.id]))
                              : prev.filter(id => id !== material.id)
                          )
                        }}
                      />
                      <span>
                        <span className="block font-medium text-text-primary">{material.title}</span>
                        <span className="block text-xs text-text-muted">
                          {material.material_type ?? 'document'}
                          {material.url ? ` / ${material.url}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
              {materialLibrary.filter(material => !(plan.materials ?? []).some(attached => attached.id === material.id)).length === 0 && (
                <p className="mt-3 text-sm text-text-muted">{t('materials.noReusableMaterials')}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMaterialLibrary(false)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-surface-elevated"
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={materialLibraryLoading || selectedMaterialIds.length === 0}
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {materialLibraryLoading ? t('form.updating') : t('materials.attachSelected')}
                </button>
              </div>
            </form>
          )}

          {canManageEducation && showMaterialForm && (
            <form
              onSubmit={handleAddMaterial}
              className="mb-6 rounded-lg bg-surface-elevated p-4 space-y-4"
              data-testid="education-material-form"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('materials.name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    aria-label={t('materials.name')}
                    value={materialForm.title}
                    onChange={(e) =>
                      setMaterialForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('materials.type')}
                  </label>
                  <select
                    aria-label={t('materials.type')}
                    value={materialForm.material_type}
                    onChange={(e) =>
                      setMaterialForm((prev) => ({ ...prev, material_type: e.target.value }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                  >
                    <option value="document">{t('materials.typeValues.document')}</option>
                    <option value="video">{t('materials.typeValues.video')}</option>
                    <option value="slide">{t('materials.typeValues.slide')}</option>
                    <option value="link">{t('materials.typeValues.link')}</option>
                    <option value="other">{t('materials.typeValues.other')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {t('materials.url')}
                </label>
                <input
                  aria-label={t('materials.url')}
                  value={materialForm.url}
                  onChange={(e) =>
                    setMaterialForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="/sample/education/security-awareness.pdf"
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {t('materials.description')}
                </label>
                <textarea
                  aria-label={t('materials.description')}
                  rows={2}
                  value={materialForm.description}
                  onChange={(e) =>
                    setMaterialForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMaterialForm(false)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-surface-elevated"
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={materialLoading || !materialForm.title.trim()}
                  className="px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {materialLoading ? t('form.creating') : t('form.save')}
                </button>
              </div>
            </form>
          )}

          {plan.materials && plan.materials.length > 0 ? (
            <ul className="divide-y divide-border">
              {plan.materials.map((material) => (
                <li key={material.id} className="py-3">
                  {editingMaterialId === material.id ? (
                    <form
                      onSubmit={handleUpdateMaterial}
                      className="rounded-lg bg-surface-elevated p-4 space-y-4"
                      data-testid="education-material-edit-form"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary">
                            {t('materials.name')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            aria-label={t('materials.name')}
                            value={materialEditForm.title}
                            onChange={(e) => setMaterialEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-secondary">
                            {t('materials.type')}
                          </label>
                          <select
                            aria-label={t('materials.type')}
                            value={materialEditForm.material_type}
                            onChange={(e) => setMaterialEditForm(prev => ({ ...prev, material_type: e.target.value }))}
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                          >
                            <option value="document">{t('materials.typeValues.document')}</option>
                            <option value="video">{t('materials.typeValues.video')}</option>
                            <option value="slide">{t('materials.typeValues.slide')}</option>
                            <option value="link">{t('materials.typeValues.link')}</option>
                            <option value="other">{t('materials.typeValues.other')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary">
                          {t('materials.url')}
                        </label>
                        <input
                          aria-label={t('materials.url')}
                          value={materialEditForm.url}
                          onChange={(e) => setMaterialEditForm(prev => ({ ...prev, url: e.target.value }))}
                          className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary">
                          {t('materials.description')}
                        </label>
                        <textarea
                          aria-label={t('materials.description')}
                          rows={2}
                          value={materialEditForm.description}
                          onChange={(e) => setMaterialEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingMaterialId(null)}
                          className="px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-surface-elevated"
                        >
                          {t('form.cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={materialLoading || !materialEditForm.title.trim()}
                          className="px-3 py-1.5 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {materialLoading ? t('form.updating') : t('materials.update')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{material.title}</p>
                        <p className="text-xs text-text-muted">
                          {material.material_type ?? 'document'}
                          {material.url && (
                            <>
                              {' - '}
                              <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {material.url}
                              </a>
                            </>
                          )}
                        </p>
                        {material.description && (
                          <p className="mt-1 text-xs text-text-muted">{material.description}</p>
                        )}
                      </div>
                      {canManageEducation && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingMaterial(material)}
                            className="rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                          >
                            {t('materials.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMaterial(material)}
                            className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            {t('materials.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">{t('materials.empty')}</p>
          )}
        </div>

        {/* Records */}
        {isMemberUser && (
          <section
            className={`rounded-lg border p-5 shadow-sm ${
              myEducationRecord?.result === 'passed'
                ? 'border-green-200 bg-green-50'
                : 'border-blue-200 bg-surface'
            }`}
            data-testid="education-my-completion"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-medium text-text-primary">
                  {t('myCompletion.title')}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {myEducationRecord?.result === 'passed'
                    ? t('myCompletion.completedDescription')
                    : isCurrentUserTarget
                      ? t('myCompletion.description')
                      : t('myCompletion.notTargetDescription')}
                </p>
                {myEducationRecord?.completed_at && (
                  <p className="mt-2 text-xs text-text-muted">
                    {t('myCompletion.completedAt', {
                      date: new Date(myEducationRecord.completed_at).toLocaleString(locale),
                    })}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                  myEducationRecord?.result === 'passed'
                    ? RESULT_COLORS.passed
                    : RESULT_COLORS.pending
                }`}
              >
                {myEducationRecord?.result === 'passed'
                  ? t('records.resultValues.passed')
                  : t('records.resultValues.pending')}
              </span>
            </div>

            {isCurrentUserTarget && myEducationRecord?.result !== 'passed' && (
              <form
                onSubmit={handleCompleteMyTraining}
                className="mt-4 space-y-3"
                data-testid="education-my-completion-form"
              >
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('myCompletion.feedback')}
                  </label>
                  <textarea
                    aria-label={t('myCompletion.feedback')}
                    rows={2}
                    value={selfCompletionFeedback}
                    onChange={(e) => setSelfCompletionFeedback(e.target.value)}
                    placeholder={t('myCompletion.feedbackPlaceholder')}
                    className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={selfCompletionLoading}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {selfCompletionLoading
                    ? t('myCompletion.saving')
                    : t('myCompletion.complete')}
                </button>
              </form>
            )}
          </section>
        )}

        <div className="bg-surface shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">{t('records.title')}</h2>
            {canManageEducation && (
              <button
                onClick={() => setShowRecordForm(!showRecordForm)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {t('records.add')}
              </button>
            )}
          </div>

          {/* Add Record Form */}
          {canManageEducation && showRecordForm && (
            <form onSubmit={handleAddRecord} className="mb-6 p-4 bg-surface-elevated rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('records.attendee')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={recordForm.attendee_id}
                    onChange={(e) =>
                      setRecordForm((prev) => ({ ...prev, attendee_id: e.target.value }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                    required
                  >
                    <option value="">--</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('records.attendedAt')}
                  </label>
                  <input
                    type="datetime-local"
                    value={recordForm.attended_at}
                    onChange={(e) =>
                      setRecordForm((prev) => ({ ...prev, attended_at: e.target.value }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('records.score')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={recordForm.score}
                    onChange={(e) =>
                      setRecordForm((prev) => ({ ...prev, score: e.target.value }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {t('records.result')}
                  </label>
                  <select
                    value={recordForm.result}
                    onChange={(e) =>
                      setRecordForm((prev) => ({ ...prev, result: e.target.value }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                  >
                    <option value="pending">{t('records.resultValues.pending')}</option>
                    <option value="passed">{t('records.resultValues.passed')}</option>
                    <option value="failed">{t('records.resultValues.failed')}</option>
                    <option value="incomplete">{t('records.resultValues.incomplete')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {t('records.feedback')}
                </label>
                <textarea
                  rows={2}
                  value={recordForm.feedback}
                  onChange={(e) =>
                    setRecordForm((prev) => ({ ...prev, feedback: e.target.value }))
                  }
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordForm(false)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-surface-elevated"
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={recordLoading}
                  className="px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {recordLoading ? t('form.creating') : t('form.save')}
                </button>
              </div>
            </form>
          )}

          {/* Records Table */}
          {plan.records && plan.records.length > 0 ? (
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">
                    {t('records.attendee')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">
                    {t('records.attendedAt')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">
                    {t('records.score')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">
                    {t('records.result')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">
                    {t('records.feedback')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plan.records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-2 text-sm text-text-primary">
                      {record.attendee
                        ? `${record.attendee.full_name} (${record.attendee.email})`
                        : record.attendee_id ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-text-muted">
                      {record.attended_at
                        ? new Date(record.attended_at).toLocaleString(locale)
                        : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-text-muted">
                      {record.score != null ? record.score : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          RESULT_COLORS[record.result ?? 'pending'] ?? RESULT_COLORS.pending
                        }`}
                      >
                        {t(`records.resultValues.${record.result ?? 'pending'}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-text-muted max-w-xs truncate">
                      {record.feedback ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-text-muted">{t('records.empty')}</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
