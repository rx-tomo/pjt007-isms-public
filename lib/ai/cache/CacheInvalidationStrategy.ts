/**
 * CacheInvalidationStrategy
 *
 * Smart cache invalidation logic for AI responses.
 * Determines when to invalidate cache based on context changes,
 * using configurable thresholds for different types of changes.
 *
 * Invalidation Rules:
 * - Impact/Likelihood changes of 2+ levels: Invalidate
 * - Asset type or risk category changes: Always invalidate
 * - Description changes >= 30% keyword difference: Invalidate
 * - Department/owner changes: Keep cache but flag for revalidation
 *
 * @module lib/ai/cache/CacheInvalidationStrategy
 */

/**
 * Context types for cache invalidation decisions
 */
export interface AssetContext {
  assetName: string
  assetType: string
  description?: string
  department?: string
  owner?: string
}

export interface RiskContext {
  riskName: string
  riskCategory: string
  description?: string
  assetName?: string
  currentImpact?: number
  currentLikelihood?: number
  existingControls?: string[]
}

/**
 * Result of an invalidation decision
 */
export interface InvalidationDecision {
  shouldInvalidate: boolean
  reason?: string
  suggestRevalidation?: boolean
}

/**
 * Result of context difference calculation
 */
export interface ContextDifference {
  significantChange: boolean
  changedFields: string[]
  changeScore: number
}

/**
 * Interface for cache invalidation strategy
 */
export interface ICacheInvalidationStrategy {
  shouldInvalidateOnContextChange(
    cacheKey: string,
    oldContext: RiskContext | AssetContext | null,
    newContext: RiskContext | AssetContext
  ): InvalidationDecision

  getInvalidationKeys(
    context: RiskContext | AssetContext,
    changedFields: string[]
  ): string[]
}

/**
 * Configuration for invalidation thresholds
 */
interface InvalidationConfig {
  /** Threshold for impact/likelihood level change to trigger invalidation */
  levelChangeThreshold: number
  /** Threshold for description keyword difference (0.0 - 1.0) to trigger invalidation */
  descriptionChangeThreshold: number
}

const DEFAULT_CONFIG: InvalidationConfig = {
  levelChangeThreshold: 2,
  descriptionChangeThreshold: 0.3
}

/**
 * Type guard to check if context is RiskContext
 */
function isRiskContext(
  context: RiskContext | AssetContext
): context is RiskContext {
  return 'riskCategory' in context || 'riskName' in context
}

/**
 * Type guard to check if context is AssetContext
 */
function isAssetContext(
  context: RiskContext | AssetContext
): context is AssetContext {
  return 'assetType' in context && !('riskCategory' in context)
}

/**
 * Smart cache invalidator that determines when to invalidate
 * based on the significance of context changes.
 */
export class SmartCacheInvalidator implements ICacheInvalidationStrategy {
  private config: InvalidationConfig

