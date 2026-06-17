/**
 * AI Providers Module
 *
 * Exports all AI provider implementations for the ISMS risk assessment system.
 *
 * @module lib/ai/providers
 */

export { ClaudeProvider } from './ClaudeProvider'
export type { ClaudeProviderConfig } from './ClaudeProvider'

export { MockProvider } from './MockProvider'
export type { MockProviderConfig } from './MockProvider'

export { OllamaProvider } from './LocalLLMProvider'
export type { LocalLLMConfig, ILocalLLMProvider } from './LocalLLMProvider'

/**
 * Available AI provider types.
 * - 'claude': Anthropic Claude API (production)
 * - 'mock': Mock provider for testing
 * - 'ollama': Local LLM via Ollama (Phase 4)
 */
export type AIProviderType = 'claude' | 'mock' | 'ollama'
