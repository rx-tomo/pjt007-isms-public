/**
 * AI Module
 *
 * Main entry point for AI-related functionality in the ISMS risk assessment system.
 * Provides AI provider interfaces and implementations for risk identification,
 * assessment, and treatment suggestions.
 *
 * @module lib/ai
 */

// Re-export interfaces
export type {
  IAIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIContext
} from './interfaces'

// Re-export providers
export { ClaudeProvider } from './providers'
export type { ClaudeProviderConfig } from './providers'

// Re-export prompt builders
export {
  buildRiskIdentificationPrompt,
  buildRiskAssessmentPrompt,
  buildTreatmentSuggestionPrompt
} from './prompts'
export type { AssetContext, RiskContext, PromptLocale } from './prompts'

// Re-export cache manager
export { CacheManager } from './cache'
export type { ICacheManager, CacheManagerConfig } from './cache'

// Re-export fallback handler
export { FallbackHandler, CacheSimilarityMatcher } from './fallback'
export type {
  IFallbackHandler,
  FallbackResult,
  FallbackLevel,
  ICacheSimilarityMatcher,
  SimilarityMatch
} from './fallback'

// Re-export error handling
export { AIErrorHandler, AIServiceError } from './errors'
export type {
  AIErrorType,
  AIErrorInfo,
  RetryConfig,
  ServiceContext as AIServiceContext,
  IErrorHandler
} from './errors'

// Re-export inference utilities
export { RiskInferenceValidator } from './inference'
export type {
  IRiskInferenceValidator,
  ValidationIssue,
  ValidationResult,
  ConsistencyReport
} from './inference'

// Re-export feature toggle / config
export { FeatureToggleService, DEFAULT_AI_CONFIG } from './config'
export { InMemoryConfigStore } from './config'
export type {
  AIFeatureConfig,
  AIFeatureType,
  IFeatureToggleService,
  IConfigStore
} from './config'

// Re-export usage monitoring
export { UsageMonitor, InMemoryAlertStore } from './monitoring'
export type {
  AlertLevel,
  UsageAlert,
  UsageCheckResult,
  IUsageMonitor,
  IFeatureToggleService as IMonitoringFeatureToggleService
} from './monitoring'
export type { IAlertStore } from './monitoring'
