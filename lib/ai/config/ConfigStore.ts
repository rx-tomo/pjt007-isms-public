/**
 * AI Configuration Store
 *
 * Provides persistence layer for AI feature configuration per organization.
 * Includes an in-memory implementation (for testing) and SQLite implementation
 * (for production use).
 *
 * @module lib/ai/config/ConfigStore
 */

import { DEFAULT_AI_CONFIG, type AIFeatureConfig } from './FeatureToggle'

/**
 * Configuration Store Interface
 *
 * Abstracts the storage mechanism for AI feature config.
 * Implementations should return DEFAULT_AI_CONFIG when no config exists.
 */
export interface IConfigStore {
  /** Get AI configuration for an organization (returns default if not set) */
  get(organizationId: string): Promise<AIFeatureConfig>
  /** Save AI configuration for an organization */
  set(organizationId: string, config: AIFeatureConfig): Promise<void>
}

/**
 * In-Memory Configuration Store
 *
 * Simple Map-based implementation for testing purposes.
 * Returns DEFAULT_AI_CONFIG for organizations without saved config.
 */
export class InMemoryConfigStore implements IConfigStore {
  private store: Map<string, AIFeatureConfig> = new Map()

  async get(organizationId: string): Promise<AIFeatureConfig> {
    const config = this.store.get(organizationId)
    if (!config) {
      return { ...DEFAULT_AI_CONFIG }
    }
    return { ...config }
  }

  async set(organizationId: string, config: AIFeatureConfig): Promise<void> {
    this.store.set(organizationId, { ...config })
  }
}
