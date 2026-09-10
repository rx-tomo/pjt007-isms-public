import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { buildLanguageAlternates } from '@/lib/guides/site';
import ResearchAssessment from './ResearchAssessment';

const PUBLIC_LOCALES = ['ja', 'en', 'zh'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'research' });

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
    alternates: {
      canonical: `/${locale}/research`,
      languages: buildLanguageAlternates(PUBLIC_LOCALES, '/research'),
    },
  };
}

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-app">
      <Header />
      <main>
        <ResearchAssessment />
      </main>
      <Footer />
    </div>
  );
}
