import type { MetadataRoute } from 'next';

const DEFAULT_SITE_URL = 'https://riscala-ai.com';

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) return DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
