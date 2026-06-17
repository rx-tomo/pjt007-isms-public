/**
 * Fallback Handler
 *
 * Provides graceful degradation when AI provider is unavailable.
 * Uses a fallback chain: cache -> similar_cache -> pattern_matching -> default
 *
 * @module lib/ai/fallback/FallbackHandler
 */

import type { ICacheManager } from '../cache/CacheManager'
import type { IsmsKnowledgeBase } from '../knowledgeBase/IsmsKnowledgeBase'
import type { ThreatPatternLibrary } from '../knowledgeBase/ThreatPatterns'
import type { AssetContext } from '../prompts/riskIdentification'
import type { RiskContext } from '../prompts/riskAssessment'
import type {
  ThreatVulnerabilitySuggestion,
  RiskLevelEstimate,
  TreatmentSuggestion,
  ServiceContext
} from '../../services/aiRiskAssessment'
import { CacheSimilarityMatcher, type ICacheSimilarityMatcher } from './CacheSimilarityMatcher'

/**
 * Fallback levels in order of preference
 */
export type FallbackLevel = 'cache' | 'similar_cache' | 'pattern_matching' | 'default'

/**
 * Result from fallback operations
 */
export interface FallbackResult<T> {
  /** The result data */
  data: T
  /** The fallback level used to generate this result */
  level: FallbackLevel
  /** Confidence score between 0.0 and 1.0 */
  confidence: number
  /** User-visible warning message (localized) */
  warning?: string
}

/**
 * Interface for the fallback handler
 */
export interface IFallbackHandler {
  /**
   * Suggest threats and vulnerabilities with fallback support
   */
  suggestThreatsWithFallback(
    asset: AssetContext,
    context: ServiceContext
  ): Promise<FallbackResult<ThreatVulnerabilitySuggestion>>

  /**
   * Estimate risk levels with fallback support
   */
  estimateRiskWithFallback(
    risk: RiskContext,
    context: ServiceContext
  ): Promise<FallbackResult<RiskLevelEstimate>>

  /**
   * Suggest treatments with fallback support
   */
  suggestTreatmentsWithFallback(
    risk: RiskContext,
    context: ServiceContext
  ): Promise<FallbackResult<TreatmentSuggestion>>
}

/**
 * Warning messages by locale
 */
const WARNING_MESSAGES = {
  similar_cache: {
    ja: 'AI が利用できないため、類似の過去データからの推定結果を表示しています。',
    en: 'AI is unavailable. Showing estimate based on similar cached data.'
  },
  pattern_matching: {
    ja: 'AI が利用できないため、パターンマッチングによる推定結果を表示しています。',
    en: 'AI is unavailable. Showing estimate based on pattern matching.'
  },
  default: {
    ja: 'AI が利用できないため、デフォルトの保守的な推定を表示しています。確認をお勧めします。',
    en: 'AI is unavailable. Showing conservative default estimate. Review recommended.'
  }
}

/**
 * Default rationale messages by locale
 */
const DEFAULT_RATIONALE = {
  ja: 'AI が利用できないため、保守的な推定値を使用しています。詳細な分析にはAIによる評価をお勧めします。',
  en: 'AI unavailable. Using conservative estimates. AI-assisted analysis recommended for detailed assessment.'
}

/**
 * Pattern matching rationale messages by locale
 */
const PATTERN_RATIONALE = {
  ja: '脅威パターンライブラリとISMSナレッジベースに基づく推定値です。',
  en: 'Estimate based on threat pattern library and ISMS knowledge base.'
}

/**
 * Confidence scores for each fallback level
 */
const CONFIDENCE_SCORES = {
  cache: 1.0,
  similar_cache_base: 0.8,  // Adjusted by actual similarity
  pattern_matching_high: 0.7,
  pattern_matching_low: 0.5,
  default: 0.2
}

/**
 * Fallback Handler Implementation
 *
 * Implements graceful degradation with the following fallback chain:
 * 1. Check exact cache match
 * 2. Check similar cache entries (using similarity matcher)
 * 3. Use pattern matching from threat library + knowledge base
 * 4. Return default conservative estimate with warning
 */
export class FallbackHandler implements IFallbackHandler {
  private readonly similarityMatcher: ICacheSimilarityMatcher

  constructor(
    private readonly knowledgeBase: IsmsKnowledgeBase,
    private readonly threatLibrary: ThreatPatternLibrary,
    private readonly cacheManager: ICacheManager
  ) {
    this.similarityMatcher = new CacheSimilarityMatcher(cacheManager)
  }

