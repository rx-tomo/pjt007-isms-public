import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function NotFound() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'errors' })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app px-4 py-16 text-center">
      <div className="mx-auto max-w-md space-y-6">
        {/* Status code */}
        <p className="text-7xl font-bold tracking-tight text-text-muted">404</p>

        {/* Title and description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-text-primary">
            {t('notFound.title')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('notFound.description')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/${locale}/home`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {t('notFound.backHome')}
          </Link>
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t('notFound.backTop')}
          </Link>
        </div>
      </div>
    </div>
  )
}
