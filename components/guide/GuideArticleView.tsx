import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import GuideBlocks from '@/components/guide/GuideBlocks';
import GuideCard from '@/components/guide/GuideCard';
import JsonLd from '@/components/guide/JsonLd';
import { getRelatedGuides } from '@/lib/guides';
import { renderInline } from '@/lib/guides/inline';
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/guides/jsonld';
import { getSiteUrl } from '@/lib/guides/site';
import type { GuideArticle, GuideFaq, GuideLocale } from '@/lib/guides/types';

interface GuideArticleViewProps {
  article: GuideArticle;
  locale: GuideLocale;
}

function Breadcrumb({ locale, home, guide, current }: { locale: string; home: string; guide: string; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        <li><Link href={`/${locale}`} className="hover:text-accent">{home}</Link></li>
        <li aria-hidden="true">/</li>
        <li><Link href={`/${locale}/guide`} className="hover:text-accent">{guide}</Link></li>
        <li aria-hidden="true">/</li>
        <li className="text-text-secondary" aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}

function TableOfContents({ article, locale, label }: { article: GuideArticle; locale: GuideLocale; label: string }) {
  const headings = article.content[locale].blocks.filter((block) => block.type === 'h2');
  if (headings.length === 0) return null;
  return (
    <nav aria-label={label} className="my-10 rounded-2xl border border-border bg-surface-elevated p-6">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">{label}</p>
      <ol className="list-decimal space-y-2 pl-6 text-text-secondary">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`} className="hover:text-accent">{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function FaqSection({ faq, locale, label }: { faq: readonly GuideFaq[]; locale: string; label: string }) {
  if (faq.length === 0) return null;
  return (
    <section aria-labelledby="guide-faq" className="mt-14">
      <h2 id="guide-faq" className="border-l-4 border-accent pl-4 text-2xl font-bold text-text-primary sm:text-3xl">{label}</h2>
      <dl className="mt-6 space-y-4">
        {faq.map((item, index) => (
          <div key={index} className="rounded-xl border border-border bg-surface-elevated p-5">
            <dt className="font-semibold text-text-primary">{item.question}</dt>
            <dd className="mt-2 leading-7 text-text-secondary">{renderInline(item.answer, locale)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ResearchCta({ locale, title, description, button }: { locale: string; title: string; description: string; button: string }) {
  return (
    <section className="mt-14 rounded-2xl bg-gradient-to-br from-primary-50 via-surface to-secondary-50 p-8 text-center">
      <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
      <p className="mt-3 text-text-secondary">{description}</p>
      <Link href={`/${locale}/research`} className="mt-6 inline-flex rounded-lg bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-primary-700">
        {button}
      </Link>
    </section>
  );
}

export default async function GuideArticleView({ article, locale }: GuideArticleViewProps) {
  const t = await getTranslations({ locale, namespace: 'guide' });
  const content = article.content[locale];
  const siteUrl = getSiteUrl();
  const related = getRelatedGuides(article);
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: t('breadcrumbHome'), url: `${siteUrl}/${locale}` },
    { name: t('breadcrumbGuide'), url: `${siteUrl}/${locale}/guide` },
    { name: content.title, url: `${siteUrl}/${locale}/guide/${article.slug}` },
  ]);

  return (
    <article className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <JsonLd data={buildArticleJsonLd(article, locale, siteUrl)} />
      <JsonLd data={buildFaqJsonLd(article, locale)} />
      <JsonLd data={breadcrumb} />

      <div className="mx-auto max-w-3xl">
        <Breadcrumb locale={locale} home={t('breadcrumbHome')} guide={t('breadcrumbGuide')} current={content.title} />

        <header className="mt-6">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">{t('eyebrow')}</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">{content.title}</h1>
          <p className="mt-5 text-lg leading-8 text-text-secondary">{renderInline(content.lead, locale)}</p>
          <p className="mt-4 text-sm text-text-muted">
            {t('published')}: <time dateTime={article.publishedAt}>{article.publishedAt}</time>
            <span className="mx-2" aria-hidden="true">·</span>
            {t('updated')}: <time dateTime={article.updatedAt}>{article.updatedAt}</time>
          </p>
        </header>

        <TableOfContents article={article} locale={locale} label={t('toc')} />

        <GuideBlocks blocks={content.blocks} locale={locale} />

        <FaqSection faq={content.faq} locale={locale} label={t('faq')} />

        <ResearchCta locale={locale} title={t('cta.title')} description={t('cta.description')} button={t('cta.button')} />

        <p className="mt-10 text-xs leading-6 text-text-muted">{t('disclaimer')}</p>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="guide-related" className="mx-auto mt-16 max-w-5xl">
          <h2 id="guide-related" className="text-2xl font-bold text-text-primary">{t('related')}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {related.map((item) => (
              <GuideCard key={item.slug} article={item} locale={locale} readLabel={t('readArticle')} updatedLabel={t('updated')} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
