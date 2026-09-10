import { stripInline } from './inline';
import { SITE_NAME } from './site';
import type { GuideArticle, GuideLocale } from './types';

interface BreadcrumbItem {
  name: string;
  url: string;
}

function inLanguageOf(locale: GuideLocale): string {
  if (locale === 'ja') return 'ja-JP';
  if (locale === 'zh') return 'zh-CN';
  return 'en-US';
}

function organization(siteUrl: string) {
  return { '@type': 'Organization', name: SITE_NAME, url: siteUrl };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildArticleJsonLd(article: GuideArticle, locale: GuideLocale, siteUrl: string) {
  const content = article.content[locale];
  const url = `${siteUrl}/${locale}/guide/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.description,
    inLanguage: inLanguageOf(locale),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: organization(siteUrl),
    publisher: organization(siteUrl),
    keywords: content.keywords.join(', '),
  };
}

export function buildFaqJsonLd(article: GuideArticle, locale: GuideLocale) {
  const content = article.content[locale];
  if (content.faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: stripInline(item.answer) },
    })),
  };
}

export function buildCollectionJsonLd(
  articles: readonly GuideArticle[],
  locale: GuideLocale,
  siteUrl: string,
  name: string,
  description: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    inLanguage: inLanguageOf(locale),
    url: `${siteUrl}/${locale}/guide`,
    publisher: organization(siteUrl),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: article.content[locale].title,
        url: `${siteUrl}/${locale}/guide/${article.slug}`,
      })),
    },
  };
}
