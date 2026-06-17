'use client'

import { useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations('errors')
  const locale = useLocale()

  useEffect(() => {
    // Log the error for diagnostics (digest is safe to log)
    console.error('[ErrorBoundary]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app px-4 py-16 text-center">
      <div className="mx-auto max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface shadow-sm">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </span>
        </div>

        {/* Title and description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-text-primary">
            {t('unexpectedError.title')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('unexpectedError.description')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('unexpectedError.retry')}
          </button>
          <Link
            href={`/${locale}/home`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t('unexpectedError.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
