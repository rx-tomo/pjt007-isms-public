'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

export default function PricingSection() {
  const t = useTranslations();
  const locale = useLocale();
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  const plans = [
    { id: 'trial', recommended: false },
    { id: 'starter', recommended: false },
    { id: 'standard', recommended: true },
    { id: 'enterprise', recommended: false },
  ];

  const getFeatures = (planId: string): string[] => {
    // 一時的に固定値を返す（後で翻訳ファイルの構造を修正）
    const featureMap: { [key: string]: string[] } = {
      trial: [
        '全機能利用可能',
        '最大5ユーザー',
        'メールサポート',
        'クレジットカード不要'
      ],
      starter: [
        '10ユーザーまで',
        '文書管理・リスク評価',
        'タスク管理',
        'メールサポート',
        '月次レポート'
      ],
      standard: [
        '50ユーザーまで',
        '全機能利用可能',
        '優先サポート',
        'カスタマイズ対応',
        'API連携'
      ],
      enterprise: [
        '無制限ユーザー',
        '専任サポート',
        'SLA保証',
        'オンプレミス対応可',
        'カスタム開発'
      ]
    };
    return featureMap[planId] || [];
  };

  return (
    <section id="pricing" className="py-20 bg-app">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {t('landing.pricing.subtitle')}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isPopular = plan.id === 'standard';

            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`relative bg-surface rounded-2xl transition-all duration-300 ${
                  hoveredPlan === plan.id ? 'transform -translate-y-2 shadow-2xl' : 'shadow-sm'
                } ${isPopular ? 'ring-2 ring-primary-600' : ''}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                      {t('landing.pricing.popular')}
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan name */}
                  <h3 className="text-xl font-semibold text-text-primary mb-4">
                    {t(`landing.pricing.${plan.id}.name`)}
                  </h3>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-text-primary">
                      {t(`landing.pricing.${plan.id}.price`)}
                    </span>
                    <span className="text-text-secondary ml-2">
                      {t(`landing.pricing.${plan.id}.duration`)}
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {getFeatures(plan.id).map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-text-secondary">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  <Link
                    href={plan.id === 'enterprise' ? `/${locale}/contact` : `/${locale}/auth/signup`}
                    className={`block w-full text-center py-3 px-6 rounded-lg font-medium transition-all duration-300 ${
                      isPopular
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-surface-elevated text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {t(`landing.pricing.${plan.id}.cta`)}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional info */}
        <div className="mt-16 text-center">
          <p className="text-text-secondary mb-4">
            {t('landing.pricing.allPlansInclude')}
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <span className="text-sm text-text-secondary">{t('landing.pricing.cancelAnytime')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">{t('landing.pricing.securePayment')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">{t('landing.pricing.moneyBack')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}