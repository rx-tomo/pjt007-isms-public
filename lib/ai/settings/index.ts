/**
 * AI Settings Module
 *
 * Exports AI settings logic and utilities.
 *
 * @module lib/ai/settings
 */

export {
  createDefaultAIFeatureConfig,
  validateAIFeatureConfig,
  formatUsageDisplay,
  calculateUsagePercent,
  isFeatureEnabled,
  applyGlobalToggle,
  validateTokenLimit,
  createFormStateFromConfig,
  hasConfigChanged,
  type AISettingsFormState,
  type AIConfigValidationResult
} from './aiSettingsLogic'
