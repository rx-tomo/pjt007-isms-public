'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  SuperAdminService,
  type GlobalAuditLogEntry,
  type AuditLogScope
} from '@/lib/services/superAdmin'
import { UserService } from '@/lib/services/user'
import SuperAdminHealthBanner from '@/components/super-admin/SuperAdminHealthBanner'
import SuperAdminHealthPanel from '@/components/super-admin/SuperAdminHealthPanel'
import { useSuperAdminHealth } from '@/lib/hooks/useSuperAdminHealth'

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

function getLastCursor(entries: GlobalAuditLogEntry[]) {
  if (entries.length === 0) return null
  return entries[entries.length - 1]?.created_at ?? null
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function renderChangeSummary(log: GlobalAuditLogEntry, fallback: string) {
  const changes = log.changes ?? {}
  const reason = (changes as Record<string, unknown>).reason
  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason
  }
  if ('subscription_status' in changes) {
    return JSON.stringify(changes)
  }
  return Object.keys(changes).length > 0 ? JSON.stringify(changes) : fallback
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default function SuperAdminLogsPage(props: PageProps) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('superAdmin.organizations')
  const router = useRouter()
  const service = useMemo(() => new SuperAdminService(), [])
  const userService = useMemo(() => new UserService(), [])
  const { health, alert } = useSuperAdminHealth()

  const [authState, setAuthState] = useState<'unknown' | 'allowed' | 'denied'>('unknown')
  const [auditLogs, setAuditLogs] = useState<GlobalAuditLogEntry[]>([])
  const [auditScope, setAuditScope] = useState<AuditLogScope>('global')
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditExhausted, setAuditExhausted] = useState(false)

  const refreshAuditLogs = useCallback(async (
    options: {
      reset?: boolean
      scope?: AuditLogScope
      cursor?: string | null
    } = {}
  ) => {
    const { reset = false, scope, cursor } = options
    const targetScope = scope ?? auditScope
    setAuditLoading(true)
    setAuditError(null)
    try {
      const logs = await service.listGlobalAuditLogs({
        limit: 50,
        before: reset ? null : cursor ?? null,
        scope: targetScope
      })
      if (reset) {
        setAuditLogs(logs)
      } else {
        setAuditLogs((prev) => [...prev, ...logs])
      }
      setAuditExhausted(logs.length === 0)
    } catch (error) {
      console.error('[SuperAdminLogs] listGlobalAuditLogs failed', error)
      setAuditError(t('errors.loadAudits'))
    } finally {
      setAuditLoading(false)
    }
  }, [auditScope, service, t])

  const handleScopeChange = async (scope: AuditLogScope) => {
    setAuditScope(scope)
    await refreshAuditLogs({ reset: true, scope })
  }

  const handleAuthGuard = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser()
      if (!user || user.role !== 'super_admin') {
        setAuthState('denied')
        router.replace(`/${locale}/home`)
        return
      }
      setAuthState('allowed')
      await refreshAuditLogs({ reset: true, scope: 'global' })
    } catch (error) {
      console.error('[SuperAdminLogs] failed to load user context', error)
      setAuthState('denied')
      router.replace(`/${locale}/home`)
    }
  }, [locale, refreshAuditLogs, router, userService])

  useEffect(() => {
    handleAuthGuard()
  }, [handleAuthGuard])

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
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">{t('audit.title')}</h1>
          <p className="mt-2 max-w-3xl text-text-secondary">{t('audit.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => refreshAuditLogs({ reset: true })}
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
          disabled={auditLoading}
        >
          {auditLoading ? t('audit.refreshing') : t('audit.refresh')}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-text-primary">{t('audit.title')}</p>
            <p className="text-xs text-text-muted">{t('audit.subtitle')}</p>
          </div>
          <div className="flex gap-2 rounded-full bg-app p-1 text-sm font-medium">
            {(['global', 'tenant'] as AuditLogScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => handleScopeChange(scope)}
                className={classNames(
                  'rounded-full px-4 py-1.5',
                  auditScope === scope ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted'
                )}
              >
                {t(`audit.scope.${scope}` as const)}
              </button>
            ))}
          </div>
        </div>
        {auditError && <div className="px-6 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">{auditError}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-app">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t('audit.columns.timestamp')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t('audit.columns.organization')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t('audit.columns.action')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t('audit.columns.actor')}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t('audit.columns.notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface text-sm">
              {auditLoading && auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-text-muted">{t('audit.loading')}</td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-text-muted">{t('audit.empty')}</td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 text-text-secondary">{formatDate(log.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-primary">{log.organization_name ?? t('audit.unknownOrg')}</div>
                      <div className="text-xs text-text-muted">{log.organization_id ?? '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">{log.action}</span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      <div className="font-medium">{log.user_email ?? '—'}</div>
                      <div className="text-xs text-text-muted">{log.user_id ?? ''}</div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      <pre className="whitespace-pre-wrap break-all text-xs text-text-muted">{renderChangeSummary(log, '—')}</pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-6 py-4 text-center">
          <button
            type="button"
            onClick={() => refreshAuditLogs({ cursor: getLastCursor(auditLogs) })}
            disabled={auditLoading || auditExhausted}
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-60"
          >
            {auditExhausted ? t('audit.noMore') : auditLoading ? t('audit.loading') : t('audit.loadMore')}
          </button>
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
