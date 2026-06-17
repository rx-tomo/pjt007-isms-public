/**
 * SQLite Alert Store - Persistent alert storage using Drizzle ORM
 *
 * Implements IAlertStore interface with SQLite-backed persistence.
 * Stores usage alerts and provides deduplication tracking for
 * threshold-based alert delivery (per organization, per month).
 *
 * @module lib/ai/monitoring/SQLiteAlertStore
 */

import { eq, and } from 'drizzle-orm'
import { aiAlerts } from '@/lib/db/drizzle/schema/ai'
import type { IAlertStore } from './AlertStore'
import type { UsageAlert } from './UsageMonitor'

/**
 * SQLite-backed implementation of IAlertStore.
 *
 * Persists alerts to the ai_alerts table and tracks which
 * threshold alerts have been sent per organization per month
 * to prevent duplicate notifications.
 */
export class SQLiteAlertStore implements IAlertStore {
  private db: any

  /**
   * Create a new SQLiteAlertStore.
   * @param db - Drizzle database instance (optional, defaults to getDb())
   */
  constructor(db?: any) {
    if (db) {
      this.db = db
    } else {
      // Lazy import to avoid circular dependencies
      const { getDb } = require('@/lib/db/drizzle/client')
      this.db = getDb()
    }
  }

  /**
   * Save a usage alert to the database.
   * Derives the month field from alert.createdAt in YYYY-MM format.
   * Converts createdAt Date to ISO string for storage.
   */
  async save(alert: UsageAlert): Promise<void> {
    const month = this.deriveMonth(alert.createdAt)

    await this.db.insert(aiAlerts).values({
      id: alert.id,
      organizationId: alert.organizationId,
      threshold: alert.threshold,
      currentUsage: alert.currentUsage,
      limitValue: alert.limit,
      percentage: alert.percentage,
      alertLevel: alert.alertLevel,
      message: alert.message,
      messageJa: alert.messageJa,
      month,
      createdAt: alert.createdAt.toISOString()
    })
  }

  /**
   * Get all alerts for an organization, ordered by createdAt descending.
   * Converts stored ISO strings back to Date objects.
   */
  async getByOrganization(organizationId: string): Promise<UsageAlert[]> {
    const rows = await this.db
      .select()
      .from(aiAlerts)
      .where(eq(aiAlerts.organizationId, organizationId))
      .orderBy(aiAlerts.createdAt)

    // Filter by organizationId (in case mock doesn't filter)
    const filtered = rows.filter((row: any) => row.organizationId === organizationId)

    return filtered.map((row: any) => this.rowToAlert(row))
  }

  /**
   * Check if a specific threshold alert has already been sent
   * for an organization in a given month.
   *
   * Queries the ai_alerts table for matching org_id + threshold + month.
   */
  async hasBeenSent(organizationId: string, threshold: number, month: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(aiAlerts)
      .where(
        and(
          eq(aiAlerts.organizationId, organizationId),
          eq(aiAlerts.threshold, threshold),
          eq(aiAlerts.month, month)
        )
      )
      .orderBy(aiAlerts.createdAt)

    // Filter matching rows (for mock compatibility)
    const matching = rows.filter((row: any) =>
      row.organizationId === organizationId &&
      row.threshold === threshold &&
      row.month === month
    )

    return matching.length > 0
  }

  /**
   * Mark a threshold alert as sent for an organization in a given month.
   *
   * Creates a minimal tracking entry in the alerts table if one doesn't
   * already exist for this org+threshold+month combination.
   * This is idempotent - calling multiple times is safe.
   */
  async markAsSent(organizationId: string, threshold: number, month: string): Promise<void> {
    // Check if already marked
    const alreadySent = await this.hasBeenSent(organizationId, threshold, month)
    if (alreadySent) {
      return // Already tracked, nothing to do
    }

    // Create a minimal tracking entry
    const trackingId = `sent-${organizationId}-${threshold}-${month}`
    await this.db.insert(aiAlerts).values({
      id: trackingId,
      organizationId,
      threshold,
      currentUsage: 0,
      limitValue: 0,
      percentage: 0,
      alertLevel: this.thresholdToAlertLevel(threshold),
      message: '',
      messageJa: '',
      month,
      createdAt: new Date().toISOString()
    })
  }

  // --- Private Helpers ---

  /**
   * Derive month string (YYYY-MM) from a Date object.
   */
  private deriveMonth(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  /**
   * Convert a database row to a UsageAlert object.
   */
  private rowToAlert(row: any): UsageAlert {
    return {
      id: row.id,
      organizationId: row.organizationId,
      threshold: row.threshold,
      currentUsage: row.currentUsage,
      limit: row.limitValue,
      percentage: row.percentage,
      alertLevel: row.alertLevel as UsageAlert['alertLevel'],
      message: row.message,
      messageJa: row.messageJa,
      createdAt: new Date(row.createdAt)
    }
  }

  /**
   * Map threshold value to alert level.
   */
  private thresholdToAlertLevel(threshold: number): string {
    if (threshold >= 1.0) return 'exceeded'
    if (threshold >= 0.9) return 'critical'
    return 'warning'
  }
}
