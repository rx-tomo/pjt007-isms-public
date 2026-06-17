'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  SuperAdminService,
  type TenantSummary,
  type OperatorCredentials
} from '@/lib/services/superAdmin'
import { UserService } from '@/lib/services/user'
import SuperAdminHealthBanner from '@/components/super-admin/SuperAdminHealthBanner'
import SuperAdminHealthPanel from '@/components/super-admin/SuperAdminHealthPanel'
import TenantActions from '@/components/super-admin/TenantActions'
import { useSuperAdminHealth } from '@/lib/hooks/useSuperAdminHealth'
import { useToast } from '@/components/ui/ToastProvider'

type ViewMode = 'active' | 'deleted'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  suspended: 'bg-rose-50 text-rose-700 border border-rose-100',
  inactive: 'bg-surface-elevated text-text-secondary border border-border',
  cancelled: 'bg-surface-elevated text-text-muted border border-border',
  deleted: 'bg-surface-elevated text-text-secondary border border-border'
}

const PLAN_STYLES: Record<string, string> = {
  trial: 'text-amber-700 bg-amber-50 border border-amber-100',
  starter: 'text-blue-700 bg-blue-50 border border-blue-100',
  standard: 'text-purple-700 bg-purple-50 border border-purple-100',
  enterprise: 'text-text-secondary bg-app border border-border'
}

const ISMS_PHASE_STYLES: Record<string, string> = {
  initial: 'bg-sky-50 text-sky-700 border border-sky-100',
  surveillance: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  unset: 'bg-app text-text-secondary border border-border'
}

