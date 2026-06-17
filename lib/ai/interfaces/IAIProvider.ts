/**
 * AI Provider Interface
 *
 * Defines the contract for AI providers used in ISMS risk assessment features.
 * This interface enables provider-agnostic AI integration, supporting multiple
 * AI services (OpenAI, Anthropic, etc.) with a unified API.
 *
 * @module lib/ai/interfaces/IAIProvider
 */

/**
 * Context information for AI completion requests.
 * Provides organizational and domain-specific context to customize AI behavior.
 */
export interface AIContext {
  /**
   * The organization ID for multi-tenant context isolation.
   * Used for logging, rate limiting, and organization-specific customizations.
   */
  organizationId: string

  /**
   * The locale for response language.
   * AI responses will be generated in the specified language.
   */
  locale: 'ja' | 'en'

  /**
   * The ISMS domain context for the request.
   * Helps the AI understand the specific task and provide relevant responses.
   *
   * - risk_identification: Identifying potential security risks
   * - risk_assessment: Evaluating risk likelihood and impact
   * - treatment_suggestion: Recommending risk treatment options
   */
  domain: 'risk_identification' | 'risk_assessment' | 'treatment_suggestion'
}

/**
 * Request payload for AI completion.
 * Contains the prompt and optional configuration for the AI request.
 */
export interface AICompletionRequest {
  /**
   * The prompt text to send to the AI provider.
   * Should contain clear instructions and any necessary context.
   */
  prompt: string

  /**
   * Optional context for the request.
   * Provides organizational and domain-specific information.
   */
  context?: AIContext

  /**
   * Optional maximum number of tokens for the response.
   * If not specified, provider defaults will be used.
   */
  maxTokens?: number

  /**
   * Optional temperature for response randomness (0.0 to 1.0).
   * Lower values produce more deterministic responses.
   * If not specified, provider defaults will be used.
   */
  temperature?: number
}

/**
 * Response from an AI completion request.
 * Contains the generated content and usage metadata.
 */
export interface AICompletionResponse {
  /**
   * The generated text content from the AI provider.
   */
  content: string

  /**
   * Token usage information for the request.
   * Useful for cost tracking and rate limiting.
   */
  usage: {
    /**
     * Number of tokens in the prompt.
     */
    promptTokens: number

    /**
     * Number of tokens in the completion response.
     */
    completionTokens: number

    /**
     * Total tokens used (prompt + completion).
     */
    totalTokens: number
  }

  /**
   * Whether the response was served from cache.
   * Cached responses have zero token usage cost.
   */
  cached: boolean

  /**
   * The name/identifier of the provider that generated the response.
   * Useful for logging and debugging multi-provider setups.
   */
  provider: string
}

/**
 * Interface for AI providers.
 *
 * Implementations of this interface provide AI completion capabilities
 * for ISMS risk assessment features. The interface supports:
 * - Multiple AI providers (OpenAI, Anthropic, etc.)
 * - Health checking and availability monitoring
 * - Provider identification for logging and debugging
 *
 * @example
 * ```typescript
 * const provider: IAIProvider = new OpenAIProvider(config)
 *
 * if (await provider.isAvailable()) {
 *   const response = await provider.complete({
 *     prompt: 'Identify risks for a web application',
 *     context: {
 *       organizationId: 'org-123',
 *       locale: 'ja',
 *       domain: 'risk_identification'
 *     }
 *   })
 *   console.log(response.content)
 * }
 * ```
 */
export interface IAIProvider {
  /**
   * Sends a completion request to the AI provider.
   *
   * @param request - The completion request containing prompt and configuration
   * @returns Promise resolving to the completion response
   * @throws Error if the provider is unavailable or the request fails
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>

  /**
   * Checks if the AI provider is available and healthy.
   *
   * Use this method to implement circuit breaker patterns or
   * provider failover logic.
   *
   * @returns Promise resolving to true if the provider is available
   */
  isAvailable(): Promise<boolean>

  /**
   * Gets the human-readable name of the AI provider.
   *
   * Used for logging, monitoring, and debugging purposes.
   *
   * @returns The provider name (e.g., "OpenAI", "Anthropic")
   */
  getProviderName(): string
}
