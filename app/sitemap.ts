import type { MetadataRoute } from 'next';
import { GUIDE_ARTICLES, getLatestGuideUpdate } from '@/lib/guides';

const DEFAULT_SITE_URL = 'https://riscala-ai.com';
const PUBLIC_LOCALES = ['ja', 'en', 'zh'] as const;
const PUBLIC_PATHS = ['', '/research', '/guide'] as const;
const PUBLIC_RESOURCE_PATHS = ['/resources', '/tools/isms-readiness-check', '/interviews/isms-operations'] as const;

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) return DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function localizedEntries(
  siteUrl: string,
  pathname: string,
  options: { priority: number; lastModified?: string; changeFrequency: 'weekly' | 'monthly' },
): MetadataRoute.Sitemap {
  const languages = {
    ...Object.fromEntries(
      PUBLIC_LOCALES.map((locale) => [locale, `${siteUrl}/${locale}${pathname}`]),
    ),
    'x-default': `${siteUrl}/ja${pathname}`,
  };

  return PUBLIC_LOCALES.map((locale) => ({
    url: `${siteUrl}/${locale}${pathname}`,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    ...(options.lastModified ? { lastModified: options.lastModified } : {}),
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const staticEntries = PUBLIC_PATHS.flatMap((pathname) =>
    localizedEntries(siteUrl, pathname, {
      priority: pathname === '' ? 1 : pathname === '/guide' ? 0.9 : 0.7,
      changeFrequency: 'weekly',
      ...(pathname === '/guide' ? { lastModified: getLatestGuideUpdate() } : {}),
    }),
  );

  const resourceEntries = PUBLIC_RESOURCE_PATHS.flatMap((pathname) =>
    localizedEntries(siteUrl, pathname, { priority: 0.7, changeFrequency: 'monthly' }),
  );

  const guideEntries = GUIDE_ARTICLES.flatMap((article) =>
    localizedEntries(siteUrl, `/guide/${article.slug}`, {
      priority: 0.8,
      changeFrequency: 'monthly',
      lastModified: article.updatedAt,
    }),
  );

  return [...staticEntries, ...resourceEntries, ...guideEntries];
}
