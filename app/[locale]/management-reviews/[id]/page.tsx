'use client'

import { useEffect, useMemo, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useTranslations } from 'next-intl'
import { managementReviewStatusValues, reviewItemTypeValues, reviewActionStatusValues } from '@/lib/db/drizzle/schema'
import type {
  ManagementReviewWithRelations,
  ManagementReviewItemRecord,
  ManagementReviewActionRecord,
} from '@/lib/services/managementReview'

export default function ManagementReviewDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>
  }
) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('managementReview')
  const router = useRouter()

  const [review, setReview] = useState<ManagementReviewWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editConclusions, setEditConclusions] = useState('')

  // Action form state
  const [showActionForm, setShowActionForm] = useState(false)
  const [actionTitle, setActionTitle] = useState('')
  const [actionDescription, setActionDescription] = useState('')
  const [actionDueDate, setActionDueDate] = useState('')
  const [actionStatus, setActionStatus] = useState('open')

  const loadReview = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/management-reviews/${id}`)
      if (!res.ok) throw new Error('Not found')
      const json = await res.json()
      setReview(json.data)
    } catch (err) {
      console.error(err)
      setError(t('errors.notFound'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    loadReview()
  }, [loadReview])

  const startEditing = () => {
    if (!review) return
    setEditTitle(review.title)
    setEditStatus(review.status)
    setEditMinutes(review.minutes ?? '')
    setEditConclusions(review.conclusions ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/management-reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          status: editStatus,
          minutes: editMinutes.trim() || null,
          conclusions: editConclusions.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setEditing(false)
      await loadReview()
    } catch (err) {
      console.error(err)
      setError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('detail.deleteConfirm'))) return
    try {
      await fetch(`/api/management-reviews/${id}`, { method: 'DELETE' })
      router.push(`/${locale}/management-reviews`)
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actionTitle.trim()) return

    try {
      const res = await fetch(`/api/management-reviews/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: actionTitle.trim(),
          description: actionDescription.trim() || null,
          due_date: actionDueDate ? new Date(actionDueDate).toISOString() : null,
          status: actionStatus,
        }),
      })
      if (!res.ok) throw new Error('Failed to create action')
      setActionTitle('')
      setActionDescription('')
      setActionDueDate('')
      setActionStatus('open')
      setShowActionForm(false)
      await loadReview()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExport = () => {
    window.open(`/api/management-reviews/export?id=${id}`, '_blank')
  }

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

  const actionStatusBadgeClass = useMemo<Record<string, string>>(
    () => ({
      open: 'bg-surface-elevated text-text-secondary',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-emerald-100 text-emerald-700',
      overdue: 'bg-rose-100 text-rose-700',
      cancelled: 'bg-surface-elevated text-text-muted',
    }),
    []
  )

  if (loading) {
    return (
      <DashboardLayout locale={locale}>
        <div className='px-4 py-8 sm:px-6 lg:px-8'>
          <div className='rounded-lg border border-border bg-surface p-6 text-sm text-text-muted'>Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !review) {
    return (
      <DashboardLayout locale={locale}>
        <div className='px-4 py-8 sm:px-6 lg:px-8'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700'>
            {error ?? t('errors.notFound')}
          </div>
          <Link href={`/${locale}/management-reviews`} className='mt-4 inline-block text-sm text-blue-700 hover:underline'>
            {t('detail.back')}
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const parsedAgenda: string[] = review.agenda ? (() => { try { return JSON.parse(review.agenda) } catch { return [] } })() : []

  return (
    <DashboardLayout locale={locale}>
      <div className='px-4 py-8 sm:px-6 lg:px-8' data-testid={`management-review-detail-${review.id}`}>
        {/* Header */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <Link href={`/${locale}/management-reviews`} className='text-sm text-blue-700 hover:underline'>
              {t('detail.back')}
            </Link>
            {editing ? (
              <input
                type='text'
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className='mt-2 block w-full rounded-md border border-border px-3 py-2 text-2xl font-bold shadow-sm'
              />
            ) : (
              <h1 className='mt-2 text-2xl font-bold text-text-primary'>{review.title}</h1>
            )}
          </div>
          <div className='flex gap-2'>
            {!editing && (
              <>
                <button data-testid='management-review-edit' onClick={startEditing} className='rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary hover:bg-surface-hover'>
                  {t('detail.edit')}
                </button>
                <button onClick={handleExport} className='rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary hover:bg-surface-hover'>
                  {t('detail.export')}
                </button>
                <button onClick={handleDelete} className='rounded-md border border-red-300 bg-surface px-3 py-2 text-sm text-red-700 hover:bg-red-50'>
                  {t('detail.delete')}
                </button>
              </>
            )}
            {editing && (
              <>
                <button data-testid='management-review-save' onClick={handleSave} disabled={saving} className='rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'>
                  {saving ? '...' : t('detail.save')}
                </button>
                <button onClick={() => setEditing(false)} className='rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary hover:bg-surface-hover'>
                  {t('detail.cancel')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Review Info */}
        <div className='mb-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2'>
          <div>
            <span className='text-xs font-semibold uppercase text-text-muted'>{t('detail.reviewDate')}</span>
            <p className='mt-1 text-sm text-text-primary'>{new Date(review.review_date).toLocaleDateString(locale)}</p>
          </div>
          <div>
            <span className='text-xs font-semibold uppercase text-text-muted'>{t('new.statusLabel')}</span>
            {editing ? (
              <select
                data-testid='management-review-status'
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className='mt-1 block w-full rounded-md border border-border px-2 py-1 text-sm'
              >
                {managementReviewStatusValues.map((s) => (
                  <option key={s} value={s}>{t(`status.${s}`)}</option>
                ))}
              </select>
            ) : (
              <p className='mt-1'>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[review.status] ?? ''}`}>
                  {t(`status.${review.status}`)}
                </span>
              </p>
            )}
          </div>
          {review.location && (
            <div>
              <span className='text-xs font-semibold uppercase text-text-muted'>{t('detail.location')}</span>
              <p className='mt-1 text-sm text-text-primary'>{review.location}</p>
            </div>
          )}
        </div>

        {/* Agenda */}
        {parsedAgenda.length > 0 && (
          <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
            <h2 className='mb-3 text-lg font-semibold text-text-primary'>{t('detail.agenda')}</h2>
            <ul className='list-inside list-disc space-y-1 text-sm text-text-primary'>
              {parsedAgenda.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Minutes */}
        <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
          <h2 className='mb-3 text-lg font-semibold text-text-primary'>{t('detail.minutes')}</h2>
          {editing ? (
            <textarea
              data-testid='management-review-minutes'
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              rows={6}
              className='w-full rounded-md border border-border px-3 py-2 text-sm'
            />
          ) : (
            <p className='whitespace-pre-wrap text-sm text-text-primary'>
              {review.minutes || '-'}
            </p>
          )}
        </div>

        {/* Conclusions */}
        <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
          <h2 className='mb-3 text-lg font-semibold text-text-primary'>{t('detail.conclusions')}</h2>
          {editing ? (
            <textarea
              data-testid='management-review-conclusions'
              value={editConclusions}
              onChange={(e) => setEditConclusions(e.target.value)}
              rows={4}
              className='w-full rounded-md border border-border px-3 py-2 text-sm'
            />
          ) : (
            <p className='whitespace-pre-wrap text-sm text-text-primary'>
              {review.conclusions || '-'}
            </p>
          )}
        </div>

        {/* Review Items */}
        <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
          <h2 className='mb-3 text-lg font-semibold text-text-primary'>{t('detail.items')}</h2>
          {review.items.length === 0 ? (
            <p className='text-sm text-text-muted'>{t('item.empty')}</p>
          ) : (
            <div className='space-y-3'>
              {review.items.map((item) => (
                <div key={item.id} data-testid={`management-review-item-${item.id}`} className='rounded-md border border-border bg-surface-hover p-4'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <span className='inline-flex rounded bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary'>
                        {t(`itemType.${item.item_type}`)}
                      </span>
                      <h3 className='mt-1 text-sm font-medium text-text-primary'>{item.title}</h3>
                      {item.description && <p className='mt-1 text-sm text-text-secondary'>{item.description}</p>}
                    </div>
                    {item.related_area && (
                      <span className='text-xs text-text-muted'>{t(`relatedArea.${item.related_area}`)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Items */}
        <div className='rounded-lg border border-border bg-surface p-6'>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-text-primary'>{t('detail.actions')}</h2>
            <button
              data-testid='management-review-action-add-open'
              onClick={() => setShowActionForm(!showActionForm)}
              className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700'
            >
              {t('action.add')}
            </button>
          </div>

          {showActionForm && (
            <form data-testid='management-review-action-form' onSubmit={handleAddAction} className='mb-4 rounded-md border border-blue-200 bg-blue-50 p-4'>
              <div className='mb-3'>
                <label className='block text-xs font-medium text-text-primary'>{t('action.title')} *</label>
                <input
                  data-testid='management-review-action-title'
                  type='text'
                  required
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className='mt-1 block w-full rounded-md border border-border px-2 py-1.5 text-sm'
                />
              </div>
              <div className='mb-3'>
                <label className='block text-xs font-medium text-text-primary'>{t('action.description')}</label>
                <textarea
                  data-testid='management-review-action-description'
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  rows={2}
                  className='mt-1 block w-full rounded-md border border-border px-2 py-1.5 text-sm'
                />
              </div>
              <div className='mb-3 grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-medium text-text-primary'>{t('action.dueDate')}</label>
                  <input
                    data-testid='management-review-action-due-date'
                    type='date'
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    className='mt-1 block w-full rounded-md border border-border px-2 py-1.5 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-text-primary'>{t('action.status')}</label>
                  <select
                    data-testid='management-review-action-status'
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value)}
                    className='mt-1 block w-full rounded-md border border-border px-2 py-1.5 text-sm'
                  >
                    {reviewActionStatusValues.map((s) => (
                      <option key={s} value={s}>{t(`actionStatus.${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className='flex gap-2'>
                <button data-testid='management-review-action-submit' type='submit' className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700'>
                  {t('action.add')}
                </button>
                <button type='button' onClick={() => setShowActionForm(false)} className='rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary'>
                  {t('detail.cancel')}
                </button>
              </div>
            </form>
          )}

          {review.actions.length === 0 && !showActionForm ? (
            <p className='text-sm text-text-muted'>{t('action.empty')}</p>
          ) : (
            <div className='space-y-2'>
              {review.actions.map((action) => (
                <div key={action.id} data-testid={`management-review-action-${action.id}`} className='flex items-start justify-between rounded-md border border-border bg-surface-hover p-3'>
                  <div>
                    <h3 className='text-sm font-medium text-text-primary'>{action.title}</h3>
                    {action.description && <p className='mt-0.5 text-xs text-text-secondary'>{action.description}</p>}
                    {action.due_date && (
                      <p className='mt-1 text-xs text-text-muted'>
                        {t('action.dueDate')}: {new Date(action.due_date).toLocaleDateString(locale)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${actionStatusBadgeClass[action.status] ?? ''}`}
                  >
                    {t(`actionStatus.${action.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
