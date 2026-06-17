'use client'

import { useState, useEffect, useMemo, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { EducationService } from '@/lib/services/education'
import { OrganizationService } from '@/lib/services/organization'
import type { Database } from '@/types/database.types'

type Organization = Database['public']['Tables']['organizations']['Row']

interface EducationPlanForm {
  title: string
  description: string
  targetAudience: string
  startDate: string
  endDate: string
  status: string
}

export default function NewEducationPlanPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('education')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)

  const educationService = useMemo(() => new EducationService(), [])
  const orgService = useMemo(() => new OrganizationService(), [])

  const [formData, setFormData] = useState<EducationPlanForm>({
    title: '',
    description: '',
    targetAudience: '',
    startDate: '',
    endDate: '',
    status: 'draft',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const org = await orgService.getCurrentOrganization()
        setOrganization(org)
      } catch (err) {
        console.error('Failed to load organization:', err)
      }
    }
    load()
  }, [orgService])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return

    setLoading(true)
    setError(null)

    try {
      await educationService.createPlan({
        organization_id: organization.id,
        title: formData.title,
        description: formData.description || null,
        target_audience: formData.targetAudience || null,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        status: formData.status,
      })

      router.push(`/${locale}/education`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create education plan')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: keyof EducationPlanForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">{t('plans.create')}</h1>
          <Link
            href={`/${locale}/education`}
            className="text-sm text-text-muted hover:text-text-secondary"
          >
            {t('form.cancel')}
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface shadow rounded-lg p-6 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-text-secondary">
              {t('form.title')} <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('form.titlePlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-secondary">
              {t('form.description')}
            </label>
            <textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Target Audience */}
          <div>
            <label htmlFor="targetAudience" className="block text-sm font-medium text-text-secondary">
              {t('form.targetAudience')}
            </label>
            <input
              id="targetAudience"
              type="text"
              value={formData.targetAudience}
              onChange={(e) => updateField('targetAudience', e.target.value)}
              placeholder={t('form.targetAudiencePlaceholder')}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-text-secondary">
                {t('form.startDate')}
              </label>
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-text-secondary">
                {t('form.endDate')}
              </label>
              <input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-text-secondary">
              {t('form.status')}
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="draft">{t('status.draft')}</option>
              <option value="scheduled">{t('status.scheduled')}</option>
              <option value="in_progress">{t('status.in_progress')}</option>
              <option value="completed">{t('status.completed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link
              href={`/${locale}/education`}
              className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated"
            >
              {t('form.cancel')}
            </Link>
            <button
              type="submit"
              disabled={loading || !formData.title}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('form.creating') : t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
