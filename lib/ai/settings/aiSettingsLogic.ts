/**
 * AI Settings Logic
 *
 * Pure functions for AI settings panel state management.
 * Separated from React component for testability.
 *
 * @module lib/ai/settings/aiSettingsLogic
 */

import type { AISettingsPanelConfig } from '@/lib/ai/interfaces/AIFeatureConfig'

/**
 * Form state representation for the AI settings panel.
 * Flattened from AISettingsPanelConfig for easier form binding.
 */
export interface AISettingsFormState {
  enabled: boolean
  identifyEnabled: boolean
  evaluateEnabled: boolean
  suggestTreatmentsEnabled: boolean
  allowExternalApi?: boolean
  allowPersonalData?: boolean
  allowAttachmentBody?: boolean
  monthlyTokenLimit: number
  alertThresholds: number[]
}

/**
 * Validation result for AI feature configuration.
 */
export interface AIConfigValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Creates a default AISettingsPanelConfig with all features disabled.
 */
export function createDefaultAIFeatureConfig(): AISettingsPanelConfig {
  return {
    enabled: false,
    features: {
      identify: false,
      evaluate: false,
      suggest_treatments: false
    },
    allowExternalApi: false,
    allowPersonalData: false,
    allowAttachmentBody: false,
    monthlyTokenLimit: 100000,
    alertThresholds: [70, 90, 100],
    currentUsage: {
      tokensUsed: 0,
      lastResetAt: new Date().toISOString()
    }
  }
}

/**
 * Validates an AISettingsPanelConfig object.
 * Returns validation result with errors if any.
 */
export function validateAIFeatureConfig(config: AISettingsPanelConfig): AIConfigValidationResult {
  const errors: string[] = []

  // Validate monthlyTokenLimit
  if (!validateTokenLimit(config.monthlyTokenLimit)) {
    errors.push('monthlyTokenLimit must be a positive integer')
  }

  // Validate alertThresholds
  if (!Array.isArray(config.alertThresholds) || config.alertThresholds.length === 0) {
    errors.push('alertThresholds must be a non-empty array')
  } else {
    const invalidThresholds = config.alertThresholds.filter(t => t < 1 || t > 100)
    if (invalidThresholds.length > 0) {
      errors.push('alertThresholds values must be between 1 and 100')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Formats usage display string with commas and percentage.
 * Example: "45,230 / 100,000 (45.2%)"
 */
export function formatUsageDisplay(used: number, limit: number): string {
  const percent = calculateUsagePercent(used, limit)
  const formattedUsed = used.toLocaleString('en-US')
  const formattedLimit = limit.toLocaleString('en-US')
  return `${formattedUsed} / ${formattedLimit} (${percent.toFixed(1)}%)`
}

/**
 * Calculates usage percentage with one decimal precision.
 * Returns 0 if limit is 0 to avoid division by zero.
 */
export function calculateUsagePercent(used: number, limit: number): number {
  if (limit === 0) return 0.0
  const percent = (used / limit) * 100
  return Math.round(percent * 10) / 10
}

/**
 * Determines if a specific feature is effectively enabled.
 * A feature is only enabled if both the global toggle AND the feature toggle are on.
 */
export function isFeatureEnabled(globalEnabled: boolean, featureEnabled: boolean): boolean {
  return globalEnabled && featureEnabled
}

/**
 * Applies global toggle change to config, preserving feature states.
 * When toggling off globally, feature toggles are preserved but effectively disabled.
 */
export function applyGlobalToggle(config: AISettingsPanelConfig, enabled: boolean): AISettingsPanelConfig {
  return {
    ...config,
    enabled
  }
}

/**
 * Validates a token limit value.
 * Must be a positive integer, not NaN, not Infinity.
 */
export function validateTokenLimit(value: number): boolean {
  if (typeof value !== 'number') return false
  if (Number.isNaN(value)) return false
  if (!Number.isFinite(value)) return false
  if (value <= 0) return false
  if (!Number.isInteger(value)) return false
  return true
}

/**
 * Creates form state from an AISettingsPanelConfig.
 * Handles undefined config by using defaults.
 */
export function createFormStateFromConfig(config: AISettingsPanelConfig | undefined): AISettingsFormState {
  if (!config) {
    const defaults = createDefaultAIFeatureConfig()
    return {
      enabled: defaults.enabled,
      identifyEnabled: defaults.features.identify,
      evaluateEnabled: defaults.features.evaluate,
      suggestTreatmentsEnabled: defaults.features.suggest_treatments,
      allowExternalApi: defaults.allowExternalApi ?? false,
      allowPersonalData: defaults.allowPersonalData ?? false,
      allowAttachmentBody: defaults.allowAttachmentBody ?? false,
      monthlyTokenLimit: defaults.monthlyTokenLimit,
      alertThresholds: [...defaults.alertThresholds]
    }
  }

  return {
    enabled: config.enabled,
    identifyEnabled: config.features.identify,
    evaluateEnabled: config.features.evaluate,
    suggestTreatmentsEnabled: config.features.suggest_treatments,
    allowExternalApi: config.allowExternalApi ?? false,
    allowPersonalData: config.allowPersonalData ?? false,
    allowAttachmentBody: config.allowAttachmentBody ?? false,
    monthlyTokenLimit: config.monthlyTokenLimit,
    alertThresholds: [...config.alertThresholds]
  }
}

/**
 * Compares original config with current form state to detect changes.
 * Returns true if any value has changed.
 */
export function hasConfigChanged(
  original: AISettingsPanelConfig | undefined,
  current: AISettingsFormState
): boolean {
  if (!original) return true

  if (original.enabled !== current.enabled) return true
  if (original.features.identify !== current.identifyEnabled) return true
  if (original.features.evaluate !== current.evaluateEnabled) return true
  if (original.features.suggest_treatments !== current.suggestTreatmentsEnabled) return true
  if ((original.allowExternalApi ?? false) !== current.allowExternalApi) return true
  if ((original.allowPersonalData ?? false) !== current.allowPersonalData) return true
  if ((original.allowAttachmentBody ?? false) !== current.allowAttachmentBody) return true
  if (original.monthlyTokenLimit !== current.monthlyTokenLimit) return true

  if (original.alertThresholds.length !== current.alertThresholds.length) return true
  for (let i = 0; i < original.alertThresholds.length; i++) {
    if (original.alertThresholds[i] !== current.alertThresholds[i]) return true
  }

  return false
}
