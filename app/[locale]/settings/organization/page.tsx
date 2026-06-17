'use client'

import { useState, useEffect, useMemo, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ErrorBoundary from '@/components/ErrorBoundary'
import { OrganizationService } from '@/lib/services/organization'
import type { IsmsPhase, PhaseHistoryEntry } from '@/lib/services/onboarding'
import { UserService } from '@/lib/services/user'
import { useAuthFeatures } from '@/lib/hooks/useAuthFeatures'
import NotificationChannelsPanel from '@/components/settings/organization/NotificationChannels'
import ISMSScopeSettings from '@/components/settings/organization/ISMSScopeSettings'
import DepartmentManagement from '@/components/settings/organization/DepartmentManagement'
import ProjectStructureManager from '@/components/settings/organization/ProjectStructureManager'
import ISMSPhaseHistory from '@/components/settings/organization/ISMSPhaseHistory'
import { useToast } from '@/components/ui/ToastProvider'
import { ADMIN_ROLES } from '@/lib/constants/roleHierarchy'
import type { Database } from '@/types/database.types'

type OrganizationDepartment = Database['public']['Tables']['organization_departments']['Row']

type OrganizationScopeData = {
  physical_locations: string[]
  it_systems: string[]
  departments: string[]
  processes: string[]
  exclusions: string[]
}

const emptyScope: OrganizationScopeData = {
  physical_locations: [],
  it_systems: [],
  departments: [],
  processes: [],
  exclusions: []
}

interface OrganizationData {
  id: string
  name: string
  name_en: string | null
  employee_count_range: '1-50' | '51-100' | '101-300' | '301-1000' | '1000+' | null
  industry: string | null
  iso_certification_status: 'certified' | 'in_progress' | 'planning' | 'not_planned' | null
  subscription_plan: 'trial' | 'starter' | 'standard' | 'enterprise'
  subscription_status: 'active' | 'inactive' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  isms_phase: IsmsPhase | null
  isms_scope: OrganizationScopeData
  departments: OrganizationDepartment[]
}

export default function OrganizationSettingsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.organization')
  const router = useRouter()
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { pushToast } = useToast()
  const [isExportingBackup, setIsExportingBackup] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isImportingData, setIsImportingData] = useState(false)
  const [importSummary, setImportSummary] = useState<any>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [phaseSelection, setPhaseSelection] = useState<IsmsPhase | ''>('')
  const [phaseSaving, setPhaseSaving] = useState(false)
  const [phaseHistory, setPhaseHistory] = useState<PhaseHistoryEntry[]>([])
  const currentPhaseKey = organization?.isms_phase ?? null
  const { features: authFeatures, loading: authFeaturesLoading } = useAuthFeatures()

  const orgService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])

  // フォームデータ
  const [formData, setFormData] = useState<{
    name: string
    name_en: string
    employee_count_range: '1-50' | '51-100' | '101-300' | '301-1000' | '1000+' | ''
    industry: string
    iso_certification_status: 'certified' | 'in_progress' | 'planning' | 'not_planned' | ''
  }>({
    name: '',
    name_en: '',
    employee_count_range: '',
    industry: '',
    iso_certification_status: ''
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [org, user] = await Promise.all([
        orgService.getCurrentOrganization(),
        userService.getCurrentUser()
      ])

      if (!org || !user) {
        // セッションを維持してエラーメッセージを表示
        setError('認証情報が見つかりません。ログインし直してください。')
        setIsLoading(false)
        return
      }

      // 管理者権限チェック
      if (!(ADMIN_ROLES as readonly string[]).includes(user.role)) {
        setError('この機能にアクセスする権限がありません。管理者にお問い合わせください。')
        setIsLoading(false)
        return
      }

      const [scopeRow, departmentRows, historyRows] = await Promise.all([
        orgService.getOrganizationScope(org.id),
        orgService.getOrganizationDepartments(org.id),
        orgService.getPhaseHistory(org.id)
      ])

      const scopeData: OrganizationScopeData = scopeRow
        ? {
            physical_locations: scopeRow.physical_locations ?? [],
            it_systems: scopeRow.it_systems ?? [],
            departments: scopeRow.departments ?? [],
            processes: scopeRow.processes ?? [],
            exclusions: scopeRow.exclusions ?? []
          }
        : { ...emptyScope }

      setOrganization({
        id: org.id,
        name: org.name,
        name_en: org.name_en ?? null,
        employee_count_range: (org.employee_count_range ?? null) as OrganizationData['employee_count_range'],
        industry: org.industry ?? null,
        iso_certification_status: (org.iso_certification_status ?? null) as OrganizationData['iso_certification_status'],
        subscription_plan: (org.subscription_plan ?? 'trial') as OrganizationData['subscription_plan'],
        subscription_status: (org.subscription_status ?? 'active') as OrganizationData['subscription_status'],
        trial_ends_at: org.trial_ends_at ?? null,
        isms_phase: (org.isms_phase ?? null) as OrganizationData['isms_phase'],
        isms_scope: scopeData,
        departments: departmentRows ?? []
      })
      setCurrentUser(user)
      setFormData({
        name: org.name || '',
        name_en: org.name_en || '',
        employee_count_range: (org.employee_count_range || '') as typeof formData.employee_count_range,
        industry: org.industry || '',
        iso_certification_status: (org.iso_certification_status || '') as typeof formData.iso_certification_status
      })
      setPhaseSelection((org.isms_phase ?? '') as IsmsPhase | '')
      setPhaseHistory(historyRows)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('データの読み込みに失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setIsLoading(false)
    }
  }, [orgService, userService])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

    setIsSaving(true)
    setError(null)

    try {
      await orgService.updateOrganization(organization.id, {
        name: formData.name,
        name_en: formData.name_en || null,
        employee_count_range: formData.employee_count_range as any || null,
        industry: formData.industry || null,
        iso_certification_status: formData.iso_certification_status as any || null
      })

      pushToast({ message: t('success.saved'), variant: 'success' })

      // 組織情報を再読み込み
      const updatedOrg = await orgService.getCurrentOrganization()
      if (updatedOrg) {
        setOrganization(prev => ({
          id: updatedOrg.id,
          name: updatedOrg.name,
          name_en: updatedOrg.name_en ?? null,
          employee_count_range: (updatedOrg.employee_count_range ?? null) as OrganizationData['employee_count_range'],
          industry: updatedOrg.industry ?? null,
          iso_certification_status: (updatedOrg.iso_certification_status ?? null) as OrganizationData['iso_certification_status'],
          subscription_plan: (updatedOrg.subscription_plan ?? 'trial') as OrganizationData['subscription_plan'],
          subscription_status: (updatedOrg.subscription_status ?? 'active') as OrganizationData['subscription_status'],
          trial_ends_at: updatedOrg.trial_ends_at ?? null,
          isms_phase: (updatedOrg.isms_phase ?? prev?.isms_phase ?? null) as OrganizationData['isms_phase'],
          isms_scope: prev?.isms_scope ?? { ...emptyScope },
          departments: prev?.departments ?? []
        }))
        setPhaseSelection((updatedOrg.isms_phase ?? '') as IsmsPhase | '')
      }
    } catch (err: any) {
      setError(err.message || t('errors.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleScopeUpdate = async (scope: OrganizationScopeData) => {
    if (!organization) return

    setError(null)

    try {
      await orgService.upsertOrganizationScope(organization.id, scope)
      setOrganization(prev => (prev ? { ...prev, isms_scope: scope } : prev))
      pushToast({ message: t('success.scopeSaved'), variant: 'success' })
    } catch (err) {
      console.error('Failed to update ISMS scope:', err)
      const message =
        err instanceof Error ? err.message : t('errors.scopeSaveFailed')
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const handlePhaseSubmit = async () => {
    if (!organization) return

    if (!phaseSelection) {
      pushToast({ message: t('phase.validation'), variant: 'error', duration: 0 })
      return
    }

    if (currentUser?.role !== 'system_operator') {
      pushToast({ message: t('phase.permission'), variant: 'error', duration: 0 })
      return
    }

    setPhaseSaving(true)

    try {
      await orgService.updateIsmsPhase(organization.id, phaseSelection as IsmsPhase, 'settings')
      setOrganization(prev => (prev ? { ...prev, isms_phase: phaseSelection } : prev))
      pushToast({
        message: t('phase.success', { phase: t(`phase.options.${phaseSelection}.label`) }),
        variant: 'success'
      })
      orgService
        .getPhaseHistory(organization.id)
        .then(setPhaseHistory)
        .catch(historyError => console.warn('Failed to refresh phase history', historyError))
    } catch (err) {
      console.error('Failed to update ISMS phase', err)
      pushToast({ message: t('phase.error'), variant: 'error', duration: 0 })
    } finally {
      setPhaseSaving(false)
    }
  }

  const handleDepartmentsUpdate = async (departments: OrganizationDepartment[]) => {
    if (!organization) return

    setError(null)
    setOrganization(prev => (prev ? { ...prev, departments } : prev))
    pushToast({ message: t('success.departmentsSaved'), variant: 'success' })
  }

  const handleDepartmentsError = (message: string | null) => {
    if (message) {
      setError(message)
    } else {
      setError(null)
    }
  }

  const handleStructureSuccess = (message: string) => {
    setError(null)
    pushToast({ message, variant: 'success' })
  }

  const handleStructureError = (message: string | null) => {
    if (message) {
      setError(message)
    } else {
      setError(null)
    }
  }

  const handleBackupExport = async () => {
    if (!organization || isExportingBackup) return

    setIsExportingBackup(true)
    try {
      const response = await fetch(`/api/export/backup?organizationId=${organization.id}`)
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `isms-backup-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)

      pushToast({ message: t('backup.success'), variant: 'success' })
    } catch (err) {
      console.error('Backup export failed', err)
      pushToast({ message: t('backup.error'), variant: 'error', duration: 0 })
    } finally {
      setIsExportingBackup(false)
    }
  }

  const handleDataExport = async (options?: { template?: boolean }) => {
    if (!organization || isExportingData) return
    setImportError(null)
    setImportSummary(null)
    setIsExportingData(true)
    try {
      const templateParam = options?.template ? '&template=1' : ''
      const response = await fetch(`/api/export/organization-data?organizationId=${organization.id}${templateParam}`)
      if (!response.ok) {
        throw new Error('export_failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = options?.template
        ? 'organization-data-template.zip'
        : `organization-data-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Data export failed', err)
      setImportError(t('dataTransfer.exportError'))
    } finally {
      setIsExportingData(false)
    }
  }

  const handleDataImport = async (file?: File | null) => {
    if (!organization || isImportingData) return
    const targetFile = file ?? importInputRef.current?.files?.[0]
    if (!targetFile) return

    setIsImportingData(true)
    setImportError(null)
    setImportSummary(null)

    try {
      const formData = new FormData()
      formData.append('file', targetFile)
      formData.append('organizationId', organization.id)

      const response = await fetch('/api/import/organization-data', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'import_failed')
      }

      const result = await response.json()
      setImportSummary(result?.summary ?? null)
      pushToast({ message: t('dataTransfer.importSuccess'), variant: 'success' })
    } catch (err: any) {
      console.error('Data import failed', err)
      setImportError(err?.message || t('dataTransfer.importError'))
    } finally {
      setIsImportingData(false)
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
        <div className="max-w-4xl">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-text-primary sm:text-3xl sm:truncate">
              {t('title')}
            </h2>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-800">{error}</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.history.back()}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  戻る
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  再試行
                </button>
              </div>
            </div>
          </div>
        )}

        {authFeatures && (
          <section className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{t('authSettings.title')}</h3>
                <p className="text-sm text-text-muted">{t('authSettings.description')}</p>
              </div>
              {authFeaturesLoading && (
                <div className="text-xs text-text-muted">{t('authSettings.loading')}</div>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-text-muted">{t('authSettings.mfaLabel')}</p>
                <p className="mt-1 text-sm text-text-primary">
                  {authFeatures.mfaEnabled
                    ? t('authSettings.mfaRoles', { roles: authFeatures.mfaRequiredRoles.join(', ') })
                    : t('authSettings.mfaDisabled')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted">{t('authSettings.ssoLabel')}</p>
                <p className="mt-1 text-sm text-text-primary">
                  {authFeatures.ssoEnabled
                    ? t('authSettings.ssoProviders', { providers: authFeatures.ssoProviders.join(', ') })
                    : t('authSettings.ssoDisabled')}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-text-muted">
              {t('authSettings.hint')} <a
                href="/docs/06-operations/development-environment-guide.md#MFA"
                className="text-indigo-600 hover:text-indigo-800"
              >
                {t('authSettings.linkLabel')}
              </a>
            </p>
          </section>
        )}
        {!authFeatures && authFeaturesLoading && (
          <div className="mb-6 rounded-2xl border border-border bg-surface p-6 text-xs text-text-secondary">
            {t('authSettings.loading')}
          </div>
        )}

        {currentUser?.role === 'system_operator' && (
          <section className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{t('phase.title')}</h3>
                <p className="text-sm text-text-secondary">{t('phase.description')}</p>
              </div>
              <div className="text-sm text-text-muted">
                {t('phase.current')}{' '}
                <span className="font-semibold text-text-primary">
                  {currentPhaseKey ? t(`phase.options.${currentPhaseKey}.label`) : t('phase.notSet')}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(['initial', 'surveillance'] as IsmsPhase[]).map(option => (
                <label
                  key={option}
                  className={`flex cursor-pointer flex-col rounded-2xl border p-4 transition ${
                    phaseSelection === option ? 'border-indigo-500 bg-indigo-50' : 'border-border hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="isms_phase"
                      value={option}
                      checked={phaseSelection === option}
                      onChange={() => setPhaseSelection(option)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-text-primary">{t(`phase.options.${option}.label`)}</p>
                      <p className="text-xs text-text-secondary">{t(`phase.options.${option}.description`)}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handlePhaseSubmit}
                disabled={!phaseSelection || phaseSaving}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-surface-elevated"
              >
                {phaseSaving ? t('phase.saving') : t('phase.save')}
              </button>
            </div>
          </section>
        )}

        <div className="mb-6">
          <ISMSPhaseHistory history={phaseHistory} locale={locale} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
            <div className="md:grid md:grid-cols-3 md:gap-6">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium leading-6 text-text-primary">
                  {t('sections.basic')}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {t('sections.basicDescription')}
                </p>
              </div>

              <div className="mt-5 md:mt-0 md:col-span-2">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6">
                    <label htmlFor="name" className="block text-sm font-medium text-text-secondary">
                      {t('fields.name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      required
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="name_en" className="block text-sm font-medium text-text-secondary">
                      {t('fields.nameEn')}
                    </label>
                    <input
                      type="text"
                      name="name_en"
                      id="name_en"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.name_en}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="employee_count_range" className="block text-sm font-medium text-text-secondary">
                      {t('fields.employeeCount')}
                    </label>
                    <select
                      id="employee_count_range"
                      name="employee_count_range"
                      className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.employee_count_range}
                      onChange={handleInputChange}
                    >
                      <option value="">{t('fields.employeeCountPlaceholder')}</option>
                      <option value="1-50">1-50</option>
                      <option value="51-100">51-100</option>
                      <option value="101-300">101-300</option>
                      <option value="301-1000">301-1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="industry" className="block text-sm font-medium text-text-secondary">
                      {t('fields.industry')}
                    </label>
                    <input
                      type="text"
                      name="industry"
                      id="industry"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.industry}
                      onChange={handleInputChange}
                      placeholder={t('fields.industryPlaceholder')}
                    />
                  </div>

                  <div className="col-span-6">
                    <label htmlFor="iso_certification_status" className="block text-sm font-medium text-text-secondary">
                      {t('fields.certificationStatus')}
                    </label>
                    <select
                      id="iso_certification_status"
                      name="iso_certification_status"
                      className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.iso_certification_status}
                      onChange={handleInputChange}
                    >
                      <option value="">{t('fields.certificationStatusPlaceholder')}</option>
                      <option value="certified">{t('certificationStatus.certified')}</option>
                      <option value="in_progress">{t('certificationStatus.inProgress')}</option>
                      <option value="planning">{t('certificationStatus.planning')}</option>
                      <option value="not_planned">{t('certificationStatus.notPlanned')}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* サブスクリプション情報（読み取り専用） */}
          <div className="bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
            <div className="md:grid md:grid-cols-3 md:gap-6">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium leading-6 text-text-primary">
                  {t('sections.subscription')}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {t('sections.subscriptionDescription')}
                </p>
              </div>

              <div className="mt-5 md:mt-0 md:col-span-2">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-text-muted">{t('fields.plan')}</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      {organization?.subscription_plan && t(`plans.${organization.subscription_plan}`)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-text-muted">{t('fields.status')}</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        organization?.subscription_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-surface-elevated text-text-primary'
                      }`}>
                        {organization?.subscription_status && t(`status.${organization.subscription_status}`)}
                      </span>
                    </dd>
                  </div>

                  {organization?.trial_ends_at && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-text-muted">{t('fields.trialEnds')}</dt>
                      <dd className="mt-1 text-sm text-text-primary">
                        {new Date(organization.trial_ends_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/home`)}
              className="bg-surface py-2 px-4 border border-border rounded-md shadow-sm text-sm font-medium text-text-primary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSaving ? t('actions.saving') : t('actions.save')}
            </button>
          </div>
        </form>

        {/* ISMS適用範囲設定 */}
        <div className="mt-8 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          {organization && (
            <ISMSScopeSettings
              organizationId={organization.id}
              initialScope={organization.isms_scope}
              onUpdate={handleScopeUpdate}
            />
          )}
        </div>

        {/* 部門管理 */}
        <div className="mt-8 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          {organization && (
            <DepartmentManagement
              organizationId={organization.id}
              initialDepartments={organization.departments}
              onUpdate={handleDepartmentsUpdate}
              onError={handleDepartmentsError}
            />
          )}
        </div>

        <div className="mt-8 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          {organization && (
            <ProjectStructureManager
              organizationId={organization.id}
              onSuccess={handleStructureSuccess}
              onError={handleStructureError}
            />
          )}
        </div>

        <div className="mt-8 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          {organization && <NotificationChannelsPanel organizationId={organization.id} />}
        </div>

        <div className="mt-8 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-text-primary">{t('dataTransfer.title')}</h3>
              <p className="mt-1 text-sm text-text-muted">{t('dataTransfer.description')}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDataExport({ template: false })}
                  disabled={!organization || isExportingData}
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isExportingData ? t('dataTransfer.exporting') : t('dataTransfer.exportAction')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDataExport({ template: true })}
                  disabled={!organization || isExportingData}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {t('dataTransfer.templateAction')}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".zip"
                  className="text-sm"
                  onChange={e => handleDataImport(e.target.files?.[0] ?? null)}
                  disabled={!organization || isImportingData}
                />
                <button
                  type="button"
                  onClick={() => handleDataImport()}
                  disabled={!organization || isImportingData}
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isImportingData ? t('dataTransfer.importing') : t('dataTransfer.importAction')}
                </button>
              </div>
              <p className="text-xs text-text-muted">{t('dataTransfer.hint')}</p>
            </div>
          </div>

          {importError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {importError}
            </div>
          )}

          {importSummary && (
            <div className="mt-4 rounded-md border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary">
              <p className="font-semibold mb-2">{t('dataTransfer.resultTitle')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(importSummary).map(([key, value]: [string, any]) => (
                  <div key={key} className="rounded border border-border bg-surface px-3 py-2 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-text-muted">{t(`dataTransfer.sections.${key}`, { default: key })}</p>
                    <p className="text-sm text-text-primary">
                      {t('dataTransfer.counts', {
                        processed: value.processed ?? 0,
                        created: value.created ?? 0,
                        updated: value.updated ?? 0,
                        skipped: value.skipped ?? 0
                      })}
                    </p>
                    {value.errors && value.errors.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-xs text-rose-600 max-h-24 overflow-y-auto">
                        {value.errors.slice(0, 4).map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                        {value.errors.length > 4 && <li>+{value.errors.length - 4} more</li>}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-text-primary">{t('backup.title')}</h3>
              <p className="mt-1 text-sm text-text-muted">{t('backup.description')}</p>
            </div>
            <button
              type="button"
              onClick={handleBackupExport}
              disabled={!organization || isExportingBackup}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {isExportingBackup ? t('backup.exporting') : t('backup.action')}
            </button>
          </div>
        </div>
        </div>
    </ErrorBoundary>
  )
}
