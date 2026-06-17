'use client'

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuditService } from '@/lib/services/audit'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type {
  AuditPlanWithRelations,
  AuditStatus,
  AuditDashboardNextAction,
  AuditFollowUpStatus,
  NonconformityStatus
} from '@/lib/services/audit'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'
import { FilterBar, type FilterBarItem } from '@/components/filters/FilterBar'
import { StatusFilterBanner } from '@/components/filters/StatusFilterBanner'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

type AuditStatistics = Awaited<ReturnType<AuditService['getAuditStatistics']>>

const PERIOD_STATUS_ORDER: AuditStatus[] = ['planning', 'scheduled', 'in_progress', 'completed', 'cancelled']
const PERIOD_STATUS_COLORS: Record<AuditStatus, string> = {
  planning: 'bg-indigo-500',
  scheduled: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-rose-500'
}

export default function AuditPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('audit')
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = `/${locale}/audit`
  const [auditPlans, setAuditPlans] = useState<AuditPlanWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null)
  const [statusFilter, setStatusFilter] = useState<AuditStatus | ''>(
    () => (searchParams?.get('status') as AuditStatus | '') ?? ''
  )
  const [periodFilter, setPeriodFilter] = useState(() => searchParams?.get('period') ?? '')
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [periodOptionsLoading, setPeriodOptionsLoading] = useState(false)
  const { isAuthorized, isLoading: accessLoading, error: accessError, profile } = useAuditAccess()
  const auditService = useMemo(() => new AuditService(), [])

  const updateQueryParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      mutator(params)
      const target = params.toString()
      router.replace(target ? `${basePath}?${target}` : basePath)
    },
    [basePath, router, searchParams]
  )

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      const normalized = value as AuditStatus | ''
      setStatusFilter(normalized)
      updateQueryParams(params => {
        if (normalized) {
          params.set('status', normalized)
        } else {
          params.delete('status')
        }
      })
    },
    [updateQueryParams]
  )

  const handlePeriodFilterChange = useCallback(
    (value: string) => {
      setPeriodFilter(value)
      updateQueryParams(params => {
        if (value) {
          params.set('period', value)
        } else {
          params.delete('period')
        }
      })
    },
    [updateQueryParams]
  )

  useEffect(() => {
    if (!searchParams) return
    const nextStatus = (searchParams.get('status') as AuditStatus | '') ?? ''
    setStatusFilter(prev => (prev === nextStatus ? prev : nextStatus))
    const nextPeriod = searchParams.get('period') ?? ''
    setPeriodFilter(prev => (prev === nextPeriod ? prev : nextPeriod))
  }, [searchParams])

  const upcomingAudits = statistics?.upcomingAudits ?? []
  const nextActions = statistics?.nextActions ?? []
  const safePlansByStatus = useMemo(
    () =>
      statistics?.plansByStatus ?? {
        planning: 0,
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      },
    [statistics]
  )
  const safeFollowUpCounts = useMemo(
    () =>
      statistics?.followUpStatusCounts ?? {
        completed: 0,
        on_hold: 0,
        reopened: 0
      },
    [statistics]
  )
  const safeNcByStatus = useMemo(
    () =>
      statistics?.ncByStatus ?? {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        verified: 0
      },
    [statistics]
  )
  const safeNcByType = useMemo(() => statistics?.ncByType ?? { major: 0, minor: 0 }, [statistics])
  const safeNcStatusCounts = useMemo(
    () =>
      statistics?.nonconformityStatusCounts ?? {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        verified: 0
      },
    [statistics]
  )

  const completionRate = statistics?.totalChecklistItems
    ? Math.round((statistics.completedChecklistItems / statistics.totalChecklistItems) * 100)
    : 0

  const priorityStyles: Record<AuditDashboardNextAction['priority'], string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-surface-elevated text-text-secondary border-border'
  }

  const followUpStatusOrder: AuditFollowUpStatus[] = ['completed', 'on_hold', 'reopened']
  const nonconformityStatusOrder: NonconformityStatus[] = ['open', 'in_progress', 'resolved', 'closed', 'verified']

  const periodSelectOptions = useMemo(() => {
    const normalized = [...availablePeriods]
    if (periodFilter && !normalized.includes(periodFilter)) {
      normalized.unshift(periodFilter)
    }

    return normalized.map(period => ({ value: period, label: period }))
  }, [availablePeriods, periodFilter])

  const periodLabel = periodFilter || t('stats.periodHeaderAll')
  const periodStatusSegments = useMemo(() => {
    const totalPlans = statistics?.totalPlans ?? 0

    return PERIOD_STATUS_ORDER.map(status => {
      const count = safePlansByStatus[status] ?? 0
      const percent = totalPlans > 0 ? Math.round((count / totalPlans) * 100) : 0
      return { status, count, percent }
    })
  }, [safePlansByStatus, statistics])

  const filterBarItems = useMemo<FilterBarItem[]>(() => {
    const items: FilterBarItem[] = [
      {
        key: 'status',
        type: 'select',
        placeholder: t('plans.filters.all'),
        value: statusFilter,
        onChange: handleStatusFilterChange,
        options: [
          { value: 'planning', label: t('plans.status.planning') },
          { value: 'scheduled', label: t('plans.status.scheduled') },
          { value: 'in_progress', label: t('plans.status.in_progress') },
          { value: 'completed', label: t('plans.status.completed') },
          { value: 'cancelled', label: t('plans.status.cancelled') }
        ]
      }
    ]

    items.push({
      key: 'period',
      type: 'select',
      placeholder: t('plans.filters.period'),
      value: periodFilter,
      onChange: handlePeriodFilterChange,
      options: periodSelectOptions,
      disabled: periodOptionsLoading || periodSelectOptions.length === 0
    })

    return items
  }, [
    handlePeriodFilterChange,
    handleStatusFilterChange,
    periodFilter,
    periodOptionsLoading,
    periodSelectOptions,
    statusFilter,
    t
  ])

  const formatActionDescription = (action: AuditDashboardNextAction) => {
    if (action.type === 'checklist') {
      return t('nextActions.descriptions.checklist', {
        remaining: action.remaining ?? 0,
        total: action.total ?? 0
      })
    }

    if (action.type === 'nonconformity') {
      return t('nextActions.descriptions.nonconformity')
    }

    return t('nextActions.descriptions.corrective_action')
  }

  const resolveActionLink = (action: AuditDashboardNextAction) => {
    if (action.type === 'checklist') {
      return `/${locale}/audit/plans/${action.planId}/checklist`
    }

    return `/${locale}/audit/nonconformities`
  }

  const loadAuditPeriods = useCallback(
    async (organizationId: string) => {
      try {
        setPeriodOptionsLoading(true)
        const periods = await auditService.getAuditPeriods(organizationId)
        setAvailablePeriods(periods)
      } catch (error) {
        console.error('Error loading audit periods:', error)
      } finally {
        setPeriodOptionsLoading(false)
      }
    },
    [auditService]
  )

  useEffect(() => {
    if (accessLoading || !isAuthorized) {
      return
    }

    const organizationId = profile?.organization_id
    if (!organizationId) {
      return
    }

    loadAuditPeriods(organizationId)
  }, [accessLoading, isAuthorized, loadAuditPeriods, profile?.organization_id])

  const loadData = useCallback(
    async (organizationId: string) => {
      try {
        const filtersPayload =
          statusFilter || periodFilter
            ? {
                ...(statusFilter ? { status: statusFilter as AuditStatus } : {}),
                ...(periodFilter ? { period: periodFilter } : {})
              }
            : undefined

        const [plansData, stats] = await Promise.all([
          auditService.getAuditPlans(organizationId, filtersPayload),
          auditService.getAuditStatistics(organizationId, periodFilter ? { period: periodFilter } : undefined)
        ])

        setAuditPlans(plansData)
        setStatistics(stats)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    },
    [auditService, periodFilter, statusFilter]
  )

  useEffect(() => {
    if (accessLoading) {
      return
    }

    if (!isAuthorized) {
      setLoading(false)
      return
    }

    const organizationId = profile?.organization_id
    if (!organizationId) {
      setLoading(false)
      return
    }

    setLoading(true)
    loadData(organizationId)
  }, [accessLoading, isAuthorized, loadData, profile?.organization_id])

  const getStatusColor = (status: AuditStatus) => {
    const colors = {
      planning: 'bg-surface-elevated text-text-primary',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status]
  }

  const followUpBadgeStyles: Record<AuditFollowUpStatus, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    on_hold: 'bg-amber-50 text-amber-700 border border-amber-200',
    reopened: 'bg-rose-50 text-rose-700 border border-rose-200'
  }

  const followUpProgressStyles: Record<AuditFollowUpStatus, string> = {
    completed: 'bg-emerald-500',
    on_hold: 'bg-amber-500',
    reopened: 'bg-rose-500'
  }

  const getAuditTypeLabel = (type: string) => {
    const labels = {
      internal: '内部監査',
      external: '外部監査',
      certification: '認証審査',
      surveillance: '継続運用'
    }
    return labels[type as keyof typeof labels] || type
  }

  const formatDateRange = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return '-'
    const start = new Date(startDate).toLocaleDateString()
    const end = endDate ? new Date(endDate).toLocaleDateString() : ''
    return end ? `${start} - ${end}` : start
  }

  if (accessLoading || (isAuthorized && loading)) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isAuthorized) {
    return (
      <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">{t('accessDenied.title')}</h1>
          <p className="text-text-secondary mb-6">{t('accessDenied.description')}</p>
          {accessError === 'permission_fetch_failed' && (
            <p className="text-sm text-red-600">{t('accessDenied.permissionFetchFailed')}</p>
          )}
        </div>
      </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* 統計情報カード */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mb-8">
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.totalPlans')}</h3>
            <p className="text-2xl font-bold text-text-primary mt-2">{statistics.totalPlans}</p>
            <p className="text-xs text-text-muted mt-1">
              {t('plans.status.planning')}: {safePlansByStatus.planning} / {t('plans.status.in_progress')}: {safePlansByStatus.in_progress}
            </p>
          </div>
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.checklistCompletion')}</h3>
            <p className="text-2xl font-bold text-indigo-600 mt-2">{completionRate}%</p>
            <p className="text-xs text-text-muted mt-1">
              {t('stats.checklistCompletionHint', {
                completed: statistics?.completedChecklistItems ?? 0,
                total: statistics?.totalChecklistItems ?? 0
              })}
            </p>
          </div>
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.totalNonconformities')}</h3>
            <p className="text-2xl font-bold text-red-600 mt-2">{statistics?.totalNonconformities ?? 0}</p>
            <p className="text-xs text-text-muted mt-1">
              重大: {safeNcByType.major}, 軽微: {safeNcByType.minor}
            </p>
          </div>
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.openNCs')}</h3>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              {safeNcByStatus.open + safeNcByStatus.in_progress}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {t('stats.overdueNonconformities', { count: statistics?.overdueNonconformities ?? 0 })}
            </p>
          </div>
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.openCorrectiveActions')}</h3>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{statistics?.openCorrectiveActions ?? 0}</p>
            <p className="text-xs text-text-muted mt-1">
              {t('stats.overdueCorrectiveActions', { count: statistics?.overdueCorrectiveActions ?? 0 })}
            </p>
          </div>
        </div>
      )}

      {statistics && (
        <div className="mb-8 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold text-text-muted">{t('stats.periodHeaderTitle')}</p>
              <p
                data-testid="audit-period-label"
                className="text-lg font-semibold text-text-primary"
              >
                {periodLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {followUpStatusOrder.map(statusKey => (
                <span
                  key={statusKey}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${followUpBadgeStyles[statusKey]}`}
                >
              {t(`plans.followUpStatus.labels.${statusKey}` as const)} {safeFollowUpCounts[statusKey] ?? 0}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div
              data-testid="audit-progress-bar"
              className="flex h-2 overflow-hidden rounded-full bg-surface-elevated"
              role="img"
              aria-label={t('stats.progressBarAriaLabel')}
            >
              {periodStatusSegments.map(segment => (
                <span
                  key={segment.status}
                  className={`${PERIOD_STATUS_COLORS[segment.status]} block`}
                  style={{ width: `${segment.percent}%` }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {periodStatusSegments.map(segment => (
                <div key={segment.status} className="rounded-xl border border-border bg-surface-elevated p-3 text-xs text-text-secondary">
                  <p className="font-semibold text-text-primary">
                    {t(`plans.status.${segment.status}` as const)}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {segment.count} ({segment.percent}%)
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {statistics && (
        <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-2">
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.followUpSummary')}</h3>
            <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
              {followUpStatusOrder.map(statusKey => (
                <div key={statusKey} className="rounded-lg border border-border p-3">
                  <dt className="text-text-muted text-xs">
                    {t(`plans.followUpStatus.labels.${statusKey}` as const)}
                  </dt>
                  <dd className="text-2xl font-semibold text-text-primary">
                      {safeFollowUpCounts[statusKey] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary">{t('stats.nonconformitySummary')}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              {nonconformityStatusOrder.map(statusKey => (
                <div key={statusKey} className="rounded-lg border border-border p-3">
                  <dt className="text-text-muted text-xs">
                    {t(`nonconformities.status.${statusKey}` as const)}
                  </dt>
                  <dd className="text-2xl font-semibold text-text-primary">
                      {safeNcStatusCounts[statusKey] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-surface p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{t('plans.title')}</h2>
          <p className="text-text-secondary mb-4">{t('plans.description')}</p>
          <Link
            href={`/${locale}/audit/plans/new`}
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('plans.new')}
          </Link>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{t('checklist.title')}</h2>
          <p className="text-text-secondary mb-4">{t('checklist.description')}</p>
          <button
            onClick={() => router.push(`/${locale}/audit/requirements`)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            {t('checklist.view')}
          </button>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{t('nonconformities.title')}</h2>
          <p className="text-text-secondary mb-4">{t('nonconformities.description')}</p>
          <button
            onClick={() => router.push(`/${locale}/audit/nonconformities`)}
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
          >
            {t('nonconformities.list')}
          </button>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{t('reports.title')}</h2>
          <p className="text-text-secondary mb-4">{t('reports.description')}</p>
          <button
            onClick={() => router.push(`/${locale}/audit/reports`)}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
          >
            {t('reports.generate')}
          </button>
        </div>
      </div>

      {/* 監査計画一覧 */}
      <div className="bg-surface shadow-sm rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold">{t('plans.list')}</h2>
          <div className="w-full lg:w-auto">
            <FilterBar items={filterBarItems} />
            {statusFilter && (
              <div className="mt-2">
                <StatusFilterBanner
                  label={t('plans.activeFilters.status', { status: t(`plans.status.${statusFilter}`) })}
                  clearLabel={t('plans.activeFilters.clear')}
                  onClear={() => handleStatusFilterChange('')}
                />
              </div>
            )}
            {periodFilter && (
              <div className="mt-2">
                <StatusFilterBanner
                  label={t('plans.activeFilters.period', { period: periodFilter })}
                  clearLabel={t('plans.activeFilters.clear')}
                  onClear={() => handlePeriodFilterChange('')}
                />
              </div>
            )}
          </div>
        </div>
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-elevated">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.title')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.type')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.plannedDate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.leadAuditor')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.progress')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.followUp')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {t('plans.columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {auditPlans.map(plan => {
                const followUpStatus: AuditFollowUpStatus = plan.progressSummary?.followUpStatus ?? 'completed'
                const followUpStatusLabel = t(`plans.followUpStatus.labels.${followUpStatus}` as const)
                const followUpStatusDescription = t(
                  `plans.followUpStatus.descriptions.${followUpStatus}` as const
                )
                const completedChecklistItems = plan.progressSummary?.completedChecklistItems ?? 0
                const totalChecklistItems = plan.progressSummary?.totalChecklistItems ?? 0
                const completionRateValue = plan.progressSummary?.completionRate ?? 0
                const progressAriaLabel = t('plans.progress.ariaLabel', {
                  statusDescription: followUpStatusDescription,
                  completed: completedChecklistItems,
                  total: totalChecklistItems,
                  rate: completionRateValue
                })

                return (
                  <tr key={plan.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/${locale}/audit/plans/${plan.id}`}
                      className="text-sm font-medium text-text-primary hover:text-blue-600"
                    >
                      {plan.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {plan.audit_period && (
                        <span className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                          {plan.audit_period}
                        </span>
                      )}
                      {followUpStatus === 'reopened' && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                          data-testid="audit-reopened-badge"
                          title={followUpStatusDescription}
                          aria-label={`${followUpStatusLabel}: ${followUpStatusDescription}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
                          {followUpStatusLabel}
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-text-muted mt-1">{plan.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    {plan.audit_type && getAuditTypeLabel(plan.audit_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    {formatDateRange(plan.planned_start_date, plan.planned_end_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    {plan.lead_auditor?.full_name || plan.lead_auditor?.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary w-56">
                    <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                      <span>
                        {t('plans.progress.checklistCount', {
                          completed: completedChecklistItems,
                          total: totalChecklistItems
                        })}
                      </span>
                      <span className="font-semibold text-text-primary">
                        {completionRateValue}%
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-surface-elevated"
                      role="img"
                      aria-label={progressAriaLabel}
                      data-testid="audit-progress-bar"
                      title={progressAriaLabel}
                    >
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          followUpProgressStyles[followUpStatus]
                        }`}
                        style={{ width: `${completionRateValue}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${followUpBadgeStyles[followUpStatus]}`}
                      title={followUpStatusDescription}
                    >
                      {followUpStatusLabel}
                    </span>
                    <p className="text-xs text-text-muted mt-1">
                      {t('plans.followUpStatus.openCount', {
                        count: plan.progressSummary?.openNonconformities ?? 0
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                      {t(`plans.status.${plan.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {plan.status === 'planning' && (
                        <Link
                          href={`/${locale}/audit/plans/${plan.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {t('actions.edit')}
                        </Link>
                      )}
                      {(plan.status === 'scheduled' || plan.status === 'in_progress') && (
                        <Link
                          href={`/${locale}/audit/plans/${plan.id}/checklist`}
                          className="text-green-600 hover:text-green-900"
                        >
                          {t('actions.execute')}
                        </Link>
                      )}
                      {plan.status === 'completed' && !plan.report && (
                        <Link
                          href={`/${locale}/audit/plans/${plan.id}/report`}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          {t('actions.report')}
                        </Link>
                      )}
                      <Link
                        href={`/${locale}/audit/plans/${plan.id}`}
                        className="text-text-secondary hover:text-text-primary"
                      >
                        {t('actions.view')}
                      </Link>
                    </div>
                  </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
        {auditPlans.length === 0 && (
          <EmptyState
            title={periodFilter ? t('plans.emptyStateForPeriod', { period: periodFilter }) : t('plans.noPlan')}
          />
        )}
      </div>

      {/* 次回監査予定 */}
      {upcomingAudits.length > 0 && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">{t('upcoming.title')}</h3>
          <div className="space-y-2">
            {upcomingAudits.slice(0, 3).map((audit) => (
              <div key={audit.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-blue-900">{audit.title}</p>
                  <p className="text-sm text-blue-700">
                    {audit.planned_start_date && new Date(audit.planned_start_date).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`/${locale}/audit/plans/${audit.id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  詳細を見る
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-text-primary">{t('nextActions.title')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('nextActions.description')}</p>
        </div>

        {nextActions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-text-muted">
            {t('nextActions.empty')}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {nextActions.map(action => (
              <div
                key={action.id}
                data-testid="audit-next-action"
                className="rounded-lg border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t(`nextActions.types.${action.type}`)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${priorityStyles[action.priority]}`}>
                    {t(`nextActions.priority.${action.priority}`)}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-base font-semibold text-text-primary">{action.planTitle || t('nextActions.labels.unnamedPlan')}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{formatActionDescription(action)}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
                  {action.dueDate ? (
                    <time dateTime={action.dueDate} className="flex items-center gap-1 font-medium text-text-secondary">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                      </svg>
                      {t('nextActions.labels.dueDate', {
                        date: new Date(action.dueDate).toLocaleDateString()
                      })}
                    </time>
                  ) : (
                    <span>{t('nextActions.labels.noDueDate')}</span>
                  )}
                  <Link
                    href={resolveActionLink(action)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {t('nextActions.labels.viewDetails')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  )
}
