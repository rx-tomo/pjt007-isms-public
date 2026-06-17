'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout'
import { BcpService, type BcpPlanRecord } from '@/lib/services/bcp'
import { OrganizationService } from '@/lib/services/organization'
import { useTranslations } from 'next-intl'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'

const bcpService = new BcpService()
const organizationService = new OrganizationService()

export default function BcpPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('bcp')
  const [plans, setPlans] = useState<BcpPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const organization = await organizationService.getCurrentOrganization()
        if (!organization?.id) {
          setPlans([])
          return
        }
        const records = await bcpService.listPlans(organization.id)
        setPlans(records)
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
      draft: 'bg-surface-elevated text-text-secondary',
      active: 'bg-emerald-100 text-emerald-700',
      under_review: 'bg-amber-100 text-amber-700',
      archived: 'bg-violet-100 text-violet-700'
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
          <Link href={`/${locale}/bcp/new`} className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'>
            {t('new')}
          </Link>
        </div>

        {loading && (
          <div className='flex h-48 items-center justify-center'>
            <LoadingSpinner size='lg' />
          </div>
        )}
        {!loading && error && <ErrorMessage message={error} onRetry={() => { window.location.reload() }} />}

        {!loading && !error && plans.length === 0 && (
          <EmptyState
            title={t('empty')}
          />
        )}

        {!loading && !error && plans.length > 0 && (
          <div className='overflow-hidden rounded-lg border border-border bg-surface'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-app'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.title')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.status')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.version')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.updatedAt')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {plans.map(plan => (
                  <tr key={plan.id}>
                    <td className='px-4 py-3 text-sm text-text-primary'>
                      <Link href={`/${locale}/bcp/${plan.id}`} className='font-medium text-blue-700 hover:underline'>
                        {plan.title}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[plan.status] ?? statusBadgeClass.draft}`}>
                        {t(`status.${plan.status}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{plan.version || '-'}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{new Date(plan.updated_at).toLocaleString(locale)}</td>
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
