'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { PUBLIC_REPOSITORY_ISSUES_URL, PUBLIC_REPOSITORY_URL } from '@/lib/publicLinks';

const productScreenshots = [
  {
    src: '/landing/dashboard-home.png',
    titleKey: 'landing.hero.screenshots.dashboard.title',
    descriptionKey: 'landing.hero.screenshots.dashboard.description'
  },
  {
    src: '/landing/risk-register.png',
    titleKey: 'landing.hero.screenshots.risks.title',
    descriptionKey: 'landing.hero.screenshots.risks.description'
  },
  {
    src: '/landing/documents-workflow.png',
    titleKey: 'landing.hero.screenshots.documents.title',
    descriptionKey: 'landing.hero.screenshots.documents.description'
  }
];

export default function HeroSection() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-surface to-secondary-50 pt-32 pb-20">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-primary-100 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-secondary-200 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-1.5 mb-8 text-sm font-medium text-accent bg-primary-50 rounded-full border border-border">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {t('landing.hero.badge')}
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-text-primary mb-6">
            {t('landing.hero.title')}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-secondary-400">
              {t('landing.hero.titleHighlight')}
            </span>
          </h1>

          {/* Description */}
          <p className="text-xl sm:text-2xl text-text-secondary mb-10 leading-relaxed">
            {t('landing.hero.description')}
          </p>
          <p className="mx-auto -mt-4 mb-10 max-w-3xl text-base sm:text-lg leading-8 text-text-secondary">
            {t('landing.hero.publicNote')}
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/dev-login`}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-accent-foreground bg-accent rounded-lg hover:bg-primary-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              {t('common.devLogin')}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href={PUBLIC_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-text-secondary bg-surface border-2 border-border rounded-lg hover:text-accent hover:border-accent transition-colors duration-200"
            >
              {t('common.publicLinks.source')}
            </a>
            <a
              href={PUBLIC_REPOSITORY_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-text-secondary bg-surface border-2 border-border rounded-lg hover:text-accent hover:border-accent transition-colors duration-200"
            >
              {t('common.publicLinks.feedback')}
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('landing.hero.trustIndicators.secureEnvironment')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span>{t('landing.hero.trustIndicators.companiesDeployed')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{t('landing.hero.trustIndicators.customerSatisfaction')}</span>
            </div>
          </div>
        </div>

        {/* Product preview */}
        <div className="mt-20 relative">
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
            <div className="bg-surface-elevated px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 text-center text-sm text-text-muted">
                Riscala AI for ISMS Dashboard
              </div>
            </div>
            <div className="grid gap-4 bg-surface-elevated p-4 lg:grid-cols-[1.45fr,1fr]">
              <figure className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                <Image
                  src={productScreenshots[0].src}
                  alt={t(productScreenshots[0].titleKey)}
                  width={1440}
                  height={980}
                  className="aspect-[16/10] w-full object-cover object-top"
                />
                <figcaption className="border-t border-border p-4 text-left">
                  <h2 className="text-base font-semibold text-text-primary">{t(productScreenshots[0].titleKey)}</h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{t(productScreenshots[0].descriptionKey)}</p>
                </figcaption>
              </figure>

              <div className="grid gap-4">
                {productScreenshots.slice(1).map((screenshot) => (
                  <figure key={screenshot.src} className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-sm sm:grid-cols-[1.1fr,0.9fr] lg:grid-cols-1">
                    <Image
                      src={screenshot.src}
                      alt={t(screenshot.titleKey)}
                      width={1440}
                      height={980}
                      className="aspect-[16/9] h-full w-full object-cover object-top"
                    />
                    <figcaption className="border-t border-border p-4 text-left sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t">
                      <h2 className="text-sm font-semibold text-text-primary">{t(screenshot.titleKey)}</h2>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">{t(screenshot.descriptionKey)}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-left sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface/85 p-4 shadow-sm">
              <div className="text-sm font-semibold text-text-primary">{t('landing.hero.previewNotes.operations.title')}</div>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{t('landing.hero.previewNotes.operations.body')}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface/85 p-4 shadow-sm">
              <div className="text-sm font-semibold text-text-primary">{t('landing.hero.previewNotes.outputs.title')}</div>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{t('landing.hero.previewNotes.outputs.body')}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface/85 p-4 shadow-sm">
              <div className="text-sm font-semibold text-text-primary">{t('landing.hero.previewNotes.public.title')}</div>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{t('landing.hero.previewNotes.public.body')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
