import Link from 'next/link';
import type { GuideArticle, GuideLocale } from '@/lib/guides/types';

interface GuideCardProps {
  article: GuideArticle;
  locale: GuideLocale;
  readLabel: string;
  updatedLabel: string;
}

export default function GuideCard({ article, locale, readLabel, updatedLabel }: GuideCardProps) {
  const content = article.content[locale];
  const href = `/${locale}/guide/${article.slug}`;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="text-lg font-semibold leading-7 text-text-primary">
        <Link href={href} className="hover:text-accent">{content.title}</Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-text-secondary">{content.description}</p>
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-text-muted">
          {updatedLabel}: <time dateTime={article.updatedAt}>{article.updatedAt}</time>
        </span>
        <Link href={href} className="font-medium text-accent hover:text-primary-700">
          {readLabel} →
        </Link>
      </div>
    </article>
  );
}
