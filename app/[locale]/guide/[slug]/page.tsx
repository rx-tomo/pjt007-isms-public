import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import GuideArticleView from '@/components/guide/GuideArticleView';
import { GUIDE_LOCALES, getGuideArticle, getGuideSlugs, isGuideLocale } from '@/lib/guides';
import { SITE_NAME, buildLanguageAlternates, getSiteUrl, ogLocaleOf } from '@/lib/guides/site';

interface GuidePageParams {
  params: Promise<{ locale: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_LOCALES.flatMap((locale) => getGuideSlugs().map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: GuidePageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getGuideArticle(slug);
  if (!article || !isGuideLocale(locale)) return {};

  const content = article.content[locale];
  const siteUrl = getSiteUrl();
  const pathname = `/guide/${slug}`;
  const canonicalPath = `/${locale}${pathname}`;
  const title = `${content.metaTitle} | ${SITE_NAME}`;

  return {
    title,
    description: content.description,
    keywords: content.keywords.join(', '),
    alternates: {
      canonical: canonicalPath,
      languages: buildLanguageAlternates(GUIDE_LOCALES, pathname),
    },
    openGraph: {
      title,
      description: content.description,
      type: 'article',
      url: `${siteUrl}${canonicalPath}`,
      locale: ogLocaleOf(locale),
      siteName: SITE_NAME,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
    twitter: { card: 'summary_large_image', title, description: content.description },
  };
}

export default async function GuideArticlePage({ params }: GuidePageParams) {
  const { locale, slug } = await params;
  const article = getGuideArticle(slug);
  if (!article || !isGuideLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-app">
      <Header />
      <main>
        <GuideArticleView article={article} locale={locale} />
      </main>
      <Footer />
    </div>
  );
}
