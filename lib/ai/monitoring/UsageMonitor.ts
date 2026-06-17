/**
 * Usage Monitor - AI usage tracking and alert generation
 *
 * Monitors AI token usage per organization, generates alerts when
 * configurable thresholds are reached, and blocks requests when
 * monthly limits are exceeded.
 *
 * Thresholds:
 * - 70%: Warning alert (informational)
 * - 90%: Critical alert (informational, recommends reduction)
 * - 100%: Exceeded alert (blocks further AI requests)
 *
 * Alerts are per-calendar-month and each threshold triggers only once per month.
 *
 * @module lib/ai/monitoring/UsageMonitor
 */

import type { IAIUsageLogRepository } from '@/lib/db/repositories/interfaces/IAIUsageLogRepository'
import type { IAlertStore } from './AlertStore'

// --- Types ---

/**
 * Alert severity levels
 */
export type AlertLevel = 'warning' | 'critical' | 'exceeded'

/**
 * A usage alert generated when a threshold is reached
 */
export interface UsageAlert {
  id: string
  organizationId: string
  threshold: number           // 0.7, 0.9, 1.0
  currentUsage: number        // Current token count this month
  limit: number               // Monthly limit
  percentage: number          // currentUsage / limit * 100
  alertLevel: AlertLevel      // warning (70%), critical (90%), exceeded (100%)
  message: string             // Human-readable message (English)
  messageJa: string           // Japanese message
  createdAt: Date
}

/**
 * Result of a usage check operation
 */
export interface UsageCheckResult {
  withinLimit: boolean
  currentUsage: number
  limit: number
  percentage: number
  alerts: UsageAlert[]        // Newly triggered alerts (not previously sent)
}

/**
 * Feature toggle service interface for AI features
 */
export interface IFeatureToggleService {
  isEnabled(feature: string, organizationId: string): boolean
  getMonthlyTokenLimit(organizationId: string): number
}

/**
 * Usage Monitor interface
 */
export interface IUsageMonitor {
  checkUsage(organizationId: string): Promise<UsageCheckResult>
  getActiveAlerts(organizationId: string): Promise<UsageAlert[]>
  shouldBlockRequest(organizationId: string): Promise<{ blocked: boolean; reason?: string }>
  recordAlert(alert: UsageAlert): Promise<void>
  hasAlertBeenSent(organizationId: string, threshold: number, month: string): Promise<boolean>
}

// --- Alert Messages ---

const ALERT_MESSAGES = {
  warning: {
    en: 'AI usage has reached {percent}% of monthly limit ({current}/{limit} tokens)',
    ja: 'AI使用量が月間上限の{percent}%に達しました（{current}/{limit}トークン）'
  },
  critical: {
    en: 'AI usage has reached {percent}% of monthly limit. Consider reducing usage.',
    ja: 'AI使用量が月間上限の{percent}%に達しました。使用量の削減を検討してください。'
  },
  exceeded: {
    en: 'AI monthly token limit exceeded. AI features are temporarily disabled.',
    ja: 'AI月間トークン上限を超過しました。AI機能は一時的に無効化されています。'
  }
} as const

// --- Threshold Configuration ---

interface ThresholdConfig {
  value: number
  level: AlertLevel
}

const THRESHOLDS: ThresholdConfig[] = [
  { value: 0.7, level: 'warning' },
  { value: 0.9, level: 'critical' },
  { value: 1.0, level: 'exceeded' }
]

// --- Implementation ---

/**
 * UsageMonitor implementation.
 *
 * Tracks AI usage and generates alerts when thresholds are reached.
 * Each threshold alert is sent only once per calendar month per organization.
 */
export class UsageMonitor implements IUsageMonitor {
  constructor(
    private usageLogRepository: IAIUsageLogRepository,
    private featureToggleService: IFeatureToggleService,
    private alertStore: IAlertStore
  ) {}

