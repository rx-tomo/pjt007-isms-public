'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

export default function HowItWorksSection() {
  const t = useTranslations();
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const steps = ['setup', 'build', 'maintain'];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Auto-advance through steps
            const interval = setInterval(() => {
              setActiveStep((prev) => (prev + 1) % steps.length);
            }, 3000);
            return () => clearInterval(interval);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [steps.length]);

  const getStepIcon = (stepId: string) => {
    const icons = {
      setup: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      build: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      maintain: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    };
    return icons[stepId as keyof typeof icons];
  };

  return (
    <section ref={sectionRef} className="py-20 bg-surface">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            {t('landing.howItWorks.title')}
          </h2>
        </div>

        {/* Steps container */}
        <div className="max-w-5xl mx-auto">
          {/* Progress bar */}
          <div className="relative mb-16">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-surface-elevated -translate-y-1/2"></div>
            <div
              className="absolute top-1/2 left-0 h-1 bg-primary-600 -translate-y-1/2 transition-all duration-1000"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            ></div>

            {/* Step indicators */}
            <div className="relative flex justify-between">
              {steps.map((step, index) => (
                <button
                  key={step}
                  onClick={() => setActiveStep(index)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-500 ${
                    index <= activeStep
                      ? 'bg-primary-600 text-white scale-110'
                      : 'bg-surface-elevated text-text-muted'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Visual side */}
            <div className={`relative transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
            }`}>
              <div className="relative w-full h-96 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl overflow-hidden">
                {/* Animated background circles */}
                <div className="absolute inset-0">
                  <div className="absolute top-10 left-10 w-32 h-32 bg-primary-200 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                  <div className="absolute bottom-10 right-10 w-40 h-40 bg-secondary-200 rounded-full blur-2xl opacity-50 animate-pulse delay-700"></div>
                </div>

                {/* Step icon display */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-32 h-32 bg-surface rounded-2xl shadow-xl flex items-center justify-center transform transition-all duration-500 ${
                    isVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
                  }`}>
                    <div className="text-primary-600">
                      {getStepIcon(steps[activeStep])}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content side */}
            <div className={`transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
            }`}>
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`transition-all duration-500 ${
                    index === activeStep
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-10 absolute'
                  }`}
                >
                  {index === activeStep && (
                    <>
                      <div className="flex items-center gap-4 mb-6">
                        <span className="text-5xl font-bold text-primary-600">
                          {t(`landing.howItWorks.steps.${step}.number`)}
                        </span>
                        <h3 className="text-2xl font-bold text-text-primary">
                          {t(`landing.howItWorks.steps.${step}.title`)}
                        </h3>
                      </div>
                      <p className="text-lg text-text-secondary leading-relaxed">
                        {t(`landing.howItWorks.steps.${step}.description`)}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}