  constructor(config?: Partial<InvalidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Determine if cache should be invalidated based on context changes
   */
  shouldInvalidateOnContextChange(
    cacheKey: string,
    oldContext: RiskContext | AssetContext | null,
    newContext: RiskContext | AssetContext
  ): InvalidationDecision {
    // Handle null/undefined old context (new entry)
    if (!oldContext) {
      return {
        shouldInvalidate: false,
        reason: 'new entry'
      }
    }

    const diff = this.calculateContextDifference(oldContext, newContext)

    // Check for fundamental changes that always trigger invalidation
    const fundamentalChange = this.checkFundamentalChanges(oldContext, newContext)
    if (fundamentalChange.shouldInvalidate) {
      return fundamentalChange
    }

    // Check for level-based changes (impact/likelihood)
    const levelChange = this.checkLevelChanges(oldContext, newContext)
    if (levelChange.shouldInvalidate) {
      return levelChange
    }

    // Check for description changes
    const descriptionChange = this.checkDescriptionChanges(oldContext, newContext)
    if (descriptionChange.shouldInvalidate) {
      return descriptionChange
    }

    // Check for minor changes that suggest revalidation
    const minorChange = this.checkMinorChanges(oldContext, newContext)
    if (minorChange.suggestRevalidation) {
      return minorChange
    }

    // No significant changes
    return {
      shouldInvalidate: false
    }
  }

  /**
   * Calculate the difference between two contexts
   */
  calculateContextDifference(
    ctx1: RiskContext | AssetContext,
    ctx2: RiskContext | AssetContext
  ): ContextDifference {
    const changedFields: string[] = []
    let changeScore = 0
    let significantChange = false

    // Get all keys from both contexts
    const allKeys = new Set([...Object.keys(ctx1), ...Object.keys(ctx2)])

    for (const key of allKeys) {
      const val1 = (ctx1 as unknown as Record<string, unknown>)[key]
      const val2 = (ctx2 as unknown as Record<string, unknown>)[key]

      if (this.valuesAreDifferent(val1, val2)) {
        changedFields.push(key)

        // Calculate change score based on field importance
        const fieldScore = this.getFieldChangeScore(key, val1, val2)
        changeScore += fieldScore

        // Check if this field change is significant
        if (this.isSignificantFieldChange(key, val1, val2)) {
          significantChange = true
        }
      }
    }

    return {
      significantChange,
      changedFields,
      changeScore
    }
  }

  /**
   * Get keys that should be invalidated based on context and changed fields
   */
  getInvalidationKeys(
    context: RiskContext | AssetContext,
    changedFields: string[]
  ): string[] {
    if (changedFields.length === 0) {
      return []
    }

    const keys: string[] = []

    if (isRiskContext(context)) {
      // For risk context, invalidate risk-related cache keys
      keys.push(`ai:risk:${context.riskCategory}`)
      if (context.riskName) {
        keys.push(`ai:risk:name:${context.riskName}`)
      }
    } else if (isAssetContext(context)) {
      // For asset context, invalidate asset-related cache keys
      keys.push(`ai:asset:${context.assetType}`)
      if (context.assetName) {
        keys.push(`ai:asset:name:${context.assetName}`)
      }
    }

    return keys
  }

  /**
   * Check for fundamental changes that always trigger invalidation
   */
  private checkFundamentalChanges(
    oldCtx: RiskContext | AssetContext,
    newCtx: RiskContext | AssetContext
  ): InvalidationDecision {
    // Check asset type change
    if (isAssetContext(oldCtx) && isAssetContext(newCtx)) {
      if (oldCtx.assetType !== newCtx.assetType) {
        return {
          shouldInvalidate: true,
          reason: 'asset type changed'
        }
      }
    }

    // Check risk category change
    if (isRiskContext(oldCtx) && isRiskContext(newCtx)) {
      if (oldCtx.riskCategory !== newCtx.riskCategory) {
        return {
          shouldInvalidate: true,
          reason: 'risk category changed'
        }
      }
    }

    return { shouldInvalidate: false }
  }

  /**
   * Check for impact/likelihood level changes
   */
  private checkLevelChanges(
    oldCtx: RiskContext | AssetContext,
    newCtx: RiskContext | AssetContext
  ): InvalidationDecision {
    if (!isRiskContext(oldCtx) || !isRiskContext(newCtx)) {
      return { shouldInvalidate: false }
    }

    // Check impact change
    if (
      oldCtx.currentImpact !== undefined &&
      newCtx.currentImpact !== undefined
    ) {
      const impactDiff = Math.abs(newCtx.currentImpact - oldCtx.currentImpact)
      if (impactDiff >= this.config.levelChangeThreshold) {
        return {
          shouldInvalidate: true,
          reason: `impact level changed by ${impactDiff} levels`
        }
      }
    }

    // Check likelihood change
    if (
      oldCtx.currentLikelihood !== undefined &&
      newCtx.currentLikelihood !== undefined
    ) {
      const likelihoodDiff = Math.abs(
        newCtx.currentLikelihood - oldCtx.currentLikelihood
      )
      if (likelihoodDiff >= this.config.levelChangeThreshold) {
        return {
          shouldInvalidate: true,
          reason: `likelihood level changed by ${likelihoodDiff} levels`
        }
      }
    }

    return { shouldInvalidate: false }
  }

  /**
   * Check for description changes
   */
  private checkDescriptionChanges(
    oldCtx: RiskContext | AssetContext,
    newCtx: RiskContext | AssetContext
  ): InvalidationDecision {
    const oldDesc = oldCtx.description || ''
    const newDesc = newCtx.description || ''

    // If one is empty and the other is not, it's a significant change
    if ((oldDesc === '' && newDesc !== '') || (oldDesc !== '' && newDesc === '')) {
      return {
        shouldInvalidate: true,
        reason: 'description added or removed'
      }
    }

    // If both are empty, no change
    if (oldDesc === '' && newDesc === '') {
      return { shouldInvalidate: false }
    }

    // Calculate keyword difference
    const difference = this.calculateKeywordDifference(oldDesc, newDesc)

    if (difference >= this.config.descriptionChangeThreshold) {
      return {
        shouldInvalidate: true,
        reason: `description changed significantly (${Math.round(difference * 100)}% difference)`
      }
    }

    return { shouldInvalidate: false }
  }

  /**
   * Check for minor changes that suggest revalidation
   */
  private checkMinorChanges(
    oldCtx: RiskContext | AssetContext,
    newCtx: RiskContext | AssetContext
  ): InvalidationDecision {
    const minorChangeFields = ['department', 'owner', 'assetName', 'riskName']
    const old = oldCtx as unknown as Record<string, unknown>
    const newC = newCtx as unknown as Record<string, unknown>

    for (const field of minorChangeFields) {
      if (old[field] !== newC[field] && old[field] !== undefined) {
        return {
          shouldInvalidate: false,
          suggestRevalidation: true
        }
      }
    }

    return { shouldInvalidate: false }
  }

  /**
   * Calculate keyword difference between two descriptions
   * Returns a value between 0.0 and 1.0
   * Uses a weighted approach that considers semantic similarity
   */
  private calculateKeywordDifference(desc1: string, desc2: string): number {
    const keywords1 = this.extractKeywords(desc1)
    const keywords2 = this.extractKeywords(desc2)

    if (keywords1.size === 0 && keywords2.size === 0) {
      return 0
    }

    // Normalize keywords using synonyms
    const normalized1 = this.normalizeKeywordsWithSynonyms(keywords1)
    const normalized2 = this.normalizeKeywordsWithSynonyms(keywords2)

    const union = new Set([...normalized1, ...normalized2])
    const intersection = new Set(
      [...normalized1].filter((k) => normalized2.has(k))
    )

    if (union.size === 0) {
      return 0
    }

    // Calculate similarity using Jaccard coefficient
    const similarity = intersection.size / union.size

    // Return distance (1 - similarity)
    // Use a more lenient threshold by considering word count ratio
    const wordCountRatio = Math.min(keywords1.size, keywords2.size) /
                           Math.max(keywords1.size, keywords2.size, 1)

    // If word counts are similar and there's good overlap, consider it minor change
    if (wordCountRatio > 0.7 && similarity > 0.5) {
      return 1 - similarity * 1.2 // Boost similarity for similar length texts
    }

    return 1 - similarity
  }

  /**
   * Normalize keywords by replacing synonyms with canonical forms
   */
  private normalizeKeywordsWithSynonyms(keywords: Set<string>): Set<string> {
    const synonymGroups: Record<string, string> = {
      // Common synonyms in security/risk context
      'via': 'through',
      'using': 'through',
      'by': 'through',
      'data': 'information',
      'info': 'information',
      'database': 'db',
      'attack': 'threat',
      'attacks': 'threat',
      'threats': 'threat',
      'vulnerability': 'vuln',
      'vulnerabilities': 'vuln',
      'unauthorized': 'unauth',
      'unauthorised': 'unauth',
      'customer': 'client',
      'customers': 'client',
      'clients': 'client',
      'system': 'systems',
      'server': 'systems',
      'servers': 'systems',
      'access': 'entry',
      'accessing': 'entry',
      'steal': 'theft',
      'stealing': 'theft',
      'stolen': 'theft'
    }

    const normalized = new Set<string>()
    for (const keyword of keywords) {
      const canonical = synonymGroups[keyword] || keyword
      normalized.add(canonical)
    }
    return normalized
  }

  /**
   * Extract keywords from a description
   */
  private extractKeywords(description: string): Set<string> {
    // Normalize: lowercase, remove punctuation
    const normalized = description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .trim()

    // Split into words and filter common stop words
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'to',
      'of',
      'and',
      'or',
      'for',
      'in',
      'on',
      'at',
      'by',
      'with',
      'from',
      'as',
      'this',
      'that',
      'it',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'shall',
      'their',
      'they',
      'them',
      'its',
      'our',
      'your',
      'his',
      'her',
      'we',
      'you',
      'he',
      'she',
      'which',
      'who',
      'whom',
      'what',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'also',
      'any',
      'into',
      'over',
      'after',
      'before',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'about',
      'against',
      'during',
      'through',
      'above',
      'below',
      'upon',
      'via'
    ])

