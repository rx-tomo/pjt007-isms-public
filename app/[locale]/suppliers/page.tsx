'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useTranslations } from 'next-intl'
import type { SupplierRecord } from '@/lib/services/supplier'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'

export default function SuppliersPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('suppliers')
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/suppliers?organizationId=current')
        if (!res.ok) throw new Error('Failed to load')
        const json = await res.json()
        setSuppliers(json.data ?? [])
      } catch (err) {
        console.error(err)
        setError(t('errors.loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [t])

  const statusBadgeClass = useMemo<Record<string, string>>(
    () => ({
      active: 'bg-emerald-100 text-emerald-700',
      inactive: 'bg-surface-elevated text-text-secondary',
      under_review: 'bg-amber-100 text-amber-700',
      terminated: 'bg-rose-100 text-rose-700',
    }),
    []
  )

  const riskBadgeClass = useMemo<Record<string, string>>(
    () => ({
      low: 'bg-emerald-100 text-emerald-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-rose-100 text-rose-700',
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
          <Link href={`/${locale}/suppliers/new`} className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'>
            {t('new')}
          </Link>
        </div>

        {loading && (
          <div className='flex h-48 items-center justify-center'>
            <LoadingSpinner size='lg' />
          </div>
        )}
        {!loading && error && <ErrorMessage message={error} onRetry={() => { window.location.reload() }} />}

        {!loading && !error && suppliers.length === 0 && (
          <EmptyState
            title={t('empty')}
          />
        )}

        {!loading && !error && suppliers.length > 0 && (
          <div className='overflow-hidden rounded-lg border border-border bg-surface'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-app'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.name')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.type')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.status')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.riskLevel')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.contactName')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.contactEmail')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {suppliers.map(supplier => (
                  <tr key={supplier.id}>
                    <td className='px-4 py-3 text-sm text-text-primary'>
                      <Link href={`/${locale}/suppliers/${supplier.id}`} className='font-medium text-blue-700 hover:underline'>
                        {supplier.name}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{t(`type.${supplier.type}`)}</td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[supplier.status] ?? statusBadgeClass.active}`}>
                        {t(`status.${supplier.status}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${riskBadgeClass[supplier.risk_level] ?? riskBadgeClass.medium}`}>
                        {t(`riskLevel.${supplier.risk_level}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{supplier.contact_name ?? '-'}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{supplier.contact_email ?? '-'}</td>
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
