'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type { ApprovalQueueItem } from '@/lib/services/approval'
import { UserService } from '@/lib/services/user'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { canDecideApproval, canRevertApproval, canViewApprovals } from '@/lib/utils/approvalUiPermissions'
import { isFinalDocumentApprovalStep } from '@/lib/approvals/documentApprovalSteps'

type TabKey = 'pending' | 'approved' | 'rejected' | 'all'
type UrgencyFilter = 'due' | 'escalation' | ''
type DecisionAction = 'approve' | 'reject'

/** ステータスバッジの配色。cancelled は成否を含意しない中立色にする。 */
const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-slate-200 text-slate-700'
}

const DEFAULT_STATUS_BADGE_CLASS = 'bg-surface-elevated text-text-primary'

/** 次段（組織管理者）の承認者候補が0名のときにAPIが409で返す固定メッセージ。 */
const NEXT_STEP_NO_APPROVER_ERROR = 'Next approval step has no eligible approver'

const statusBadgeClass = (status: string): string => {
  return STATUS_BADGE_CLASSES[status] ?? DEFAULT_STATUS_BADGE_CLASS
}

/**
 * 文書の二段階承認における段ラベルのキー。
 * step_number 未設定（二段化以前の単段レコード）は段を表示しない。
 */
const resolveStepLabelKey = (request: ApprovalQueueItem): 'first' | 'final' | null => {
  if (request.resource_type !== 'document' || request.step_number == null) {
    return null
  }
  return isFinalDocumentApprovalStep(request.step_number) ? 'final' : 'first'
}

const normalizeTab = (value: string | null | undefined): TabKey => {
  return value === 'approved' || value === 'rejected' || value === 'all' || value === 'pending'
    ? value
    : 'pending'
}

const normalizeUrgency = (value: string | null | undefined): UrgencyFilter => {
  return value === 'due' || value === 'escalation' ? value : ''
}

const isDueSoon = (dueAt: string | null): boolean => {
  if (!dueAt) return false
  const dueTime = new Date(dueAt).getTime()
  if (Number.isNaN(dueTime)) return false
  const now = Date.now()
  return dueTime >= now && dueTime - now <= 24 * 60 * 60 * 1000
}

const formatDateTime = (value: string | null, locale: string): string => {
  if (!value) return '-'
  return new Date(value).toLocaleString(locale)
}

