import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import AIUsageDashboardPageWrapper from '@/components/ai/AIUsageDashboardPageWrapper'

interface AIUsagePageProps {
  params: Promise<{ locale: string }>
}

/**
 * Generate metadata for the AI Usage Dashboard page.
 */
export async function generateMetadata(props: AIUsagePageProps): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'ai.settings' })

  return {
    title: t('usagePageTitle'),
    description: t('usagePageTitle')
  }
}

/**
 * AI Usage Dashboard Page
 *
 * Server Component that renders the AIUsageDashboardPageWrapper client component.
 * This page is accessible at /[locale]/settings/ai/usage and provides:
 * - Usage statistics summary cards
 * - Period selector (7d/30d/90d)
 * - Daily usage chart
 * - Type breakdown visualization
 *
 * Access: org_admin role required (enforced by middleware/layout)
 */
export default async function AIUsagePage(props: AIUsagePageProps) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'ai.settings' })

  // In production, organizationId would come from the authenticated session.
  const organizationId = 'current-org'

  return (
    <div className="max-w-6xl">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 sm:text-3xl sm:truncate" style={{ color: 'var(--foreground)' }}>
            {t('usagePageTitle')}
          </h1>
        </div>
      </div>

      <AIUsageDashboardPageWrapper
        organizationId={organizationId}
        autoRefreshInterval={30000}
      />
    </div>
  )
}
