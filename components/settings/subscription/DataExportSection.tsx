'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface DataExportSectionProps {
  organizationId: string
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  currentPeriodEnd: string | null
  locale: string
}

type OffboardingStatus = {
  retentionDays: number
  schedule: {
    endedAt: string | null
    retentionUntil: string | null
    deletionScheduledAt: string | null
    deletionStatus: string
    dueForDeletion: boolean
  } | null
  requests: Array<{
    id: string
    requestedAt: string
    status: string
    executionScheduledAt: string | null
    customerNotice: string | null
  }>
  runs: Array<{
    id: string
    startedAt: string
    completedAt: string | null
    result: string
    customerEvidence: string | null
  }>
}

export default function DataExportSection({
  organizationId,
  subscriptionStatus,
  cancelAtPeriodEnd,
  canceledAt,
  currentPeriodEnd,
  locale
}: DataExportSectionProps) {
  const t = useTranslations('settings.subscription.dataExport')
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [offboardingStatus, setOffboardingStatus] = useState<OffboardingStatus | null>(null)

  const RETENTION_DAYS = offboardingStatus?.retentionDays ?? 30

  const isCanceled = subscriptionStatus === 'canceled' || cancelAtPeriodEnd

  const scheduledAt = offboardingStatus?.schedule?.deletionScheduledAt ?? null
  const deletionDate = scheduledAt
    ? new Date(scheduledAt)
    : canceledAt
      ? new Date(new Date(canceledAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
      : currentPeriodEnd && cancelAtPeriodEnd
        ? new Date(new Date(currentPeriodEnd).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
        : null

  const daysRemaining = deletionDate
    ? Math.max(0, Math.ceil((deletionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null

  const formatDate = useCallback(
    (date: Date) => {
      return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },
    [locale]
  )

  const loadOffboardingStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/offboarding/status?organizationId=${organizationId}`, {
        credentials: 'include',
        cache: 'no-store'
      })
      if (!response.ok) return
      const payload = await response.json()
      setOffboardingStatus(payload.data ?? null)
    } catch (err) {
      console.warn('Failed to load offboarding status', err)
    }
  }, [organizationId])

  useEffect(() => {
    void loadOffboardingStatus()
  }, [loadOffboardingStatus])

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportSuccess(null)

    try {
      const response = await fetch(`/api/export/backup?organizationId=${organizationId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `isms-data-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportSuccess(t('export.success'))
    } catch (err) {
      console.error('Export failed:', err)
      setExportError(t('errors.exportFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    setRequestSuccess(null)

    try {
      const response = await fetch(`/api/offboarding/early-delete-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId, reason: deleteReason })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Delete failed')
      }

      setShowDeleteConfirm(false)
      setDeleteReason('')
      setRequestSuccess(t('earlyDelete.success'))
      await loadOffboardingStatus()
    } catch (err) {
      console.error('Early delete request failed:', err)
      setDeleteError(t('earlyDelete.error'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="bg-surface shadow overflow-hidden sm:rounded-lg mb-8">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-text-primary">{t('title')}</h3>
        <p className="mt-1 text-sm text-text-muted">
          {t('description', { days: RETENTION_DAYS })}
        </p>
      </div>

      <div className="border-t border-border px-4 py-5 sm:px-6">
        {exportError && (
          <div className="rounded-md bg-red-50 p-3 mb-4">
            <p className="text-sm text-red-800">{exportError}</p>
          </div>
        )}

        {exportSuccess && (
          <div className="rounded-md bg-green-50 p-3 mb-4">
            <p className="text-sm text-green-800">{exportSuccess}</p>
          </div>
        )}

        {deleteError && (
          <div className="rounded-md bg-red-50 p-3 mb-4">
            <p className="text-sm text-red-800">{deleteError}</p>
          </div>
        )}

        {requestSuccess && (
          <div className="rounded-md bg-green-50 p-3 mb-4">
            <p className="text-sm text-green-800">{requestSuccess}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-secondary mb-2">{t('export.label')}</p>
            <p className="text-xs text-text-muted mb-3">{t('export.formats')}</p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('export.loading')}
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {t('export.button')}
                </>
              )}
            </button>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-surface-elevated p-3">
                <p className="text-xs font-medium text-text-secondary">{t('scope.title')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('scope.body')}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-elevated p-3">
                <p className="text-xs font-medium text-text-secondary">{t('externalFiles.title')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('externalFiles.body')}</p>
              </div>
            </div>
          </div>

          {isCanceled && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="rounded-md bg-yellow-50 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      {t('cancelled.status')}
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      {canceledAt && (
                        <p>
                          {t('cancelled.cancelledAt', {
                            date: formatDate(new Date(canceledAt))
                          })}
                        </p>
                      )}
                      {deletionDate && (
                        <p>
                          {t('cancelled.deleteAt', {
                            date: formatDate(deletionDate)
                          })}
                        </p>
                      )}
                      {daysRemaining !== null && (
                        <p className="font-medium mt-1">
                          {t('cancelled.daysRemaining', { days: daysRemaining })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-text-muted mb-4">
                {t('cancelled.reimportNote', { days: RETENTION_DAYS })}
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-3 mb-4">
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs text-text-muted">{t('schedule.status')}</dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {t(`schedule.statusValues.${offboardingStatus?.schedule?.deletionStatus ?? 'retention'}` as any)}
                  </dd>
                </div>
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs text-text-muted">{t('schedule.retentionUntil')}</dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {offboardingStatus?.schedule?.retentionUntil ? formatDate(new Date(offboardingStatus.schedule.retentionUntil)) : '-'}
                  </dd>
                </div>
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs text-text-muted">{t('schedule.deletionScheduledAt')}</dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {deletionDate ? formatDate(deletionDate) : '-'}
                  </dd>
                </div>
              </dl>

              {subscriptionStatus === 'canceled' && (
                <div>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-surface hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg
                        className="-ml-1 mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      {t('earlyDelete.button')}
                    </button>
                  ) : (
                    <div className="rounded-md bg-red-50 p-4">
                      <p className="text-sm text-red-800 mb-3">{t('earlyDelete.confirm')}</p>
                      <textarea
                        value={deleteReason}
                        onChange={(event) => setDeleteReason(event.target.value)}
                        rows={3}
                        className="mb-3 block w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-text-primary shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder={t('earlyDelete.reasonPlaceholder')}
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleDeleteConfirm}
                          disabled={isDeleting}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                          {isDeleting ? t('export.loading') : t('earlyDelete.button')}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                          className="inline-flex items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="rounded-md border border-border bg-surface-elevated p-4">
            <h4 className="text-sm font-medium text-text-primary">{t('recovery.title')}</h4>
            <p className="mt-1 text-sm text-text-muted">{t('recovery.body')}</p>
          </div>

          {(offboardingStatus?.requests?.length || offboardingStatus?.runs?.length) ? (
            <div className="rounded-md border border-border p-4">
              <h4 className="text-sm font-medium text-text-primary">{t('evidence.title')}</h4>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                {offboardingStatus.requests.slice(0, 2).map(request => (
                  <p key={request.id}>
                    {t('evidence.request', {
                      status: t(`requestStatus.${request.status}` as any),
                      date: formatDate(new Date(request.requestedAt))
                    })}
                  </p>
                ))}
                {offboardingStatus.runs.slice(0, 2).map(run => (
                  <p key={run.id}>
                    {t('evidence.run', {
                      result: t(`runResult.${run.result}` as any),
                      date: formatDate(new Date(run.startedAt))
                    })}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
