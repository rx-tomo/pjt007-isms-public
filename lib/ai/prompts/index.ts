/**
 * Prompt Templates Module
 *
 * Exports prompt builders for AI-assisted ISMS risk management features.
 *
 * @module lib/ai/prompts
 */

// Risk Identification
export {
  buildRiskIdentificationPrompt,
  type AssetContext,
  type PromptLocale
} from './riskIdentification'

// Risk Assessment
export {
  buildRiskAssessmentPrompt,
  type RiskContext
} from './riskAssessment'

// Treatment Suggestion
export {
  buildTreatmentSuggestionPrompt
} from './treatmentSuggestion'
