/**
 * Alert Store - Persistence layer for AI usage alerts
 *
 * Provides interface and in-memory implementation for storing
 * and querying usage alerts. The InMemoryAlertStore is suitable
 * for unit testing, while production implementations can use
 * database-backed stores.
 *
 * @module lib/ai/monitoring/AlertStore
 */

import type { UsageAlert } from './UsageMonitor'

/**
 * Interface for alert persistence.
 * Handles saving, querying, and deduplication tracking for usage alerts.
 */
export interface IAlertStore {
  /**
   * Save a usage alert to the store.
   */
  save(alert: UsageAlert): Promise<void>

  /**
   * Get all alerts for an organization.
   */
  getByOrganization(organizationId: string): Promise<UsageAlert[]>

  /**
   * Check if a specific threshold alert has already been sent
   * for an organization in a given month.
   *
   * @param organizationId - The organization to check
   * @param threshold - The threshold value (0.7, 0.9, 1.0)
   * @param month - The month in YYYY-MM format
   */
  hasBeenSent(organizationId: string, threshold: number, month: string): Promise<boolean>

  /**
   * Mark a threshold alert as sent for an organization in a given month.
   *
   * @param organizationId - The organization to mark
   * @param threshold - The threshold value (0.7, 0.9, 1.0)
   * @param month - The month in YYYY-MM format
   */
  markAsSent(organizationId: string, threshold: number, month: string): Promise<void>
}

/**
 * In-memory implementation of IAlertStore for unit testing.
 * Data is not persisted across process restarts.
 */
export class InMemoryAlertStore implements IAlertStore {
  private alerts: UsageAlert[] = []
  private sentTracking: Set<string> = new Set()

  async save(alert: UsageAlert): Promise<void> {
    this.alerts.push(alert)
  }

  async getByOrganization(organizationId: string): Promise<UsageAlert[]> {
    return this.alerts.filter(a => a.organizationId === organizationId)
  }

  async hasBeenSent(organizationId: string, threshold: number, month: string): Promise<boolean> {
    const key = this.buildKey(organizationId, threshold, month)
    return this.sentTracking.has(key)
  }

  async markAsSent(organizationId: string, threshold: number, month: string): Promise<void> {
    const key = this.buildKey(organizationId, threshold, month)
    this.sentTracking.add(key)
  }

  private buildKey(organizationId: string, threshold: number, month: string): string {
    return `${organizationId}:${threshold}:${month}`
  }
}
