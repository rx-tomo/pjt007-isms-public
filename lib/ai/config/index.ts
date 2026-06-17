/**
 * AI Config Module
 *
 * Exports feature toggle service, config store implementations,
 * and all related types for AI capability management per organization.
 *
 * @module lib/ai/config
 */

// Feature Toggle Service
export {
  FeatureToggleService,
  DEFAULT_AI_CONFIG
} from './FeatureToggle'

export type {
  AIFeatureConfig,
  AIFeatureType,
  IFeatureToggleService
} from './FeatureToggle'

// Config Store
export {
  InMemoryConfigStore
} from './ConfigStore'

export {
  SQLiteConfigStore
} from './SQLiteConfigStore'

export type {
  IConfigStore
} from './ConfigStore'
