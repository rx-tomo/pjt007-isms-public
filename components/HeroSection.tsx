'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { PUBLIC_REPOSITORY_ISSUES_URL, PUBLIC_REPOSITORY_URL } from '@/lib/publicLinks';

const AUTO_ADVANCE_MS = 5000;

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
  },
  {
    src: '/landing/audit-workflow.png',
    titleKey: 'landing.hero.screenshots.audit.title',
    descriptionKey: 'landing.hero.screenshots.audit.description'
  },
  {
    src: '/landing/submission-bundle.png',
    titleKey: 'landing.hero.screenshots.submission.title',
    descriptionKey: 'landing.hero.screenshots.submission.description'
  }
];

export default function HeroSection() {
  const t = useTranslations();
  const locale = useLocale();
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  useEffect(() => {
    if (isUserInteracting) return;

    const timer = window.setInterval(() => {
      setActiveSceneIndex((current) => (current + 1) % productScreenshots.length);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [isUserInteracting]);

  const goToScene = (nextIndex: number) => {
    setActiveSceneIndex((nextIndex + productScreenshots.length) % productScreenshots.length);
  };

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
        <div
          className="mt-20 relative"
          onMouseEnter={() => setIsUserInteracting(true)}
          onMouseLeave={() => setIsUserInteracting(false)}
          onFocus={() => setIsUserInteracting(true)}
          onBlur={() => setIsUserInteracting(false)}
        >
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
            <div className="relative bg-surface-elevated">
              <div className="overflow-hidden" aria-live="polite">
                <div
                  className="flex transition-transform duration-700 ease-out"
                  style={{ transform: `translateX(-${activeSceneIndex * 100}%)` }}
                >
                  {productScreenshots.map((screenshot, index) => (
                    <figure key={screenshot.src} className="min-w-full bg-surface-elevated">
                      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr),340px]">
                        <div className="bg-slate-950/5 p-3 sm:p-5">
                          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                            <Image
                              src={screenshot.src}
                              alt={t(screenshot.titleKey)}
                              width={1440}
                              height={980}
                              priority={index === 0}
                              className="aspect-[16/10] w-full object-cover object-top"
                            />
                          </div>
                        </div>
                        <figcaption className="flex flex-col justify-center border-t border-border bg-surface p-6 text-left lg:border-l lg:border-t-0 lg:p-8">
                          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                            {t('landing.hero.screenshots.sceneLabel', {
                              current: index + 1,
                              total: productScreenshots.length
                            })}
                          </div>
                          <h2 className="text-2xl font-bold leading-tight text-text-primary sm:text-3xl">
                            {t(screenshot.titleKey)}
                          </h2>
                          <p className="mt-4 text-base leading-8 text-text-secondary">
                            {t(screenshot.descriptionKey)}
                          </p>
                        </figcaption>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-border bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-center gap-2">
                  {productScreenshots.map((screenshot, index) => (
                    <button
                      key={screenshot.src}
                      type="button"
                      aria-label={t('landing.hero.screenshots.goToScene', { index: index + 1 })}
                      aria-current={activeSceneIndex === index}
                      onClick={() => goToScene(index)}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        activeSceneIndex === index ? 'w-9 bg-accent' : 'w-2.5 bg-border hover:bg-text-muted'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToScene(activeSceneIndex - 1)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:border-accent hover:text-accent"
                    aria-label={t('landing.hero.screenshots.previous')}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => goToScene(activeSceneIndex + 1)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:border-accent hover:text-accent"
                    aria-label={t('landing.hero.screenshots.next')}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
