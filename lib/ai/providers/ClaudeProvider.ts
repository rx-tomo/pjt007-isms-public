/**
 * Claude Provider Implementation
 *
 * Implements the IAIProvider interface for Anthropic's Claude API.
 * Provides AI completion capabilities for ISMS risk assessment features.
 *
 * @module lib/ai/providers/ClaudeProvider
 */

import type {
  IAIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIContext
} from '../interfaces/IAIProvider'

/**
 * Configuration options for ClaudeProvider.
 */
export interface ClaudeProviderConfig {
  /**
   * Anthropic API key. If not provided, falls back to ANTHROPIC_API_KEY env variable.
   */
  apiKey?: string

  /**
   * Claude model to use. Defaults to 'claude-sonnet-4-20250514'.
   */
  model?: string
}

/**
 * Anthropic Claude API response type (Messages API).
 */
interface ClaudeAPIResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

/**
 * Claude AI Provider implementation.
 *
 * Provides integration with Anthropic's Claude API for ISMS risk assessment
 * features including risk identification, assessment, and treatment suggestions.
 *
 * @example
 * ```typescript
 * const provider = new ClaudeProvider({ apiKey: 'your-api-key' })
 *
 * if (await provider.isAvailable()) {
 *   const response = await provider.complete({
 *     prompt: 'Identify security risks for a web application',
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
export class ClaudeProvider implements IAIProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly baseUrl: string = 'https://api.anthropic.com/v1'

  /**
   * Creates a new ClaudeProvider instance.
   *
   * @param config - Optional configuration for the provider
   */
  constructor(config?: ClaudeProviderConfig) {
    this.apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY || ''
    this.model = config?.model || 'claude-sonnet-4-20250514'
  }

  /**
   * Sends a completion request to Claude API.
   *
   * @param request - The completion request containing prompt and configuration
   * @returns Promise resolving to the completion response
   * @throws Error if the API key is not configured or the request fails
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error('API key is not configured')
    }

    const systemMessage = this.buildSystemMessage(request.context)

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      messages: [
        {
          role: 'user',
          content: request.prompt
        }
      ]
    }

    if (systemMessage) {
      body.system = systemMessage
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Claude API error (${response.status}): ${response.statusText}`)
    }

    const data: ClaudeAPIResponse = await response.json()

    const content = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const isCached =
      (data.usage.cache_creation_input_tokens ?? 0) > 0 ||
      (data.usage.cache_read_input_tokens ?? 0) > 0

    return {
      content,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      cached: isCached,
      provider: 'claude'
    }
  }

  /**
   * Checks if the Claude provider is available.
   *
   * @returns Promise resolving to true if the API key is configured
   */
  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  /**
   * Gets the provider name.
   *
   * @returns The provider name 'claude'
   */
  getProviderName(): string {
    return 'claude'
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

    return `${domainInstructions[context.domain]}

${localeInstructions[context.locale]}

Organization context: ${context.organizationId}
Domain: ${context.domain}
Locale: ${context.locale}`
  }
}
