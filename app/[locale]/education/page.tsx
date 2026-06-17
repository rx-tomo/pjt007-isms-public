'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { EducationService } from '@/lib/services/education'
import { OrganizationService } from '@/lib/services/organization'
import type { EducationPlanEntity } from '@/lib/services/education'
import type { Database } from '@/types/database.types'

type Organization = Database['public']['Tables']['organizations']['Row']

type EducationFollowUpItem = {
  id: string
}

type EducationFollowUpResponse = {
  data?: {
    items?: EducationFollowUpItem[]
  }
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-surface-elevated text-text-primary',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function EducationPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('education')
  const commonT = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [plans, setPlans] = useState<EducationPlanEntity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [filterStatus, setFilterStatus] = useState(
    () => searchParams?.get('status') ?? ''
  )
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams?.get('search') ?? ''
  )
  const [followUpFilter, setFollowUpFilter] = useState(
    () => searchParams?.get('followUp') === 'needs_attention' ? 'needs_attention' : ''
  )

  const educationService = useMemo(() => new EducationService(), [])
  const orgService = useMemo(() => new OrganizationService(), [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const org = await orgService.getCurrentOrganization()
      setOrganization(org)

      if (org?.id) {
        const [data, followUpSummary] = await Promise.all([
          educationService.getPlans(org.id, {
            status: filterStatus || undefined,
            search: searchQuery || undefined,
          }),
          followUpFilter
            ? fetch('/api/education/follow-up?limit=all', { credentials: 'include' })
                .then(async response => {
                  if (!response.ok) throw new Error(`education follow-up ${response.status}`)
                  return response.json() as Promise<EducationFollowUpResponse>
                })
            : Promise.resolve(null),
        ])
        if (followUpFilter && followUpSummary) {
          const followUpIds = new Set((followUpSummary.data?.items ?? []).map(item => item.id))
          setPlans(data.filter(plan => followUpIds.has(plan.id)))
        } else {
          setPlans(data)
        }
      }
    } catch (error) {
      console.error('Failed to load education plans:', error)
    } finally {
      setIsLoading(false)
    }
  }, [educationService, orgService, filterStatus, followUpFilter, searchQuery])

  const clearFollowUpFilter = useCallback(() => {
    setFollowUpFilter('')
    const params = new URLSearchParams(searchParams?.toString())
    params.delete('followUp')
    const query = params.toString()
    router.replace(`/${locale}/education${query ? `?${query}` : ''}`)
  }, [locale, router, searchParams])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExport = () => {
    if (!organization?.id) return
    const params = new URLSearchParams({ organizationId: organization.id })
    if (filterStatus) params.set('status', filterStatus)
    const normalizedSearch = searchQuery.trim()
    if (normalizedSearch) params.set('search', normalizedSearch)
    if (followUpFilter) params.set('followUp', followUpFilter)
    const url = `/api/education/export?${params.toString()}`
    window.open(url, '_blank')
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
            <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated"
            >
              {t('export.title')}
            </button>
            <Link
              href={`/${locale}/education/new`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {t('plans.create')}
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder={commonT('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm"
          >
            <option value="">{t('form.status')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="scheduled">{t('status.scheduled')}</option>
            <option value="in_progress">{t('status.in_progress')}</option>
            <option value="completed">{t('status.completed')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </select>
        </div>

        {followUpFilter === 'needs_attention' && (
          <div
            data-testid="education-follow-up-filter-banner"
            className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{t('filters.followUpActive')}</span>
            <button
              type="button"
              onClick={clearFollowUpFilter}
              className="text-left text-xs font-medium text-amber-700 hover:text-amber-600 hover:underline"
            >
              {t('filters.clear')}
            </button>
          </div>
        )}

        {/* Plan List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-lg border border-border">
            <p className="text-text-muted">
              {followUpFilter === 'needs_attention' ? t('filters.followUpEmpty') : t('plans.empty')}
            </p>
            <Link
              href={`/${locale}/education/new`}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {t('plans.create')}
            </Link>
          </div>
        ) : (
          <div className="bg-surface shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    {t('form.title')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    {t('form.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    {t('form.startDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    {t('form.endDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    {commonT('updatedAt')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {plans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="hover:bg-surface-elevated cursor-pointer"
                    onClick={() => router.push(`/${locale}/education/${plan.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">
                        {plan.title}
                      </div>
                      {plan.description && (
                        <div className="text-sm text-text-muted truncate max-w-xs">
                          {plan.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          STATUS_COLORS[plan.status ?? 'draft'] ?? STATUS_COLORS.draft
                        }`}
                      >
                        {t(`status.${plan.status ?? 'draft'}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                      {plan.start_date ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                      {plan.end_date ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                      {plan.updated_at
                        ? new Date(plan.updated_at).toLocaleDateString(locale)
                        : '-'}
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
