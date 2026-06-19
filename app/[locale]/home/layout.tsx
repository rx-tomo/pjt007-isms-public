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

  const t = await getTranslations({ locale, namespace: 'common' })

  return {
    title: `${t('home')} - ${t('appName')}`,
    description: 'Riscala AI for ISMS Home overview'
  }
}

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
