import { setRequestLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function VerifyEmailPage(
  props: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ email?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)
  const t = await getTranslations('auth.verifyEmail')

  return (
    <div className="min-h-screen flex items-center justify-center bg-app py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>

          <h2 className="mt-6 text-3xl font-extrabold text-text-primary">
            {t('title')}
          </h2>

          <p className="mt-2 text-sm text-text-secondary">
            {t('description')}
          </p>

          {searchParams.email && (
            <p className="mt-2 text-sm font-medium text-text-primary">
              {searchParams.email}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <p className="text-sm text-text-muted">
              {t('checkSpam')}
            </p>

            <p className="text-sm text-text-muted">
              {t('didNotReceive')}
            </p>

            <Link
              href={`/${locale}/auth/login`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}