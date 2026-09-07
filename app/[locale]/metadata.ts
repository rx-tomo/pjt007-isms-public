import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const DEFAULT_SITE_URL = 'https://riscala-ai.com';
const SUPPORTED_LOCALES = ['ja', 'en', 'zh'] as const;

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) return DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });

  const title = 'Riscala AI for ISMS - ' + t('hero.title');
  const description = t('hero.subtitle');
  const siteUrl = getSiteUrl();
  const canonicalPath = `/${locale}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords: locale === 'ja'
      ? 'ISO27001, ISMS, 情報セキュリティ, 認証取得, クラウドサービス, リスク管理, 文書管理'
      : locale === 'zh'
        ? 'ISO27001, ISMS, 信息安全, 认证, 云服务, 风险管理, 文档管理'
        : 'ISO27001, ISMS, Information Security, Certification, Cloud Service, Risk Management, Document Management',
    authors: [{ name: 'Riscala AI for ISMS Team' }],
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      locale: locale === 'ja' ? 'ja_JP' : locale === 'zh' ? 'zh_CN' : 'en_US',
      siteName: 'Riscala AI for ISMS',
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
      canonical: canonicalPath,
      languages: Object.fromEntries(SUPPORTED_LOCALES.map((supportedLocale) => [
        supportedLocale,
        `/${supportedLocale}`,
      ])),
    },
  };
}