  /**
   * Suggest threats and vulnerabilities with fallback support
   */
  async suggestThreatsWithFallback(
    asset: AssetContext,
    context: ServiceContext
  ): Promise<FallbackResult<ThreatVulnerabilitySuggestion>> {
    // 1. Check exact cache match
    const cacheKey = this.buildThreatCacheKey(asset, context)
    const cached = this.cacheManager.get<ThreatVulnerabilitySuggestion>(cacheKey)

    if (cached) {
      return {
        data: cached,
        level: 'cache',
        confidence: CONFIDENCE_SCORES.cache
      }
    }

    // 2. Check similar cache entries
    const similarMatch = this.similarityMatcher.findSimilarEntry<ThreatVulnerabilitySuggestion>(
      asset,
      `threats:${context.organizationId}`
    )

    if (similarMatch) {
      return {
        data: similarMatch.data,
        level: 'similar_cache',
        confidence: CONFIDENCE_SCORES.similar_cache_base * similarMatch.similarity,
        warning: WARNING_MESSAGES.similar_cache[context.locale]
      }
    }

    // 3. Use pattern matching
    const patternResult = this.suggestThreatsFromPatterns(asset, context.locale)

    if (patternResult.threats.length > 0 || patternResult.vulnerabilities.length > 0) {
      const confidence = patternResult.threats.length >= 3
        ? CONFIDENCE_SCORES.pattern_matching_high
        : CONFIDENCE_SCORES.pattern_matching_low

      return {
        data: patternResult,
        level: 'pattern_matching',
        confidence,
        warning: WARNING_MESSAGES.pattern_matching[context.locale]
      }
    }

    // 4. Return default conservative estimate
    return {
      data: this.getDefaultThreatSuggestion(context.locale),
      level: 'default',
      confidence: CONFIDENCE_SCORES.default,
      warning: WARNING_MESSAGES.default[context.locale]
    }
  }

  /**
   * Estimate risk levels with fallback support
   */
  async estimateRiskWithFallback(
    risk: RiskContext,
    context: ServiceContext
  ): Promise<FallbackResult<RiskLevelEstimate>> {
    // 1. Check exact cache match
    const cacheKey = this.buildRiskCacheKey(risk, context)
    const cached = this.cacheManager.get<RiskLevelEstimate>(cacheKey)

    if (cached) {
      return {
        data: cached,
        level: 'cache',
        confidence: CONFIDENCE_SCORES.cache
      }
    }

    // 2. Check similar cache entries
    const similarMatch = this.similarityMatcher.findSimilarEntry<RiskLevelEstimate>(
      risk,
      `risklevel:${context.organizationId}`
    )

    if (similarMatch) {
      return {
        data: similarMatch.data,
        level: 'similar_cache',
        confidence: CONFIDENCE_SCORES.similar_cache_base * similarMatch.similarity,
        warning: WARNING_MESSAGES.similar_cache[context.locale]
      }
    }

    // 3. Use pattern matching
    const patternEstimate = this.estimateRiskFromPatterns(risk, context.locale)

    if (patternEstimate) {
      return {
        data: patternEstimate,
        level: 'pattern_matching',
        confidence: CONFIDENCE_SCORES.pattern_matching_high,
        warning: WARNING_MESSAGES.pattern_matching[context.locale]
      }
    }

    // 4. Return default conservative estimate
    return {
      data: this.getDefaultRiskEstimate(context.locale),
      level: 'default',
      confidence: CONFIDENCE_SCORES.default,
      warning: WARNING_MESSAGES.default[context.locale]
    }
  }

  /**
   * Suggest treatments with fallback support
   */
  async suggestTreatmentsWithFallback(
    risk: RiskContext,
    context: ServiceContext
  ): Promise<FallbackResult<TreatmentSuggestion>> {
    // 1. Check exact cache match
    const cacheKey = this.buildTreatmentCacheKey(risk, context)
    const cached = this.cacheManager.get<TreatmentSuggestion>(cacheKey)

    if (cached) {
      return {
        data: cached,
        level: 'cache',
        confidence: CONFIDENCE_SCORES.cache
      }
    }

    // 2. Check similar cache entries
    const similarMatch = this.similarityMatcher.findSimilarEntry<TreatmentSuggestion>(
      risk,
      `treatment:${context.organizationId}`
    )

    if (similarMatch) {
      return {
        data: similarMatch.data,
        level: 'similar_cache',
        confidence: CONFIDENCE_SCORES.similar_cache_base * similarMatch.similarity,
        warning: WARNING_MESSAGES.similar_cache[context.locale]
      }
    }

    // 3. Use knowledge base for treatment suggestions
    const knowledgeBaseTreatments = this.suggestTreatmentsFromKnowledgeBase(risk, context.locale)

    if (knowledgeBaseTreatments.treatments.length > 0) {
      return {
        data: knowledgeBaseTreatments,
        level: 'pattern_matching',
        confidence: CONFIDENCE_SCORES.pattern_matching_high,
        warning: WARNING_MESSAGES.pattern_matching[context.locale]
      }
    }

    // 4. Return default treatments
    return {
      data: this.getDefaultTreatmentSuggestion(context.locale),
      level: 'default',
      confidence: CONFIDENCE_SCORES.default,
      warning: WARNING_MESSAGES.default[context.locale]
    }
  }

