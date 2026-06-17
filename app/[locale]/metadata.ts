import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });

  const title = 'ISMS Manager - ' + t('hero.title');
  const description = t('hero.subtitle');

  return {
    title,
    description,
    keywords: locale === 'ja'
      ? 'ISO27001, ISMS, 情報セキュリティ, 認証取得, クラウドサービス, リスク管理, 文書管理'
      : 'ISO27001, ISMS, Information Security, Certification, Cloud Service, Risk Management, Document Management',
    authors: [{ name: 'ISMS Manager Team' }],
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      siteName: 'ISMS Manager',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: `https://isms-manager.com/${locale}`,
      languages: {
        'ja': '/ja',
        'en': '/en',
      },
    },
  };
}
