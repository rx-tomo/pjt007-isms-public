/**
 * AI Fallback Module Exports
 *
 * Provides graceful degradation capabilities when AI provider is unavailable.
 *
 * @module lib/ai/fallback
 */

export {
  FallbackHandler,
  type IFallbackHandler,
  type FallbackResult,
  type FallbackLevel
} from './FallbackHandler'

export {
  CacheSimilarityMatcher,
  type ICacheSimilarityMatcher,
  type SimilarityMatch
} from './CacheSimilarityMatcher'
