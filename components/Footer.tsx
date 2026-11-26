'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { PUBLIC_PRODUCT_OVERVIEW_URL, PUBLIC_REPOSITORY_ISSUES_URL, PUBLIC_REPOSITORY_URL } from '@/lib/publicLinks';

export default function Footer() {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();
  const externalLinks = [
    { href: PUBLIC_REPOSITORY_URL, label: 'landing.footer.product.source' },
    { href: PUBLIC_PRODUCT_OVERVIEW_URL, label: 'landing.footer.product.publicOverview' },
    { href: PUBLIC_REPOSITORY_ISSUES_URL, label: 'landing.footer.company.feedback' },
  ];

  return (
    <footer className="border-t border-border bg-surface text-text-secondary">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link href="/" className="text-xl font-semibold text-text-primary">{t('common.appName')}</Link>
            <p className="mt-4 text-sm text-text-muted">{t('landing.footer.tagline')}</p>
          </div>
          <div>
            <h3 className="mb-4 font-semibold text-text-primary">{t('landing.footer.support.title')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/dev-login" className="hover:text-accent">{t('landing.hero.demoButton')}</Link></li>
              <li><Link href="/guide" className="hover:text-accent">{t('landing.footer.product.guide')}</Link></li>
              <li><Link href="/research" className="hover:text-accent">{t('landing.cta.researchButton')}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-semibold text-text-primary">{t('landing.footer.company.title')}</h3>
            <ul className="space-y-2 text-sm">
              {externalLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="hover:text-accent">{t(link.label)}</a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-6 text-text-muted">{t('landing.publicFeedbackNotice')}</p>
          </div>
        </div>
        <p className="mt-12 border-t border-border pt-8 text-sm text-text-muted">
          {t('landing.footer.copyright').replace('2025', currentYear.toString())}
        </p>
      </div>
    </footer>
  );
}
