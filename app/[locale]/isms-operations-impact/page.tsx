import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { GUIDE_LOCALES, getGuideArticle, isGuideLocale } from '@/lib/guides';
import { buildLanguageAlternates, getSiteUrl, ogLocaleOf, SITE_NAME } from '@/lib/guides/site';
import AnnualEstimate from './AnnualEstimate';
import { effortScenarios, scenarioOrder, totalsFor } from '@/lib/isms-effort';

const path = '/isms-operations-impact';
const related = [
  'iso27001-annex-a-controls',
  'isms-statement-of-applicability',
  'isms-corrective-action-example',
];
const sources = [
  { scenario: 'evidence', url: 'https://www.ipa.go.jp/security/guide/sme/ug65p90000019cbk-att/sme_guideline_v4.0.pdf' },
  { scenario: 'risks', url: 'https://www.ipa.go.jp/security/sme/f55m8k000000587z-att/outline_guidance_risk.pdf' },
  { scenario: 'supplier', url: 'https://www.ipa.go.jp/security/economics/practices_navi/practice237.html' },
] as const;
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicSeo.impact' });
  const title = `${t('metaTitle')} | ${SITE_NAME}`;
  const description = t('metaDescription');
  return {
    metadataBase: new URL(getSiteUrl()),
    title, description,
    alternates: { canonical: `/${locale}${path}`, languages: buildLanguageAlternates(GUIDE_LOCALES, path) },
    openGraph: { title, description, siteName: SITE_NAME, type: 'website', locale: ogLocaleOf(locale), url: `${getSiteUrl()}/${locale}${path}` },
    twitter: { card: 'summary', title, description },
  };
}

export default async function ImpactPage({ params }: Props) {
  const { locale } = await params;
  if (!isGuideLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'publicSeo.impact' });
  const demoUrl = `https://riscala-ai.com/${locale}/dev-login`;
  const demoStyle = 'inline-flex items-center rounded-lg bg-accent px-5 py-3 font-semibold text-accent-foreground hover:bg-primary-700';
  return (
    <div className="min-h-screen bg-app text-text-primary">
      <Header />
      <main className="pb-20 pt-24">
        <header className="border-b border-border bg-gradient-to-br from-primary-50 via-surface to-secondary-50">
          <div className="mx-auto grid max-w-6xl gap-9 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-accent">Riscala AI for ISMS</p>
              <h1 className="mt-3 text-balance [word-break:auto-phrase] text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{t('title')}</h1>
              <p className="mt-5 leading-8 text-text-secondary">{t('intro')}</p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <a className={demoStyle} href={demoUrl}>{t('demo')}</a>
                <a className="font-semibold text-accent underline underline-offset-4" href="#workflows">{t('compare')}</a>
              </div>
            </div>
            <aside className="min-w-0 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold text-accent">{t('sampleLabel')}</p>
              <h2 className="mt-2 text-2xl font-bold">{t('sampleTitle')}</h2>
              <dl className="mt-5 divide-y divide-border">
                {(['record', 'decision', 'next'] as const).map((field) => (
                  <div key={field} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
                    <dt className="font-semibold">{t(`sample.${field}.label`)}</dt>
                    <dd className="leading-6 text-text-secondary">{t(`sample.${field}.text`)}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <section className="pt-14" aria-labelledby="role-heading">
            <h2 id="role-heading" className="text-3xl font-bold">{t('roleTitle')}</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {(['experienced', 'new', 'successor'] as const).map((role) => (
                <div key={role} className="border-t-2 border-accent pt-4">
                  <h3 className="text-lg font-semibold">{t(`roles.${role}.title`)}</h3>
                  <p className="mt-2 leading-7 text-text-secondary">{t(`roles.${role}.text`)}</p>
                </div>
              ))}
            </div>
          </section>
          <section id="workflows" className="scroll-mt-24 pt-14">
            <h2 className="text-3xl font-bold">{t('casesTitle')}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-text-secondary">{t('caseIntro')}</p>
            {scenarioOrder.map((key) => {
              const total = totalsFor(key);
              return (
                <section key={key} id={key} className="scroll-mt-20 mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-8">
                  <h3 className="text-2xl font-bold">{t(`${key}.title`)}</h3>
                  <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                    {(['before', 'after'] as const).map((side) => (
                      <div key={side}>
                        <dt className="font-semibold text-accent">{t(side)}</dt>
                        <dd className="mt-2 leading-7 text-text-secondary">{t(`${key}.${side}Text`)}</dd>
                      </div>
                    ))}
                  </dl>
                  <details className="mt-5 border-t border-border pt-4">
                    <summary className="cursor-pointer font-semibold text-accent">{t('details')}</summary>
                    <p className="mt-3 text-sm text-text-secondary">
                      {t('label')} · {total.before} → {total.after} {t('mins')} · <strong>{t('delta')} {total.before - total.after} {t('mins')}</strong>
                    </p>
                    <table className="mt-4 w-full text-left text-sm">
                      <thead><tr>{(['task', 'count', 'unitBefore', 'unitAfter'] as const).map((field) => (
                        <th scope="col" key={field} className="border-b border-border p-2">{t(field)}</th>
                      ))}</tr></thead>
                      <tbody>{effortScenarios[key].map((r) => (
                        <tr key={r.step} className="border-b border-border">
                          <th scope="row" className="p-2 font-normal">{t(`${key}.rows.${r.step}`)}</th>
                          {[r.count, r.before, r.after].map((value, i) => <td key={i} className="p-2 tabular-nums">{value}</td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  </details>
                </section>
              );
            })}
            <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-8">
              <h3 className="text-2xl font-bold">{t('supplier.title')}</h3>
              <p className="mt-4 leading-7">{t('supplier.process')}</p>
              <p className="mt-3 leading-7 text-text-secondary">{t('supplier.boundary')}</p>
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold text-accent">{t('supplier.details')}</summary>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{t('supplier.math')}</p>
              </details>
            </section>
          </section>
          <section className="mt-12">
            <h2 className="text-2xl font-bold">{t('budget')}</h2>
            <p className="mt-4 leading-8 text-text-secondary">{t('budgetText')}</p>
            <p className="mt-3 border-l-4 border-accent pl-4 font-semibold">{t('formula')}</p>
            <details id="estimate" className="mt-6">
              <summary className="cursor-pointer font-semibold text-accent">{t('annualTitle')}</summary>
              <div className="mt-4"><AnnualEstimate /></div>
            </details>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <span>{t('sources')}</span>
              {sources.map((source) => <a key={source.scenario} className="text-accent underline" href={source.url}>IPA · {t(`${source.scenario}.source`)}</a>)}
            </div>
          </section>
          <section className="my-12 rounded-2xl border border-border bg-surface-elevated p-6 sm:p-8">
            <h2 className="text-2xl font-bold">{t('tryTitle')}</h2>
            <p className="my-4 leading-7 text-text-secondary">{t('tryText')}</p>
            <a className={demoStyle} href={demoUrl}>{t('demo')}</a>
          </section>
          <nav aria-label={t('guideTitle')}>
            <h2 className="text-xl font-semibold">{t('guideTitle')}</h2>
            <ul className="mt-4 space-y-3">{related.map((slug) => (
              <li key={slug}><Link className="text-accent underline underline-offset-4" href={`/${locale}/guide/${slug}`}>{getGuideArticle(slug)?.content[locale].title}</Link></li>
            ))}</ul>
          </nav>
        </div>
      </main>
      <Footer />
    </div>
  );
}
