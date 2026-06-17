'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ROLE_SCENARIOS, type RoleKey, type RoleScenarioOrganization } from '@/lib/dev-login/scenarios'
import { getRoleDefaultRoute } from '@/lib/home/roleHomeConfig'

type OrganizationOption = RoleScenarioOrganization & {
  updatedAt: string | null
  ismsPhase: string | null
  employeeCountRange: string | null
  industry: string | null
  isoCertificationStatus: string | null
  userCount: number
}

interface OrganizationUserOption {
  id: string
  email: string
  full_name: string | null
  role: RoleKey
  department: string | null
  position: string | null
  status: string | null
  is_active: boolean | null
}

interface OrganizationsResponse {
  organizations?: OrganizationOption[]
}

const PLAN_LABEL_KEYS: Record<RoleScenarioOrganization['plan'], string> = {
  trial: 'tenantSelector.planLabels.trial',
  starter: 'tenantSelector.planLabels.starter',
  standard: 'tenantSelector.planLabels.standard',
  enterprise: 'tenantSelector.planLabels.enterprise'
}

const STATUS_LABEL_KEYS: Record<RoleScenarioOrganization['status'], string> = {
  active: 'tenantSelector.statusLabels.active',
  inactive: 'tenantSelector.statusLabels.inactive',
  suspended: 'tenantSelector.statusLabels.suspended',
  cancelled: 'tenantSelector.statusLabels.cancelled'
}

const ROLE_BADGE_STYLES: Record<RoleKey, string> = {
  super_admin: 'bg-slate-100 text-slate-800',
  system_operator: 'bg-purple-100 text-purple-800',
  org_admin: 'bg-blue-100 text-blue-800',
  user: 'bg-emerald-100 text-emerald-800',
  auditor: 'bg-amber-100 text-amber-800',
  approver: 'bg-rose-100 text-rose-800'
}

