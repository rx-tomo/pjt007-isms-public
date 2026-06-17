'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout'
import { IncidentService, type IncidentRecord } from '@/lib/services/incident'
import { OrganizationService } from '@/lib/services/organization'
import { useTranslations } from 'next-intl'

const incidentService = new IncidentService()
const organizationService = new OrganizationService()

export default function IncidentsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('incidents')
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const organization = await organizationService.getCurrentOrganization()
        if (!organization?.id) {
          setIncidents([])
          return
        }
        const records = await incidentService.list(organization.id)
        setIncidents(records)
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
      in_progress: 'bg-blue-100 text-blue-700',
      resolved: 'bg-emerald-100 text-emerald-700',
      closed: 'bg-violet-100 text-violet-700'
    }),
    []
  )
  const approvalBadgeClass = useMemo<Record<string, string>>(
    () => ({
      none: 'bg-surface-elevated text-text-secondary',
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-rose-100 text-rose-700',
      expired: 'bg-orange-100 text-orange-700'
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
          <Link href={`/${locale}/incidents/new`} className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'>
            {t('new')}
          </Link>
        </div>

        {loading && <div className='rounded-lg border border-border bg-surface p-6 text-sm text-text-muted'>{t('loading')}</div>}
        {!loading && error && <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>}

        {!loading && !error && (
          <div className='overflow-hidden rounded-lg border border-border bg-surface'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-app'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.title')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.severity')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.status')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.approval')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('table.occurredAt')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={5} className='px-4 py-10 text-center text-sm text-text-muted'>
                      {t('empty')}
                    </td>
                  </tr>
                )}
                {incidents.map(incident => (
                  <tr key={incident.id}>
                    <td className='px-4 py-3 text-sm text-text-primary'>
                      <Link href={`/${locale}/incidents/${incident.id}`} className='font-medium text-blue-700 hover:underline'>
                        {incident.title}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{t(`severity.${incident.severity}`)}</td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[incident.status] ?? statusBadgeClass.draft}`}>
                        {t(`status.${incident.status}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${approvalBadgeClass[incident.approval_status ?? 'none'] ?? approvalBadgeClass.none}`}>
                        {t(`approvalStatus.${incident.approval_status ?? 'none'}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>
                      {new Date(incident.occurred_at).toLocaleString(locale)}
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
