/**
 * Cache Similarity Matcher
 *
 * Provides similarity matching for cache entries to find related cached results
 * when exact matches are not available. Used for fallback scenarios.
 *
 * @module lib/ai/fallback/CacheSimilarityMatcher
 */

import type { ICacheManager } from '../cache/CacheManager'
import type { AssetContext } from '../prompts/riskIdentification'
import type { RiskContext } from '../prompts/riskAssessment'

/**
 * Represents a match between a context and a cached entry
 */
export interface SimilarityMatch<T> {
  /** The matched cached data */
  data: T
  /** Similarity score between 0.0 and 1.0 */
  similarity: number
  /** The cache key of the matched entry */
  cacheKey: string
}

/**
 * Cached entry structure with context metadata
 */
interface CachedEntryWithContext<T> {
  data?: T
  _context?: AssetContext | RiskContext
  [key: string]: unknown
}

/**
 * Interface for cache similarity matching
 */
export interface ICacheSimilarityMatcher {
  /**
   * Find a similar entry in cache that matches the given context
   * @param context - The context to match against
   * @param cacheKeyPrefix - Prefix to filter cache entries
   * @returns The most similar match or null if none found above threshold
   */
  findSimilarEntry<T>(
    context: AssetContext | RiskContext,
    cacheKeyPrefix: string
  ): SimilarityMatch<T> | null

  /**
   * Calculate similarity between two contexts
   * @param ctx1 - First context
   * @param ctx2 - Second context
   * @returns Similarity score between 0.0 and 1.0
   */
  calculateSimilarity(
    ctx1: AssetContext | RiskContext,
    ctx2: AssetContext | RiskContext
  ): number
}

/**
 * Similarity weights for different attributes
 */
const SIMILARITY_WEIGHTS = {
  assetType: 0.3,      // Asset type exact match
  category: 0.3,       // Risk category match (for RiskContext)
  description: 0.4,    // Keyword overlap in description
  department: 0.15     // Department/category match (bonus)
}

/**
 * Minimum similarity threshold for a match to be considered valid
 */
const SIMILARITY_THRESHOLD = 0.7

/**
 * Common stop words to exclude from keyword matching
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'also', 'now', 'this', 'that', 'it', 'its'
])

/**
 * Cache Similarity Matcher Implementation
 *
 * Finds similar cache entries based on context similarity.
 * Uses weighted scoring based on:
 * - Asset type / Risk category match (0.3 weight)
 * - Description keyword overlap (0.4 weight)
 * - Department/additional field match (0.15 weight bonus)
 */
export class CacheSimilarityMatcher implements ICacheSimilarityMatcher {
  constructor(private cacheManager: ICacheManager) {}

  /**
   * Find a similar entry in cache that matches the given context
   */
  findSimilarEntry<T>(
    context: AssetContext | RiskContext,
    cacheKeyPrefix: string
  ): SimilarityMatch<T> | null {
    // Get all cache entries with the given prefix
    const entries = this.getCacheEntriesWithPrefix<T>(cacheKeyPrefix)

    if (entries.length === 0) {
      return null
    }

    let bestMatch: SimilarityMatch<T> | null = null
    let highestSimilarity = 0

    for (const entry of entries) {
      const entryContext = entry.context
      if (!entryContext) {
        continue
      }

      const similarity = this.calculateSimilarity(context, entryContext)

      if (similarity > highestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
        highestSimilarity = similarity
        bestMatch = {
          data: entry.data,
          similarity,
          cacheKey: entry.key
        }
      }
    }

    return bestMatch
  }

