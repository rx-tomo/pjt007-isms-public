'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { SuperAdminHealthAlert } from '@/lib/hooks/useSuperAdminHealth'

const RUNBOOK_URL =
  process.env.NEXT_PUBLIC_RUNBOOK_URL ??
  'https://github.com/rx-tomo/isms-pilot-public/blob/main/docs/06-operations/super-admin-runbook.md'

interface Props {
  alert: SuperAdminHealthAlert
}

export default function SuperAdminHealthBanner({ alert }: Props) {
  const t = useTranslations('superAdmin.health')
  const severity = alert.type === 'failure' ? 'failure' : 'standby'
  const bgClass = severity === 'failure' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
  const textClass = severity === 'failure' ? 'text-rose-700' : 'text-amber-700'
  const queueLabel = alert.queueLength ?? '—'
  const stateLabel = alert.failoverState ?? 'primary'

  return (
    <div className={`rounded-2xl border px-4 py-4 ${bgClass}`}>
      <div className="flex flex-col gap-2">
        <p className={`text-sm font-semibold ${textClass}`}>
          {t(`banner.${severity}.title`)}
        </p>
        <p className="text-sm text-text-secondary">
          {t(`banner.${severity}.body`, {
            queueLength: queueLabel,
            failoverState: t(`status.${stateLabel}`),
            lastDeployAt: alert.lastDeployAt ?? t('panel.unknown')
          })}
        </p>
        {alert.details && (
          <p className="text-xs text-text-muted" data-test="health-details">
            {alert.details}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
          <span>{t('panel.queue', { queueLength: queueLabel })}</span>
          <span>{t('panel.failover', { failoverState: t(`status.${stateLabel}`) })}</span>
          {alert.lastDeployAt && (
            <span>{t('panel.lastDeploy', { lastDeployAt: alert.lastDeployAt })}</span>
          )}
        </div>
        <Link
          href={RUNBOOK_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs font-semibold text-text-secondary underline"
        >
          {t('banner.cta')}
        </Link>
      </div>
    </div>
  )
}
