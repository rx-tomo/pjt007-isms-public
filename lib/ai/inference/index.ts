/**
 * AI Inference Module
 *
 * Provides utilities and abstractions for AI inference operations.
 * This module serves as a preparation layer for future local LLM integration.
 *
 * @module lib/ai/inference
 */

import type { IAIProvider, AICompletionRequest, AICompletionResponse } from '../interfaces/IAIProvider'
import type { ILocalLLMProvider, LocalLLMConfig } from '../providers/LocalLLMProvider'

/**
 * Inference configuration options.
 */
export interface InferenceConfig {
  /**
   * Maximum number of retries for failed requests.
   * @default 3
   */
  maxRetries?: number

  /**
   * Timeout for individual requests in milliseconds.
   * @default 30000
   */
  timeoutMs?: number

  /**
   * Whether to enable streaming (when supported).
   * @default false
   */
  streaming?: boolean
}

/**
 * Inference result with additional metadata.
 */
export interface InferenceResult {
  /**
   * The completion response from the AI provider.
   */
  response: AICompletionResponse

  /**
   * Time taken for the inference in milliseconds.
   */
  latencyMs: number

  /**
   * Number of retries performed.
   */
  retries: number
}

/**
 * Checks if a provider supports local LLM operations.
 *
 * @param provider - The AI provider to check
 * @returns True if the provider implements ILocalLLMProvider
 */
export function isLocalLLMProvider(provider: IAIProvider): provider is ILocalLLMProvider {
  return (
    typeof (provider as ILocalLLMProvider).configure === 'function' &&
    typeof (provider as ILocalLLMProvider).isServerAvailable === 'function' &&
    typeof (provider as ILocalLLMProvider).getAvailableModels === 'function'
  )
}

/**
 * Creates a default inference configuration.
 *
 * @returns Default inference configuration
 */
export function createDefaultInferenceConfig(): InferenceConfig {
  return {
    maxRetries: 3,
    timeoutMs: 30000,
    streaming: false
  }
}

/**
 * Re-export types for convenience
 */
export type { LocalLLMConfig, ILocalLLMProvider }

/**
 * Risk Inference Validator - validates AI-generated risk estimates
 */
export { RiskInferenceValidator } from './RiskInferenceValidator'
export type {
  IRiskInferenceValidator,
  ValidationIssue,
  ValidationResult,
  ConsistencyReport,
  RiskLevelEstimate,
  ThreatVulnerabilitySuggestion,
  TreatmentSuggestion
} from './RiskInferenceValidator'
