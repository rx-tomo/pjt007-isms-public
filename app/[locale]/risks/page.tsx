'use client'

import { useState, useEffect, useMemo, useCallback, Fragment, use } from 'react';
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { RiskService } from '@/lib/services/risk'
import { OrganizationService } from '@/lib/services/organization'
import { UserService, type UserProfile } from '@/lib/services/user'
import type { RiskWithRelations, RiskCategory, RiskStatus } from '@/lib/services/risk'
import { buildDepartmentOptions } from '@/lib/utils/departments'
import type { Database } from '@/types/database.types'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { FilterBar, type FilterBarItem } from '@/components/filters/FilterBar'
import { StatusFilterBanner } from '@/components/filters/StatusFilterBanner'
import { evaluateDepartmentScope } from '@/lib/utils/departmentScope'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

type Organization = Database['public']['Tables']['organizations']['Row']
type OrganizationDepartment = Database['public']['Tables']['organization_departments']['Row']

export default function RisksPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('risks')
  const commonT = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [risks, setRisks] = useState<RiskWithRelations[]>([])
  const [categories, setCategories] = useState<RiskCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [filterStatus, setFilterStatus] = useState<RiskStatus | ''>(
    () => (searchParams?.get('status') as RiskStatus | '') ?? ''
  )
  const [filterCategory, setFilterCategory] = useState<string>(() => searchParams?.get('categoryId') ?? '')
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([])
  const [filterDepartment, setFilterDepartment] = useState<string>(() => searchParams?.get('departmentId') ?? '')
  const [filterPeriod, setFilterPeriod] = useState(() => searchParams?.get('period') ?? '')
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('search') ?? '')
  const [showHelp, setShowHelp] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null)
  const [matrixFilter, setMatrixFilter] = useState<{ impact: number | null; likelihood: number | null }>({
    impact: null,
    likelihood: null
  })



  const riskService = useMemo(() => new RiskService(), [])
  const orgService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])

  const updateQueryParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '')
      mutator(params)
      const query = params.toString()
      const target = query ? `${pathname}?${query}` : pathname
      router.replace(target, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [org, profile] = await Promise.all([
        orgService.getCurrentOrganization(),
        userService.getCurrentUser()
      ])

      if (!org || !profile) {
        router.push(`/${locale}/auth/login`)
        return
      }

      setOrganization(org)
      setCurrentUser(profile)

      const [risksData, categoriesData, departmentRows] = await Promise.all([
        riskService.getRisksScoped(org.id, profile.id),
        riskService.getCategories(org.id),
        orgService.getOrganizationDepartments(org.id)
      ])

      setRisks(risksData)
      setCategories(categoriesData)
      setDepartments(departmentRows)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [locale, orgService, riskService, router, userService])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const impactParam = searchParams?.get('matrixImpact')
    const likelihoodParam = searchParams?.get('matrixLikelihood')
    setMatrixFilter({
      impact: impactParam ? Number(impactParam) || null : null,
      likelihood: likelihoodParam ? Number(likelihoodParam) || null : null
    })
  }, [searchParams])

  const handlePeriodChange = useCallback(
    (value: string) => {
      setFilterPeriod(value)
      updateQueryParams(params => {
        if (value) {
          params.set('period', value)
        } else {
          params.delete('period')
        }
      })
    },
    [updateQueryParams]
  )

  const getRiskLevelColor = (score: number) => {
    if (score >= 15) return 'bg-red-100 text-red-800'
    if (score >= 8) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getRiskLevelText = (score: number) => {
    if (score >= 15) return t('riskLevel.high')
    if (score >= 8) return t('riskLevel.medium')
    return t('riskLevel.low')
  }

  const handleStatusChange = useCallback(
    (value: RiskStatus | '') => {
      setFilterStatus(value)
      updateQueryParams(params => {
        if (value) {
          params.set('status', value)
        } else {
          params.delete('status')
        }
      })
    },
    [updateQueryParams]
  )

  const handleCategoryChange = useCallback(
    (value: string) => {
      setFilterCategory(value)
      updateQueryParams(params => {
        if (value) {
          params.set('categoryId', value)
        } else {
          params.delete('categoryId')
        }
      })
    },
    [updateQueryParams]
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      const normalized = value.trim()
      updateQueryParams(params => {
        if (normalized) {
          params.set('search', normalized)
        } else {
          params.delete('search')
        }
      })
    },
    [updateQueryParams]
  )

  const getStatusColor = (status: RiskStatus | string | null) => {
    const colors: Record<string, string> = {
      identified: 'bg-surface-elevated text-text-primary',
      analyzing: 'bg-blue-100 text-blue-800',
      treating: 'bg-yellow-100 text-yellow-800',
      monitoring: 'bg-green-100 text-green-800',
      closed: 'bg-surface-elevated text-text-secondary'
    }
    return status ? colors[status] ?? '' : ''
  }

  const departmentOptions = useMemo(() => buildDepartmentOptions(departments), [departments])

  const departmentNameToId = useMemo(() => {
    const map = new Map<string, string>()
    departments.forEach(dept => {
      map.set(dept.name, dept.id)
    })
    if (currentUser?.department && !map.has(currentUser.department)) {
      map.set(currentUser.department, currentUser.department)
    }
    return map
  }, [currentUser?.department, departments])

  const periodOptions = useMemo(() => {
    const unique = new Set<string>()
    risks.forEach(risk => {
      if (risk.assessment_period) {
        unique.add(risk.assessment_period)
      }
    })

    const parsePeriod = (value: string) => {
      const match = value.match(/^FY(\d{4})\s+Q(\d)$/)
      if (!match) {
        return { year: 0, quarter: 0 }
      }
      return { year: Number(match[1]), quarter: Number(match[2]) }
    }

    return Array.from(unique).sort((a, b) => {
      const pa = parsePeriod(a)
      const pb = parsePeriod(b)
      if (pa.year === pb.year) {
        return pb.quarter - pa.quarter
      }
      return pb.year - pa.year
    })
  }, [risks])

  const departmentScope = useMemo(
    () =>
      evaluateDepartmentScope({
        role: currentUser?.role ?? null,
        departmentName: currentUser?.department ?? null,
        departmentNameToId
      }),
    [currentUser?.department, currentUser?.role, departmentNameToId]
  )

  const appliedDepartmentFilter = departmentScope.enforcedFilterValue ?? filterDepartment

  const handleDepartmentChange = useCallback(
    (value: string) => {
      if (departmentScope.enforcedFilterValue) {
        return
      }
      setFilterDepartment(value)
      updateQueryParams(params => {
        if (value) {
          params.set('departmentId', value)
        } else {
          params.delete('departmentId')
        }
      })
    },
    [departmentScope.enforcedFilterValue, updateQueryParams]
  )

  const clearMatrixFilter = useCallback(() => {
    setMatrixFilter({ impact: null, likelihood: null })
    updateQueryParams(params => {
      params.delete('matrixImpact')
      params.delete('matrixLikelihood')
    })
  }, [updateQueryParams])

  const handleMatrixCellClick = useCallback(
    (impact: number, likelihood: number) => {
      if (matrixFilter.impact === impact && matrixFilter.likelihood === likelihood) {
        clearMatrixFilter()
        return
      }
      setMatrixFilter({ impact, likelihood })
      updateQueryParams(params => {
        params.set('matrixImpact', String(impact))
        params.set('matrixLikelihood', String(likelihood))
      })
    },
    [matrixFilter, clearMatrixFilter, updateQueryParams]
  )

  const filterBarItems = useMemo<FilterBarItem[]>(() => {
    return [
      {
        key: 'search',
        type: 'search',
        placeholder: t('search'),
        value: searchQuery,
        onChange: handleSearchChange,
        className: 'flex-1 min-w-[220px]'
      },
      {
        key: 'period',
        type: 'select',
        placeholder: t('filterByPeriod'),
        value: filterPeriod,
        onChange: value => handlePeriodChange(value),
        options: periodOptions.map(periodValue => ({ value: periodValue, label: periodValue }))
      },
      {
        key: 'category',
        type: 'select',
        placeholder: t('filterByCategory'),
        value: filterCategory,
        onChange: value => handleCategoryChange(value),
        options: categories.map(category => ({ value: category.id, label: category.name }))
      },
      {
        key: 'status',
        type: 'select',
        placeholder: t('filterByStatus'),
        value: filterStatus,
        onChange: value => handleStatusChange(value as RiskStatus | ''),
        options: [
          { value: 'identified', label: t('status.identified') },
          { value: 'analyzing', label: t('status.analyzing') },
          { value: 'treating', label: t('status.treating') },
          { value: 'monitoring', label: t('status.monitoring') },
          { value: 'closed', label: t('status.closed') }
        ]
      },
      {
        key: 'department',
        type: 'select',
        placeholder: t('filterByDepartment'),
        value: appliedDepartmentFilter,
        onChange: value => handleDepartmentChange(value),
        disabled: Boolean(departmentScope.enforcedFilterValue),
        options: [
          ...departmentOptions.map(option => ({
            value: option.id,
            label: `${'　'.repeat(option.depth)}${option.name}`
          })),
          { value: DEPARTMENT_UNASSIGNED_VALUE, label: t('filterDepartmentUnassigned') }
        ]
      }
    ]
  }, [appliedDepartmentFilter, categories, departmentOptions, departmentScope.enforcedFilterValue, filterCategory, filterPeriod, filterStatus, handleCategoryChange, handleDepartmentChange, handlePeriodChange, handleSearchChange, handleStatusChange, periodOptions, searchQuery, t])

  const risksMatchingListFilters = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return risks.filter(risk => {
      const matchesSearch =
        !normalizedSearch ||
        risk.title.toLowerCase().includes(normalizedSearch) ||
        risk.description?.toLowerCase().includes(normalizedSearch)
      const matchesStatus = !filterStatus || risk.status === filterStatus
      const matchesCategory = !filterCategory || risk.category_id === filterCategory
      const ownerDepartmentName = risk.owner?.department ?? null
      const ownerDepartmentId = ownerDepartmentName
        ? departmentNameToId.get(ownerDepartmentName) ?? null
        : null
      const matchesDepartment =
        !appliedDepartmentFilter ||
        (appliedDepartmentFilter === DEPARTMENT_UNASSIGNED_VALUE
          ? !ownerDepartmentId
          : ownerDepartmentId === appliedDepartmentFilter)
      const matchesPeriod = !filterPeriod || risk.assessment_period === filterPeriod

      return matchesSearch && matchesStatus && matchesCategory && matchesDepartment && matchesPeriod
    })
  }, [appliedDepartmentFilter, departmentNameToId, filterCategory, filterPeriod, filterStatus, risks, searchQuery])

  const filteredRisks = useMemo(() => {
    if (!matrixFilter.impact || !matrixFilter.likelihood) {
      return risksMatchingListFilters
    }

    return risksMatchingListFilters.filter(
      risk => risk.impact_level === matrixFilter.impact && risk.likelihood_level === matrixFilter.likelihood
    )
  }, [matrixFilter.impact, matrixFilter.likelihood, risksMatchingListFilters])

  const activeDepartmentLabel = useMemo(() => {
    if (!appliedDepartmentFilter) return ''
    if (appliedDepartmentFilter === DEPARTMENT_UNASSIGNED_VALUE) {
      return t('filterDepartmentUnassigned')
    }
    const match = departmentOptions.find(option => option.id === appliedDepartmentFilter)
    return match?.name ?? ''
  }, [appliedDepartmentFilter, departmentOptions, t])

  const matrixFilterLabel = useMemo(() => {
    if (!matrixFilter.impact || !matrixFilter.likelihood) {
      return ''
    }
    return t('riskMatrix.banner', {
      impact: matrixFilter.impact,
      likelihood: matrixFilter.likelihood,
      count: filteredRisks.length
    })
  }, [filteredRisks.length, matrixFilter, t])

  const emptyStateMessage = useMemo(() => {
    if (matrixFilter.impact && matrixFilter.likelihood) {
      return t('emptyStateForMatrix', {
        impact: matrixFilter.impact,
        likelihood: matrixFilter.likelihood
      })
    }
    if (filterPeriod) {
      return t('emptyStateForPeriod', { period: filterPeriod })
    }
    return t('emptyState')
  }, [filterPeriod, matrixFilter.impact, matrixFilter.likelihood, t])

  const enforcedDepartmentLabel = useMemo(() => {
    if (!departmentScope.enforcedFilterValue) {
      return ''
    }
    if (departmentScope.enforcedFilterValue === DEPARTMENT_UNASSIGNED_VALUE) {
      return t('filterDepartmentUnassigned')
    }
    const match = departmentOptions.find(option => option.id === departmentScope.enforcedFilterValue)
    return match?.name ?? departmentScope.enforcedFilterValue
  }, [departmentOptions, departmentScope.enforcedFilterValue, t])

  useEffect(() => {
    if (!searchParams) return
    const periodValue = searchParams.get('period') ?? ''
    const statusValue = (searchParams.get('status') as RiskStatus | '') ?? ''
    const categoryValue = searchParams.get('categoryId') ?? ''
    const departmentValue = searchParams.get('departmentId') ?? ''
    const searchValue = searchParams.get('search') ?? ''

    setFilterPeriod(prev => (prev === periodValue ? prev : periodValue))
    setFilterStatus(prev => (prev === statusValue ? prev : statusValue))
    setFilterCategory(prev => (prev === categoryValue ? prev : categoryValue))
    if (!departmentScope.enforcedFilterValue) {
      setFilterDepartment(prev => (prev === departmentValue ? prev : departmentValue))
    }
    setSearchQuery(prev => (prev === searchValue ? prev : searchValue))
  }, [departmentScope.enforcedFilterValue, searchParams])

  useEffect(() => {
    if (!departmentScope.enforcedFilterValue) {
      return
    }
    setFilterDepartment(departmentScope.enforcedFilterValue)
    const currentParam = searchParams?.get('departmentId') ?? ''
    if (currentParam === departmentScope.enforcedFilterValue) {
      return
    }
    updateQueryParams(params => {
      params.set('departmentId', departmentScope.enforcedFilterValue as string)
    })
  }, [departmentScope.enforcedFilterValue, searchParams, updateQueryParams])

  const handleExportRisks = useCallback(async (format: 'excel' | 'pdf') => {
    if (!organization || exportingFormat) return

    const params = new URLSearchParams({ organizationId: organization.id })

    if (filterStatus) {
      params.set('status', filterStatus)
    }

    if (filterCategory) {
      params.set('categoryId', filterCategory)
    }

    if (appliedDepartmentFilter) {
      params.set('departmentId', appliedDepartmentFilter)
    }

    if (filterPeriod) {
      params.set('assessmentPeriod', filterPeriod)
    }

    if (matrixFilter.impact && matrixFilter.likelihood) {
      params.set('matrixImpact', String(matrixFilter.impact))
      params.set('matrixLikelihood', String(matrixFilter.likelihood))
    }

    const normalizedSearch = searchQuery.trim()
    if (normalizedSearch) {
      params.set('search', normalizedSearch)
    }

    params.set('format', format)

    setExportingFormat(format)
    try {
      const response = await fetch(`/api/risks/export?${params.toString()}`, {
        headers: {
          Accept: format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel'
        }
      })
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const extension = format === 'pdf' ? 'pdf' : 'xls'
      anchor.download = `risks-${new Date().toISOString().slice(0, 10)}.${extension}`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export risks', error)
      alert(t('messages.exportFailed'))
    } finally {
      setExportingFormat(null)
    }
  }, [
    appliedDepartmentFilter,
    exportingFormat,
    filterCategory,
    filterPeriod,
    filterStatus,
    matrixFilter.impact,
    matrixFilter.likelihood,
    organization,
    searchQuery,
    t
  ])


  const handleDeleteRisk = async (riskId: string) => {
    if (!confirm('このリスクを削除してもよろしいですか？')) return

    try {
      await riskService.deleteRisk(riskId)
      await loadData()
    } catch (error: any) {
      console.error('Error deleting risk:', error)
      alert(error.message || 'リスクの削除に失敗しました')
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="px-4 sm:px-6 lg:px-8">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
              <p className="mt-2 text-sm text-text-secondary">
                {t('description')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${
                  filterPeriod ? 'bg-indigo-50 text-indigo-700' : 'bg-surface-elevated text-text-secondary'
                }`}>
                  {filterPeriod || t('periodTag.all')}
                </span>
                {filterPeriod && (
                  <button
                    type="button"
                    onClick={() => handlePeriodChange('')}
                    className="text-indigo-600 hover:underline"
                  >
                    {t('periodTag.clear')}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 flex gap-3 flex-wrap justify-end">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                使い方
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportRisks('excel')}
                  disabled={!organization || !!exportingFormat}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {exportingFormat === 'excel' ? t('actions.exporting') : t('actions.exportExcel')}
                </button>
                <button
                  onClick={() => handleExportRisks('pdf')}
                  disabled={!organization || !!exportingFormat}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {exportingFormat === 'pdf' ? t('actions.exporting') : t('actions.exportPdf')}
                </button>
              </div>
              {['org_admin', 'system_operator'].includes(currentUser?.role ?? '') && (
                <Link
                  href={`/${locale}/settings/setup`}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  {t('importCsv')}
                </Link>
              )}
              <Link
                href={`/${locale}/risks/new`}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
              >
                {t('actions.newRisk')}
            </Link>
          </div>
        </div>

        {/* ヘルプセクション */}
        {showHelp && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-blue-900 mb-2">リスクアセスメントの使い方</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>• <strong>リスクスコア</strong>：影響度 × 発生可能性で自動計算されます（1～25）</p>
                  <p>• <strong>色分け</strong>：高リスク（赤）、中リスク（黄）、低リスク（緑）で視覚的に確認できます</p>
                  <p>• <strong>ステータス管理</strong>：「特定済み」→「分析中」→「対応中」→「監視中」→「対応完了」の流れで管理</p>
                  <p>• <strong>リスクマトリックス</strong>：下部の表で全リスクの分布を俯瞰できます</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-blue-500 hover:text-blue-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <FilterBar items={filterBarItems} />
          {departmentScope.enforcedFilterValue && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <p>
                {commonT('departmentScope.locked', {
                  department: enforcedDepartmentLabel || t('filterDepartmentUnassigned')
                })}
              </p>
              {departmentScope.reason === 'missing_department' && (
                <p className="mt-1">{commonT('departmentScope.lockedMissing')}</p>
              )}
            </div>
          )}
          {filterStatus && (
            <StatusFilterBanner
              label={t('activeFilters.status', { status: t(`status.${filterStatus}`) })}
              clearLabel={t('activeFilters.clear')}
              onClear={() => handleStatusChange('')}
            />
          )}
          {matrixFilterLabel && (
            <StatusFilterBanner
              label={matrixFilterLabel}
              clearLabel={t('riskMatrix.clear')}
              onClear={clearMatrixFilter}
            />
          )}
          {appliedDepartmentFilter && (
            <div className="flex items-center gap-2 text-xs text-indigo-700">
              <span>{t('filterDepartmentActive', { department: activeDepartmentLabel })}</span>
              {!departmentScope.enforcedFilterValue && (
                <button
                  type="button"
                  onClick={() => handleDepartmentChange('')}
                  className="text-indigo-500 hover:underline"
                >
                  {t('clearDepartmentFilter')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col">
          {filteredRisks.length === 0 ? (
            <EmptyState
              title={emptyStateMessage}
              action={risks.length === 0 ? (
                <div className="bg-surface-elevated rounded-lg p-6 max-w-2xl text-left">
                  <h4 className="font-medium text-text-primary mb-3">サンプルリスクを参考にしてください：</h4>
                  <div className="space-y-3 text-sm text-text-secondary">
                    <div className="flex items-start">
                      <span className="font-medium mr-2">1.</span>
                      <div>
                        <strong>不正アクセスリスク</strong>：外部からの不正アクセスによる情報漏洩<br />
                        <span className="text-xs">影響度: 5, 発生可能性: 3, リスクスコア: 15（高）</span>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium mr-2">2.</span>
                      <div>
                        <strong>データバックアップ不備</strong>：災害時のデータ復旧が困難<br />
                        <span className="text-xs">影響度: 4, 発生可能性: 2, リスクスコア: 8（中）</span>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium mr-2">3.</span>
                      <div>
                        <strong>従業員の情報管理不徹底</strong>：人的ミスによる情報流出<br />
                        <span className="text-xs">影響度: 3, 発生可能性: 3, リスクスコア: 9（中）</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/${locale}/risks/new`}
                    className="inline-flex items-center mt-4 text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                  >
                    新規リスクを登録する
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              ) : undefined}
            />
          ) : (
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-elevated">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.title')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.category')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.impact')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.likelihood')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.riskScore')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.status')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('columns.owner')}
                      </th>
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">{t('columns.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {filteredRisks.map((risk) => (
                        <tr key={risk.id} data-testid="risk-table-row">
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <Link href={`/${locale}/risks/${risk.id}`} className="block hover:bg-surface-elevated -m-2 p-2 rounded">
                              <div>
                                <div className="font-medium text-text-primary hover:text-indigo-600">{risk.title}</div>
                                {risk.description && (
                                  <div className="text-text-muted truncate max-w-xs">
                                    {risk.description}
                                  </div>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-text-muted">
                            <span
                              className="inline-block w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: risk.category?.color || '#6B7280' }}
                            />
                            {risk.category?.name || '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <div className="flex items-center">
                              <span className="font-medium">{risk.impact_level || '-'}</span>
                              <span className="ml-1 text-text-muted">/5</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <div className="flex items-center">
                              <span className="font-medium">{risk.likelihood_level || '-'}</span>
                              <span className="ml-1 text-text-muted">/5</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {risk.risk_score ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(risk.risk_score)}`}>
                                {risk.risk_score} - {getRiskLevelText(risk.risk_score)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(risk.status)}`}>
                              {t(`status.${risk.status}`)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-text-muted">
                            {risk.owner?.full_name || '-'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex items-center justify-end space-x-2">
                              <Link
                                href={`/${locale}/risks/${risk.id}/edit`}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                {t('actions.edit')}
                              </Link>
                              <button
                                onClick={() => handleDeleteRisk(risk.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                {t('actions.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* リスクマトリックス表示（オプション） */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-text-primary">{t('riskMatrix.title')}</h2>
          <p className="mt-1 mb-4 text-sm text-text-secondary">{t('riskMatrix.description')}</p>
          <div className="bg-surface shadow rounded-lg p-6">
            <div className="grid grid-cols-6 gap-2">
              <div></div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="text-center text-sm font-medium text-text-secondary">
                  {t('likelihood')} {i}
                </div>
              ))}
              {[5, 4, 3, 2, 1].map(impact => (
                <Fragment key={`impact-${impact}`}>
                  <div className="text-center text-sm font-medium text-text-secondary">
                    {t('impact')} {impact}
                  </div>
                  {[1, 2, 3, 4, 5].map(likelihood => {
                    const score = impact * likelihood
                    const risksInCell = risksMatchingListFilters.filter(r =>
                      r.impact_level === impact && r.likelihood_level === likelihood
                    )
                    const borderClass =
                      score >= 15 ? 'border-red-200' : score >= 8 ? 'border-yellow-200' : 'border-green-200'
                    const isSelected =
                      matrixFilter.impact === impact && matrixFilter.likelihood === likelihood
                    return (
                      <button
                        key={`${impact}-${likelihood}`}
                        data-testid="risk-matrix-cell"
                        data-impact={impact}
                        data-likelihood={likelihood}
                        data-score={score}
                        data-risk-count={risksInCell.length}
                        onClick={() => handleMatrixCellClick(impact, likelihood)}
                        aria-pressed={isSelected}
                        aria-label={t('riskMatrix.cellLabel', {
                          impact,
                          likelihood,
                          count: risksInCell.length
                        })}
                        title={t('riskMatrix.cellLabel', {
                          impact,
                          likelihood,
                          count: risksInCell.length
                        })}
                        className={`border ${borderClass} rounded p-2 text-center text-xs font-medium transition ${
                          score >= 15
                            ? 'bg-red-100 text-red-800'
                            : score >= 8
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        } cursor-pointer hover:ring-2 hover:ring-indigo-300 ${
                          isSelected ? 'ring-2 ring-indigo-500' : ''
                        }`}
                      >
                        <div>{score}</div>
                        <div className="mt-1 font-normal">
                          ({risksInCell.length})
                        </div>
                      </button>
                    )
                  })}
                </Fragment>
              ))}
            </div>
            <div className="mt-4 space-y-2" data-testid="risk-matrix-legend">
              <div className="text-sm font-medium text-text-secondary">{t('riskMatrix.legend.label')}</div>
              <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-2" data-testid="risk-matrix-legend-item-high">
                  <span className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                    {t('riskLevel.high')}
                  </span>
                  <span>{t('riskMatrix.legend.high')}</span>
                </div>
                <div className="flex items-center gap-2" data-testid="risk-matrix-legend-item-medium">
                  <span className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                    {t('riskLevel.medium')}
                  </span>
                  <span>{t('riskMatrix.legend.medium')}</span>
                </div>
                <div className="flex items-center gap-2" data-testid="risk-matrix-legend-item-low">
                  <span className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                    {t('riskLevel.low')}
                  </span>
                  <span>{t('riskMatrix.legend.low')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
