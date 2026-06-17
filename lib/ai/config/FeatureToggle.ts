/**
 * AI Feature Toggle Service
 *
 * Provides feature toggle logic for AI capabilities per organization.
 * Controls which AI features are enabled, enforces token limits,
 * and manages per-organization configuration.
 *
 * Business Rules:
 * - New organizations start with AI disabled (enabled: false)
 * - Token limit is per calendar month (resets on 1st of each month)
 * - When token limit is exceeded, requests are rejected
 * - Rate limiting is per organization (not per user)
 * - Config changes take effect immediately (no cache)
 *
 * @module lib/ai/config/FeatureToggle
 */

import type { IConfigStore } from './ConfigStore'
import type { IAIUsageLogRepository } from '@/lib/db/repositories/interfaces/IAIUsageLogRepository'

/**
 * Types of AI features that can be toggled
 */
export type AIFeatureType = 'identify' | 'evaluate' | 'suggest_treatments'

/**
 * AI Feature Configuration for an organization
 */
export interface AIFeatureConfig {
  /** Global AI ON/OFF for this organization */
  enabled: boolean
  /** Which AI features are enabled */
  allowedFeatures: AIFeatureType[]
  /** Allow scoped data to be sent to an external AI API */
  allowExternalApi?: boolean
  /** Allow personal data only after explicit review */
  allowPersonalData?: boolean
  /** Allow attachment body text only after explicit review */
  allowAttachmentBody?: boolean
  /** Monthly token budget (must be positive) */
  monthlyTokenLimit: number
  /** Usage alert thresholds as percentages (must be ascending, 0-1 range) */
  alertThresholds: number[]
  /** Rate limit per organization per minute (must be positive) */
  maxRequestsPerMinute: number
  /** Override provider for testing purposes */
  providerOverride?: 'claude' | 'mock'
}

/**
 * Default configuration for new organizations.
 * AI is disabled by default to prevent unintended usage.
 */
export const DEFAULT_AI_CONFIG: AIFeatureConfig = {
  enabled: false,
  allowedFeatures: ['identify', 'evaluate', 'suggest_treatments'],
  allowExternalApi: false,
  allowPersonalData: false,
  allowAttachmentBody: false,
  monthlyTokenLimit: 100000,
  alertThresholds: [0.7, 0.9, 1.0],
  maxRequestsPerMinute: 10,
}

/**
 * Feature Toggle Service Interface
 */
export interface IFeatureToggleService {
  /** Get AI configuration for an organization */
  getConfig(organizationId: string): Promise<AIFeatureConfig>
  /** Update AI configuration (partial merge) */
  updateConfig(organizationId: string, config: Partial<AIFeatureConfig>): Promise<AIFeatureConfig>
  /** Check if a specific AI feature is enabled for an organization */
  isFeatureEnabled(organizationId: string, feature: AIFeatureType): Promise<boolean>
  /** Check if the organization is within its monthly token limit */
  isWithinTokenLimit(organizationId: string): Promise<boolean>
  /** Get current usage statistics for the current month */
  getCurrentUsage(organizationId: string): Promise<{ tokens: number; limit: number; percentage: number }>
}

/**
 * Validates partial AI feature configuration.
 * Throws descriptive errors for invalid values.
 */
function validateConfig(config: Partial<AIFeatureConfig>): void {
  if (config.monthlyTokenLimit !== undefined) {
    if (config.monthlyTokenLimit <= 0) {
      throw new Error('monthlyTokenLimit must be a positive number')
    }
  }

  if (config.alertThresholds !== undefined) {
    const thresholds = config.alertThresholds
    // Validate range: all values must be between 0 and 1 (inclusive)
    for (const t of thresholds) {
      if (t < 0 || t > 1.0) {
        throw new Error('alertThresholds values must be between 0 and 1.0')
      }
    }
    // Validate ascending order
    for (let i = 1; i < thresholds.length; i++) {
      if (thresholds[i] <= thresholds[i - 1]) {
        throw new Error('alertThresholds must be in strictly ascending order')
      }
    }
  }

  if (config.maxRequestsPerMinute !== undefined) {
    if (config.maxRequestsPerMinute <= 0) {
      throw new Error('maxRequestsPerMinute must be a positive number')
    }
  }
}

/**
 * Returns the start of the current calendar month in UTC.
 * Used to calculate monthly token usage windows.
 */
function getMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * Returns the current time as a Date.
 * Used as the end boundary for usage queries.
 */
function getNow(): Date {
  return new Date()
}

/**
 * Feature Toggle Service Implementation
 *
 * Manages AI feature configuration per organization and enforces
 * token usage limits on a monthly basis.
 */
export class FeatureToggleService implements IFeatureToggleService {
  constructor(
    private usageLogRepository: Pick<IAIUsageLogRepository, 'getStatistics'>,
    private configStore: IConfigStore
  ) {}

  /**
   * Get AI configuration for an organization.
   * Returns DEFAULT_AI_CONFIG if no custom config has been set.
   */
  async getConfig(organizationId: string): Promise<AIFeatureConfig> {
    return this.configStore.get(organizationId)
  }

  /**
   * Update AI configuration for an organization.
   * Merges the partial config with the existing config.
   * Validates all provided values before saving.
   *
   * @throws Error if config values are invalid
   */
  async updateConfig(organizationId: string, config: Partial<AIFeatureConfig>): Promise<AIFeatureConfig> {
    // Validate before merging
    validateConfig(config)

    // Get existing config (defaults if new org)
    const existing = await this.configStore.get(organizationId)

    // Merge: provided fields override existing
    const merged: AIFeatureConfig = {
      ...existing,
      ...config
    }

    // Persist the merged config
    await this.configStore.set(organizationId, merged)

    return merged
  }

  /**
   * Check if a specific AI feature is enabled for an organization.
   *
   * Returns false if:
   * - AI is globally disabled for the organization
   * - The specific feature is not in allowedFeatures
   */
  async isFeatureEnabled(organizationId: string, feature: AIFeatureType): Promise<boolean> {
    const config = await this.configStore.get(organizationId)

    if (!config.enabled) {
      return false
    }

    return config.allowedFeatures.includes(feature)
  }

  /**
   * Check if the organization is within its monthly token limit.
   * Uses the current calendar month (UTC) as the billing period.
   *
   * Returns false if usage >= limit (strict less-than for "within").
   */
  async isWithinTokenLimit(organizationId: string): Promise<boolean> {
    const config = await this.configStore.get(organizationId)
    const monthStart = getMonthStart()
    const now = getNow()

    const statistics = await this.usageLogRepository.getStatistics(
      organizationId,
      monthStart,
      now
    )

    return statistics.totalTokens < config.monthlyTokenLimit
  }

  /**
   * Get current usage statistics for the current month.
   * Returns tokens used, the limit, and usage percentage.
   *
   * Percentage can exceed 1.0 if the organization has gone over limit.
   */
  async getCurrentUsage(organizationId: string): Promise<{ tokens: number; limit: number; percentage: number }> {
    const config = await this.configStore.get(organizationId)
    const monthStart = getMonthStart()
    const now = getNow()

    const statistics = await this.usageLogRepository.getStatistics(
      organizationId,
      monthStart,
      now
    )

    const tokens = statistics.totalTokens
    const limit = config.monthlyTokenLimit
    const percentage = limit > 0 ? tokens / limit : 0

    return { tokens, limit, percentage }
  }
}
