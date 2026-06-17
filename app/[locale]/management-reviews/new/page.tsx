'use client'

import { useState, use } from 'react';
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useTranslations } from 'next-intl'
import { managementReviewStatusValues } from '@/lib/db/drizzle/schema'

export default function NewManagementReviewPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('managementReview')
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [status, setStatus] = useState('planned')
  const [location, setLocation] = useState('')
  const [agenda, setAgenda] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !reviewDate) return

    try {
      setSaving(true)
      setError(null)

      const agendaJson = agenda.trim()
        ? JSON.stringify(agenda.split('\n').filter((line) => line.trim()))
        : null

      const res = await fetch('/api/management-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          review_date: new Date(reviewDate).toISOString(),
          status,
          location: location.trim() || null,
          agenda: agendaJson,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to create')
      }

      const json = await res.json()
      router.push(`/${locale}/management-reviews/${json.data.id}`)
    } catch (err) {
      console.error(err)
      setError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mx-auto max-w-2xl'>
          <h1 className='mb-6 text-2xl font-bold text-text-primary'>{t('new.title')}</h1>

          {error && (
            <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-6'>
            <div>
              <label htmlFor='title' className='block text-sm font-medium text-text-primary'>
                {t('new.titleLabel')} *
              </label>
              <input
                id='title'
                type='text'
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('new.titlePlaceholder')}
                className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>

            <div>
              <label htmlFor='reviewDate' className='block text-sm font-medium text-text-primary'>
                {t('new.reviewDateLabel')} *
              </label>
              <input
                id='reviewDate'
                type='date'
                required
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>

            <div>
              <label htmlFor='status' className='block text-sm font-medium text-text-primary'>
                {t('new.statusLabel')}
              </label>
              <select
                id='status'
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              >
                {managementReviewStatusValues.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor='location' className='block text-sm font-medium text-text-primary'>
                {t('new.locationLabel')}
              </label>
              <input
                id='location'
                type='text'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('new.locationPlaceholder')}
                className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>

            <div>
              <label htmlFor='agenda' className='block text-sm font-medium text-text-primary'>
                {t('new.agendaLabel')}
              </label>
              <textarea
                id='agenda'
                rows={4}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder={t('new.agendaPlaceholder')}
                className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>

            <div className='flex gap-3'>
              <button
                type='submit'
                disabled={saving || !title.trim() || !reviewDate}
                className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
              >
                {saving ? '...' : t('new.create')}
              </button>
              <button
                type='button'
                onClick={() => router.push(`/${locale}/management-reviews`)}
                className='rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover'
              >
                {t('new.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