    const words = normalized.split(/\s+/).filter((w) => w.length > 2)
    return new Set(words.filter((w) => !stopWords.has(w)))
  }

  /**
   * Check if two values are different
   */
  private valuesAreDifferent(val1: unknown, val2: unknown): boolean {
    if (val1 === val2) return false
    if (val1 === undefined && val2 === undefined) return false
    if (val1 === null && val2 === null) return false

    // Handle arrays
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) return true
      return val1.some((v, i) => v !== val2[i])
    }

    return true
  }

  /**
   * Get change score for a field
   */
  private getFieldChangeScore(
    field: string,
    _oldVal: unknown,
    _newVal: unknown
  ): number {
    // High importance fields
    const highImportance = [
      'assetType',
      'riskCategory',
      'currentImpact',
      'currentLikelihood'
    ]
    if (highImportance.includes(field)) {
      return 10
    }

    // Medium importance fields
    const mediumImportance = ['description', 'existingControls']
    if (mediumImportance.includes(field)) {
      return 5
    }

    // Low importance fields
    return 1
  }

  /**
   * Check if a field change is significant
   */
  private isSignificantFieldChange(
    field: string,
    oldVal: unknown,
    newVal: unknown
  ): boolean {
    // Fundamental field changes are always significant
    if (field === 'assetType' || field === 'riskCategory') {
      return true
    }

    // Level changes of 2+ are significant
    if (field === 'currentImpact' || field === 'currentLikelihood') {
      const diff = Math.abs(
        (newVal as number) - (oldVal as number || 0)
      )
      return diff >= this.config.levelChangeThreshold
    }

    return false
  }
}
