import type { GuideArticle, GuideLocale } from './types';
import { ismsCertificationCost } from './articles/isms-certification-cost';
import { iso27001CertificationProcess } from './articles/iso27001-certification-process';
import { ismsRiskAssessment } from './articles/isms-risk-assessment';
import { ismsRequiredDocuments } from './articles/isms-required-documents';
import { ismsVsPrivacyMark } from './articles/isms-vs-privacy-mark';
import { iso27001AnnexAControls } from './articles/iso27001-annex-a-controls';

export { GUIDE_LOCALES } from './types';
export type { GuideArticle, GuideBlock, GuideFaq, GuideLocale, GuideLocaleContent } from './types';

/** ハブページの表示順 = 読者の検討順（比較 → 費用 → 流れ → 実務） */
export const GUIDE_ARTICLES: readonly GuideArticle[] = [
  ismsVsPrivacyMark,
  ismsCertificationCost,
  iso27001CertificationProcess,
  ismsRiskAssessment,
  iso27001AnnexAControls,
  ismsRequiredDocuments,
];

export function getGuideSlugs(): string[] {
  return GUIDE_ARTICLES.map((article) => article.slug);
}

export function getGuideArticle(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find((article) => article.slug === slug);
}

export function getRelatedGuides(article: GuideArticle): GuideArticle[] {
  return article.related
    .map((slug) => getGuideArticle(slug))
    .filter((related): related is GuideArticle => related !== undefined);
}

export function isGuideLocale(locale: string): locale is GuideLocale {
  return locale === 'ja' || locale === 'en' || locale === 'zh';
}

/** sitemap 用: 全記事の中で最も新しい更新日 */
export function getLatestGuideUpdate(): string {
  return GUIDE_ARTICLES.reduce(
    (latest, article) => (article.updatedAt > latest ? article.updatedAt : latest),
    GUIDE_ARTICLES[0]?.updatedAt ?? '2026-01-01',
  );
}
