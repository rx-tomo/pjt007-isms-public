'use client';

import { useTranslations } from 'next-intl';

export default function ProcessSection() {
  const t = useTranslations();

  const steps = [
    {
      number: '01',
      key: 'step1',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    },
    {
      number: '02',
      key: 'step2',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      number: '03',
      key: 'step3',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )
    }
  ];

  return (
    <section className="py-20 bg-surface">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            {t('landing.process.title')}
          </h2>
          <p className="text-xl text-text-secondary">
            {t('landing.process.subtitle')}
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 transform -translate-y-1/2 hidden lg:block" />

            <div className="grid lg:grid-cols-3 gap-8 relative">
              {steps.map((step, index) => (
                <div key={step.key} className="relative">
                  {/* Mobile connection line */}
                  {index < steps.length - 1 && (
                    <div className="absolute top-24 left-1/2 w-0.5 h-16 bg-gradient-to-b from-blue-400 to-blue-200 transform -translate-x-1/2 lg:hidden" />
                  )}

                  <div className="text-center">
                    {/* Step number */}
                    <div className="relative inline-flex items-center justify-center w-20 h-20 bg-surface rounded-full shadow-lg border-4 border-blue-100 mb-6 group hover:border-blue-400 transition-colors duration-300">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative text-blue-600 group-hover:text-white transition-colors duration-300">
                        {step.icon}
                      </div>
                    </div>

                    {/* Step content */}
                    <div className="bg-surface-elevated rounded-xl p-6 hover:shadow-lg transition-shadow duration-300">
                      <div className="text-sm font-semibold text-blue-600 mb-2">
                        STEP {step.number}
                      </div>
                      <h3 className="text-xl font-semibold text-text-primary mb-2">
                        {t(`landing.process.${step.key}.title`)}
                      </h3>
                      <div className="text-sm font-medium text-text-muted mb-3">
                        {t(`landing.process.${step.key}.time`)}
                      </div>
                      <p className="text-text-secondary">
                        {t(`landing.process.${step.key}.description`)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional info */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 rounded-full text-blue-700 font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>{t('support')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}