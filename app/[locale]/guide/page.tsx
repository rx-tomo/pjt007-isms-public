import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import GuideCard from '@/components/guide/GuideCard';
import JsonLd from '@/components/guide/JsonLd';
import { GUIDE_ARTICLES, GUIDE_LOCALES, isGuideLocale } from '@/lib/guides';
import { buildBreadcrumbJsonLd, buildCollectionJsonLd } from '@/lib/guides/jsonld';
import { buildLanguageAlternates, getSiteUrl, ogLocaleOf } from '@/lib/guides/site';

const GUIDE_PATH = '/guide';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guide' });
  const siteUrl = getSiteUrl();
  const canonicalPath = `/${locale}${GUIDE_PATH}`;
  const title = t('metadata.title');
  const description = t('metadata.description');

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: buildLanguageAlternates(GUIDE_LOCALES, GUIDE_PATH),
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}${canonicalPath}`,
      locale: ogLocaleOf(locale),
      siteName: 'Riscala AI for ISMS',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function GuideHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isGuideLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'guide' });
  const siteUrl = getSiteUrl();

  return (
    <div className="min-h-screen bg-app">
      <Header />
      <main className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <JsonLd data={buildCollectionJsonLd(GUIDE_ARTICLES, locale, siteUrl, t('hubTitle'), t('hubDescription'))} />
        <JsonLd data={buildBreadcrumbJsonLd([
          { name: t('breadcrumbHome'), url: `${siteUrl}/${locale}` },
          { name: t('breadcrumbGuide'), url: `${siteUrl}/${locale}${GUIDE_PATH}` },
        ])} />

        <div className="mx-auto max-w-5xl">
          <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
            <ol className="flex items-center gap-2">
              <li><Link href={`/${locale}`} className="hover:text-accent">{t('breadcrumbHome')}</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-text-secondary" aria-current="page">{t('breadcrumbGuide')}</li>
            </ol>
          </nav>

          <header className="mt-6 max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">{t('eyebrow')}</p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">{t('hubTitle')}</h1>
            <p className="mt-5 text-lg leading-8 text-text-secondary">{t('hubDescription')}</p>
          </header>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {GUIDE_ARTICLES.map((article) => (
              <GuideCard key={article.slug} article={article} locale={locale} readLabel={t('readArticle')} updatedLabel={t('updated')} />
            ))}
          </div>

          <section className="mt-16 rounded-2xl bg-gradient-to-br from-primary-50 via-surface to-secondary-50 p-8 text-center">
            <h2 className="text-2xl font-bold text-text-primary">{t('cta.title')}</h2>
            <p className="mt-3 text-text-secondary">{t('cta.description')}</p>
            <Link href={`/${locale}/research`} className="mt-6 inline-flex rounded-lg bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-primary-700">
              {t('cta.button')}
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
