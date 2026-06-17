'use client'

import { useTranslations } from 'next-intl'
/**
 * @deprecated Edge Function health endpoint has been removed.
 * This panel is retained for backward compatibility but will never render
 * because useSuperAdminHealth() now returns null.
 */
export type TenantAdminHealth = {
  status: 'ok' | 'degraded'
  queueLength: number
  lastDeployAt: string | null
  failoverState: 'primary' | 'standby'
  timestamp: string
}

interface Props {
  health: TenantAdminHealth
}

function formatTimestamp(value: string | null) {
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

export default function SuperAdminHealthPanel({ health }: Props) {
  const t = useTranslations('superAdmin.health')
  const connectionLabel = health.failoverState === 'standby' ? t('status.standby') : t('status.primary')

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-5 text-sm text-text-secondary shadow-sm">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('panel.title')}</p>
          <p className="text-lg font-semibold text-text-primary">{connectionLabel}</p>
        </div>
        <div className="text-right text-xs text-text-muted">
          <div>{t('panel.lastChecked', { timestamp: formatTimestamp(health.timestamp) })}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{t('panel.queueLabel')}</p>
          <p className="text-lg font-semibold text-text-primary">{health.queueLength}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{t('panel.failoverLabel')}</p>
          <p className="text-lg font-semibold text-text-primary">{connectionLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{t('panel.lastDeployLabel')}</p>
          <p className="text-lg font-semibold text-text-primary">{formatTimestamp(health.lastDeployAt)}</p>
        </div>
      </div>
    </div>
  )
}
