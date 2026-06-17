'use client'

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useTranslations } from 'next-intl'
import type { SupplierRecord, SupplierAssessmentRecord, SupplierContractRecord } from '@/lib/services/supplier'

export default function SupplierDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('suppliers')
  const router = useRouter()
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null)
  const [assessments, setAssessments] = useState<SupplierAssessmentRecord[]>([])
  const [contracts, setContracts] = useState<SupplierContractRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const [supplierRes, assessmentsRes, contractsRes] = await Promise.all([
          fetch(`/api/suppliers/${id}`),
          fetch(`/api/suppliers/${id}/assessments`),
          fetch(`/api/suppliers/${id}/assessments`), // contracts route can be added later
        ])

        if (!supplierRes.ok) throw new Error('Failed to load supplier')

        const supplierJson = await supplierRes.json()
        setSupplier(supplierJson.data)

        if (assessmentsRes.ok) {
          const assessmentsJson = await assessmentsRes.json()
          setAssessments(assessmentsJson.data ?? [])
        }

        // Contracts are not fetched from assessments endpoint - use proper endpoint when available
        if (contractsRes.ok) {
          // placeholder: contracts endpoint needed
        }
      } catch (err) {
        console.error(err)
        setError(t('errors.loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, t])

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.push(`/${locale}/suppliers`)
    } catch (err) {
      console.error(err)
      setError(t('errors.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

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

  const resultBadgeClass = useMemo<Record<string, string>>(
    () => ({
      pass: 'bg-emerald-100 text-emerald-700',
      fail: 'bg-rose-100 text-rose-700',
      conditional: 'bg-amber-100 text-amber-700',
      pending: 'bg-surface-elevated text-text-secondary',
    }),
    []
  )

  if (loading) {
    return (
      <DashboardLayout locale={locale}>
        <div className='px-4 py-8 sm:px-6 lg:px-8'>
          <div className='rounded-lg border border-border bg-surface p-6 text-sm text-text-muted'>{t('loading')}</div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !supplier) {
    return (
      <DashboardLayout locale={locale}>
        <div className='px-4 py-8 sm:px-6 lg:px-8'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error ?? t('errors.loadFailed')}</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mb-6'>
          <Link href={`/${locale}/suppliers`} className='text-sm text-blue-600 hover:underline'>
            {t('backToList')}
          </Link>
        </div>

        {/* Supplier Header */}
        <div className='mb-6 flex items-start justify-between rounded-lg border border-border bg-surface p-6'>
          <div>
            <h1 className='text-2xl font-bold text-text-primary'>{supplier.name}</h1>
            <div className='mt-2 flex flex-wrap gap-2'>
              <span className='inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700'>
                {t(`type.${supplier.type}`)}
              </span>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[supplier.status] ?? ''}`}>
                {t(`status.${supplier.status}`)}
              </span>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${riskBadgeClass[supplier.risk_level] ?? ''}`}>
                {t(`riskLevel.${supplier.risk_level}`)}
              </span>
            </div>
            {supplier.description && (
              <p className='mt-3 text-sm text-text-secondary'>{supplier.description}</p>
            )}
          </div>
          <div className='flex gap-2'>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className='rounded-md border border-red-300 bg-surface px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
            >
              {t('delete')}
            </button>
          </div>
        </div>

        {/* Contact Information */}
        <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
          <h2 className='mb-4 text-lg font-semibold text-text-primary'>{t('form.contactName')}</h2>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div>
              <dt className='text-xs font-medium uppercase text-text-muted'>{t('form.contactName')}</dt>
              <dd className='mt-1 text-sm text-text-primary'>{supplier.contact_name ?? '-'}</dd>
            </div>
            <div>
              <dt className='text-xs font-medium uppercase text-text-muted'>{t('form.contactEmail')}</dt>
              <dd className='mt-1 text-sm text-text-primary'>{supplier.contact_email ?? '-'}</dd>
            </div>
            <div>
              <dt className='text-xs font-medium uppercase text-text-muted'>{t('form.contactPhone')}</dt>
              <dd className='mt-1 text-sm text-text-primary'>{supplier.contact_phone ?? '-'}</dd>
            </div>
            <div>
              <dt className='text-xs font-medium uppercase text-text-muted'>{t('form.website')}</dt>
              <dd className='mt-1 text-sm text-text-primary'>
                {supplier.website ? (
                  <a href={supplier.website} target='_blank' rel='noopener noreferrer' className='text-blue-600 hover:underline'>
                    {supplier.website}
                  </a>
                ) : '-'}
              </dd>
            </div>
          </div>
        </div>

        {/* Assessments Section */}
        <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-text-primary'>{t('assessments.title')}</h2>
          </div>
          {assessments.length === 0 ? (
            <p className='text-sm text-text-muted'>{t('assessments.empty')}</p>
          ) : (
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-app'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('assessments.assessmentDate')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('assessments.assessor')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('assessments.result')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('assessments.overallScore')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('assessments.nextAssessmentDate')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {assessments.map(assessment => (
                  <tr key={assessment.id}>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{assessment.assessment_date}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{assessment.assessor ?? '-'}</td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${resultBadgeClass[assessment.result] ?? ''}`}>
                        {t(`assessments.resultValues.${assessment.result}`)}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{assessment.overall_score ?? '-'}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{assessment.next_assessment_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Contracts Section */}
        <div className='mb-6 rounded-lg border border-border bg-surface p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-text-primary'>{t('contracts.title')}</h2>
          </div>
          {contracts.length === 0 ? (
            <p className='text-sm text-text-muted'>{t('contracts.empty')}</p>
          ) : (
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-app'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('contracts.contractNumber')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('contracts.contractTitle')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('contracts.startDate')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('contracts.endDate')}</th>
                  <th className='px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted'>{t('contracts.status')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {contracts.map(contract => (
                  <tr key={contract.id}>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{contract.contract_number ?? '-'}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{contract.title}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{contract.start_date}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{contract.end_date ?? '-'}</td>
                    <td className='px-4 py-3 text-sm'>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass[contract.status] ?? ''}`}>
                        {t(`contracts.statusValues.${contract.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
