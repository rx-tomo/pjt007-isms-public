/**
 * SQLite Configuration Store
 *
 * Persists AI feature configuration per organization in the SQLite
 * organizations table's ai_config TEXT column (as JSON string).
 *
 * Uses Drizzle ORM for type-safe database operations.
 * Falls back to DEFAULT_AI_CONFIG when:
 * - Organization doesn't exist in the database
 * - ai_config column is null or empty
 * - ai_config contains invalid JSON
 *
 * @module lib/ai/config/SQLiteConfigStore
 */

import { eq } from 'drizzle-orm'
import { getDb, type DrizzleDb } from '@/lib/db/drizzle/client'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { DEFAULT_AI_CONFIG, type AIFeatureConfig } from './FeatureToggle'
import type { IConfigStore } from './ConfigStore'

export class SQLiteConfigStore implements IConfigStore {
  private db: DrizzleDb

  constructor(db?: DrizzleDb) {
    this.db = db || getDb()
  }

  /**
   * Get AI configuration for an organization.
   * Returns DEFAULT_AI_CONFIG if:
   * - Organization not found
   * - ai_config is null/empty
   * - ai_config contains invalid JSON
   */
  async get(organizationId: string): Promise<AIFeatureConfig> {
    const rows = await this.db
      .select({ aiConfig: organizations.aiConfig })
      .from(organizations)
      .where(eq(organizations.id, organizationId))

    const result = rows[0]

    if (!result || !result.aiConfig) {
      return { ...DEFAULT_AI_CONFIG }
    }

    try {
      return JSON.parse(result.aiConfig) as AIFeatureConfig
    } catch {
      return { ...DEFAULT_AI_CONFIG }
    }
  }

  /**
   * Save AI configuration for an organization.
   * Serializes the config to JSON and stores in the ai_config column.
   */
  async set(organizationId: string, config: AIFeatureConfig): Promise<void> {
    const jsonStr = JSON.stringify(config)

    await this.db
      .update(organizations)
      .set({ aiConfig: jsonStr })
      .where(eq(organizations.id, organizationId))
  }
}
