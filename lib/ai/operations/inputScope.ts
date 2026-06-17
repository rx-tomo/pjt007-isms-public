import type { AIFeatureType } from '@/lib/ai/config/FeatureToggle'

export type AIDataCategory =
  | 'public_business_metadata'
  | 'internal_business_data'
  | 'personal_data'
  | 'confidential_attachment'

export interface AIInputScopeField {
  key: string
  label: string
  category: AIDataCategory
  sentByDefault: boolean
}

export interface AIInputScopeDefinition {
  feature: AIFeatureType
  label: string
  fields: AIInputScopeField[]
  excludedByDefault: AIDataCategory[]
  requiresHumanReview: true
}

export interface AISendPolicy {
  allowExternalApi: boolean
  allowPersonalData: boolean
  allowAttachmentBody: boolean
}

const definitions: Record<AIFeatureType, AIInputScopeDefinition> = {
  identify: {
    feature: 'identify',
    label: 'Risk identification',
    fields: [
      { key: 'assetName', label: 'Asset name', category: 'internal_business_data', sentByDefault: true },
      { key: 'assetType', label: 'Asset type', category: 'public_business_metadata', sentByDefault: true },
      { key: 'description', label: 'Asset description', category: 'internal_business_data', sentByDefault: true },
      { key: 'department', label: 'Department', category: 'internal_business_data', sentByDefault: true },
    ],
    excludedByDefault: ['personal_data', 'confidential_attachment'],
    requiresHumanReview: true,
  },
  evaluate: {
    feature: 'evaluate',
    label: 'Risk evaluation',
    fields: [
      { key: 'riskName', label: 'Risk name', category: 'internal_business_data', sentByDefault: true },
      { key: 'riskCategory', label: 'Risk category', category: 'public_business_metadata', sentByDefault: true },
      { key: 'description', label: 'Risk description', category: 'internal_business_data', sentByDefault: true },
      { key: 'currentImpact', label: 'Current impact', category: 'internal_business_data', sentByDefault: true },
      { key: 'currentLikelihood', label: 'Current likelihood', category: 'internal_business_data', sentByDefault: true },
      { key: 'existingControls', label: 'Existing controls', category: 'internal_business_data', sentByDefault: true },
    ],
    excludedByDefault: ['personal_data', 'confidential_attachment'],
    requiresHumanReview: true,
  },
  suggest_treatments: {
    feature: 'suggest_treatments',
    label: 'Treatment suggestions',
    fields: [
      { key: 'riskName', label: 'Risk name', category: 'internal_business_data', sentByDefault: true },
      { key: 'riskCategory', label: 'Risk category', category: 'public_business_metadata', sentByDefault: true },
      { key: 'description', label: 'Risk description', category: 'internal_business_data', sentByDefault: true },
      { key: 'existingControls', label: 'Existing controls', category: 'internal_business_data', sentByDefault: true },
    ],
    excludedByDefault: ['personal_data', 'confidential_attachment'],
    requiresHumanReview: true,
  },
}

export function getAIInputScopeDefinition(feature: AIFeatureType): AIInputScopeDefinition {
  return definitions[feature]
}

export function listAIInputScopeDefinitions(): AIInputScopeDefinition[] {
  return Object.values(definitions)
}

export function buildScopeSnapshot(feature: AIFeatureType, policy?: Partial<AISendPolicy>) {
  const definition = getAIInputScopeDefinition(feature)
  const effectivePolicy: AISendPolicy = {
    allowExternalApi: policy?.allowExternalApi ?? false,
    allowPersonalData: policy?.allowPersonalData ?? false,
    allowAttachmentBody: policy?.allowAttachmentBody ?? false,
  }

  const sentFields = definition.fields.filter((field) => {
    if (field.category === 'personal_data') return effectivePolicy.allowPersonalData
    if (field.category === 'confidential_attachment') return effectivePolicy.allowAttachmentBody
    return field.sentByDefault
  })

  return {
    feature,
    label: definition.label,
    sentFieldKeys: sentFields.map((field) => field.key),
    sentCategories: Array.from(new Set(sentFields.map((field) => field.category))),
    excludedCategories: definition.excludedByDefault,
    allowExternalApi: effectivePolicy.allowExternalApi,
    requiresHumanReview: definition.requiresHumanReview,
  }
}