export default function ApprovalsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('approvals')
  const userService = useMemo(() => new UserService(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [requests, setRequests] = useState<ApprovalQueueItem[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>(() => normalizeTab(searchParams?.get('status')))
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>(() => {
    return normalizeTab(searchParams?.get('status')) === 'pending'
      ? normalizeUrgency(searchParams?.get('urgency'))
      : ''
  })
  const [revertModalRequestId, setRevertModalRequestId] = useState<string | null>(null)
  const [revertReason, setRevertReason] = useState('')
  const [revertLoading, setRevertLoading] = useState(false)
  const [decisionRequestId, setDecisionRequestId] = useState<string | null>(null)
  const [decisionAction, setDecisionAction] = useState<DecisionAction | null>(null)
  const [decisionReason, setDecisionReason] = useState('')

  const canView = canViewApprovals(effectiveRole)
  const pendingCount = requests.filter((request) => request.status === 'pending').length
  const dueSoonCount = requests.filter((request) => request.status === 'pending' && isDueSoon(request.due_at)).length
  const escalationCount = requests.filter((request) => request.escalation_notified_at).length

  useEffect(() => {
    const nextTab = normalizeTab(searchParams?.get('status'))
    setActiveTab(nextTab)
    setUrgencyFilter(nextTab === 'pending' ? normalizeUrgency(searchParams?.get('urgency')) : '')
  }, [searchParams])

  const replaceApprovalUrl = useCallback((tab: TabKey, urgency: UrgencyFilter = '') => {
    const nextParams = new URLSearchParams()
    nextParams.set('status', tab)
    if (tab === 'pending' && urgency) {
      nextParams.set('urgency', urgency)
    }
    router.replace(`/${locale}/approvals?${nextParams.toString()}`, { scroll: false })
  }, [locale, router])

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab)
    setUrgencyFilter('')
    replaceApprovalUrl(tab)
  }, [replaceApprovalUrl])

  const handleClearUrgencyFilter = useCallback(() => {
    setUrgencyFilter('')
    replaceApprovalUrl('pending')
  }, [replaceApprovalUrl])

  const getResourceLink = (request: ApprovalQueueItem): string => {
    return `/${locale}${request.context.target_path}`
  }

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const profile = await userService.getUserProfile() as {
        id: string
        effective_role?: string | null
        effective_organization_id?: string | null
      } | null
      if (!profile) {
        throw new Error('profile_missing')
      }

      setEffectiveRole(profile.effective_role ?? null)
      setProfileId(profile.id)
      setOrganizationId(profile.effective_organization_id ?? null)

      if (!canViewApprovals(profile.effective_role) || !profile.effective_organization_id) {
        setRequests([])
        return
      }

      const params = new URLSearchParams({ organizationId: profile.effective_organization_id })
      const response = await fetch(`/api/approvals?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('approval_queue_fetch_failed')
      }
      const data = await response.json()
      setRequests(data)
    } catch (err) {
      console.error('[ApprovalsPage] Failed to load requests', err)
      setError('承認キューの取得に失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [userService])

  const filteredRequests = useMemo(() => {
    let items = activeTab === 'all' ? [...requests] : requests.filter((request) => request.status === activeTab)
    if (urgencyFilter === 'due') {
      const threshold = Date.now() + 48 * 60 * 60 * 1000
      items = items.filter((request) => request.due_at && new Date(request.due_at).getTime() <= threshold)
    } else if (urgencyFilter === 'escalation') {
      items = items.filter((request) => Boolean(request.escalation_notified_at))
    }
    return items.sort((a, b) => {
      if (activeTab === 'pending') {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER
        return aDue - bDue
      }
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    })
  }, [activeTab, requests, urgencyFilter])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleApprove = async (requestId: string) => {
    if (!profileId) return
    setActionLoadingId(requestId)
    setError(null)

    try {
      const request = requests.find(item => item.id === requestId)
      if (!request) {
        throw new Error('request_not_found')
      }

      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestId }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as { error?: unknown }
        const serverMessage = typeof errorBody?.error === 'string' ? errorBody.error : ''
        throw new Error(serverMessage || 'approval_action_failed')
      }
      await loadRequests()
    } catch (err) {
      console.error('[ApprovalsPage] approve failed', err)
      const message = err instanceof Error ? err.message : ''
      if (message.includes(NEXT_STEP_NO_APPROVER_ERROR)) {
        // 次段（組織管理者）の候補が0名。運用側の是正が必要なので専用文言を出す。
        setError(t('errors.nextStepNoApprover'))
      } else {
        setError('承認処理に失敗しました。')
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleReject = async (requestId: string, reason: string) => {
    if (!profileId) return
    if (!reason.trim()) return

    setActionLoadingId(requestId)
    setError(null)

    try {
      const request = requests.find(item => item.id === requestId)
      if (!request) {
        throw new Error('request_not_found')
      }

      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', requestId, reason: reason.trim() }),
      })
      if (!response.ok) {
        throw new Error('approval_reject_failed')
      }
      await loadRequests()
    } catch (err) {
      console.error('[ApprovalsPage] reject failed', err)
      setError('却下処理に失敗しました。')
    } finally {
      setActionLoadingId(null)
    }
  }

  const closeDecisionModal = () => {
    setDecisionRequestId(null)
    setDecisionAction(null)
    setDecisionReason('')
  }

  const handleDecisionSubmit = async () => {
    if (!decisionRequestId || !decisionAction) return
    if (decisionAction === 'approve') {
      await handleApprove(decisionRequestId)
    } else {
      await handleReject(decisionRequestId, decisionReason)
    }
    closeDecisionModal()
  }

  const handleRevert = async (requestId: string) => {
    if (!profileId || !organizationId) return
    if (!revertReason.trim()) return

    setRevertLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert', requestId, reason: revertReason.trim() }),
      })
      if (!response.ok) {
        throw new Error('approval_revert_failed')
      }
      setRevertModalRequestId(null)
      setRevertReason('')
      await loadRequests()
    } catch (err) {
      console.error('[ApprovalsPage] revert failed', err)
      setError('差し戻しに失敗しました。')
    } finally {
      setRevertLoading(false)
    }
  }

  const decisionRequest = decisionRequestId ? requests.find((request) => request.id === decisionRequestId) ?? null : null
  const revertRequest = revertModalRequestId ? requests.find((request) => request.id === revertModalRequestId) ?? null : null

  return (
    <DashboardLayout locale={locale}>
      <div className="container mx-auto min-w-0 px-3 py-5 sm:px-4 sm:py-8">
        <div className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 data-testid="approval-queue-title" className="text-2xl font-bold text-text-primary sm:text-3xl">
                {t('title')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                {t('description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 font-medium text-text-primary">
                {t('summary.pending', { count: pendingCount })}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-900">
                {t('summary.dueSoon', { count: dueSoonCount })}
              </span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-900">
                {t('summary.escalated', { count: escalationCount })}
              </span>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex h-48 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {!loading && !canView && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            {t('forbidden')}
          </div>
        )}

        {!loading && canView && error && (
          <div className="mb-4">
            <ErrorMessage message={error} onRetry={() => void loadRequests()} />
          </div>
        )}

        {!loading && canView && (
          <>
            <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  aria-pressed={activeTab === tab}
                  data-testid={`approval-tab-${tab}`}
                  className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(tab)}
                </button>
              ))}
            </div>

            {urgencyFilter && (
              <div
                data-testid="approval-urgency-filter"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                <span>
                  {urgencyFilter === 'due'
                    ? t('filters.due')
                    : t('filters.escalation')}
                </span>
                <button
                  type="button"
                  onClick={handleClearUrgencyFilter}
                  data-testid="approval-clear-urgency-filter"
                  className="rounded-md border border-amber-300 bg-surface px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  {t('filters.clear')}
                </button>
              </div>
            )}

            {filteredRequests.length === 0 ? (
              <EmptyState
                title={activeTab === 'pending' ? t('empty') : t('emptyFiltered')}
              />
            ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <table className="hidden min-w-full table-fixed divide-y divide-border text-sm md:table">
                <thead className="bg-surface-elevated text-left text-xs font-semibold text-text-muted">
                  <tr>
                    <th className="w-[34%] px-4 py-3">{t('columns.subject')}</th>
                    <th className="w-[20%] px-4 py-3">{t('columns.people')}</th>
                    <th className="w-[18%] px-4 py-3">{t('columns.due')}</th>
                    <th className="w-[18%] px-4 py-3">{t('columns.impact')}</th>
                    <th className="w-[10%] px-4 py-3 text-right">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRequests.map((request) => {
                    const disabled = actionLoadingId === request.id
                      const link = getResourceLink(request)
                      const typeLabel = t(`resourceTypes.${request.resource_type}`)
                      const statusLabel = t(`statuses.${request.status}`)
                      const stepLabelKey = resolveStepLabelKey(request)
                      return (
                        <tr key={request.id} data-testid={`approval-row-${request.resource_type}-${request.resource_id}`}>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary">{typeLabel}</span>
                                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(request.status)}`}>{statusLabel}</span>
                                {stepLabelKey && (
                                  <span
                                    data-testid={`approval-step-${request.id}`}
                                    className="rounded border border-border px-2 py-0.5 text-xs font-semibold text-text-secondary"
                                  >
                                    {t(`steps.${stepLabelKey}`)}
                                  </span>
                                )}
                              </div>
                              <Link href={link} className="block font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2">
                                {request.context.title}
                              </Link>
                              {request.context.summary && <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{request.context.summary}</p>}
                              <p className="break-all text-[11px] text-text-muted">{t('reference', { value: request.context.reference })}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-xs leading-5 text-text-secondary">
                            <p><span className="font-semibold text-text-primary">{t('requester')}:</span> {request.context.requester_name ?? t('unknown')}</p>
                            <p><span className="font-semibold text-text-primary">{t('approver')}:</span> {request.context.approver_name ?? t('unassigned')}</p>
                          </td>
                          <td className={`px-4 py-4 align-top text-xs leading-5 ${isDueSoon(request.due_at) ? 'font-semibold text-amber-700' : 'text-text-secondary'}`}>
                            <p>{formatDateTime(request.due_at, locale)}</p>
                            <p className="mt-1 font-normal text-text-muted">{t('requestedAt', { value: formatDateTime(request.requested_at, locale) })}</p>
                          </td>
                          <td className="px-4 py-4 align-top text-xs leading-5 text-text-secondary">{t(`impacts.${request.resource_type}`)}</td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col items-end gap-2">
                              {canDecideApproval(request, profileId) && (
                                <>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { setDecisionRequestId(request.id); setDecisionAction('approve'); setDecisionReason('') }}
                                    data-testid={`approval-approve-${request.id}`}
                                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t('approve')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { setDecisionRequestId(request.id); setDecisionAction('reject'); setDecisionReason('') }}
                                    data-testid={`approval-reject-${request.id}`}
                                    className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {t('reject')}
                                  </button>
                                </>
                              )}
                              {canRevertApproval(effectiveRole, request, profileId) && (
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => {
                                    setRevertModalRequestId(request.id)
                                    setRevertReason('')
                                  }}
                                  className="rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {t('revert')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                  })}
                </tbody>
              </table>
              <div className="divide-y divide-border md:hidden">
                {filteredRequests.map((request) => {
                  const disabled = actionLoadingId === request.id
                  const stepLabelKey = resolveStepLabelKey(request)
                  return (
                    <article key={request.id} data-testid={`approval-mobile-row-${request.resource_type}-${request.resource_id}`} className="space-y-4 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary">{t(`resourceTypes.${request.resource_type}`)}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(request.status)}`}>{t(`statuses.${request.status}`)}</span>
                        {stepLabelKey && (
                          <span
                            data-testid={`approval-step-${request.id}`}
                            className="rounded border border-border px-2 py-0.5 text-xs font-semibold text-text-secondary"
                          >
                            {t(`steps.${stepLabelKey}`)}
                          </span>
                        )}
                      </div>
                      <div>
                        <Link href={getResourceLink(request)} className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2">{request.context.title}</Link>
                        {request.context.summary && <p className="mt-2 text-sm leading-6 text-text-secondary">{request.context.summary}</p>}
                      </div>
                      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-xs leading-5">
                        <dt className="font-semibold text-text-muted">{t('requester')}</dt><dd className="text-text-primary">{request.context.requester_name ?? t('unknown')}</dd>
                        <dt className="font-semibold text-text-muted">{t('approver')}</dt><dd className="text-text-primary">{request.context.approver_name ?? t('unassigned')}</dd>
                        <dt className="font-semibold text-text-muted">{t('columns.due')}</dt><dd className={isDueSoon(request.due_at) ? 'font-semibold text-amber-700' : 'text-text-primary'}>{formatDateTime(request.due_at, locale)}</dd>
                        <dt className="font-semibold text-text-muted">{t('columns.impact')}</dt><dd className="text-text-primary">{t(`impacts.${request.resource_type}`)}</dd>
                      </dl>
                      <p className="break-all text-[11px] text-text-muted">{t('reference', { value: request.context.reference })}</p>
                      <div className="flex flex-wrap justify-end gap-2">
                        {canDecideApproval(request, profileId) && <>
                          <button type="button" disabled={disabled} onClick={() => { setDecisionRequestId(request.id); setDecisionAction('approve'); setDecisionReason('') }} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{t('approve')}</button>
                          <button type="button" disabled={disabled} onClick={() => { setDecisionRequestId(request.id); setDecisionAction('reject'); setDecisionReason('') }} className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60">{t('reject')}</button>
                        </>}
                        {canRevertApproval(effectiveRole, request, profileId) && <button type="button" disabled={disabled} onClick={() => { setRevertModalRequestId(request.id); setRevertReason('') }} className="rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{t('revert')}</button>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
            )}

            {decisionRequest && decisionAction && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
                <div role="dialog" aria-modal="true" aria-labelledby="approval-decision-title" className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
                  <h2 id="approval-decision-title" className="text-lg font-bold text-text-primary">
                    {decisionAction === 'approve' ? t('decision.approveTitle') : t('decision.rejectTitle')}
                  </h2>
                  <p className="mt-2 font-semibold text-text-primary">{decisionRequest.context.title}</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{t(`impacts.${decisionRequest.resource_type}`)}</p>
                  {decisionAction === 'reject' && (
                    <textarea
                      className="mt-4 w-full rounded-md border border-border p-3 text-sm"
                      id="approval-reject-reason"
                      aria-label={t('decision.rejectReasonLabel')}
                      rows={4}
                      placeholder={t('decision.rejectReasonPlaceholder')}
                      value={decisionReason}
                      onChange={(event) => setDecisionReason(event.target.value)}
                    />
                  )}
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" disabled={Boolean(actionLoadingId)} onClick={closeDecisionModal} className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-elevated">{t('cancel')}</button>
                    <button
                      type="button"
                      disabled={Boolean(actionLoadingId) || (decisionAction === 'reject' && !decisionReason.trim())}
                      onClick={() => void handleDecisionSubmit()}
                      className={decisionAction === 'approve' ? 'rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60' : 'rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60'}
                    >
                      {actionLoadingId ? t('processing') : decisionAction === 'approve' ? t('decision.confirmApprove') : t('decision.confirmReject')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {revertModalRequestId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div role="dialog" aria-modal="true" aria-labelledby="approval-revert-title" className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
                  <h2 id="approval-revert-title" className="text-lg font-bold text-text-primary">{t('revertModalTitle')}</h2>
                  {revertRequest && <p className="mt-2 font-semibold text-text-primary">{revertRequest.context.title}</p>}
                  <p className="mb-3 mt-2 text-sm text-text-secondary">{t('revertModalDescription')}</p>
                  <textarea
                    className="mb-4 w-full rounded-md border border-border p-2 text-sm"
                    id="approval-revert-reason"
                    aria-label={t('revertReasonLabel')}
                    rows={3}
                    placeholder={t('revertReasonPlaceholder')}
                    value={revertReason}
                    onChange={(e) => setRevertReason(e.target.value)}
                  />
                  {error && (
                    <div className="mb-3 text-sm text-red-600">{error}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={revertLoading}
                      onClick={() => {
                        setRevertModalRequestId(null)
                        setRevertReason('')
                      }}
                      className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-elevated"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={revertLoading || !revertReason.trim()}
                      onClick={() => handleRevert(revertModalRequestId)}
                      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {revertLoading ? t('processing') : t('revert')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
