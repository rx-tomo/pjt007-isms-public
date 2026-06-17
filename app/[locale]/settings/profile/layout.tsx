import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'settings' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  return {
    title: `${t('profile.title')} - ${tCommon('appName')}`,
    description: t('profile.description')
  }
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}