  /**
   * Check current usage for an organization and generate any new alerts.
   *
   * Steps:
   * 1. Get current month's total tokens from usage log
   * 2. Get organization's monthly limit from feature toggle config
   * 3. Calculate percentage
   * 4. Check each threshold - generate alert only if not already sent this month
   * 5. If 100% exceeded, mark withinLimit as false
   */
  async checkUsage(organizationId: string): Promise<UsageCheckResult> {
    const { startDate, endDate } = this.getCurrentMonthRange()
    const month = this.getCurrentMonth()

    const stats = await this.usageLogRepository.getStatistics(
      organizationId,
      startDate,
      endDate
    )

    const currentUsage = stats.totalTokens
    const limit = this.featureToggleService.getMonthlyTokenLimit(organizationId)

    const percentage = limit === 0
      ? (currentUsage > 0 ? Infinity : 0)
      : Math.round((currentUsage / limit) * 100)

    const withinLimit = limit === 0
      ? currentUsage === 0
      : currentUsage < limit

    const alerts: UsageAlert[] = []

    // Check each threshold and generate alerts if not already sent
    for (const threshold of THRESHOLDS) {
      const thresholdPercentage = threshold.value * 100
      if (percentage >= thresholdPercentage) {
        const alreadySent = await this.alertStore.hasBeenSent(
          organizationId,
          threshold.value,
          month
        )

        if (!alreadySent) {
          const alert = this.createAlert(
            organizationId,
            threshold,
            currentUsage,
            limit,
            percentage
          )
          alerts.push(alert)

          // Record and mark as sent
          await this.alertStore.save(alert)
          await this.alertStore.markAsSent(organizationId, threshold.value, month)
        }
      }
    }

    return {
      withinLimit,
      currentUsage,
      limit,
      percentage: percentage === Infinity ? 100 : percentage,
      alerts
    }
  }

  /**
   * Get all active alerts for an organization (current month).
   */
  async getActiveAlerts(organizationId: string): Promise<UsageAlert[]> {
    return this.alertStore.getByOrganization(organizationId)
  }

  /**
   * Determine if a request should be blocked based on usage limits.
   *
   * Returns blocked=true only when the monthly token limit is exceeded.
   * If the AI feature is disabled entirely, this returns blocked=false
   * (the feature toggle handles that separately).
   */
  async shouldBlockRequest(organizationId: string): Promise<{ blocked: boolean; reason?: string }> {
    const isEnabled = this.featureToggleService.isEnabled('ai', organizationId)
    if (!isEnabled) {
      return { blocked: false }
    }

    const { startDate, endDate } = this.getCurrentMonthRange()

    const stats = await this.usageLogRepository.getStatistics(
      organizationId,
      startDate,
      endDate
    )

    const currentUsage = stats.totalTokens
    const limit = this.featureToggleService.getMonthlyTokenLimit(organizationId)

    if (limit === 0 && currentUsage > 0) {
      return {
        blocked: true,
        reason: 'AI monthly token limit exceeded.'
      }
    }

    if (currentUsage >= limit) {
      return {
        blocked: true,
        reason: 'AI monthly token limit exceeded.'
      }
    }

    return { blocked: false }
  }

  /**
   * Record a pre-built alert in the store.
   */
  async recordAlert(alert: UsageAlert): Promise<void> {
    await this.alertStore.save(alert)
  }

  /**
   * Check if a specific threshold alert has been sent for an organization in a given month.
   */
  async hasAlertBeenSent(organizationId: string, threshold: number, month: string): Promise<boolean> {
    return this.alertStore.hasBeenSent(organizationId, threshold, month)
  }

  // --- Private Helpers ---

  private createAlert(
    organizationId: string,
    threshold: ThresholdConfig,
    currentUsage: number,
    limit: number,
    percentage: number
  ): UsageAlert {
    const displayPercentage = percentage === Infinity ? 100 : percentage
    const messages = ALERT_MESSAGES[threshold.level]

    const message = this.formatMessage(messages.en, displayPercentage, currentUsage, limit)
    const messageJa = this.formatMessage(messages.ja, displayPercentage, currentUsage, limit)

    return {
      id: `alert-${organizationId}-${threshold.value}-${Date.now()}`,
      organizationId,
      threshold: threshold.value,
      currentUsage,
      limit,
      percentage: displayPercentage,
      alertLevel: threshold.level,
      message,
      messageJa,
      createdAt: new Date()
    }
  }

  private formatMessage(
    template: string,
    percent: number,
    current: number,
    limit: number
  ): string {
    return template
      .replace('{percent}', String(percent))
      .replace('{current}', String(current))
      .replace('{limit}', String(limit))
  }

  private getCurrentMonthRange(): { startDate: Date; endDate: Date } {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
    return { startDate, endDate }
  }

  private getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
}
