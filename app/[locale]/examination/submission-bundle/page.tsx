'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { OrganizationService } from '@/lib/services/organization'
import { UserService } from '@/lib/services/user'
import type { UserProfile } from '@/lib/services/user'
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

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
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

      if (!allowedRoles.has(user.role)) {
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
            {bundle && (
              <p className="mt-3 text-sm text-text-muted">
                {t('organizationLine', {
                  name: bundle.organization.name,
                  phase: bundle.organization.ismsPhase ?? '-',
                  role: currentUser?.role ?? '-',
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
          <div
            className="rounded-lg border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950"
            data-testid="submission-bundle-review-notice"
          >
            <p className="font-semibold">{t('reviewNotice.title')}</p>
            <p className="mt-1">{t('reviewNotice.body')}</p>
          </div>

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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!organizationId || !bundle || isDownloading || isDownloadingPdf}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    data-testid="submission-bundle-next-action-pdf"
                  >
                    {isDownloadingPdf ? t('actions.downloadingPdf') : t('actions.downloadPdf')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={!organizationId || !bundle || isDownloading || isDownloadingPdf}
                    className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-surface px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    data-testid="submission-bundle-next-action-zip"
                  >
                    {isDownloading ? t('actions.downloadingZip') : t('actions.downloadZip')}
                  </button>
                </div>
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
                    <p className="mt-1 text-sm text-text-muted">
                      {t('items.countAndSources', {
                        count: item.count,
                        sources: item.sources.join(', '),
                      })}
                    </p>
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
                          {entry}
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
