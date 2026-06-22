'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CTASection() {
  const t = useTranslations();
  const locale = useLocale();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="py-20 bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Background decoration */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-72 h-72 bg-primary-400 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-72 h-72 bg-primary-300 rounded-full blur-3xl opacity-20 animate-pulse delay-1000"></div>
          </div>

          {/* Content */}
          <div className="relative z-10">
            <h2
              className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 transition-all duration-1000 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {t('landing.cta.title')}
            </h2>

            <p
              className={`text-xl text-primary-100 mb-10 transition-all duration-1000 delay-200 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {t('landing.cta.subtitle')}
            </p>

            {/* CTA Button */}
            <div
              className={`transition-all duration-1000 delay-400 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <Link
                href={`/${locale}/dev-login`}
                className="group inline-flex items-center gap-3 bg-surface text-accent px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                {t('common.devLogin')}
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <p className="mt-4 text-primary-100 text-sm">
                {t('landing.cta.noCredit')}
              </p>
            </div>

            {/* Trust indicators */}
            <div
              className={`mt-12 flex flex-wrap justify-center items-center gap-8 transition-all duration-1000 delay-600 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <div className="flex items-center gap-2 text-primary-100">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{t('landing.cta.noSetupFee')}</span>
              </div>
              <div className="flex items-center gap-2 text-primary-100">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{t('landing.cta.cancelAnytime')}</span>
              </div>
              <div className="flex items-center gap-2 text-primary-100">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{t('landing.cta.support247')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
