'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function FAQSection() {
  const t = useTranslations();
  const [openItem, setOpenItem] = useState<string | null>(null);

  const faqItems = ['q1', 'q2', 'q3', 'q4'];

  const toggleItem = (itemId: string) => {
    setOpenItem(openItem === itemId ? null : itemId);
  };

  return (
    <section id="faq" className="py-20 bg-surface">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            {t('landing.faq.title')}
          </h2>
        </div>

        {/* FAQ items */}
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {faqItems.map((itemId) => (
              <div
                key={itemId}
                className="bg-surface-elevated rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md"
              >
                <button
                  onClick={() => toggleItem(itemId)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <h3 className="text-lg font-medium text-text-primary pr-8">
                    {t(`landing.faq.items.${itemId}.question`)}
                  </h3>
                  <svg
                    className={`w-5 h-5 text-text-muted transform transition-transform duration-300 ${
                      openItem === itemId ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <div
                  className={`px-6 transition-all duration-300 ease-in-out ${
                    openItem === itemId ? 'max-h-96 pb-5' : 'max-h-0'
                  }`}
                >
                  <p className="text-text-secondary leading-relaxed">
                    {t(`landing.faq.items.${itemId}.answer`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Contact support */}
          <div className="mt-12 text-center">
            <p className="text-text-secondary mb-4">
              {t('landing.faq.stillHaveQuestions')}
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              {t('landing.faq.contactSupport')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}