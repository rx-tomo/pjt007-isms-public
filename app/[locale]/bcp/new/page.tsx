'use client'

import { FormEvent, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { BcpService, type BcpPlanStatus } from '@/lib/services/bcp'
import { OrganizationService } from '@/lib/services/organization'
import { useAuth } from '@/lib/hooks/useAuth'
import { useTranslations } from 'next-intl'

const bcpService = new BcpService()
const organizationService = new OrganizationService()

export default function NewBcpPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('bcp')
  const router = useRouter()
  const { user: authUser } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [version, setVersion] = useState('1.0')
  const [status, setStatus] = useState<BcpPlanStatus>('draft')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const organization = await organizationService.getCurrentOrganization()
        setOrganizationId(organization?.id ?? null)
      } catch (err) {
        console.error(err)
        setError(t('errors.organizationMissing'))
      }
    }

    loadOrganization()
  }, [t])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError(null)

      if (!organizationId) {
        throw new Error(t('errors.organizationMissing'))
      }

      const plan = await bcpService.createPlan({
        organization_id: organizationId,
        title,
        scope,
        status,
        version,
        created_by: authUser?.id
      })

      router.push(`/${locale}/bcp/${plan.id}`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : t('errors.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout locale={locale}>
      <div className='mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8'>
        <h1 className='text-2xl font-bold text-text-primary'>{t('newTitle')}</h1>
        <p className='mt-1 text-sm text-text-secondary'>{t('newDescription')}</p>

        <form onSubmit={handleSubmit} className='mt-6 space-y-4 rounded-lg border border-border bg-surface p-6'>
          {error && <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</div>}

          <div>
            <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.title')}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className='w-full rounded-md border border-border px-3 py-2 text-sm'
            />
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.scope')}</label>
            <textarea
              value={scope}
              onChange={e => setScope(e.target.value)}
              rows={4}
              className='w-full rounded-md border border-border px-3 py-2 text-sm'
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.version')}</label>
              <input
                value={version}
                onChange={e => setVersion(e.target.value)}
                required
                className='w-full rounded-md border border-border px-3 py-2 text-sm'
              />
            </div>
            <div>
              <label className='mb-1 block text-sm font-medium text-text-secondary'>{t('form.status')}</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as BcpPlanStatus)}
                className='w-full rounded-md border border-border px-3 py-2 text-sm'
              >
                <option value='draft'>{t('status.draft')}</option>
                <option value='active'>{t('status.active')}</option>
                <option value='under_review'>{t('status.under_review')}</option>
                <option value='archived'>{t('status.archived')}</option>
              </select>
            </div>
          </div>

          <div className='flex justify-end gap-2'>
            <button
              type='button'
              onClick={() => router.push(`/${locale}/bcp`)}
              className='rounded-md border border-border px-4 py-2 text-sm'
            >
              {t('form.cancel')}
            </button>
            <button
              type='submit'
              disabled={submitting}
              className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60'
            >
              {submitting ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
