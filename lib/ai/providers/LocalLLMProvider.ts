/**
 * Local LLM Provider (Ollama Integration)
 *
 * This module provides a preparation layer for future local LLM integration.
 * In Phase 3, this is a stub implementation. Actual Ollama integration will
 * be implemented in Phase 4.
 *
 * Supported local LLM servers:
 * - Ollama (https://ollama.ai)
 *
 * @module lib/ai/providers/LocalLLMProvider
 */

import type {
  IAIProvider,
  AICompletionRequest,
  AIContext,
  AICompletionResponse
} from '../interfaces/IAIProvider'

/**
 * Configuration for local LLM providers.
 */
export interface LocalLLMConfig {
  /**
   * The endpoint URL for the local LLM server.
   * @example 'http://localhost:11434'
   */
  endpoint: string

  /**
   * The model name to use.
   * @example 'mistral', 'llama2', 'neural-chat'
   */
  model: string

  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number

  /**
   * Maximum tokens for completion response.
   * @default 2048
   */
  maxTokens?: number
}

/**
 * Extended interface for local LLM providers.
 * Adds methods specific to local LLM server management.
 */
export interface ILocalLLMProvider extends IAIProvider {
  /**
   * Configures the provider with new settings.
   * @param config - The configuration to apply
   */
  configure(config: LocalLLMConfig): void

  /**
   * Checks if the local LLM server is available and responding.
   * This pings the actual server endpoint.
   * @returns Promise resolving to true if server is available
   */
  isServerAvailable(): Promise<boolean>

  /**
   * Gets the list of models installed on the local LLM server.
   * @returns Promise resolving to array of model names
   */
  getAvailableModels(): Promise<string[]>
}

/**
 * Allowed schemes for Ollama endpoints.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

/**
 * Allowed hosts for Ollama endpoints (SSRF prevention).
 */
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Validates an Ollama endpoint URL to prevent SSRF attacks.
 * Only http/https schemes and localhost addresses are permitted.
 *
 * @param endpoint - The endpoint URL string to validate
 * @throws Error if the URL is invalid or points to a disallowed host
 */