  /**
   * Calculate similarity between two contexts
   */
  calculateSimilarity(
    ctx1: AssetContext | RiskContext,
    ctx2: AssetContext | RiskContext
  ): number {
    let totalScore = 0
    let maxScore = 0

    // Check if contexts are of the same type
    const isAssetContext1 = this.isAssetContext(ctx1)
    const isAssetContext2 = this.isAssetContext(ctx2)

    if (isAssetContext1 !== isAssetContext2) {
      // Different context types - low similarity
      return 0.1
    }

    if (isAssetContext1 && isAssetContext2) {
      // Both are AssetContext
      const asset1 = ctx1 as AssetContext
      const asset2 = ctx2 as AssetContext

      // Asset type match (0.3 weight)
      maxScore += SIMILARITY_WEIGHTS.assetType
      if (this.normalizeString(asset1.assetType) === this.normalizeString(asset2.assetType)) {
        totalScore += SIMILARITY_WEIGHTS.assetType
      }

      // Description keyword overlap (0.4 weight)
      maxScore += SIMILARITY_WEIGHTS.description
      totalScore += SIMILARITY_WEIGHTS.description * this.calculateKeywordOverlap(
        asset1.description || '',
        asset2.description || ''
      )

      // Department match (bonus)
      if (asset1.department && asset2.department) {
        maxScore += SIMILARITY_WEIGHTS.department
        if (this.normalizeString(asset1.department) === this.normalizeString(asset2.department)) {
          totalScore += SIMILARITY_WEIGHTS.department
        }
      }

      // Asset name similarity (partial bonus)
      const nameSimilarity = this.calculateKeywordOverlap(asset1.assetName, asset2.assetName)
      if (nameSimilarity > 0) {
        totalScore += 0.15 * nameSimilarity
        maxScore += 0.15
      }
    } else {
      // Both are RiskContext
      const risk1 = ctx1 as RiskContext
      const risk2 = ctx2 as RiskContext

      // Risk category match (0.3 weight)
      maxScore += SIMILARITY_WEIGHTS.category
      if (this.normalizeString(risk1.riskCategory) === this.normalizeString(risk2.riskCategory)) {
        totalScore += SIMILARITY_WEIGHTS.category
      }

      // Description keyword overlap (0.4 weight)
      maxScore += SIMILARITY_WEIGHTS.description
      totalScore += SIMILARITY_WEIGHTS.description * this.calculateKeywordOverlap(
        risk1.description || '',
        risk2.description || ''
      )

      // Asset name match (bonus if both have it)
      if (risk1.assetName && risk2.assetName) {
        maxScore += 0.15
        if (this.normalizeString(risk1.assetName) === this.normalizeString(risk2.assetName)) {
          totalScore += 0.15
        }
      }

      // Risk name similarity
      const nameSimilarity = this.calculateKeywordOverlap(risk1.riskName, risk2.riskName)
      if (nameSimilarity > 0) {
        totalScore += 0.15 * nameSimilarity
        maxScore += 0.15
      }
    }

    // Normalize to 0-1 range
    return maxScore > 0 ? totalScore / maxScore : 0
  }

  /**
   * Check if context is AssetContext
   */
  private isAssetContext(ctx: AssetContext | RiskContext): boolean {
    return 'assetType' in ctx && 'assetName' in ctx
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string): string {
    return str.toLowerCase().trim()
  }

  /**
   * Extract keywords from text (excluding stop words)
   */
  private extractKeywords(text: string): Set<string> {
    if (!text) {
      return new Set()
    }

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))

    return new Set(words)
  }

  /**
   * Calculate keyword overlap between two texts
   * Returns a score between 0.0 and 1.0
   */
  private calculateKeywordOverlap(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1)
    const keywords2 = this.extractKeywords(text2)

    if (keywords1.size === 0 || keywords2.size === 0) {
      return 0
    }

    // Calculate Jaccard similarity
    let intersection = 0
    for (const word of keywords1) {
      if (keywords2.has(word)) {
        intersection++
      }
    }

    const union = keywords1.size + keywords2.size - intersection

    return union > 0 ? intersection / union : 0
  }

  /**
   * Get cache entries with a given prefix
   */
  private getCacheEntriesWithPrefix<T>(
    prefix: string
  ): Array<{ key: string; data: T; context?: AssetContext | RiskContext }> {
    const entries: Array<{ key: string; data: T; context?: AssetContext | RiskContext }> = []

    // Use CacheManager's getKeysByPrefix to get all matching keys
    const keys = this.cacheManager.getKeysByPrefix(prefix)

    for (const key of keys) {
      const entry = this.cacheManager.get<CachedEntryWithContext<T>>(key)
      if (entry) {
        // Check if entry has context metadata
        if (entry._context) {
          entries.push({
            key,
            data: (entry.data || entry) as T,
            context: entry._context
          })
        }
      }
    }

    return entries
  }
}
