import type { MetadataRoute } from 'next';

const DEFAULT_SITE_URL = 'https://riscala-ai.com';
const PUBLIC_LOCALES = ['ja', 'en', 'zh'] as const;
const PUBLIC_RESOURCE_PATHS = ['resources', 'tools/isms-readiness-check', 'interviews/isms-operations'] as const;

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) return DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const languages = Object.fromEntries(
    PUBLIC_LOCALES.map((locale) => [locale, `${siteUrl}/${locale}`]),
  );

  return PUBLIC_LOCALES.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    changeFrequency: 'weekly' as MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: 1,
    alternates: { languages },
  })).concat(PUBLIC_RESOURCE_PATHS.flatMap((resourcePath) => PUBLIC_LOCALES.map((locale) => ({
      url: `${siteUrl}/${locale}/${resourcePath}`,
      changeFrequency: 'monthly' as MetadataRoute.Sitemap[number]['changeFrequency'],
      priority: 0.7,
      alternates: { languages: Object.fromEntries(PUBLIC_LOCALES.map((alternateLocale) => [alternateLocale, `${siteUrl}/${alternateLocale}/${resourcePath}`])) },
    }))));
}