function validateEndpoint(endpoint: string): void {
  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    throw new Error(`Invalid Ollama endpoint URL: ${endpoint}`)
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error(
      `Invalid Ollama endpoint scheme "${parsed.protocol}". Only http: and https: are allowed.`
    )
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Invalid Ollama endpoint host "${parsed.hostname}". Only localhost, 127.0.0.1, and ::1 are allowed.`
    )
  }
}

/**
 * Default configuration values for OllamaProvider.
 */
const DEFAULT_CONFIG: Partial<LocalLLMConfig> = {
  endpoint: 'http://localhost:11434',
  timeoutMs: 30000,
  maxTokens: 2048
}

/**
 * Ollama Provider Implementation (Phase 3 Stub)
 *
 * This is a stub implementation for Phase 3. The actual Ollama API integration
 * will be implemented in Phase 4.
 *
 * In Phase 3:
 * - complete() throws "not implemented" error
 * - isAvailable() always returns false
 * - isServerAvailable() always returns false
 * - getAvailableModels() returns empty array
 *
 * Phase 4 will add:
 * - Actual Ollama API integration (/api/generate, /api/tags)
 * - Server health checking
 * - Model management
 * - Streaming support
 *
 * @example
 * ```typescript
 * // Prepare configuration (Phase 3)
 * const provider = new OllamaProvider({
 *   endpoint: 'http://localhost:11434',
 *   model: 'mistral'
 * })
 *
 * // Check availability (always false in Phase 3)
 * const available = await provider.isAvailable()
 *
 * // Attempt completion (throws in Phase 3)
 * try {
 *   await provider.complete({ prompt: 'Test' })
 * } catch (error) {
 *   console.log('Expected: Ollama not yet implemented')
 * }
 * ```
 */
export class OllamaProvider implements ILocalLLMProvider {
  private config: LocalLLMConfig | null = null

  /**
   * Creates a new OllamaProvider instance.
   *
   * @param config - Optional initial configuration
   */
  constructor(config?: LocalLLMConfig) {
    if (config) {
      validateEndpoint(config.endpoint)
      this.config = {
        ...DEFAULT_CONFIG,
        ...config
      }
    }
  }

  /**
   * Configures the provider with new settings.
   * Can be called multiple times to update configuration.
   *
   * @param config - The configuration to apply
   */
  configure(config: LocalLLMConfig): void {
    validateEndpoint(config.endpoint)
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    }
  }

  /**
   * Sends a completion request to the Ollama server.
   *
   * Phase 3: Throws "not implemented" error.
   * Phase 4: Will integrate with Ollama's /api/generate endpoint.
   *
   * @param request - The completion request
   * @returns Promise resolving to completion response
   * @throws Error - If configuration is missing or API call fails
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.config) {
      throw new Error('Ollama provider is not configured. Call configure() before complete().')
    }

    const systemMessage = this.buildSystemMessage(request.context)
    const prompt = [systemMessage, request.prompt].filter(Boolean).join('\n\n')
    const timeoutMs = this.config.timeoutMs || DEFAULT_CONFIG.timeoutMs || 30000

    try {
      const response = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            num_predict: request.maxTokens || this.config.maxTokens || 2048,
            temperature: request.temperature
          }
        })
      })

      if (!response.ok) {
        const message = await response.text().catch(() => 'No response body')
        throw new Error(`Ollama /api/generate request failed (${response.status} ${response.statusText}): ${message}`)
      }

      const data = await response.json()

      if (!data || typeof data.response !== 'string') {
        throw new Error(`Unexpected Ollama /api/generate response: ${JSON.stringify(data)}`)
      }

      const promptTokens = typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : 0
      const completionTokens = typeof data.eval_count === 'number' ? data.eval_count : 0

      return {
        content: data.response,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        cached: false,
        provider: 'ollama'
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama completion failed: ${error.message}`)
      }
      throw new Error('Ollama completion failed: Unknown error')
    }
  }

  /**
   * Checks if the Ollama provider is available for use.
   *
   * Phase 3: Always returns false.
   * Phase 4: Will check if configured and server is reachable.
   *
   * @returns Promise resolving to false in Phase 3
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config) {
      return false
    }

    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Gets the provider name.
   *
   * @returns The provider name 'ollama'
   */
  getProviderName(): string {
    return 'ollama'
  }

  /**
   * Checks if the Ollama server is available at the configured endpoint.
   *
   * Phase 3: Always returns false.
   * Phase 4: Will ping the server at /api/version or /api/tags.
   *
   * @returns Promise resolving to false in Phase 3
   */
  async isServerAvailable(): Promise<boolean> {
    return this.isAvailable()
  }

  /**
   * Gets the list of models available on the Ollama server.
   *
   * Phase 3: Returns empty array.
   * Phase 4: Will query /api/tags for installed models.
   *
   * @returns Promise resolving to empty array in Phase 3
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.config) {
      return []
    }

    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`Ollama /api/tags request failed (${response.status} ${response.statusText})`)
      }

      const data = await response.json()
      if (!Array.isArray(data?.models)) {
        return []
      }

      return data.models
        .map((item: { name?: unknown }) => (typeof item?.name === 'string' ? item.name : null))
        .filter((name: string | null): name is string => name !== null)
    } catch {
      return []
    }
  }

  /**
   * Builds a system message based on the ISMS context.
   *
   * @param context - Optional AI context with organization and domain info
   * @returns System message string or undefined if no context
   */
  private buildSystemMessage(context?: AIContext): string | undefined {
    if (!context) {
      return undefined
    }

    const domainInstructions: Record<AIContext['domain'], string> = {
      risk_identification: `You are an ISMS (Information Security Management System) expert specializing in risk identification.
Your task is to identify potential security risks based on the provided information.
Consider ISO/IEC 27001 requirements and common threat patterns.`,

      risk_assessment: `You are an ISMS (Information Security Management System) expert specializing in risk assessment.
Your task is to evaluate the likelihood and impact of identified risks.
Use a structured approach aligned with ISO/IEC 27001 risk assessment methodology.`,

      treatment_suggestion: `You are an ISMS (Information Security Management System) expert specializing in risk treatment.
Your task is to recommend appropriate risk treatment options.
Consider ISO/IEC 27001 Annex A controls and industry best practices.`
    }

    const localeInstructions: Record<AIContext['locale'], string> = {
      ja: 'Respond in Japanese (日本語で回答してください).',
      en: 'Respond in English.'
    }

    return `${domainInstructions[context.domain]}\n\n${localeInstructions[context.locale]}\n\nOrganization context: ${context.organizationId}\nDomain: ${context.domain}\nLocale: ${context.locale}`
  }

  /**
   * Gets the current configuration.
   * Useful for debugging and testing.
   *
   * @returns The current configuration or null if not configured
   */
  getConfig(): LocalLLMConfig | null {
    return this.config ? { ...this.config } : null
  }
}