  /**
   * Build cache key for threat suggestions
   */
  private buildThreatCacheKey(asset: AssetContext, context: ServiceContext): string {
    return `threats:${context.organizationId}:${asset.assetName}:${asset.assetType}`
  }

  /**
   * Build cache key for risk estimates
   */
  private buildRiskCacheKey(risk: RiskContext, context: ServiceContext): string {
    return `risklevel:${context.organizationId}:${risk.riskName}:${risk.riskCategory}`
  }

  /**
   * Build cache key for treatment suggestions
   */
  private buildTreatmentCacheKey(risk: RiskContext, context: ServiceContext): string {
    return `treatment:${context.organizationId}:${risk.riskName}:${risk.riskCategory}`
  }

  /**
   * Suggest threats using pattern library
   */
  private suggestThreatsFromPatterns(
    asset: AssetContext,
    locale: 'ja' | 'en'
  ): ThreatVulnerabilitySuggestion {
    const threats: ThreatVulnerabilitySuggestion['threats'] = []
    const vulnerabilities: ThreatVulnerabilitySuggestion['vulnerabilities'] = []

    // Get patterns by asset type
    const assetPatterns = this.threatLibrary.getPatternsByAssetType(asset.assetType)

    // Also match patterns by description
    const descriptionMatches = asset.description
      ? this.threatLibrary.matchPatterns(asset.description, locale)
      : []

    // Combine patterns (deduplicate by ID)
    const seenIds = new Set<string>()
    const combinedPatterns = [...assetPatterns]

    for (const match of descriptionMatches) {
      if (!seenIds.has(match.pattern.id)) {
        seenIds.add(match.pattern.id)
        combinedPatterns.push(match.pattern)
      }
    }

    // Add patterns already in assetPatterns to seenIds
    for (const pattern of assetPatterns) {
      seenIds.add(pattern.id)
    }

    // Convert patterns to threats and vulnerabilities
    for (const pattern of combinedPatterns.slice(0, 5)) {
      const riskEstimate = this.threatLibrary.estimateRiskOffline(pattern)

      threats.push({
        name: locale === 'ja' ? pattern.nameJa : pattern.name,
        description: locale === 'ja' ? pattern.descriptionJa : pattern.description,
        likelihood: riskEstimate.likelihood
      })

      // Generate corresponding vulnerability
      if (pattern.mitigationSuggestions.length > 0) {
        vulnerabilities.push({
          name: locale === 'ja'
            ? `${pattern.nameJa}に対する脆弱性`
            : `Vulnerability to ${pattern.name}`,
          description: pattern.mitigationSuggestions[0],
          severity: riskEstimate.impact
        })
      }
    }

    return { threats, vulnerabilities }
  }

  /**
   * Estimate risk using pattern library
   */
  private estimateRiskFromPatterns(
    risk: RiskContext,
    locale: 'ja' | 'en'
  ): RiskLevelEstimate | null {
    // Match patterns by risk description
    const description = `${risk.riskName} ${risk.description || ''}`
    const matches = this.threatLibrary.matchPatterns(description, locale)

    if (matches.length === 0) {
      // Try matching by category
      const categoryPatterns = this.threatLibrary.getPatternsByCategory(
        risk.riskCategory as 'confidentiality' | 'integrity' | 'availability'
      )

      if (categoryPatterns.length > 0) {
        // Use average of category patterns
        let totalImpact = 0
        let totalLikelihood = 0

        for (const pattern of categoryPatterns.slice(0, 5)) {
          const estimate = this.threatLibrary.estimateRiskOffline(pattern)
          totalImpact += estimate.impact
          totalLikelihood += estimate.likelihood
        }

        const count = Math.min(categoryPatterns.length, 5)

        return {
          impact: Math.round(totalImpact / count),
          likelihood: Math.round(totalLikelihood / count),
          rationale: PATTERN_RATIONALE[locale]
        }
      }

      return null
    }

    // Use the best matching pattern
    const bestMatch = matches[0]
    const estimate = this.threatLibrary.estimateRiskOffline(bestMatch.pattern)

    // Adjust based on existing controls
    let adjustedLikelihood = estimate.likelihood
    if (risk.existingControls && risk.existingControls.length > 0) {
      // Reduce likelihood if controls exist
      adjustedLikelihood = Math.max(1, estimate.likelihood - 1)
    }

    return {
      impact: estimate.impact,
      likelihood: adjustedLikelihood,
      rationale: locale === 'ja'
        ? `${bestMatch.pattern.nameJa}のパターンに基づく推定。${PATTERN_RATIONALE.ja}`
        : `Estimate based on ${bestMatch.pattern.name} pattern. ${PATTERN_RATIONALE.en}`
    }
  }

