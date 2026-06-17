/**
 * AI Feature Configuration Interface
 *
 * Defines the configuration structure for AI features in the ISMS system.
 * Used by the AISettingsPanel component to manage AI settings per organization.
 *
 * @module lib/ai/interfaces/AIFeatureConfig
 */

/**
 * Feature toggles for individual AI capabilities.
 */
export interface AIFeatureToggles {
  /** Enable AI-assisted risk identification */
  identify: boolean

  /** Enable AI-assisted risk evaluation/assessment */
  evaluate: boolean

  /** Enable AI-assisted treatment suggestions */
  suggest_treatments: boolean
}

/**
 * Current usage tracking for token consumption.
 */
export interface AIUsageInfo {
  /** Number of tokens consumed in the current billing period */
  tokensUsed: number

  /** ISO 8601 timestamp of the last usage counter reset */
  lastResetAt: string
}

/**
 * Complete AI feature configuration for an organization.
 * Controls which AI features are available and their usage limits.
 */
export interface AISettingsPanelConfig {
  /** Global toggle to enable/disable all AI features */
  enabled: boolean

  /** Individual feature toggles */
  features: AIFeatureToggles

  /** Whether AI calls may send scoped data to an external API provider */
  allowExternalApi?: boolean

  /** Whether personal data can be included after explicit review */
  allowPersonalData?: boolean

  /** Whether attachment body text can be included after explicit review */
  allowAttachmentBody?: boolean

  /** Maximum tokens allowed per month */
  monthlyTokenLimit: number

  /**
   * Percentage thresholds at which alerts are triggered.
   * Values should be between 1 and 100.
   * Example: [70, 90, 100] means alerts at 70%, 90%, and 100% usage.
   */
  alertThresholds: number[]

  /** Current token usage information (optional, may not be available) */
  currentUsage?: AIUsageInfo

  /** Name of the current AI provider (optional) */
  providerName?: string
}
