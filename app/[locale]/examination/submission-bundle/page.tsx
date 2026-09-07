'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { OrganizationService } from '@/lib/services/organization'
import { UserService } from '@/lib/services/user'
import type { CurrentUserProfile } from '@/lib/services/user'
import { useToast } from '@/components/ui/ToastProvider'

type BundleItemStatus = 'ready' | 'missing' | 'needs_review'

type BundleItem = {
  key: string
  label: string
  status: BundleItemStatus
  count: number
  sources: string[]
  evidence: string[]
  gaps: string[]
  gapActions: {
    gap: string
    reason: string
    nextAction: string
    route: string
  }[]
}

type SubmissionBundle = {
  organization: {
    id: string
    name: string
    ismsPhase: string | null
    isoCertificationStatus: string | null
  }
  generatedAt: string
  reviewNotice: {
    title: string
    body: string
  }
  readiness: {
    status: 'ready' | 'ready_with_gaps'
    readyItems: number
    totalItems: number
    gapItems: string[]
  }
  latestSoaVersion: {
    id: string
    versionNumber: number
    title: string
    controlCount: number
    approvedControlCount: number
    publishedAt: string
  } | null
  items: BundleItem[]
}

const allowedRoles = new Set(['org_admin', 'system_operator', 'auditor'])

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'ISMS管理者',
  system_operator: '導入支援担当',
  auditor: '内部監査員',
}

const PHASE_LABELS: Record<string, [string, string, string]> = {
  initial: ['初回登録準備', 'Initial certification preparation', '初次认证准备'],
  surveillance: ['継続運用', 'Ongoing certification operation', '持续认证运行'],
}

function formatPhaseLabel(phase: string | null, locale: string) {
  if (!phase) return '-'
  const labels = PHASE_LABELS[phase]
  if (!labels) return phase.replaceAll('_', ' ')
  return locale.startsWith('zh') ? labels[2] : locale.startsWith('en') ? labels[1] : labels[0]
}

const EVIDENCE_LABELS: Record<string, [string, string, string]> = {
  physical_locations: ['拠点', 'Locations', '地点'],
  it_systems: ['対象システム', 'In-scope systems', '范围内系统'],
  departments: ['対象部門', 'Departments', '部门'],
  processes: ['対象業務', 'Processes', '业务流程'],
  exclusions: ['除外事項', 'Exclusions', '排除项'],
  required_roles: ['必要な役割', 'Required roles', '必要角色'],
  assigned_required_roles: ['担当者設定済み', 'Assigned required roles', '已分配必要角色'],
  documents: ['登録文書', 'Documents', '已登记文件'],
  approved: ['承認済み', 'Approved', '已批准'],
  draft_or_review: ['作成・確認中', 'Draft or in review', '草稿或评审中'],
  assets: ['情報資産', 'Information assets', '信息资产'],
  risks: ['リスク', 'Risks', '风险'],
  treatments: ['リスク対応', 'Risk treatments', '风险处置'],
  completed_treatments: ['完了した対応', 'Completed treatments', '已完成处置'],
  latest_version: ['最新の版', 'Latest version', '最新版本'],
  controls: ['管理策', 'Controls', '控制措施'],
  approved_controls: ['承認済み管理策', 'Approved controls', '已批准控制措施'],
  tasks: ['タスク', 'Tasks', '任务'],
  parent_tasks: ['主要タスク', 'Main tasks', '主要任务'],
  subtasks: ['サブタスク', 'Subtasks', '子任务'],
  completed_tasks: ['完了タスク', 'Completed tasks', '已完成任务'],
  open_tasks: ['対応中タスク', 'Open tasks', '进行中任务'],
  average_progress: ['平均進捗', 'Average progress', '平均进度'],
  education_plans: ['教育計画', 'Education plans', '教育计划'],
  education_records: ['受講記録', 'Training records', '培训记录'],
  passed_records: ['完了・合格記録', 'Completed or passed records', '完成或合格记录'],
  materials: ['教材', 'Materials', '教材'],
  audit_plans: ['内部監査計画', 'Internal audit plans', '内部审核计划'],
  scheduled_or_later: ['予定化済み', 'Scheduled or later', '已计划或以后'],
  audit_reports: ['内部監査報告書', 'Internal audit reports', '内部审核报告'],
  nonconformities: ['不適合', 'Nonconformities', '不符合项'],
  resolved_or_later: ['解決済み', 'Resolved or later', '已解决或以后'],
  corrective_actions: ['是正処置', 'Corrective actions', '纠正措施'],
  completed_or_verified: ['完了・検証済み', 'Completed or verified', '已完成或验证'],
  follow_ups: ['フォローアップ', 'Follow-ups', '跟进记录'],
  management_reviews: ['マネジメントレビュー', 'Management reviews', '管理评审'],
  completed: ['完了', 'Completed', '已完成'],
  review_items: ['確認項目', 'Review items', '评审项目'],
  review_actions: ['決定後の対応', 'Review actions', '评审行动'],
  accept_treatments: ['受容を選択したリスク', 'Risks selected for acceptance', '选择接受的风险'],
  approved_acceptances: ['承認済み受容', 'Approved acceptances', '已批准接受'],
  review_due_dates: ['再確認日設定済み', 'Review dates set', '已设置复查日期'],
  audit_evidence: ['監査証跡ファイル', 'Audit evidence files', '审核证据文件']
}

