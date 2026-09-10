import type { GuideLocale } from './types';

export const SITE_NAME = 'Riscala AI for ISMS';
export const DEFAULT_SITE_URL = 'https://riscala-ai.com';
/** hreflang x-default に使う既定ロケール */
export const DEFAULT_GUIDE_LOCALE: GuideLocale = 'ja';

export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) return DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function ogLocaleOf(locale: string): string {
  if (locale === 'ja') return 'ja_JP';
  if (locale === 'zh') return 'zh_CN';
  return 'en_US';
}

/**
 * ロケール別 URL と x-default を含む alternates.languages を組み立てる。
 * @param pathname ロケール接頭辞なしのパス（'' はトップ）
 */
export function buildLanguageAlternates(
  locales: readonly string[],
  pathname: string,
): Record<string, string> {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, `/${locale}${pathname}`]),
  );
  languages['x-default'] = `/${DEFAULT_GUIDE_LOCALE}${pathname}`;
  return languages;
}