const FORM_HELPER_IDS = {
  name: 'super-admin-tenant-name-help',
  plan: 'super-admin-tenant-plan-help',
  status: 'super-admin-tenant-status-help',
  trialDays: 'super-admin-tenant-trial-help',
  operatorEmail: 'super-admin-operator-email-help'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function normalizeIsmsPhase(value: TenantSummary['isms_phase'] | string | null | undefined) {
  return value === 'initial' || value === 'surveillance' ? value : null
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default function SuperAdminOrganizationsPage(props: PageProps) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('superAdmin.organizations')
  const router = useRouter()
  const { pushToast } = useToast()
  const service = useMemo(() => new SuperAdminService(), [])
  const userService = useMemo(() => new UserService(), [])

  const [authState, setAuthState] = useState<'unknown' | 'allowed' | 'denied'>('unknown')
  const [viewMode, setViewMode] = useState<ViewMode>('active')
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [deletedTenants, setDeletedTenants] = useState<TenantSummary[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(true)
  const [deletedTenantsLoading, setDeletedTenantsLoading] = useState(false)
  const [tenantsError, setTenantsError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    plan: 'trial',
    status: 'active',
    trialDays: 30,
    operatorEmail: '',
    operatorName: '',
    operatorLocale: 'ja'
  })
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [operatorCredentials, setOperatorCredentials] = useState<OperatorCredentials | null>(null)
  const [creatingTenant, setCreatingTenant] = useState(false)
  const [lockBusyId, setLockBusyId] = useState<string | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const { health, alert } = useSuperAdminHealth()


  const refreshTenants = useCallback(async () => {
    setTenantsLoading(true)
    setTenantsError(null)
    try {
      const list = await service.listTenants()
      // Filter out deleted tenants from active list
      setTenants(list.filter((t) => !t.deleted_at))
    } catch (error) {
      console.error('[SuperAdmin] listTenants failed', error)
      setTenantsError(t('errors.loadTenants'))
    } finally {
      setTenantsLoading(false)
    }
  }, [service, t])

  const refreshDeletedTenants = useCallback(async () => {
    setDeletedTenantsLoading(true)
    setTenantsError(null)
    try {
      const list = await service.listDeletedOrganizations()
      setDeletedTenants(list.map((org) => ({
        id: org.id,
        name: org.name,
        deleted_at: org.deleted_at,
        subscription_plan: (org.subscription_plan as TenantSummary['subscription_plan']) ?? 'trial',
        subscription_status: (org.subscription_status as TenantSummary['subscription_status']) ?? 'inactive',
        trial_ends_at: null,
        created_at: '',
        updated_at: ''
      })))
    } catch (error) {
      console.error('[SuperAdmin] listDeletedOrganizations failed', error)
      setTenantsError(t('errors.loadDeletedTenants'))
    } finally {
      setDeletedTenantsLoading(false)
    }
  }, [service, t])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'deleted' && deletedTenants.length === 0) {
      refreshDeletedTenants()
    }
  }, [deletedTenants.length, refreshDeletedTenants])

  const handleAuthGuard = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser()
      if (!user || user.role !== 'super_admin') {
        setAuthState('denied')
        router.replace(`/${locale}/home`)
        return
      }
      setAuthState('allowed')
      await refreshTenants()
    } catch (error) {
      console.error('[SuperAdmin] failed to load user context', error)
      setAuthState('denied')
      router.replace(`/${locale}/home`)
    }
  }, [locale, refreshTenants, router, userService])

  useEffect(() => {
    handleAuthGuard()
  }, [handleAuthGuard])

  const handleCreateTenant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreatingTenant(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      if (!createForm.name.trim() || !createForm.operatorEmail.trim()) {
        setCreateError(t('errors.createValidation'))
        setCreatingTenant(false)
        return
      }
      const { tenant, operator } = await service.createTenant({
        name: createForm.name.trim(),
        plan: createForm.plan,
        status: createForm.status,
        trialDays: Number.isFinite(createForm.trialDays) ? createForm.trialDays : 30,
        operatorEmail: createForm.operatorEmail.trim(),
        operatorName: createForm.operatorName.trim() || undefined,
        operatorLocale: createForm.operatorLocale
      })
      setOperatorCredentials(operator)
      setCreateSuccess(t('create.success', { name: tenant.name }))
      setTenants((prev) => [tenant, ...prev.filter((row) => row.id !== tenant.id)])
      setCreateForm((prev) => ({ ...prev, name: '', operatorEmail: '', operatorName: '' }))
      await refreshTenants()
    } catch (error) {
      console.error('[SuperAdmin] createTenant failed', error)
      setCreateError(t('errors.createFailed'))
    } finally {
      setCreatingTenant(false)
    }
  }

  const handleToggleLock = async (tenant: TenantSummary, action: 'lock' | 'unlock') => {
    setLockBusyId(tenant.id)
    setTenantsError(null)
    try {
      const reason =
        action === 'lock'
          ? window.prompt(t('lock.prompt', { name: tenant.name }))?.trim() || undefined
          : undefined
      const updated = await service.toggleTenantLock(tenant.id, reason)
      setTenants((prev) => prev.map((row) => (row.id === tenant.id ? { ...row, ...updated } : row)))
    } catch (error) {
      console.error('[SuperAdmin] toggleTenantLock failed', error)
      setTenantsError(t('errors.lockFailed'))
    } finally {
      setLockBusyId(null)
    }
  }

  const handleDeleteTenant = async (tenantId: string, reason?: string) => {
    setActionBusyId(tenantId)
    try {
      await service.softDeleteOrganization(tenantId, reason)
      const deletedTenant = tenants.find((t) => t.id === tenantId)
      setTenants((prev) => prev.filter((t) => t.id !== tenantId))
      if (deletedTenant) {
        setDeletedTenants((prev) => [...prev, { ...deletedTenant, deleted_at: new Date().toISOString() }])
      }
      pushToast({
        message: t('tenantActions.deleteSuccess', { name: deletedTenant?.name ?? '' }),
        variant: 'success'
      })
    } catch (error) {
      console.error('[SuperAdmin] softDeleteOrganization failed', error)
      const message = error instanceof Error ? error.message : t('tenantActions.errors.deleteFailed')
      pushToast({ message, variant: 'error' })
      throw error
    } finally {
      setActionBusyId(null)
    }
  }

  const handleRestoreTenant = async (tenantId: string, reason?: string) => {
    setActionBusyId(tenantId)
    try {
      await service.restoreOrganization(tenantId, reason)
      const restoredTenant = deletedTenants.find((t) => t.id === tenantId)
      setDeletedTenants((prev) => prev.filter((t) => t.id !== tenantId))
      if (restoredTenant) {
        setTenants((prev) => [...prev, { ...restoredTenant, deleted_at: null }])
      }
      pushToast({
        message: t('tenantActions.restoreSuccess', { name: restoredTenant?.name ?? '' }),
        variant: 'success'
      })
    } catch (error) {
      console.error('[SuperAdmin] restoreOrganization failed', error)
      const message = error instanceof Error ? error.message : t('tenantActions.errors.restoreFailed')
      pushToast({ message, variant: 'error' })
      throw error
    } finally {
      setActionBusyId(null)
    }
  }

  const handleCopy = (value: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(value).catch(() => {})
  }

  const displayedTenants = viewMode === 'active' ? tenants : deletedTenants
  const isLoading = viewMode === 'active' ? tenantsLoading : deletedTenantsLoading

  const content = (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {alert && <SuperAdminHealthBanner alert={alert} />}
      {health && (
        <div>
          <SuperAdminHealthPanel health={health} />
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">{t('badge')}</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">{t('title')}</h1>
          <p className="mt-2 text-text-secondary max-w-3xl">{t('description')}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => viewMode === 'active' ? refreshTenants() : refreshDeletedTenants()}
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            disabled={isLoading}
          >
            {isLoading ? t('tenants.refreshing') : t('tenants.refresh')}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{t('tenants.title')}</h2>
                <p className="text-sm text-text-muted">{t('tenants.subtitle')}</p>
              </div>
            </div>

            {/* View Mode Toggle Tabs */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => handleViewModeChange('active')}
                data-testid="show-active-toggle"
                className={classNames(
                  'flex-1 px-6 py-3 text-sm font-medium transition-colors',
                  viewMode === 'active'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50/50'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                )}
              >
                {t('viewMode.active')}
                <span className="ml-2 rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary">
                  {tenants.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('deleted')}
                data-testid="show-deleted-toggle"
                className={classNames(
                  'flex-1 px-6 py-3 text-sm font-medium transition-colors',
                  viewMode === 'deleted'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50/50'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                )}
              >
                {t('viewMode.deleted')}
                <span className="ml-2 rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary">
                  {deletedTenants.length}
                </span>
              </button>
            </div>

            {tenantsError && (
              <div className="px-6 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">{tenantsError}</div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-app">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {t('tenants.columns.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {t('tenants.columns.plan')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {t('tenants.columns.ismsPhase')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {viewMode === 'deleted' ? t('tenants.columns.deletedAt') : t('tenants.columns.trialEnds')}
                    </th>
                    {viewMode === 'active' && (
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                        {t('tenants.columns.audits')}
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {t('tenants.columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={viewMode === 'active' ? 6 : 5} className="px-6 py-10 text-center text-text-muted">
                        {t('tenants.loading')}
                      </td>
                    </tr>
                  ) : displayedTenants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={viewMode === 'active' ? 6 : 5}
                        className="px-6 py-10 text-center text-text-muted"
                        data-testid={viewMode === 'deleted' ? 'empty-deleted-tenants' : undefined}
                      >
                        {viewMode === 'deleted' ? t('tenants.emptyDeleted') : t('tenants.empty')}
                      </td>
                    </tr>
                  ) : (
                    displayedTenants.map((tenant) => {
                      const isDeleted = Boolean(tenant.deleted_at)
                      const isLocked = tenant.locked ?? tenant.subscription_status === 'suspended'
                      const ismsPhase = normalizeIsmsPhase(tenant.isms_phase)
                      return (
                        <tr key={tenant.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="font-medium text-text-primary">{tenant.name}</div>
                          <div className="mt-1 text-xs text-text-muted">{t('tenants.created', { date: formatDate(tenant.created_at) })}</div>
                        </td>
                        <td className="px-6 py-4 align-top space-y-2">
                          <span
                            className={classNames(
                              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize',
                              PLAN_STYLES[tenant.subscription_plan] ?? PLAN_STYLES.standard
                            )}
                          >
                            {t(`tenants.plan.${tenant.subscription_plan}` as const)}
                          </span>
                          <span
                            className={classNames(
                              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize',
                              isDeleted
                                ? STATUS_STYLES.deleted
                                : isLocked
                                  ? STATUS_STYLES.suspended
                                  : (STATUS_STYLES[tenant.subscription_status] ?? STATUS_STYLES.active)
                            )}
                          >
                            {isDeleted
                              ? t('tenants.status.deleted')
                              : isLocked
                                ? t('tenants.status.locked')
                                : t(`tenants.status.${tenant.subscription_status}` as const)}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span
                            data-testid={`super-admin-tenant-phase-${tenant.id}`}
                            className={classNames(
                              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                              ISMS_PHASE_STYLES[ismsPhase ?? 'unset'] ?? ISMS_PHASE_STYLES.unset
                            )}
                          >
                            {ismsPhase
                              ? t(`tenants.ismsPhase.${ismsPhase}` as const)
                              : t('tenants.ismsPhase.unset')}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-text-secondary">
                          {isDeleted ? formatDate(tenant.deleted_at) : formatDate(tenant.trial_ends_at)}
                        </td>
                        {viewMode === 'active' && (
                          <td className="px-6 py-4 align-top text-text-secondary">
                            <div className="font-semibold">
                              {tenant.audit_log_count ?? 0} {t('tenants.audits.total')}
                            </div>
                            <div className="text-xs text-text-muted">{t('tenants.audits.last', { date: formatDate(tenant.last_audit_at) })}</div>
                          </td>
                        )}
                        <td className="px-6 py-4 align-top text-right">
                          <div className="flex justify-end gap-2">
                            {viewMode === 'active' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleLock(tenant, isLocked ? 'unlock' : 'lock')}
                                  disabled={lockBusyId === tenant.id}
                                  className={classNames(
                                    'rounded-lg px-3 py-1.5 text-xs font-medium',
                                    isLocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                                    lockBusyId === tenant.id && 'opacity-60'
                                  )}
                                >
                                  {isLocked ? t('tenants.actions.unlock') : t('tenants.actions.lock')}
                                </button>
                              </>
                            )}
                            <TenantActions
                              tenant={tenant}
                              isDeleted={isDeleted}
                              onDelete={handleDeleteTenant}
                              onRestore={handleRestoreTenant}
                              disabled={actionBusyId === tenant.id}
                            />
                          </div>
                        </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">{t('create.title')}</h2>
              <p className="text-sm text-text-muted">{t('create.subtitle')}</p>
            </div>
            {createError && <div className="px-6 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">{createError}</div>}
            {createSuccess && <div className="px-6 py-3 text-sm text-emerald-700 bg-emerald-50 border-b border-emerald-100">{createSuccess}</div>}
            <form className="space-y-4 px-6 py-6" onSubmit={handleCreateTenant}>
              <div>
                <label htmlFor="super-admin-tenant-name" className="text-sm font-medium text-text-secondary">
                  {t('create.fields.name')}
                </label>
                <input
                  id="super-admin-tenant-name"
                  type="text"
                  required
                  aria-describedby={FORM_HELPER_IDS.name}
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-border focus:outline-none"
                />
                <p id={FORM_HELPER_IDS.name} className="mt-1 text-xs text-text-muted">
                  {t('create.helpTexts.name')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="super-admin-tenant-plan" className="text-sm font-medium text-text-secondary">
                    {t('create.fields.plan')}
                  </label>
                  <select
                    id="super-admin-tenant-plan"
                    value={createForm.plan}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, plan: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    aria-describedby={FORM_HELPER_IDS.plan}
                    required
                  >
                    {['trial', 'starter', 'standard', 'enterprise'].map((plan) => (
                      <option key={plan} value={plan}>
                        {t(`create.planOptions.${plan}` as const)}
                      </option>
                    ))}
                  </select>
                  <p id={FORM_HELPER_IDS.plan} className="mt-1 text-xs text-text-muted">
                    {t('create.helpTexts.plan')}
                  </p>
                </div>
                <div>
                  <label htmlFor="super-admin-tenant-status" className="text-sm font-medium text-text-secondary">
                    {t('create.fields.status')}
                  </label>
                  <select
                    id="super-admin-tenant-status"
                    value={createForm.status}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    aria-describedby={FORM_HELPER_IDS.status}
                    required
                  >
                    {['active', 'suspended'].map((status) => (
                      <option key={status} value={status}>
                        {t(`tenants.status.${status}` as const)}
                      </option>
                    ))}
                  </select>
                  <p id={FORM_HELPER_IDS.status} className="mt-1 text-xs text-text-muted">
                    {t('create.helpTexts.status')}
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="super-admin-tenant-trial" className="text-sm font-medium text-text-secondary">
                  {t('create.fields.trialDays')}
                </label>
                <input
                  id="super-admin-tenant-trial"
                  type="number"
                  min={0}
                  max={365}
                  value={createForm.trialDays}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, trialDays: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  aria-describedby={FORM_HELPER_IDS.trialDays}
                />
                <p id={FORM_HELPER_IDS.trialDays} className="mt-1 text-xs text-text-muted">
                  {t('create.helpTexts.trialDays')}
                </p>
              </div>
              <div>
                <label htmlFor="super-admin-operator-email" className="text-sm font-medium text-text-secondary">
                  {t('create.fields.operatorEmail')}
                </label>
                <input
                  id="super-admin-operator-email"
                  type="email"
                  required
                  aria-describedby={FORM_HELPER_IDS.operatorEmail}
                  value={createForm.operatorEmail}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, operatorEmail: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <p id={FORM_HELPER_IDS.operatorEmail} className="mt-1 text-xs text-text-muted">
                  {t('create.helpTexts.operatorEmail')}
                </p>
              </div>
              <div>
                <label htmlFor="super-admin-operator-name" className="text-sm font-medium text-text-secondary">
                  {t('create.fields.operatorName')}
                </label>
                <input
                  id="super-admin-operator-name"
                  type="text"
                  value={createForm.operatorName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, operatorName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="super-admin-operator-locale" className="text-sm font-medium text-text-secondary">
                  {t('create.fields.locale')}
                </label>
                <select
                  id="super-admin-operator-locale"
                  value={createForm.operatorLocale}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, operatorLocale: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingTenant}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {creatingTenant ? t('create.actions.creating') : t('create.actions.submit')}
              </button>
            </form>
          </div>

          {operatorCredentials && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">{t('create.credentials.title')}</p>
              {operatorCredentials.status === 'linked' && (
                <p className="mt-0.5 font-semibold text-amber-900">
                  {t('create.credentials.linkedTitle')}
                </p>
              )}
              <p className="mt-1 text-amber-800">
                {operatorCredentials.status === 'linked'
                  ? t('create.credentials.linkedDescription')
                  : t('create.credentials.description')}
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-text-primary">
                  <div>
                    <p className="text-xs text-text-muted">{t('create.credentials.email')}</p>
                    <p className="font-mono text-sm">{operatorCredentials.email}</p>
                  </div>
                  <button className="text-xs font-medium text-text-secondary" onClick={() => handleCopy(operatorCredentials.email)}>
                    {t('create.credentials.copy')}
                  </button>
                </div>
                {operatorCredentials.password ? (
                  <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-text-primary">
                    <div>
                      <p className="text-xs text-text-muted">{t('create.credentials.password')}</p>
                      <p className="font-mono text-sm">{operatorCredentials.password}</p>
                    </div>
                    <button className="text-xs font-medium text-text-secondary" onClick={() => handleCopy(operatorCredentials.password ?? '')}>
                      {t('create.credentials.copy')}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg bg-surface px-3 py-2 text-text-primary">
                    <p className="text-xs text-text-muted">{t('create.credentials.passwordLinkedLabel')}</p>
                    <p className="text-sm">{t('create.credentials.passwordLinkedValue')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )

  if (authState === 'unknown') {
    return (
      <DashboardLayout locale={locale}>
        <div className="px-4 py-10 text-center text-text-muted">{t('loadingGuard')}</div>
      </DashboardLayout>
    )
  }

  if (authState === 'denied') {
    return null
  }

  return <DashboardLayout locale={locale}>{content}</DashboardLayout>
}
