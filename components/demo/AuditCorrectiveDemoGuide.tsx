'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

const planId = '7c020000-0000-4000-8000-000200000091'

export default function AuditCorrectiveDemoGuide({ locale, showLinks = false }: { locale: string; showLinks?: boolean }) {
  const t = useTranslations('devLogin.auditScenario')
  return (
    <section data-testid="audit-corrective-demo-guide" className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-sm text-teal-950">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="mt-2">{t('intro')}</p>
      <ol className="mt-3 space-y-2">
        {(['assignment', 'action', 'evidence', 'decision'] as const).map(key => <li key={key}>{t(key)}</li>)}
      </ol>
      {showLinks && <div className="mt-4 flex flex-wrap gap-4 font-medium underline">
        <Link href={`/${locale}/audit/plans/${planId}`}>{t('plan')}</Link>
        <Link href={`/${locale}/audit/plans/${planId}/checklist`}>{t('checklist')}</Link>
        <a href="/demo/audit-access-review-observation.csv" download>{t('sample')}</a>
      </div>}
      <p className="mt-4 text-xs leading-6">{t('limits')}</p>
      <p className="mt-2 text-xs leading-6">{t('reset')}</p>
    </section>
  )
}
