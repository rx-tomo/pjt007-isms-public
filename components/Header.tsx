'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { PUBLIC_REPOSITORY_ISSUES_URL, PUBLIC_REPOSITORY_URL } from '@/lib/publicLinks';

export default function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { key: 'features', href: '#features' },
    { key: 'pricing', href: `/${locale}/pricing` },
    { key: 'faq', href: '#faq' }
  ];

  return (
    <header className="fixed top-0 w-full border-b border-border bg-surface/95 backdrop-blur-sm shadow-sm z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-text-primary">{t('common.appName')}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="text-text-secondary hover:text-accent transition-colors duration-200"
              >
                {t(`nav.${item.key}`)}
              </a>
            ))}
            <a
              href={PUBLIC_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary hover:text-accent transition-colors duration-200"
            >
              {t('common.publicLinks.source')}
            </a>
            <a
              href={PUBLIC_REPOSITORY_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary hover:text-accent transition-colors duration-200"
            >
              {t('common.publicLinks.feedback')}
            </a>
          </nav>

          {/* Right side items */}
          <div className="flex items-center gap-4">
            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href={`/${locale}/auth/login`}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-accent transition-colors duration-200"
              >
                {t('common.login.title')}
              </Link>
              <Link
                href={`/${locale}/dev-login`}
                className="px-4 py-2 text-sm font-medium text-accent-foreground bg-accent rounded-lg hover:bg-primary-700 transition-colors duration-200"
              >
                {t('common.devLogin')}
              </Link>
            </div>

            <LanguageSwitcher />

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-surface-elevated transition-colors duration-200"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              {navItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-text-secondary hover:text-accent transition-colors duration-200 py-2"
                >
                  {t(`nav.${item.key}`)}
                </a>
              ))}
              <a
                href={PUBLIC_REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-text-secondary hover:text-accent transition-colors duration-200 py-2"
              >
                {t('common.publicLinks.source')}
              </a>
              <a
                href={PUBLIC_REPOSITORY_ISSUES_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-text-secondary hover:text-accent transition-colors duration-200 py-2"
              >
                {t('common.publicLinks.feedback')}
              </a>
              {/* Auth links for mobile */}
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Link
                  href={`/${locale}/auth/login`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-text-secondary hover:text-accent transition-colors duration-200 py-2"
                >
                  {t('common.login.title')}
                </Link>
                <Link
                  href={`/${locale}/dev-login`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full px-4 py-2 text-sm font-medium text-accent-foreground bg-accent rounded-lg hover:bg-primary-700 transition-colors duration-200 text-center"
                >
                  {t('common.devLogin')}
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
