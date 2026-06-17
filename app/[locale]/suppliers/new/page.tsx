'use client'

import { useState, use } from 'react';
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useTranslations } from 'next-intl'
import { supplierTypeValues, supplierStatusValues, supplierRiskLevelValues } from '@/lib/db/drizzle/schema/suppliers'

export default function NewSupplierPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('suppliers')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'current',
          name: form.get('name'),
          type: form.get('type'),
          contact_name: form.get('contactName') || undefined,
          contact_email: form.get('contactEmail') || undefined,
          contact_phone: form.get('contactPhone') || undefined,
          website: form.get('website') || undefined,
          description: form.get('description') || undefined,
          status: form.get('status') || 'active',
          risk_level: form.get('riskLevel') || 'medium',
        }),
      })

      if (!res.ok) throw new Error('Failed to create')

      router.push(`/${locale}/suppliers`)
    } catch (err) {
      console.error(err)
      setError(t('errors.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mb-6'>
          <Link href={`/${locale}/suppliers`} className='text-sm text-blue-600 hover:underline'>
            {t('backToList')}
          </Link>
          <h1 className='mt-2 text-2xl font-bold text-text-primary'>{t('newTitle')}</h1>
          <p className='mt-1 text-sm text-text-secondary'>{t('newDescription')}</p>
        </div>

        {error && <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

        <form onSubmit={handleSubmit} className='space-y-6 rounded-lg border border-border bg-surface p-6'>
          <div>
            <label htmlFor='name' className='block text-sm font-medium text-text-secondary'>{t('form.name')}</label>
            <input id='name' name='name' type='text' required className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' />
          </div>

          <div>
            <label htmlFor='type' className='block text-sm font-medium text-text-secondary'>{t('form.type')}</label>
            <select id='type' name='type' required className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'>
              {supplierTypeValues.map(v => (
                <option key={v} value={v}>{t(`type.${v}`)}</option>
              ))}
            </select>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div>
              <label htmlFor='contactName' className='block text-sm font-medium text-text-secondary'>{t('form.contactName')}</label>
              <input id='contactName' name='contactName' type='text' className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' />
            </div>
            <div>
              <label htmlFor='contactEmail' className='block text-sm font-medium text-text-secondary'>{t('form.contactEmail')}</label>
              <input id='contactEmail' name='contactEmail' type='email' className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' />
            </div>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div>
              <label htmlFor='contactPhone' className='block text-sm font-medium text-text-secondary'>{t('form.contactPhone')}</label>
              <input id='contactPhone' name='contactPhone' type='tel' className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' />
            </div>
            <div>
              <label htmlFor='website' className='block text-sm font-medium text-text-secondary'>{t('form.website')}</label>
              <input id='website' name='website' type='url' className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' />
            </div>
          </div>

          <div>
            <label htmlFor='description' className='block text-sm font-medium text-text-secondary'>{t('form.description')}</label>
            <textarea id='description' name='description' rows={3} className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' />
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div>
              <label htmlFor='status' className='block text-sm font-medium text-text-secondary'>{t('form.status')}</label>
              <select id='status' name='status' className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'>
                {supplierStatusValues.map(v => (
                  <option key={v} value={v}>{t(`status.${v}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor='riskLevel' className='block text-sm font-medium text-text-secondary'>{t('form.riskLevel')}</label>
              <select id='riskLevel' name='riskLevel' defaultValue='medium' className='mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'>
                {supplierRiskLevelValues.map(v => (
                  <option key={v} value={v}>{t(`riskLevel.${v}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className='flex justify-end gap-3'>
            <Link href={`/${locale}/suppliers`} className='rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover'>
              {t('cancel')}
            </Link>
            <button type='submit' disabled={submitting} className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'>
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
