/**
 * 公開 SEO ガイド記事の型定義。
 * 本文は構造化ブロックで持ち、描画・目次・JSON-LD をここから生成する。
 */

export const GUIDE_LOCALES = ['ja', 'en', 'zh'] as const;
export type GuideLocale = (typeof GUIDE_LOCALES)[number];

export type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; id: string; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; title?: string; text: string };

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideLocaleContent {
  /** H1 */
  title: string;
  /** <title> 用。サイト名サフィックスは描画側で付ける。全角30字/半角60字以内 */
  metaTitle: string;
  /** meta description。全角80〜110字 / 半角120〜155字 */
  description: string;
  /** 導入段落（結論ファースト） */
  lead: string;
  blocks: GuideBlock[];
  faq: GuideFaq[];
  keywords: string[];
}

export interface GuideArticle {
  slug: string;
  /** ISO 8601 日付 (YYYY-MM-DD) */
  publishedAt: string;
  updatedAt: string;
  /** 関連記事 slug（内部リンク） */
  related: string[];
  content: Record<GuideLocale, GuideLocaleContent>;
}
