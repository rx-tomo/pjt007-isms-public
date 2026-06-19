import { setRequestLocale, getTranslations } from 'next-intl/server'
import AuthForm from '@/components/auth/AuthForm'
import type { Metadata } from 'next'

function isPublicDemoMode() {
  return process.env.DEMO_PUBLIC_LOGIN_ENABLED === 'true' && process.env.DEMO_RESET_ENABLED === 'true'
}

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({locale, namespace: 'auth'});

  return {
    title: t('signup.title'),
    description: t('signup.description')
  };
}

export default async function SignupPage(
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
    <div className="min-h-screen flex items-center justify-center bg-app py-12 px-4 sm:px-6 lg:px-8">
      <AuthForm mode="signup" locale={locale} publicDemoMode={isPublicDemoMode()} />
    </div>
  )
}