function formatEvidenceEntry(entry: string, locale: string) {
  const separator = entry.indexOf(':')
  if (separator < 0) return entry
  const key = entry.slice(0, separator)
  const value = entry.slice(separator + 1)
  const labels = EVIDENCE_LABELS[key]
  const label = locale.startsWith('zh') ? labels?.[2] : locale.startsWith('en') ? labels?.[1] : labels?.[0]
  if (!label) return entry.replaceAll('_', ' ')
  const suffix = key === 'average_progress' ? '%' : ''
  return `${label} ${value}${suffix}`
}

export default function SubmissionBundlePage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params)
  const { locale } = params

  const t = useTranslations('examination.submissionBundle')
  const router = useRouter()
  const { pushToast } = useToast()

  const organizationService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])

  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [bundle, setBundle] = useState<SubmissionBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState(true)

  const formatDateTime = useCallback((isoString: string | null) => {
    if (!isoString) return '-'
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoString))
    } catch {
      return isoString
    }
  }, [locale])

  const loadBundle = useCallback(async (targetOrganizationId: string) => {
    setError(null)
    const response = await fetch(
      `/api/examination/submission-bundle?organizationId=${encodeURIComponent(targetOrganizationId)}`,
      {
        credentials: 'include',
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json() as { ok: boolean; bundle: SubmissionBundle }
    setBundle(payload.bundle)
  }, [])

  const ensureAccess = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [user, organization] = await Promise.all([
        userService.getCurrentUser(),
        organizationService.getCurrentOrganization(),
      ])

      if (!user || !organization) {
        router.push(`/${locale}/auth/login`)
        return
      }

      setCurrentUser(user)
      setOrganizationId(organization.id)

      if (!user.effective_role || !allowedRoles.has(user.effective_role)) {
        setHasAccess(false)
        try {
          router.push(`/${locale}/home`)
        } catch {}
        return
      }

      setHasAccess(true)
      await loadBundle(organization.id)
    } catch (err) {
      console.error('Failed to load audit preparation package', err)
      setError(t('errors.loadFailed'))
      pushToast({ message: t('errors.loadFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsLoading(false)
    }
  }, [loadBundle, locale, organizationService, pushToast, router, t, userService])

  useEffect(() => {
    ensureAccess()
  }, [ensureAccess])

  const handleRefresh = async () => {
    if (!organizationId) return
    setIsLoading(true)
    try {
      await loadBundle(organizationId)
      pushToast({ message: t('messages.refreshed'), variant: 'success' })
    } catch (err) {
      console.error('Failed to refresh audit preparation package', err)
      setError(t('errors.loadFailed'))
      pushToast({ message: t('errors.loadFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadZip = async () => {
    if (!organizationId) return
    setIsDownloading(true)
    try {
      const response = await fetch(
        `/api/examination/submission-bundle?organizationId=${encodeURIComponent(organizationId)}&format=zip`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? `API error ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `isms-audit-preparation-package-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      pushToast({ message: t('messages.downloaded'), variant: 'success' })
    } catch (err) {
      console.error('Failed to download audit preparation package ZIP', err)
      pushToast({ message: t('errors.downloadFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!organizationId) return
    setIsDownloadingPdf(true)
    try {
      const response = await fetch(
        `/api/examination/submission-bundle?organizationId=${encodeURIComponent(organizationId)}&format=pdf`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? `API error ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `isms-audit-preparation-package-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      pushToast({ message: t('messages.pdfDownloaded'), variant: 'success' })
    } catch (err) {
      console.error('Failed to download audit preparation package PDF', err)
      pushToast({ message: t('errors.pdfDownloadFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const statusClass = (status: BundleItemStatus) => {
    if (status === 'ready') return 'bg-emerald-100 text-emerald-800'
    if (status === 'needs_review') return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

  const readinessClass = bundle?.readiness.status === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-amber-200 bg-amber-50 text-amber-900'

  const nextGapItem = bundle?.items.find((item) => item.gaps.length > 0)
  const nextActionHrefByItem: Record<string, string> = {
    isms_scope: `/${locale}/settings/organization`,
    organization_structure: `/${locale}/settings/structure`,
    approved_documents: `/${locale}/documents`,
    information_assets: `/${locale}/settings/assets`,
    risk_assessment: `/${locale}/risks`,
    soa_version: `/${locale}/settings/controls`,
    initial_tasks: `/${locale}/tasks`,
    education_training_evidence: `/${locale}/education`,
    annual_audit_plans: `/${locale}/audit`,
    audit_reports: `/${locale}/audit/reports`,
    nonconformity_corrective_actions: `/${locale}/audit/nonconformities`,
    follow_up_records: `/${locale}/audit`,
    management_reviews: `/${locale}/management-reviews`,
    residual_risk_acceptances: `/${locale}/risks`,
    annual_audit_evidence: `/${locale}/audit`,
  }
  const buildLocalizedRoute = useCallback(
    (route: string | null | undefined) => {
      if (!route) return `/${locale}/home`
      if (route.startsWith(`/${locale}/`)) return route
      return `/${locale}${route.startsWith('/') ? route : `/${route}`}`
    },
    [locale]
  )
  const nextActionHref = nextGapItem
    ? buildLocalizedRoute((nextGapItem.gapActions ?? [])[0]?.route ?? nextActionHrefByItem[nextGapItem.key])
    : null
  const currentRoleLabel = currentUser?.effective_role
    ? ROLE_LABELS[currentUser.effective_role] ?? currentUser.effective_role
    : '-'

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="submission-bundle-page-loading">
        <div className="bg-surface shadow-sm rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-surface-elevated rounded w-1/3" />
            <div className="h-20 bg-surface-elevated rounded" />
            <div className="h-48 bg-surface-elevated rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="bg-surface shadow-sm rounded-lg p-8 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">{t('noAccess.title')}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t('noAccess.description')}</p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/home`)}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('noAccess.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="submission-bundle-page">
      <div className="bg-surface shadow-sm rounded-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
            <div
              className="mt-3 max-w-3xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              data-testid="submission-bundle-safety-boundary"
            >
              <p className="font-semibold">{t('safetyBoundary.title')}</p>
              <p className="mt-1">{t('safetyBoundary.body')}</p>
              <p className="mt-2 text-xs text-amber-900">{t('safetyBoundary.demoReset')}</p>
            </div>
            {bundle && (
              <p className="mt-3 text-sm text-text-muted">
                {t('organizationLine', {
                  name: bundle.organization.name,
                  phase: formatPhaseLabel(bundle.organization.ismsPhase, locale),
                  role: currentRoleLabel,
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={!organizationId || isLoading}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated disabled:opacity-60"
              data-testid="submission-bundle-refresh"
            >
              {t('actions.refresh')}
            </button>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={!organizationId || !bundle || isDownloading || isDownloadingPdf}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              data-testid="submission-bundle-download-zip"
            >
              {isDownloading ? t('actions.downloadingZip') : t('actions.downloadZip')}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!organizationId || !bundle || isDownloading || isDownloadingPdf}
              className="rounded-md border border-blue-300 bg-surface px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
              data-testid="submission-bundle-download-pdf"
            >
              {isDownloadingPdf ? t('actions.downloadingPdf') : t('actions.downloadPdf')}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {bundle && (
        <>
          <div className={`rounded-lg border p-5 ${readinessClass}`} data-testid="submission-bundle-readiness">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">{t('readiness.label')}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {t(`readiness.status.${bundle.readiness.status}`)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs opacity-75">{t('readiness.readyItems')}</p>
                  <p className="text-xl font-semibold" data-testid="submission-bundle-ready-count">
                    {bundle.readiness.readyItems}/{bundle.readiness.totalItems}
                  </p>
                </div>
                <div>
                  <p className="text-xs opacity-75">{t('readiness.gapItems')}</p>
                  <p className="text-xl font-semibold">{bundle.readiness.gapItems.length}</p>
                </div>
                <div>
                  <p className="text-xs opacity-75">{t('readiness.generatedAt')}</p>
                  <p className="text-sm font-medium">{formatDateTime(bundle.generatedAt)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-75">{t('readiness.latestSoa')}</p>
                  <p className="text-sm font-medium" data-testid="submission-bundle-latest-soa">
                    {bundle.latestSoaVersion
                      ? t('readiness.soaVersion', { version: bundle.latestSoaVersion.versionNumber })
                      : t('readiness.noSoa')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            data-testid="submission-bundle-next-action"
          >
            <p className="text-sm font-medium text-text-muted">{t('nextAction.eyebrow')}</p>
            {nextGapItem ? (
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {t('nextAction.gapTitle', { item: nextGapItem.label })}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {nextGapItem.gaps[0] ?? t('nextAction.gapFallback')}
                  </p>
                </div>
                <a
                  href={nextActionHref ?? `/${locale}/home`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 md:w-auto"
                  data-testid="submission-bundle-next-action-open"
                >
                  {t('nextAction.openTarget')}
                </a>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{t('nextAction.readyTitle')}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{t('nextAction.readyDescription')}</p>
                </div>
                <p className="text-sm text-text-muted">{t('nextAction.readyOutputHint')}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {bundle.items.map((item) => (
              <div
                key={item.key}
                className="rounded-lg border border-border bg-surface p-5 shadow-sm"
                data-testid={`submission-bundle-item-${item.key}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">{item.label}</h2>
                    <p className="mt-1 text-sm text-text-muted">{t('items.count', { count: item.count })}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                    {t(`items.status.${item.status}`)}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-text-muted">{t('items.evidence')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.evidence.length > 0 ? item.evidence.map((entry) => (
                        <span key={`${item.key}-${entry}`} className="rounded-md bg-surface-elevated px-2 py-1 text-xs text-text-secondary">
                          {formatEvidenceEntry(entry, locale)}
                        </span>
                      )) : (
                        <span className="text-sm text-text-muted">{t('items.none')}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-text-muted">{t('items.gaps')}</p>
                    {item.gaps.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-sm text-amber-900">
                        {(item.gapActions?.length
                          ? item.gapActions
                          : item.gaps.map((gap) => ({
                              gap,
                              reason: gap,
                              nextAction: t('nextAction.gapFallback'),
                              route: nextActionHrefByItem[item.key] ?? `/${locale}/home`,
                            }))
                        ).map((action) => (
                          <li
                            key={`${item.key}-${action.gap}`}
                            className="rounded-md border border-amber-200 bg-amber-50 p-3"
                            data-testid={`submission-bundle-gap-${item.key}`}
                          >
                            <p>{action.reason}</p>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-xs text-amber-800">
                                <span className="font-medium">{t('items.nextAction')}</span>
                                {' '}
                                {action.nextAction}
                              </p>
                              <button
                                type="button"
                                onClick={() => router.push(buildLocalizedRoute(action.route))}
                                className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-surface px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                                data-testid={`submission-bundle-gap-action-${item.key}`}
                              >
                                {t('items.openRelated')}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-emerald-700">{t('items.noGaps')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
