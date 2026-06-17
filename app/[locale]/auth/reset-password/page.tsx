import { Suspense } from 'react'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import ResetPasswordForm from './ResetPasswordForm'

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'auth' })

  return {
    title: t('resetPassword.title'),
    description: t('resetPassword.description'),
  }
}

export default async function ResetPasswordPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)

  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 sm:px-6 lg:px-8">
      <Suspense>
        <ResetPasswordForm locale={locale} />
      </Suspense>
    </div>
  )
}