  /**
   * Suggest treatments using knowledge base
   */
  private suggestTreatmentsFromKnowledgeBase(
    risk: RiskContext,
    locale: 'ja' | 'en'
  ): TreatmentSuggestion {
    const treatments: TreatmentSuggestion['treatments'] = []

    // Get relevant controls from knowledge base
    const searchQuery = `${risk.riskName} ${risk.description || ''}`
    const relevantControls = this.knowledgeBase.searchControls(searchQuery, locale)

    // Also get controls by threat keywords
    const threatControls = this.knowledgeBase.getControlsByThreat(risk.riskCategory)

    // Combine and deduplicate
    const seenIds = new Set<string>()
    const allControls = [...relevantControls]

    for (const control of threatControls) {
      if (!seenIds.has(control.id)) {
        seenIds.add(control.id)
        allControls.push(control)
      }
    }

    // Add controls already in relevantControls to seenIds
    for (const control of relevantControls) {
      seenIds.add(control.id)
    }

    // Convert controls to treatment suggestions
    for (const control of allControls.slice(0, 4)) {
      treatments.push({
        type: 'mitigate',
        description: locale === 'ja' ? control.descriptionJa : control.description,
        controlIds: [control.id]
      })
    }

    // Add general treatment options if we have few specific ones
    if (treatments.length < 2) {
      treatments.push({
        type: 'accept',
        description: locale === 'ja'
          ? 'リスクを許容し、モニタリングを継続する'
          : 'Accept the risk and continue monitoring'
      })

      treatments.push({
        type: 'transfer',
        description: locale === 'ja'
          ? 'サイバー保険への加入を検討する'
          : 'Consider cyber insurance coverage'
      })
    }

    return { treatments }
  }

  /**
   * Get default threat suggestions
   */
  private getDefaultThreatSuggestion(locale: 'ja' | 'en'): ThreatVulnerabilitySuggestion {
    if (locale === 'ja') {
      return {
        threats: [
          {
            name: '不正アクセス',
            description: '未許可のユーザーによるシステムへのアクセス',
            likelihood: 3
          },
          {
            name: '情報漏洩',
            description: '機密情報の意図しない開示',
            likelihood: 3
          },
          {
            name: 'サービス停止',
            description: 'システムの可用性に影響を与える障害',
            likelihood: 2
          }
        ],
        vulnerabilities: [
          {
            name: '設定の不備',
            description: 'セキュリティ設定が適切に構成されていない',
            severity: 3
          },
          {
            name: 'アクセス制御の不足',
            description: 'アクセス権限の管理が不十分',
            severity: 3
          }
        ]
      }
    }

    return {
      threats: [
        {
          name: 'Unauthorized Access',
          description: 'Access by unauthorized users to the system',
          likelihood: 3
        },
        {
          name: 'Data Breach',
          description: 'Unintended disclosure of confidential information',
          likelihood: 3
        },
        {
          name: 'Service Disruption',
          description: 'Failures affecting system availability',
          likelihood: 2
        }
      ],
      vulnerabilities: [
        {
          name: 'Misconfiguration',
          description: 'Security settings not properly configured',
          severity: 3
        },
        {
          name: 'Insufficient Access Control',
          description: 'Inadequate management of access permissions',
          severity: 3
        }
      ]
    }
  }

  /**
   * Get default risk estimate (conservative)
   */
  private getDefaultRiskEstimate(locale: 'ja' | 'en'): RiskLevelEstimate {
    return {
      impact: 3,
      likelihood: 3,
      rationale: DEFAULT_RATIONALE[locale]
    }
  }

  /**
   * Get default treatment suggestions
   */
  private getDefaultTreatmentSuggestion(locale: 'ja' | 'en'): TreatmentSuggestion {
    if (locale === 'ja') {
      return {
        treatments: [
          {
            type: 'mitigate',
            description: 'アクセス制御の強化と監視の実施',
            controlIds: ['A.5.15', 'A.8.2']
          },
          {
            type: 'mitigate',
            description: 'セキュリティ意識向上トレーニングの実施',
            controlIds: ['A.6.3']
          },
          {
            type: 'accept',
            description: 'リスクを許容し、定期的なレビューを実施'
          }
        ]
      }
    }

    return {
      treatments: [
        {
          type: 'mitigate',
          description: 'Strengthen access controls and implement monitoring',
          controlIds: ['A.5.15', 'A.8.2']
        },
        {
          type: 'mitigate',
          description: 'Conduct security awareness training',
          controlIds: ['A.6.3']
        },
        {
          type: 'accept',
          description: 'Accept the risk and conduct periodic reviews'
        }
      ]
    }
  }
}
