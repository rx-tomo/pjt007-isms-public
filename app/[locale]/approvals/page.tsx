'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type { ApprovalRequest } from '@/lib/services/approval'
import { UserService } from '@/lib/services/user'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'

const APPROVAL_VIEWER_ROLES = new Set(['approver', 'org_admin', 'system_operator'])
const REVERT_ROLES = new Set(['org_admin', 'system_operator'])

/** Map from resource_type to a human-readable Japanese label */
const RESOURCE_TYPE_LABELS: Record<string, string> = {
  document: '文書',
  incident: 'インシデント',
  audit_plan: '監査計画',
  audit_report: '監査報告書',
  nonconformity_closure: '不適合クローズ',
  followup_record: 'フォローアップ記録',
  iso_control_soa: '適用管理策の判断',
  soa_version: '適用管理策判断の版レビュー',
  risk_residual_acceptance: '残留リスク受容'
}

const STATUS_LABELS: Record<string, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下済み',
  expired: '期限切れ'
}

type TabKey = 'pending' | 'approved' | 'rejected' | 'all'
type UrgencyFilter = 'due' | 'escalation' | ''

const TAB_LABELS: Record<TabKey, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下済み',
  all: 'すべて'
}

const normalizeTab = (value: string | null | undefined): TabKey => {
  return value === 'approved' || value === 'rejected' || value === 'all' || value === 'pending'
    ? value
    : 'pending'
}

