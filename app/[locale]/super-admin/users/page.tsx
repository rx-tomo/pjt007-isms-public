'use client'

import { useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import WindowToast from '@/components/ui/WindowToast'
import { UserService } from '@/lib/services/user'

type RoleKey = 'super_admin' | 'system_operator'

interface PageProps {
  params: Promise<{ locale: string }>
}

interface OrgOption {
  id: string
  name: string
  status: string
  plan: string
}

export default function SuperAdminUsersPage(props: PageProps) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('superAdmin.users')
  const router = useRouter()
  const userService = useMemo(() => new UserService(), [])

  const [authState, setAuthState] = useState<'unknown' | 'allowed' | 'denied'>('unknown')
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [orgsError, setOrgsError] = useState<string | null>(null)
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    role: 'system_operator' as RoleKey,
    organizationId: '',
    locale: locale === 'en' ? 'en' : 'ja'
  })
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadOrgs = async () => {
    setOrgsLoading(true)
    setOrgsError(null)
    try {
      const response = await fetch('/api/super-admin/organizations')
      if (!response.ok) throw new Error('Failed to load organizations')
      const data = await response.json()
      const rows = Array.isArray(data) ? data : []
      setOrgs(
        rows.map((row: any) => ({
          id: row.id,
          name: row.name ?? row.id.slice(0, 8),
          status: row.subscription_status ?? '',
          plan: row.subscription_plan ?? ''
        }))
      )
    } catch (err) {
      console.error('[SuperAdminUsers] load orgs failed', err)
      setOrgsError(t('messages.loadOrgsFailed'))
    } finally {
      setOrgsLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const user = await userService.getCurrentUser()
        if (!user || user.role !== 'super_admin') {
          setAuthState('denied')
          router.replace(`/${locale}/home`)
          return
        }
        setAuthState('allowed')
        await loadOrgs()
      } catch (error) {
        console.error('[SuperAdminUsers] guard failed', error)
        setAuthState('denied')
        router.replace(`/${locale}/home`)
      }
    })()
  }, [locale, router, userService])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.email.trim() || !form.role) {
      setToast({ type: 'error', message: t('messages.validation') })
      return
    }
    if (form.role === 'system_operator' && !form.organizationId) {
      setToast({ type: 'error', message: t('messages.validation') })
      return
    }

    setSubmitting(true)
    setToast(null)
    try {
      const response = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          role: form.role,
          organizationId: form.role === 'system_operator' ? form.organizationId : null,
          locale: form.locale
        })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error || t('messages.createFailed'))
      }
      const password = body?.temporaryPassword as string | null
      const message =
        password && password.length > 0
          ? `${t('messages.created', { email: form.email, role: t(`roles.${form.role}` as any) })} ${t('messages.passwordIssued', { password })}`
          : t('messages.created', { email: form.email, role: t(`roles.${form.role}` as any) })
      setToast({ type: 'success', message })
      setForm((prev) => ({ ...prev, email: '', organizationId: '' }))
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || t('messages.createFailed') })
    } finally {
      setSubmitting(false)
    }
  }

  if (authState === 'denied') return null

  return (
    <DashboardLayout locale={locale}>
      <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <WindowToast
          message={toast?.message ?? null}
          variant={toast?.type === 'error' ? 'error' : 'success'}
          onDismiss={() => setToast(null)}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">{t('badge')}</p>
          <h1 className="text-3xl font-semibold text-text-primary">{t('title')}</h1>
          <p className="max-w-3xl text-sm text-text-secondary">{t('description')}</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <form className="space-y-6 px-6 py-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="sa-user-email" className="text-sm font-medium text-text-primary">
                  {t('form.email')}
                </label>
                <input
                  id="sa-user-email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@example.com"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="sa-user-role" className="text-sm font-medium text-text-primary">
                  {t('form.role')}
                </label>
                <select
                  id="sa-user-role"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      role: e.target.value as RoleKey,
                      organizationId: e.target.value === 'super_admin' ? '' : prev.organizationId
                    }))
                  }
                >
                  <option value="super_admin">{t('roles.super_admin')}</option>
                  <option value="system_operator">{t('roles.system_operator')}</option>
                </select>
                <p className="text-xs text-text-muted">{t('form.roleHint')}</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="sa-user-locale" className="text-sm font-medium text-text-primary">
                  {t('form.locale')}
                </label>
                <select
                  id="sa-user-locale"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.locale}
                  onChange={(e) => setForm((prev) => ({ ...prev, locale: e.target.value }))}
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label htmlFor="sa-user-org" className="text-sm font-medium text-text-primary">
                  {t('form.organization')}
                  {form.role === 'system_operator' && <span className="text-rose-600"> *</span>}
                </label>
                <div className="flex gap-3">
                  <select
                    id="sa-user-org"
                    disabled={form.role === 'super_admin' || orgsLoading}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-app"
                    value={form.organizationId}
                    onChange={(e) => setForm((prev) => ({ ...prev, organizationId: e.target.value }))}
                  >
                    <option value="">{form.role === 'super_admin' ? (locale === 'ja' ? '任意' : 'Optional') : '—'}</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} · {org.plan}/{org.status}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadOrgs}
                    disabled={orgsLoading}
                    className="mt-1 inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {orgsLoading ? '...' : '↻'}
                  </button>
                </div>
                {orgsError && <p className="text-xs text-rose-600">{orgsError}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {submitting ? t('form.creating') : t('form.submit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
