'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useTranslations } from 'next-intl'
import type { ManagementReviewRecord } from '@/lib/services/managementReview'
import {
  managementReviewStatusValues,
  type ManagementReviewStatus
} from '@/lib/db/drizzle/schema/management-reviews'

export default function ManagementReviewsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('managementReview')
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = `/${locale}/management-reviews`
  const [reviews, setReviews] = useState<ManagementReviewRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<ManagementReviewStatus | ''>(
    () => (searchParams?.get('status') as ManagementReviewStatus | '') ?? ''
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updateStatusFilter = useCallback(
    (value: ManagementReviewStatus | '') => {
      setStatusFilter(value)
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (value) {
        params.set('status', value)
      } else {
        params.delete('status')
      }
      const target = params.toString()
      router.replace(target ? `${basePath}?${target}` : basePath, { scroll: false })
    },
    [basePath, router, searchParams]
  )

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/management-reviews')
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        setReviews(json.data ?? [])
      } catch (err) {
        console.error(err)
        setError(t('errors.loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [t])

  useEffect(() => {
    if (!searchParams) return
    const nextStatus = (searchParams.get('status') as ManagementReviewStatus | '') ?? ''
    setStatusFilter(current => (current === nextStatus ? current : nextStatus))
  }, [searchParams])

  const filteredReviews = useMemo(
    () => reviews.filter(review => !statusFilter || review.status === statusFilter),
    [reviews, statusFilter]
  )

  const statusCounts = useMemo(() => {
    const initial = managementReviewStatusValues.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<ManagementReviewStatus, number>
    )
    reviews.forEach(review => {
      initial[review.status] = (initial[review.status] ?? 0) + 1
    })
    return initial
  }, [reviews])

  const statusBadgeClass = useMemo<Record<string, string>>(
    () => ({
      planned: 'bg-surface-elevated text-text-secondary',
      scheduled: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-rose-100 text-rose-700',
    }),
    []
  )

  return (
    <DashboardLayout locale={locale}>
      <div className='px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-text-primary'>{t('title')}</h1>
            <p className='mt-1 text-sm text-text-secondary'>{t('description')}</p>
          </div>
          <Link
            href={`/${locale}/management-reviews/new`}
            className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
          >
            {t('list.createNew')}
          </Link>
        </div>

        <div className='mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-sm font-medium text-text-primary'>{t('list.filters.title')}</p>
            <p className='text-xs text-text-muted'>{t('list.filters.subtitle')}</p>
          </div>
          <div className='flex items-center gap-2'>
            <label htmlFor='management-review-status-filter' className='text-xs font-medium text-text-secondary'>
              {t('list.filters.status')}
            </label>
            <select
              id='management-review-status-filter'
              data-testid='management-review-status-filter'
              value={statusFilter}
              onChange={(event) => updateStatusFilter(event.target.value as ManagementReviewStatus | '')}
              className='rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
            >
              <option value=''>{t('list.filters.allStatuses')}</option>
              {managementReviewStatusValues.map(status => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && !error && (
          <section
            data-testid='management-review-status-summary'
            className='mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6'
            aria-label={t('list.summary.title')}
          >
            <Link
              href={`/${locale}/management-reviews`}
              data-testid='management-review-status-summary-all'
              className={`rounded-lg border p-4 transition hover:shadow-sm ${
                statusFilter === ''
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-border bg-surface hover:border-blue-100'
              }`}
            >
              <p className='text-xs font-medium text-text-muted'>{t('list.summary.all')}</p>
              <p className='mt-2 text-2xl font-semibold text-text-primary'>{reviews.length}</p>
              <p className='mt-1 text-xs text-text-muted'>{t('list.summary.unit')}</p>
            </Link>
            {managementReviewStatusValues.map(status => (
              <Link
                key={status}
                href={`/${locale}/management-reviews?status=${status}`}
                data-testid={`management-review-status-summary-${status}`}
                className={`rounded-lg border p-4 transition hover:shadow-sm ${
                  statusFilter === status
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-border bg-surface hover:border-blue-100'
                }`}
              >
                <p className='text-xs font-medium text-text-muted'>{t(`status.${status}`)}</p>
                <p className='mt-2 text-2xl font-semibold text-text-primary'>{statusCounts[status] ?? 0}</p>
                <p className='mt-1 text-xs text-text-muted'>{t('list.summary.unit')}</p>
              </Link>
            ))}
          </section>
        )}

        {statusFilter && !loading && !error && (
          <div
            data-testid='management-review-active-status-filter'
            className='mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700'
          >
            {t('list.filters.activeStatus', { status: t(`status.${statusFilter}`) })}
          </div>
        )}

        {loading && (
          <div className='rounded-lg border border-border bg-surface p-6 text-sm text-text-muted'>
            Loading...
          </div>
        )}
        {!loading && error && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>
        )}

        {!loading && !error && (
          <div className='overflow-hidden rounded-lg border border-border bg-surface'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-elevated'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>
                    {t('new.titleLabel')}
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>
                    {t('detail.reviewDate')}
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>
                    {t('new.statusLabel')}
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>
                    {t('detail.location')}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {filteredReviews.length === 0 && (
                  <tr>
                    <td colSpan={4} className='px-4 py-10 text-center text-sm text-text-muted'>
                      {statusFilter ? t('list.emptyForStatus', { status: t(`status.${statusFilter}`) }) : t('list.empty')}
                    </td>
                  </tr>
                )}
                {filteredReviews.map((review) => (
                  <tr key={review.id}>
                    <td className='px-4 py-3 text-sm text-text-primary'>
                      <Link
                        href={`/${locale}/management-reviews/${review.id}`}
                        className='font-medium text-blue-700 hover:underline'
                      >
                        {review.title}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-primary'>
                      {new Date(review.review_date).toLocaleDateString(locale)}
                    </td>
                    <td className='px-4 py-3 text-sm'>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[review.status] ?? statusBadgeClass.planned}`}
                      >
                        {t(`status.${review.status}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-primary'>
                      {review.location ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