const normalizeUrgency = (value: string | null | undefined): UrgencyFilter => {
  return value === 'due' || value === 'escalation' ? value : ''
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
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>(() => normalizeTab(searchParams?.get('status')))
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>(() => {
    return normalizeTab(searchParams?.get('status')) === 'pending'
      ? normalizeUrgency(searchParams?.get('urgency'))
      : ''
  })
  const [revertModalRequestId, setRevertModalRequestId] = useState<string | null>(null)
  const [revertReason, setRevertReason] = useState('')
  const [revertLoading, setRevertLoading] = useState(false)

  const canView = profileRole ? APPROVAL_VIEWER_ROLES.has(profileRole) : false
  const canRevert = profileRole ? REVERT_ROLES.has(profileRole) : false

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

  const getResourceLink = (request: ApprovalRequest): string => {
    switch (request.resource_type) {
      case 'document':
        return `/${locale}/documents`
      case 'incident':
        return `/${locale}/incidents/${request.resource_id}`
      case 'audit_plan':
        return `/${locale}/audit/plans/${request.resource_id}`
      case 'audit_report':
        // resource_id is the report ID; link to the plan's report page
        // requires async resolution of plan_id which we cannot do here.
        // Fall back to the audit reports list for now.
        return `/${locale}/audit/reports`
      case 'nonconformity_closure':
        // resource_id is the corrective action ID; link to the nonconformity workbench
        return `/${locale}/audit/nonconformities`
      case 'followup_record':
        // resource_id is the follow-up record ID; link to the audit overview
        return `/${locale}/audit`
      case 'iso_control_soa':
        return `/${locale}/settings/controls`
      case 'soa_version':
        return `/${locale}/settings/controls`
      case 'risk_residual_acceptance':
        return `/${locale}/risks`
      default:
        return '#'
    }
  }

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const profile = await userService.getUserProfile()
      if (!profile?.organization_id) {
        throw new Error('organization_missing')
      }

      setProfileRole(profile.role)
      setProfileId(profile.id)
      setOrganizationId(profile.organization_id)

      if (!APPROVAL_VIEWER_ROLES.has(profile.role)) {
        setRequests([])
        return
      }

      const params = new URLSearchParams({ organizationId: profile.organization_id })
      if (activeTab !== 'all') params.set('status', activeTab)
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
  }, [userService, activeTab])

  const filteredRequests = useMemo(() => {
    if (!urgencyFilter) return requests

    const now = Date.now()
    const thresholdHours = urgencyFilter === 'due' ? 48 : 96
    const threshold = now + thresholdHours * 60 * 60 * 1000

    return requests.filter(request => {
      if (request.status !== 'pending' || !request.due_at) return false
      const dueTime = new Date(request.due_at).getTime()
      return Number.isFinite(dueTime) && dueTime <= threshold
    })
  }, [requests, urgencyFilter])

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
        throw new Error('approval_action_failed')
      }
      await loadRequests()
    } catch (err) {
      console.error('[ApprovalsPage] approve failed', err)
      setError('承認処理に失敗しました。')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!profileId) return
    const reason = window.prompt('却下理由を入力してください')
    if (!reason || !reason.trim()) return

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

  return (
    <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary">承認キュー</h1>
          <p className="mt-2 text-sm text-text-secondary">承認待ちの案件をまとめて確認・処理します。</p>
          {organizationId && (
            <p className="mt-1 text-xs text-text-muted">Organization: {organizationId}</p>
          )}
        </div>

        {loading && (
          <div className="flex h-48 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {!loading && !canView && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            この画面を閲覧する権限がありません。
          </div>
        )}

        {!loading && canView && error && (
          <div className="mb-4">
            <ErrorMessage message={error} onRetry={() => void loadRequests()} />
          </div>
        )}

        {!loading && canView && (
          <>
            <div className="mb-4 flex gap-2">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  aria-pressed={activeTab === tab}
                  data-testid={`approval-tab-${tab}`}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {TAB_LABELS[tab]}
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
                    ? '期限が近い承認依頼のみ表示中'
                    : 'エスカレーション対象の承認依頼のみ表示中'}
                </span>
                <button
                  type="button"
                  onClick={handleClearUrgencyFilter}
                  data-testid="approval-clear-urgency-filter"
                  className="rounded-md border border-amber-300 bg-surface px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  絞り込みを解除
                </button>
              </div>
            )}

            {filteredRequests.length === 0 ? (
              <EmptyState
                title={activeTab === 'pending' ? t('empty') : t('emptyFiltered')}
              />
            ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-surface-elevated text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-3">対象</th>
                    <th className="px-4 py-3">タイプ</th>
                    <th className="px-4 py-3">ステータス</th>
                    <th className="px-4 py-3">申請日時</th>
                    <th className="px-4 py-3">期限</th>
                    <th className="px-4 py-3">承認者</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRequests.map((request) => {
                    const disabled = actionLoadingId === request.id
                      const link = getResourceLink(request)
                      const typeLabel = RESOURCE_TYPE_LABELS[request.resource_type] ?? request.resource_type
                      const statusLabel = STATUS_LABELS[request.status] ?? request.status
                      return (
                        <tr key={request.id} data-testid={`approval-row-${request.resource_type}-${request.resource_id}`}>
                          <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                            {link === '#' ? (
                              request.resource_id
                            ) : (
                              <Link href={link} className="text-blue-700 underline">
                                {request.resource_id}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-primary">{typeLabel}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                              request.status === 'approved' ? 'bg-green-100 text-green-800'
                                : request.status === 'rejected' ? 'bg-red-100 text-red-800'
                                : request.status === 'pending' ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-surface-elevated text-text-primary'
                            }`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{new Date(request.requested_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-text-secondary">{request.due_at ? new Date(request.due_at).toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-text-secondary">{request.approver_id ?? '未割当'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {request.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleApprove(request.id)}
                                    data-testid={`approval-approve-${request.id}`}
                                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    承認
                                  </button>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleReject(request.id)}
                                    data-testid={`approval-reject-${request.id}`}
                                    className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    却下
                                  </button>
                                </>
                              )}
                              {canRevert && (request.status === 'approved' || request.status === 'rejected') && (
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => {
                                    setRevertModalRequestId(request.id)
                                    setRevertReason('')
                                  }}
                                  className="rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  差し戻し
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                  })}
                </tbody>
              </table>
            </div>
            )}

            {revertModalRequestId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
                  <h2 className="mb-4 text-lg font-bold text-text-primary">承認の差し戻し</h2>
                  <p className="mb-3 text-sm text-text-secondary">この承認を差し戻しますか？差し戻し理由を入力してください。</p>
                  <textarea
                    className="mb-4 w-full rounded-md border border-border p-2 text-sm"
                    rows={3}
                    placeholder="差し戻し理由（必須）"
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
                      キャンセル
                    </button>
                    <button
                      type="button"
                      disabled={revertLoading || !revertReason.trim()}
                      onClick={() => handleRevert(revertModalRequestId)}
                      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {revertLoading ? '処理中...' : '差し戻す'}
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
