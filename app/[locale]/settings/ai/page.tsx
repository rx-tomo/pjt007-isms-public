import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import AISettingsPageWrapper from '@/components/ai/AISettingsPageWrapper'

interface AISettingsPageProps {
  params: Promise<{ locale: string }>
}

/**
 * Generate metadata for the AI Settings page.
 */
export async function generateMetadata(props: AISettingsPageProps): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'ai.settings' })

  return {
    title: t('pageTitle'),
    description: t('enableAIDescription')
  }
}

/**
 * AI Settings Page
 *
 * Server Component that renders the AISettingsPageWrapper client component.
 * This page is accessible at /[locale]/settings/ai and provides:
 * - Page heading with translated title
 * - AISettingsPanel wrapped with E2E-compatible testids
 *
 * Access: org_admin role required (enforced by middleware/layout)
 */
export default async function AISettingsPage(props: AISettingsPageProps) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'ai.settings' })

  // In production, organizationId would come from the authenticated session.
  // For now, we use a placeholder that will be replaced by auth context.
  const organizationId = 'current-org'

  return (
    <div className="max-w-4xl">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 sm:text-3xl sm:truncate" style={{ color: 'var(--foreground)' }}>
            {t('pageTitle')}
          </h1>
        </div>
      </div>

      <AISettingsPageWrapper organizationId={organizationId} />
    </div>
  )
}
