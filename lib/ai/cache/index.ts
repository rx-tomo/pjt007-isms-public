/**
 * Cache Module
 *
 * Exports cache-related utilities for AI responses.
 *
 * @module lib/ai/cache
 */

export { CacheManager } from './CacheManager'
export type { ICacheManager, CacheManagerConfig } from './CacheManager'

export { SmartCacheInvalidator } from './CacheInvalidationStrategy'
export type {
  ICacheInvalidationStrategy,
  InvalidationDecision,
  ContextDifference,
  AssetContext,
  RiskContext
} from './CacheInvalidationStrategy'