export default function DevLoginPage() {
  const t = useTranslations('devLogin')
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('')
  const [users, setUsers] = useState<OrganizationUserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [organizationStatus, setOrganizationStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [userStatus, setUserStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => {
      const activeScore = Number(b.status === 'active') - Number(a.status === 'active')
      if (activeScore !== 0) return activeScore
      return a.name.localeCompare(b.name, locale === 'ja' ? 'ja' : 'en')
    })
  }, [organizations, locale])

  const selectedOrganization = sortedOrganizations.find((org) => org.id === selectedOrganizationId) ?? null
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null
  const canLoginAsTenantUser = Boolean(selectedOrganization && selectedUser && selectedOrganization.status === 'active')
  const formatPhaseLabel = (phase: string | null) => {
    if (phase === 'initial') return t('tenantSelector.phaseLabels.initial')
    if (phase === 'surveillance') return t('tenantSelector.phaseLabels.surveillance')
    return t('tenantSelector.phaseLabels.unset')
  }

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      setOrganizationStatus('loading')
      setError(null)

      try {
        const response = await fetch('/api/dev/organizations')
        if (!response.ok) {
          throw new Error(t('tenantSelector.loadError'))
        }
        const payload = (await response.json()) as OrganizationsResponse
        const incoming = payload.organizations ?? []
        if (cancelled) return
        setOrganizations(incoming)
        const firstActive = incoming.find((org) => org.status === 'active') ?? incoming[0]
        setSelectedOrganizationId((current) => current || firstActive?.id || '')
        setOrganizationStatus('loaded')
      } catch (loadError) {
        if (cancelled) return
        setOrganizationStatus('error')
        setError(loadError instanceof Error ? loadError.message : t('tenantSelector.loadError'))
      }
    }

    void loadOrganizations()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!selectedOrganizationId) {
      setUsers([])
      setSelectedUserId('')
      setUserStatus('idle')
      return
    }

    let cancelled = false
    setUserStatus('loading')
    setError(null)

    async function loadUsers() {
      try {
        const search = new URLSearchParams({ organizationId: selectedOrganizationId })
        const response = await fetch(`/api/dev/users?${search.toString()}`)
        if (!response.ok) {
          throw new Error(t('userSelector.loadError'))
        }
        const payload = await response.json()
        const incoming = (payload.users ?? []) as OrganizationUserOption[]
        if (cancelled) return
        setUsers(incoming)
        setSelectedUserId((current) => {
          if (incoming.some((user) => user.id === current)) return current
          return incoming.find((user) => user.role === 'org_admin')?.id ?? incoming[0]?.id ?? ''
        })
        setUserStatus('loaded')
      } catch (loadError) {
        if (cancelled) return
        setUsers([])
        setSelectedUserId('')
        setUserStatus('error')
        setError(loadError instanceof Error ? loadError.message : t('userSelector.loadError'))
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [selectedOrganizationId, t])

  const executeLogin = async (mode: 'super_admin' | 'tenant_user') => {
    setError(null)
    setIsLoading(true)

    try {
      const role = mode === 'super_admin' ? 'super_admin' : selectedUser?.role
      const organizationId = mode === 'super_admin' ? null : selectedOrganization?.id
      const email = mode === 'super_admin' ? ROLE_SCENARIOS.super_admin.email : selectedUser?.email
      const userId = mode === 'super_admin' ? null : selectedUser?.id

      if (!role || !email) {
        throw new Error(t('errors.userRequired'))
      }

      if (mode === 'tenant_user') {
        if (!organizationId || !userId) {
          throw new Error(t('errors.userRequired'))
        }
        if (selectedOrganization?.status !== 'active') {
          throw new Error(t('errors.tenantInactive'))
        }
      }

      const response = await fetch('/api/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          organizationId,
          email,
          userId
        })
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body ? body.error : 'Failed to prepare dev session'
        throw new Error(typeof message === 'string' ? message : 'Failed to prepare dev session')
      }

      const redirect = getRoleDefaultRoute(role)
      router.push(`/${locale}${redirect}?from=dev-login&role=${role}`)
    } catch (loginError) {
      console.error('[DevLogin] failed', loginError)
      setError(loginError instanceof Error ? loginError.message : 'Dev login failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            {t('devOnlyFeature')}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-text-primary">{t('title')}</h1>
              <p className="mt-2 max-w-3xl text-sm text-text-secondary">{t('description')}</p>
            </div>
            <Link href={`/${locale}/auth/login`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              {t('backToLogin')}
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{t('tenantSelector.title')}</h2>
              <p className="mt-1 text-xs text-text-secondary">{t('tenantSelector.description')}</p>
            </div>

            <div className="space-y-2" data-testid="dev-login-tenant-list">
              {organizationStatus === 'loading' && (
                <div className="rounded-lg border border-border px-4 py-3 text-sm text-text-secondary">{t('tenantSelector.loading')}</div>
              )}
              {sortedOrganizations.map((org) => {
                const selected = org.id === selectedOrganizationId
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setSelectedOrganizationId(org.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      selected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-border hover:border-indigo-300 hover:bg-indigo-50/60'
                    }`}
                    data-testid={`dev-login-tenant-${org.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{org.name}</div>
                        <div className="mt-1 text-xs text-text-secondary">{org.industry || org.employeeCountRange || org.id}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        org.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t(STATUS_LABEL_KEYS[org.status])}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span>{t(PLAN_LABEL_KEYS[org.plan])}</span>
                      <span>{formatPhaseLabel(org.ismsPhase)}</span>
                      <span>{t('tenantSelector.userCount', { count: org.userCount })}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-surface shadow-sm">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-sm font-semibold text-text-primary">{t('userSelector.title')}</h2>
                <p className="mt-1 text-xs text-text-secondary">{t('userSelector.description')}</p>
              </div>
              <div className="space-y-4 px-6 py-5">
                {selectedOrganization && (
                  <div className="grid gap-3 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-700 sm:grid-cols-4">
                    <div>
                      <div className="font-medium text-slate-500">{t('tenantSelector.labels.status')}</div>
                      <div className="mt-1">{t(STATUS_LABEL_KEYS[selectedOrganization.status])}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-500">{t('tenantSelector.labels.plan')}</div>
                      <div className="mt-1">{t(PLAN_LABEL_KEYS[selectedOrganization.plan])}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-500">{t('tenantSelector.labels.phase')}</div>
                      <div className="mt-1">{formatPhaseLabel(selectedOrganization.ismsPhase)}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-500">{t('tenantSelector.labels.users')}</div>
                      <div className="mt-1">{selectedOrganization.userCount}</div>
                    </div>
                  </div>
                )}

                {userStatus === 'loading' && (
                  <div className="rounded-lg border border-border px-4 py-3 text-sm text-text-secondary">{t('userSelector.loading')}</div>
                )}
                {userStatus === 'loaded' && users.length === 0 && (
                  <div className="rounded-lg border border-border px-4 py-3 text-sm text-text-secondary">{t('userSelector.empty')}</div>
                )}

                <div className="grid gap-3 md:grid-cols-2" data-testid="dev-login-user-list">
                  {users.map((user) => {
                    const selected = user.id === selectedUserId
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={`min-h-32 rounded-lg border px-4 py-3 text-left transition ${
                          selected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-border hover:border-indigo-300 hover:bg-indigo-50/60'
                        }`}
                        data-testid={`dev-login-user-${user.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-text-primary">{user.full_name || t('userSelector.unknownName')}</div>
                            <div className="mt-1 text-xs text-text-secondary">{user.email}</div>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${ROLE_BADGE_STYLES[user.role]}`}>
                            {t(`roles.${user.role}.name`)}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-text-muted">
                          <div>{user.department || '-'}</div>
                          <div>{user.position || '-'}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => executeLogin('tenant_user')}
                    disabled={isLoading || !canLoginAsTenantUser}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    data-testid="dev-login-tenant-user-submit"
                  >
                    {isLoading ? t('loggingIn') : t('login')}
                  </button>
                  {!canLoginAsTenantUser && selectedOrganization?.status !== 'active' && (
                    <span className="text-xs text-text-muted">{t('errors.tenantInactive')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">{t('superAdminEntry.title')}</h2>
                  <p className="mt-1 text-xs text-text-secondary">{t('superAdminEntry.description')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => executeLogin('super_admin')}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="dev-login-super-admin-submit"
                >
                  {t('superAdminEntry.login')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
