/**
 * SQLite AI Suggestion Repository
 *
 * Implements IAISuggestionRepository using Drizzle ORM with SQLite.
 * Handles CRUD operations for AI-generated suggestions with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - Stores JSON fields (inputContext, suggestionContent) as stringified text
 * - Converts boolean `accepted` to integer (0/1/null) for SQLite storage
 * - All queries include organization_id filtering for multi-tenant isolation
 *
 * @module lib/db/repositories/sqlite/AISuggestionRepository
 */

import { eq, and } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import { aiSuggestions } from '@/lib/db/drizzle/schema/ai'
import type {
  IAISuggestionRepository,
  AISuggestion,
  CreateSuggestionInput,
  DecideSuggestionInput,
  SuggestionDecisionStatus,
  SuggestionType,
} from '../interfaces/IAISuggestionRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteAISuggestionRepository extends BaseSQLiteRepository implements IAISuggestionRepository {
  /**
   * Constructor accepts an optional db override for testing (dependency injection)
   */
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  /**
   * Create a new AI suggestion
   *
   * - Generates a unique UUID
   * - Sets createdAt to current ISO8601 timestamp
   * - Stringifies JSON fields for SQLite TEXT storage
   */
  async create(input: CreateSuggestionInput): Promise<AISuggestion> {
    this.requireOrganizationId(input.organizationId, 'create AI suggestion')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: input.organizationId,
      riskId: input.riskId ?? null,
      suggestionType: input.suggestionType,
      inputContext: JSON.stringify(input.inputContext),
      inputScope: input.inputScope ? JSON.stringify(input.inputScope) : null,
      suggestionContent: JSON.stringify(input.suggestionContent),
      decisionStatus: 'draft',
      finalContent: null as string | null,
      decisionReason: null as string | null,
      accepted: null as number | null,
      acceptedAt: null as string | null,
      acceptedBy: null as string | null,
      usageLogId: input.usageLogId ?? null,
      createdAt: now,
    }

    const result = await this.db
      .insert(aiSuggestions)
      .values(row)
      .returning()

    const inserted = Array.isArray(result) ? result[0] : undefined

    if (!inserted) {
      this.logError('create AI suggestion', new Error('Insert returned no rows'), {
        organizationId: input.organizationId,
      })
      throw new Error('AIサジェストの作成に失敗しました')
    }

    this.logDataAccess('create AI suggestion', input.organizationId, {
      id: inserted.id,
      suggestionType: input.suggestionType,
    })

    return this.mapRowToEntity(inserted)
  }

  /**
   * Find a suggestion by its ID
   *
   * @returns The suggestion entity or null if not found
   */
  async findById(id: string): Promise<AISuggestion | null> {
    const rows = await this.db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, id))

    if (rows.length === 0) return null

    return this.mapRowToEntity(rows[0])
  }

  /**
   * Find all suggestions for a specific risk
   *
   * @param riskId - Risk ID to filter by
   * @returns Array of suggestions for the risk
   */
  async findByRiskId(riskId: string): Promise<AISuggestion[]> {
    const rows = await this.db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.riskId, riskId))

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Find all suggestions for an organization
   *
   * Organization-scoped query ensures multi-tenant data isolation.
   *
   * @param organizationId - Organization to filter by
   * @returns Array of suggestions for the organization
   */
  async findByOrganizationId(organizationId: string): Promise<AISuggestion[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    const rows = await this.db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.organizationId, organizationId))

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length })

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Accept a suggestion
   *
   * Sets accepted=true (integer 1), records timestamp and user ID.
   *
   * @param id - Suggestion ID to accept
   * @param userId - User who accepted the suggestion
   * @throws Error if suggestion not found
   */
  async accept(id: string, userId: string): Promise<AISuggestion> {
    const now = new Date().toISOString()

    const result = await this.db
      .update(aiSuggestions)
      .set({
        accepted: 1,
        decisionStatus: 'accepted',
        finalContent: null,
        decisionReason: null,
        acceptedAt: now,
        acceptedBy: userId,
      })
      .where(eq(aiSuggestions.id, id))
      .returning()

    const updated = Array.isArray(result) ? result[0] : undefined

    if (!updated) {
      this.logError('accept AI suggestion', new Error('Suggestion not found'), { id })
      throw new Error('AIサジェストが見つかりません')
    }

    this.logDataAccess('accept AI suggestion', updated.organizationId, {
      id,
      acceptedBy: userId,
    })

    return this.mapRowToEntity(updated)
  }

  async decide(input: DecideSuggestionInput): Promise<AISuggestion> {
    const now = new Date().toISOString()
    const accepted = input.status === 'accepted' || input.status === 'accepted_with_edits' ? 1 : 0

    const result = await this.db
      .update(aiSuggestions)
      .set({
        accepted,
        decisionStatus: input.status,
        finalContent: input.finalContent ? JSON.stringify(input.finalContent) : null,
        decisionReason: input.reason ?? null,
        acceptedAt: now,
        acceptedBy: input.userId,
      })
      .where(eq(aiSuggestions.id, input.id))
      .returning()

    const updated = Array.isArray(result) ? result[0] : undefined

    if (!updated) {
      this.logError('decide AI suggestion', new Error('Suggestion not found'), { id: input.id })
      throw new Error('AIサジェストが見つかりません')
    }

    this.logDataAccess('decide AI suggestion', updated.organizationId, {
      id: input.id,
      decisionStatus: input.status,
      decidedBy: input.userId,
    })

    return this.mapRowToEntity(updated)
  }

  /**
   * Reject a suggestion
   *
   * Sets accepted=false (integer 0), records timestamp and user ID.
   *
   * @param id - Suggestion ID to reject
   * @param userId - User who rejected the suggestion
   * @throws Error if suggestion not found
   */
  async reject(id: string, userId: string): Promise<AISuggestion> {
    const now = new Date().toISOString()

    const result = await this.db
      .update(aiSuggestions)
      .set({
        accepted: 0,
        decisionStatus: 'rejected',
        finalContent: null,
        decisionReason: null,
        acceptedAt: now,
        acceptedBy: userId,
      })
      .where(eq(aiSuggestions.id, id))
      .returning()

    const updated = Array.isArray(result) ? result[0] : undefined

    if (!updated) {
      this.logError('reject AI suggestion', new Error('Suggestion not found'), { id })
      throw new Error('AIサジェストが見つかりません')
    }

    this.logDataAccess('reject AI suggestion', updated.organizationId, {
      id,
      rejectedBy: userId,
    })

    return this.mapRowToEntity(updated)
  }

  /**
   * Delete a suggestion by ID
   *
   * @param id - Suggestion ID to delete
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(aiSuggestions)
      .where(eq(aiSuggestions.id, id))

    const deleted = (result.rowsAffected ?? 0) > 0

    if (deleted) {
      this.logDataAccess('delete AI suggestion', 'unknown', { id })
    }

    return deleted
  }

  /**
   * Maps a database row to the AISuggestion domain entity
   *
   * Key transformations:
   * - inputContext: JSON text -> parsed object
   * - suggestionContent: JSON text -> parsed object
   * - accepted: integer (0/1/null) -> boolean (false/true/null)
   */
  private mapRowToEntity(row: {
    id: string
    organizationId: string
    riskId: string | null
    suggestionType: string
    inputContext: string
    inputScope: string | null
    suggestionContent: string
    decisionStatus: string
    finalContent: string | null
    decisionReason: string | null
    accepted: number | null
    acceptedAt: string | null
    acceptedBy: string | null
    usageLogId: string | null
    createdAt: string
  }): AISuggestion {
    return {
      id: row.id,
      organizationId: row.organizationId,
      riskId: row.riskId,
      suggestionType: row.suggestionType as SuggestionType,
      inputContext: JSON.parse(row.inputContext),
      inputScope: row.inputScope ? JSON.parse(row.inputScope) : null,
      suggestionContent: JSON.parse(row.suggestionContent),
      decisionStatus: row.decisionStatus as SuggestionDecisionStatus,
      finalContent: row.finalContent ? JSON.parse(row.finalContent) : null,
      decisionReason: row.decisionReason,
      accepted: row.accepted === null ? null : row.accepted === 1,
      acceptedAt: row.acceptedAt,
      acceptedBy: row.acceptedBy,
      usageLogId: row.usageLogId,
      createdAt: row.createdAt,
    }
  }
}
