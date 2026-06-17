'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function Footer() {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface text-text-secondary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company info */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-xl">I</span>
              </div>
              <span className="text-xl font-semibold text-text-primary">{t('common.appName')}</span>
            </div>
            <p className="text-sm text-text-muted mb-4">
              {t('landing.footer.tagline')}
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">{t('landing.footer.product.title')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.product.features')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.product.pricing')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">{t('landing.footer.company.title')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.company.about')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.company.contact')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.company.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.company.terms')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support links */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">{t('landing.footer.support.title')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/help" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.support.help')}
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.support.docs')}
                </Link>
              </li>
              <li>
                <Link href="/status" className="text-sm hover:text-accent transition-colors">
                  {t('landing.footer.support.status')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-text-muted">
              {t('landing.footer.copyright').replace('2025', currentYear.toString())}
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy" className="text-sm text-text-muted hover:text-accent transition-colors">
                {t('landing.footer.privacyPolicy')}
              </Link>
              <Link href="/terms" className="text-sm text-text-muted hover:text-accent transition-colors">
                {t('landing.footer.termsOfService')}
              </Link>
              <Link href="/cookies" className="text-sm text-text-muted hover:text-accent transition-colors">
                {t('landing.footer.cookiePolicy')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
