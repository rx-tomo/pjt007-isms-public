import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const locales = ['ja', 'en', 'zh'] as const;
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicSeo.resources' });
  const path = `/${locale}/resources`;
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: { canonical: path, languages: Object.fromEntries(locales.map((item) => [item, `/${item}/resources`])) } };
}
export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'publicSeo.resources' });
  return <main className="min-h-screen bg-app px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><p className="text-sm font-semibold text-accent">Riscala AI for ISMS</p><h1 className="mt-3 text-4xl font-bold text-text-primary sm:text-5xl">{t('title')}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-text-secondary">{t('description')}</p><div className="mt-10 grid gap-6 md:grid-cols-2"><Link href={`/${locale}/tools/isms-readiness-check`} className="rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:border-accent"><h2 className="text-2xl font-semibold text-text-primary">{t('toolTitle')}</h2><p className="mt-3 leading-7 text-text-secondary">{t('toolDescription')}</p><span className="mt-5 inline-block font-semibold text-accent">{t('openTool')}</span></Link><Link href={`/${locale}/interviews/isms-operations`} className="rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:border-accent"><h2 className="text-2xl font-semibold text-text-primary">{t('interviewTitle')}</h2><p className="mt-3 leading-7 text-text-secondary">{t('interviewDescription')}</p><span className="mt-5 inline-block font-semibold text-accent">{t('openInterview')}</span></Link></div><nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium text-accent" aria-label={t('navigationLabel')}><Link href={`/${locale}`}>{t('homeLink')}</Link><Link href={`/${locale}/auth/login`}>{t('loginLink')}</Link></nav></div></main>;
}
