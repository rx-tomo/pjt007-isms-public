'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'
import {
  AuditService,
  type Nonconformity,
  type NonconformityStatus,
  type NonconformityType,
  type CorrectiveAction,
  type CorrectiveActionStatus,
  type FollowUpRecord
} from '@/lib/services/audit'
import { UserService, type UserProfile } from '@/lib/services/user'

interface ToastState {
  type: 'success' | 'error'
  message: string
}

const STATUS_OPTIONS: NonconformityStatus[] = ['open', 'in_progress', 'resolved', 'verified', 'closed']
const TYPE_OPTIONS: NonconformityType[] = ['major', 'minor']
const CORRECTIVE_STATUS_OPTIONS: CorrectiveActionStatus[] = ['planned', 'in_progress', 'completed', 'verified']

interface CorrectiveActionForm {
  description: string
  plannedDate: string
}

interface FollowUpForm {
  title: string
  description: string
  dueDate: string
  assignedTo: string
}

function formatUserName(user?: { full_name?: string | null; full_name_en?: string | null; email?: string | null } | null) {
  return user?.full_name || user?.full_name_en || user?.email || '—'
}

export default function NonconformitiesPage() {
  const params = useParams<{ locale: string }>()
  const locale = params.locale ?? 'ja'
  const t = useTranslations('audit')
  const { isAuthorized, isLoading: accessLoading, error: accessError, profile } = useAuditAccess()
  const [nonconformities, setNonconformities] = useState<Nonconformity[]>([])
  const [followUpsByNonconformity, setFollowUpsByNonconformity] = useState<Record<string, FollowUpRecord[]>>({})
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | NonconformityStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | NonconformityType>('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingActionId, setSavingActionId] = useState<string | null>(null)
  const [submittingClosureActionId, setSubmittingClosureActionId] = useState<string | null>(null)
  const [creatingActionFor, setCreatingActionFor] = useState<string | null>(null)
  const [creatingFollowUpFor, setCreatingFollowUpFor] = useState<string | null>(null)
  const [newActionForms, setNewActionForms] = useState<Record<string, CorrectiveActionForm>>({})
  const [followUpForms, setFollowUpForms] = useState<Record<string, FollowUpForm>>({})
  const [toast, setToast] = useState<ToastState | null>(null)

  const auditService = useMemo(() => new AuditService(), [])
  const userService = useMemo(() => new UserService(), [])
  const organizationId = profile?.organization_id

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await auditService.getNonconformities({ organizationId })
      setNonconformities(data)
      const [users, followUpEntries] = await Promise.all([
        userService.getOrganizationUsers(organizationId),
        Promise.all(data.map(async (nc) => [nc.id, await auditService.getFollowUpRecordsByNonconformity(nc.id)] as const))
      ])
      setAvailableUsers(users)
      setFollowUpsByNonconformity(Object.fromEntries(followUpEntries))
    } catch (err) {
      console.error('[AuditNonconformities] Failed to load nonconformities', err)
      setToast({ type: 'error', message: t('nonconformities.toast.loadFailed') })
    } finally {
      setLoading(false)
    }
  }, [auditService, organizationId, t, userService])

  useEffect(() => {
    if (accessLoading) return
    if (!isAuthorized) {
      setLoading(false)
      return
    }
    loadData()
  }, [accessLoading, isAuthorized, loadData])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const filteredNonconformities = useMemo(() => {
    return nonconformities.filter(nc => {
      const matchStatus = statusFilter === 'all' || nc.status === statusFilter
      const matchType = typeFilter === 'all' || nc.type === typeFilter
      return matchStatus && matchType
    })
  }, [nonconformities, statusFilter, typeFilter])

  const handleUpdate = async (nc: Nonconformity) => {
    setSavingId(nc.id)
    try {
      const updated = await auditService.updateNonconformity(nc.id, {
        status: nc.status,
        root_cause: nc.root_cause || undefined,
        corrective_action: nc.corrective_action || undefined,
        preventive_action: nc.preventive_action || undefined,
        due_date: nc.due_date || undefined,
        resolution_date: nc.resolution_date || undefined,
        verification_date: nc.verification_date || undefined
      })
      setNonconformities(prev => prev.map(item => (item.id === nc.id ? { ...item, ...updated } : item)))
      setToast({ type: 'success', message: t('nonconformities.toast.saveSuccess') })
    } catch (err) {
      console.error('[AuditNonconformities] Failed to update nonconformity', err)
      setToast({ type: 'error', message: t('nonconformities.toast.saveFailed') })
    } finally {
      setSavingId(null)
    }
  }

  const handleFieldChange = (
    ncId: string,
    field: keyof Nonconformity,
    value: Nonconformity[keyof Nonconformity]
  ) => {
    setNonconformities(prev =>
      prev.map(item => (item.id === ncId ? { ...item, [field]: value } : item))
    )
  }

  const handleCorrectiveActionFieldChange = (
    ncId: string,
    actionId: string,
    field: keyof CorrectiveAction,
    value: CorrectiveAction[keyof CorrectiveAction]
  ) => {
    setNonconformities(prev =>
      prev.map(item =>
        item.id === ncId
          ? {
              ...item,
              corrective_actions: (item.corrective_actions || []).map(action =>
                action.id === actionId ? { ...action, [field]: value } : action
              )
            }
          : item
      )
    )
  }

  const handleNewActionFormChange = (
    ncId: string,
    field: keyof CorrectiveActionForm,
    value: string
  ) => {
    setNewActionForms(prev => ({
      ...prev,
      [ncId]: {
        description: field === 'description' ? value : prev[ncId]?.description || '',
        plannedDate: field === 'plannedDate' ? value : prev[ncId]?.plannedDate || ''
      }
    }))
  }

  const handleCreateAction = async (nc: Nonconformity) => {
    const form = newActionForms[nc.id] || { description: '', plannedDate: '' }
    if (!form.description.trim()) {
      setToast({ type: 'error', message: t('nonconformities.correctiveActions.toast.descriptionRequired') })
      return
    }

    setCreatingActionFor(nc.id)
    try {
      const created = await auditService.createCorrectiveAction({
        nonconformity_id: nc.id,
        action_description: form.description.trim(),
        status: 'planned',
        planned_date: form.plannedDate ? form.plannedDate : undefined
      })
      setNonconformities(prev =>
        prev.map(item =>
          item.id === nc.id
            ? {
                ...item,
                corrective_actions: [...(item.corrective_actions || []), created]
              }
            : item
        )
      )
      setNewActionForms(prev => ({
        ...prev,
        [nc.id]: { description: '', plannedDate: '' }
      }))
      setToast({ type: 'success', message: t('nonconformities.correctiveActions.toast.createSuccess') })
    } catch (err) {
      console.error('[AuditNonconformities] Failed to create corrective action', err)
      setToast({ type: 'error', message: t('nonconformities.correctiveActions.toast.createFailed') })
    } finally {
      setCreatingActionFor(null)
    }
  }

  const handleFollowUpFormChange = (
    ncId: string,
    field: keyof FollowUpForm,
    value: string
  ) => {
    setFollowUpForms(prev => ({
      ...prev,
      [ncId]: {
        title: field === 'title' ? value : prev[ncId]?.title || '',
        description: field === 'description' ? value : prev[ncId]?.description || '',
        dueDate: field === 'dueDate' ? value : prev[ncId]?.dueDate || '',
        assignedTo: field === 'assignedTo' ? value : prev[ncId]?.assignedTo || ''
      }
    }))
  }

  const handleCreateFollowUp = async (nc: Nonconformity) => {
    const form = followUpForms[nc.id] || { title: '', description: '', dueDate: '' }
    if (!form.title.trim()) {
      setToast({ type: 'error', message: t('followUp.toast.titleRequired') })
      return
    }

    setCreatingFollowUpFor(nc.id)
    try {
      const created = await auditService.createFollowUpRecord({
        auditPlanId: '',
        nonconformityId: nc.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignedTo: form.assignedTo || undefined,
        dueDate: form.dueDate || undefined
      })
      const assignedUser = availableUsers.find(user => user.id === form.assignedTo)
      const createdWithAssignee = assignedUser
        ? {
            ...created,
            assigned_user: {
              id: assignedUser.id,
              full_name: assignedUser.full_name,
              email: assignedUser.email
            }
          }
        : created
      setFollowUpsByNonconformity(prev => ({
        ...prev,
        [nc.id]: [createdWithAssignee, ...(prev[nc.id] || [])]
      }))
      setFollowUpForms(prev => ({
        ...prev,
        [nc.id]: { title: '', description: '', dueDate: '', assignedTo: '' }
      }))
      setToast({ type: 'success', message: t('followUp.toast.createSuccess') })
    } catch (err) {
      console.error('[AuditNonconformities] Failed to create follow-up', err)
      setToast({ type: 'error', message: t('followUp.toast.createFailed') })
    } finally {
      setCreatingFollowUpFor(null)
    }
  }

  const handleUpdateAction = async (ncId: string, action: CorrectiveAction) => {
    setSavingActionId(action.id)
    try {
      const updated = await auditService.updateCorrectiveAction(action.id, {
        action_description: action.action_description,
        status: action.status,
        planned_date: action.planned_date || undefined,
        completion_date: action.completion_date || undefined,
        effectiveness_review: action.effectiveness_review || undefined
      })
      setNonconformities(prev =>
        prev.map(item =>
          item.id === ncId
            ? {
                ...item,
                corrective_actions: (item.corrective_actions || []).map(existing =>
                  existing.id === action.id ? { ...existing, ...updated } : existing
                )
              }
            : item
        )
      )
      setToast({ type: 'success', message: t('nonconformities.correctiveActions.toast.updateSuccess') })
    } catch (err) {
      console.error('[AuditNonconformities] Failed to update corrective action', err)
      setToast({ type: 'error', message: t('nonconformities.correctiveActions.toast.updateFailed') })
    } finally {
      setSavingActionId(null)
    }
  }

  const handleSubmitClosureApproval = async (action: CorrectiveAction) => {
    setSubmittingClosureActionId(action.id)
    try {
      await auditService.submitCorrectiveActionClosureApproval(action.id)
      setToast({ type: 'success', message: t('nonconformities.correctiveActions.toast.submitClosureSuccess') })
      await loadData()
    } catch (err) {
      console.error('[AuditNonconformities] Failed to submit corrective action closure approval', err)
      setToast({ type: 'error', message: t('nonconformities.correctiveActions.toast.submitClosureFailed') })
    } finally {
      setSubmittingClosureActionId(null)
    }
  }

  return (
    <DashboardLayout locale={locale}>
      {!isAuthorized && !accessLoading ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-900">
          <h3 className="text-sm font-semibold">{t('accessDenied.title')}</h3>
          <p className="mt-2 text-sm">
            {accessError === 'permission_fetch_failed'
              ? t('accessDenied.permissionFetchFailed')
              : t('accessDenied.description')}
          </p>
        </div>
      ) : null}

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('nonconformities.title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('nonconformities.description')}</p>
      </div>

      {toast && (
        <div
          role="status"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center text-text-muted">{t('nonconformities.loading')}</div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-text-primary">{t('nonconformities.filters.title')}</h2>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-medium">{t('nonconformities.filters.status')}</span>
                  <select
                    className="rounded-md border border-border px-3 py-2"
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
                  >
                    <option value="all">{t('nonconformities.filters.all')}</option>
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {t(`nonconformities.status.${status}` as const)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-medium">{t('nonconformities.filters.type')}</span>
                  <select
                    className="rounded-md border border-border px-3 py-2"
                    value={typeFilter}
                    onChange={event => setTypeFilter(event.target.value as typeof typeFilter)}
                  >
                    <option value="all">{t('nonconformities.filters.all')}</option>
                    {TYPE_OPTIONS.map(type => (
                      <option key={type} value={type}>
                        {t(`nonconformities.type.${type}` as const)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            {filteredNonconformities.length === 0 ? (
              <div className="text-center text-text-muted">{t('nonconformities.empty')}</div>
            ) : (
              <div className="space-y-4">
                {filteredNonconformities.map(nc => (
                  <div
                    key={nc.id}
                    data-testid={`nonconformity-card-${nc.id}`}
                    className="rounded-md border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          {t(`nonconformities.type.${nc.type}` as const)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{nc.description}</p>
                        <p className="mt-2 text-xs text-amber-800">
                          {t('nonconformities.labels.relatedChecklist', {
                            clause: (nc as any)?.audit_checklist?.requirement?.clause_number || '—'
                          })}
                        </p>
                        <div
                          data-testid={`nonconformity-capa-boundary-${nc.id}`}
                          className="mt-3 rounded-md border border-amber-300 bg-surface/80 px-3 py-2 text-xs text-amber-900"
                        >
                          <p className="font-semibold">{t('nonconformities.capaBoundary.title')}</p>
                          <p className="mt-1">{t('nonconformities.capaBoundary.description')}</p>
                          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                              <dt className="font-medium">{t('nonconformities.capaBoundary.ncNumber')}</dt>
                              <dd>{nc.nc_number}</dd>
                            </div>
                            <div>
                              <dt className="font-medium">{t('nonconformities.fields.responsible')}</dt>
                              <dd>{formatUserName(nc.responsible)}</dd>
                            </div>
                            <div>
                              <dt className="font-medium">{t('nonconformities.fields.rootCause')}</dt>
                              <dd>{nc.root_cause || '—'}</dd>
                            </div>
                            <div>
                              <dt className="font-medium">{t('nonconformities.fields.preventiveAction')}</dt>
                              <dd>{nc.preventive_action || '—'}</dd>
                            </div>
                          </dl>
                        </div>
                        <div
                          data-testid={`nonconformity-follow-up-summary-${nc.id}`}
                          className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
                        >
                          <p className="font-semibold">{t('nonconformities.followUpSummary.title')}</p>
                          {(followUpsByNonconformity[nc.id] || []).length === 0 ? (
                            <p className="mt-1">{t('nonconformities.followUpSummary.empty')}</p>
                          ) : (
                            <ul className="mt-2 space-y-2">
                              {(followUpsByNonconformity[nc.id] || []).map(record => (
                                <li key={record.id} data-testid={`nonconformity-follow-up-${record.id}`}>
                                  <span className="font-medium">{record.title}</span>
                                  <span className="ml-2">
                                    {t('nonconformities.followUpSummary.status', {
                                      status: t(`followUp.${record.status}` as const)
                                    })}
                                  </span>
                                  <span className="ml-2">
                                    {t('nonconformities.followUpSummary.dueDate', {
                                      date: record.due_date || '—'
                                    })}
                                  </span>
                                  <span className="ml-2">
                                    {t('nonconformities.followUpSummary.assignee', {
                                      name: formatUserName(record.assigned_user)
                                    })}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-3 rounded-md border border-blue-200 bg-surface p-3">
                            <p className="font-semibold">{t('nonconformities.followUpSummary.createTitle')}</p>
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              <label className="flex flex-col">
                                <span className="mb-1 font-medium">{t('followUp.recordTitle')}</span>
                                <input
                                  data-testid={`nonconformity-follow-up-title-${nc.id}`}
                                  className="rounded-md border border-blue-200 px-3 py-2"
                                  value={followUpForms[nc.id]?.title || ''}
                                  onChange={event => handleFollowUpFormChange(nc.id, 'title', event.target.value)}
                                  placeholder={t('followUp.titlePlaceholder')}
                                />
                              </label>
                              <label className="flex flex-col">
                                <span className="mb-1 font-medium">{t('followUp.dueDate')}</span>
                                <input
                                  data-testid={`nonconformity-follow-up-due-date-${nc.id}`}
                                  type="date"
                                  className="rounded-md border border-blue-200 px-3 py-2"
                                  value={followUpForms[nc.id]?.dueDate || ''}
                                  onChange={event => handleFollowUpFormChange(nc.id, 'dueDate', event.target.value)}
                                />
                              </label>
                              <label className="flex flex-col">
                                <span className="mb-1 font-medium">{t('followUp.assignedTo')}</span>
                                <select
                                  data-testid={`nonconformity-follow-up-assigned-to-${nc.id}`}
                                  className="rounded-md border border-blue-200 px-3 py-2"
                                  value={followUpForms[nc.id]?.assignedTo || ''}
                                  onChange={event => handleFollowUpFormChange(nc.id, 'assignedTo', event.target.value)}
                                >
                                  <option value="">{t('followUp.selectAssignee')}</option>
                                  {availableUsers.map(user => (
                                    <option key={user.id} value={user.id}>
                                      {user.full_name || user.email}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col md:col-span-2">
                                <span className="mb-1 font-medium">{t('followUp.description')}</span>
                                <textarea
                                  data-testid={`nonconformity-follow-up-description-${nc.id}`}
                                  className="min-h-[64px] rounded-md border border-blue-200 px-3 py-2"
                                  value={followUpForms[nc.id]?.description || ''}
                                  onChange={event => handleFollowUpFormChange(nc.id, 'description', event.target.value)}
                                  placeholder={t('followUp.descriptionPlaceholder')}
                                />
                              </label>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                data-testid={`nonconformity-follow-up-create-${nc.id}`}
                                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleCreateFollowUp(nc)}
                                disabled={creatingFollowUpFor === nc.id}
                              >
                                {creatingFollowUpFor === nc.id
                                  ? t('followUp.creating')
                                  : t('followUp.addNew')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
                          {t(`nonconformities.status.${nc.status}` as const)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <label className="flex flex-col text-sm text-amber-900 md:col-span-3">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.rootCause')}</span>
                        <textarea
                          data-testid={`nonconformity-root-cause-${nc.id}`}
                          className="min-h-[72px] rounded-md border border-amber-300 bg-surface px-3 py-2"
                          value={nc.root_cause || ''}
                          onChange={event => handleFieldChange(nc.id, 'root_cause', event.target.value || null)}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-amber-900 md:col-span-3">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.correctiveAction')}</span>
                        <textarea
                          data-testid={`nonconformity-corrective-action-${nc.id}`}
                          className="min-h-[72px] rounded-md border border-amber-300 bg-surface px-3 py-2"
                          value={nc.corrective_action || ''}
                          onChange={event => handleFieldChange(nc.id, 'corrective_action', event.target.value || null)}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-amber-900 md:col-span-3">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.preventiveAction')}</span>
                        <textarea
                          data-testid={`nonconformity-preventive-action-${nc.id}`}
                          className="min-h-[72px] rounded-md border border-amber-300 bg-surface px-3 py-2"
                          value={nc.preventive_action || ''}
                          onChange={event => handleFieldChange(nc.id, 'preventive_action', event.target.value || null)}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-amber-900">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.status')}</span>
                        <select
                          data-testid={`nonconformity-status-${nc.id}`}
                          className="rounded-md border border-amber-300 bg-surface px-3 py-2"
                          value={nc.status}
                          onChange={event => handleFieldChange(nc.id, 'status', event.target.value as NonconformityStatus)}
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>
                              {t(`nonconformities.status.${status}` as const)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col text-sm text-amber-900">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.dueDate')}</span>
                        <input
                          data-testid={`nonconformity-due-date-${nc.id}`}
                          type="date"
                          className="rounded-md border border-amber-300 px-3 py-2"
                          value={nc.due_date ? nc.due_date.substring(0, 10) : ''}
                          onChange={event => handleFieldChange(nc.id, 'due_date', event.target.value || null)}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-amber-900">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.resolutionDate')}</span>
                        <input
                          data-testid={`nonconformity-resolution-date-${nc.id}`}
                          type="date"
                          className="rounded-md border border-amber-300 px-3 py-2"
                          value={nc.resolution_date ? nc.resolution_date.substring(0, 10) : ''}
                          onChange={event => handleFieldChange(nc.id, 'resolution_date', event.target.value || null)}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-amber-900">
                        <span className="mb-1 font-medium">{t('nonconformities.fields.verificationDate')}</span>
                        <input
                          data-testid={`nonconformity-verification-date-${nc.id}`}
                          type="date"
                          className="rounded-md border border-amber-300 px-3 py-2"
                          value={nc.verification_date ? nc.verification_date.substring(0, 10) : ''}
                          onChange={event => handleFieldChange(nc.id, 'verification_date', event.target.value || null)}
                        />
                      </label>
                  </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        data-testid={`nonconformity-save-${nc.id}`}
                        className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleUpdate(nc)}
                        disabled={savingId === nc.id}
                      >
                        {savingId === nc.id
                          ? t('nonconformities.actions.saving')
                          : t('nonconformities.actions.save')}
                      </button>
                    </div>

                    <div className="mt-6 rounded-md border border-amber-200 bg-surface p-4 shadow-inner">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-amber-900">
                          {t('nonconformities.correctiveActions.title')}
                        </h3>
                        <span className="text-xs text-amber-700">
                          {t('nonconformities.correctiveActions.count', {
                            count: (nc.corrective_actions || []).length
                          })}
                        </span>
                      </div>

                      {(nc.corrective_actions || []).length === 0 ? (
                        <p className="mt-3 text-sm text-amber-700">
                          {t('nonconformities.correctiveActions.empty')}
                        </p>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {(nc.corrective_actions || []).map(action => (
                            <div
                              key={action.id}
                              data-testid={`corrective-action-card-${action.id}`}
                              className="rounded-md border border-amber-100 bg-amber-50 p-4"
                            >
                              <div
                                data-testid={`corrective-action-capa-summary-${action.id}`}
                                className="mb-4 rounded-md border border-amber-200 bg-surface px-3 py-2 text-xs text-amber-900"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded-full bg-amber-200 px-2 py-1 font-semibold text-amber-950">
                                    {t('nonconformities.correctiveActions.capaSummary.badge')}
                                  </span>
                                  <span>{t('nonconformities.correctiveActions.capaSummary.description')}</span>
                                </div>
                                <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                                  <div>
                                    <dt className="font-medium">{t('nonconformities.correctiveActions.fields.responsible')}</dt>
                                    <dd>{formatUserName(action.responsible)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium">{t('nonconformities.correctiveActions.fields.reviewer')}</dt>
                                    <dd>{formatUserName(action.reviewer)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium">{t('nonconformities.correctiveActions.fields.effectivenessReview')}</dt>
                                    <dd>{action.effectiveness_review || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium">{t('nonconformities.correctiveActions.fields.approvalState')}</dt>
                                    <dd>
                                      {action.status === 'completed'
                                        ? t('nonconformities.correctiveActions.capaSummary.closureApprovalPending')
                                        : action.status === 'verified'
                                          ? t('nonconformities.correctiveActions.capaSummary.verified')
                                          : t('nonconformities.correctiveActions.capaSummary.inProgress')}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="flex flex-col text-sm text-amber-900">
                                  <span className="mb-1 font-medium">
                                    {t('nonconformities.correctiveActions.fields.description')}
                                  </span>
                                  <textarea
                                    data-testid={`corrective-action-description-${action.id}`}
                                    className="min-h-[72px] rounded-md border border-amber-300 px-3 py-2"
                                    value={action.action_description}
                                    onChange={event =>
                                      handleCorrectiveActionFieldChange(
                                        nc.id,
                                        action.id,
                                        'action_description',
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>
                                <label className="flex flex-col text-sm text-amber-900">
                                  <span className="mb-1 font-medium">
                                    {t('nonconformities.correctiveActions.fields.status')}
                                  </span>
                                  <select
                                    data-testid={`corrective-action-status-${action.id}`}
                                    className="rounded-md border border-amber-300 px-3 py-2"
                                    value={action.status}
                                    onChange={event =>
                                      handleCorrectiveActionFieldChange(
                                        nc.id,
                                        action.id,
                                        'status',
                                        event.target.value as CorrectiveActionStatus
                                      )
                                    }
                                  >
                                    {CORRECTIVE_STATUS_OPTIONS.map(status => (
                                      <option key={status} value={status}>
                                        {t(`nonconformities.correctiveActions.status.${status}` as const)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col text-sm text-amber-900">
                                  <span className="mb-1 font-medium">
                                    {t('nonconformities.correctiveActions.fields.plannedDate')}
                                  </span>
                                  <input
                                    data-testid={`corrective-action-planned-date-${action.id}`}
                                    type="date"
                                    className="rounded-md border border-amber-300 px-3 py-2"
                                    value={action.planned_date ? action.planned_date.substring(0, 10) : ''}
                                    onChange={event =>
                                      handleCorrectiveActionFieldChange(
                                        nc.id,
                                        action.id,
                                        'planned_date',
                                        event.target.value || null
                                      )
                                    }
                                  />
                                </label>
                                <label className="flex flex-col text-sm text-amber-900">
                                  <span className="mb-1 font-medium">
                                    {t('nonconformities.correctiveActions.fields.completionDate')}
                                  </span>
                                  <input
                                    data-testid={`corrective-action-completion-date-${action.id}`}
                                    type="date"
                                    className="rounded-md border border-amber-300 px-3 py-2"
                                    value={action.completion_date ? action.completion_date.substring(0, 10) : ''}
                                    onChange={event =>
                                      handleCorrectiveActionFieldChange(
                                        nc.id,
                                        action.id,
                                        'completion_date',
                                        event.target.value || null
                                      )
                                    }
                                  />
                                </label>
                                <label className="flex flex-col text-sm text-amber-900 md:col-span-2">
                                  <span className="mb-1 font-medium">
                                    {t('nonconformities.correctiveActions.fields.effectivenessReview')}
                                  </span>
                                  <textarea
                                    data-testid={`corrective-action-effectiveness-review-${action.id}`}
                                    className="min-h-[72px] rounded-md border border-amber-300 px-3 py-2"
                                    value={action.effectiveness_review || ''}
                                    onChange={event =>
                                      handleCorrectiveActionFieldChange(
                                        nc.id,
                                        action.id,
                                        'effectiveness_review',
                                        event.target.value || null
                                      )
                                    }
                                  />
                                </label>
                              </div>
                              <div className="mt-3 flex flex-wrap justify-end gap-2">
                                {action.status === 'completed' ? (
                                  <button
                                    type="button"
                                    data-testid={`corrective-action-submit-closure-approval-${action.id}`}
                                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => handleSubmitClosureApproval(action)}
                                    disabled={submittingClosureActionId === action.id}
                                  >
                                    {submittingClosureActionId === action.id
                                      ? t('nonconformities.correctiveActions.actions.submittingClosure')
                                      : t('nonconformities.correctiveActions.actions.submitClosure')}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  data-testid={`corrective-action-save-${action.id}`}
                                  className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() => handleUpdateAction(nc.id, action)}
                                  disabled={savingActionId === action.id}
                                >
                                  {savingActionId === action.id
                                    ? t('nonconformities.correctiveActions.actions.saving')
                                    : t('nonconformities.correctiveActions.actions.save')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-6 rounded-md border border-dashed border-amber-300 bg-amber-50 p-4">
                        <h4 className="text-sm font-semibold text-amber-900">
                          {t('nonconformities.correctiveActions.new.title')}
                        </h4>
                        <p className="mt-1 text-xs text-amber-700">
                          {t('nonconformities.correctiveActions.new.description')}
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col text-sm text-amber-900 md:col-span-2">
                            <span className="mb-1 font-medium">
                              {t('nonconformities.correctiveActions.fields.description')}
                            </span>
                            <textarea
                              className="min-h-[72px] rounded-md border border-amber-300 px-3 py-2"
                              value={newActionForms[nc.id]?.description || ''}
                              placeholder={t('nonconformities.correctiveActions.new.placeholder')}
                              onChange={event =>
                                handleNewActionFormChange(nc.id, 'description', event.target.value)
                              }
                            />
                          </label>
                          <label className="flex flex-col text-sm text-amber-900">
                            <span className="mb-1 font-medium">
                              {t('nonconformities.correctiveActions.fields.plannedDate')}
                            </span>
                            <input
                              type="date"
                              className="rounded-md border border-amber-300 px-3 py-2"
                              value={newActionForms[nc.id]?.plannedDate || ''}
                              onChange={event =>
                                handleNewActionFormChange(nc.id, 'plannedDate', event.target.value)
                              }
                            />
                          </label>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleCreateAction(nc)}
                            disabled={creatingActionFor === nc.id}
                          >
                            {creatingActionFor === nc.id
                              ? t('nonconformities.correctiveActions.actions.creating')
                              : t('nonconformities.correctiveActions.actions.create')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  )
}
