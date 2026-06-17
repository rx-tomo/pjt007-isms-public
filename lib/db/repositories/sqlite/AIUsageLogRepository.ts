/**
 * SQLite AI Usage Log Repository
 *
 * Implements IAIUsageLogRepository using Drizzle ORM with SQLite.
 * Handles token usage tracking for AI API calls with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - Converts boolean `cached` to integer (0/1) for SQLite storage
 * - Date range filtering uses ISO8601 string comparison
 * - Organization-scoped queries enforce multi-tenant isolation
 *
 * @module lib/db/repositories/sqlite/AIUsageLogRepository
 */

import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import { aiUsageLogs } from '@/lib/db/drizzle/schema/ai'
import type {
  IAIUsageLogRepository,
  AIUsageLog,
  CreateUsageLogInput,
  UsageStatistics,
  RequestType,
} from '../interfaces/IAIUsageLogRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteAIUsageLogRepository extends BaseSQLiteRepository implements IAIUsageLogRepository {
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
   * Create a new AI usage log entry
   *
   * - Generates a unique UUID
   * - Sets createdAt to current ISO8601 timestamp
   * - Converts cached boolean to integer (1/0) for SQLite
   */
  async create(input: CreateUsageLogInput): Promise<AIUsageLog> {
    this.requireOrganizationId(input.organizationId, 'create AI usage log')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      provider: input.provider,
      providerMode: input.providerMode ?? 'mock',
      modelLabel: input.modelLabel ?? null,
      requestType: input.requestType,
      status: input.status ?? (input.errorMessage ? 'failed' : 'succeeded'),
      inputScope: input.inputScope ? JSON.stringify(input.inputScope) : null,
      targetRecords: input.targetRecords ? JSON.stringify(input.targetRecords) : null,
      redactionSummary: input.redactionSummary ? JSON.stringify(input.redactionSummary) : null,
      startedAt: input.startedAt ?? now,
      completedAt: input.completedAt ?? now,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      cached: input.cached ? 1 : 0,
      latencyMs: input.latencyMs ?? null,
      errorMessage: input.errorMessage ?? null,
      createdAt: now,
    }

    await this.db.insert(aiUsageLogs).values(row)

    this.logDataAccess('create AI usage log', input.organizationId, { id, provider: input.provider })

    return this.mapRowToEntity(row)
  }

  /**
   * Find a usage log by its ID
   *
   * @returns The usage log entity or null if not found
   */
  async findById(id: string): Promise<AIUsageLog | null> {
    const rows = await this.db
      .select()
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.id, id))

    if (rows.length === 0) return null

    return this.mapRowToEntity(rows[0])
  }

  /**
   * Find all usage logs for an organization
   *
   * Results are ordered by createdAt descending (newest first).
   * @param organizationId - Organization to filter by
   * @param limit - Maximum number of records (default: 100)
   */
  async findByOrganizationId(organizationId: string, limit: number = 100): Promise<AIUsageLog[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    const rows = await this.db
      .select()
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.organizationId, organizationId))
      .orderBy(sql`${aiUsageLogs.createdAt} DESC`)
      .limit(limit)

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length, limit })

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Find all usage logs for a specific user
   *
   * @param userId - User ID to filter by
   */
  async findByUserId(userId: string): Promise<AIUsageLog[]> {
    const rows = await this.db
      .select()
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, userId))

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Get usage statistics for an organization within a date range
   *
   * Calculates aggregate metrics:
   * - totalRequests: count of all requests
   * - totalTokens: sum of all token usage
   * - promptTokens: sum of prompt tokens
   * - completionTokens: sum of completion tokens
   * - cachedRequests: count of cached responses
   * - errorCount: count of requests with errors
   *
   * @param organizationId - Organization to filter by
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   */
  async getStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageStatistics> {
    this.requireOrganizationId(organizationId, 'getStatistics')

    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()

    const result = await this.db
      .select({
        totalRequests: sql<number>`COUNT(*)`,
        totalTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)`,
        promptTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)`,
        completionTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)`,
        cachedRequests: sql<number>`COALESCE(SUM(CASE WHEN ${aiUsageLogs.cached} = 1 THEN 1 ELSE 0 END), 0)`,
        errorCount: sql<number>`COALESCE(SUM(CASE WHEN ${aiUsageLogs.errorMessage} IS NOT NULL THEN 1 ELSE 0 END), 0)`,
      })
      .from(aiUsageLogs)
      .where(
        and(
          eq(aiUsageLogs.organizationId, organizationId),
          gte(aiUsageLogs.createdAt, startIso),
          lte(aiUsageLogs.createdAt, endIso)
        )
      )

    const stats = result[0]

    this.logDataAccess('getStatistics', organizationId, {
      startDate: startIso,
      endDate: endIso,
      totalRequests: stats?.totalRequests ?? 0,
    })

    return {
      totalRequests: Number(stats?.totalRequests ?? 0),
      totalTokens: Number(stats?.totalTokens ?? 0),
      promptTokens: Number(stats?.promptTokens ?? 0),
      completionTokens: Number(stats?.completionTokens ?? 0),
      cachedRequests: Number(stats?.cachedRequests ?? 0),
      errorCount: Number(stats?.errorCount ?? 0),
    }
  }

  /**
   * Maps a database row to the AIUsageLog domain entity
   *
   * Key transformations:
   * - cached: integer (0/1/null) -> boolean | null
   * - snake_case column names are handled by Drizzle's camelCase mapping
   */
  private mapRowToEntity(row: {
    id: string
    organizationId: string
    userId: string | null
    provider: string
    providerMode: string
    modelLabel: string | null
    requestType: string
    status: string
    inputScope: string | null
    targetRecords: string | null
    redactionSummary: string | null
    startedAt: string | null
    completedAt: string | null
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cached: number | null
    latencyMs: number | null
    errorMessage: string | null
    createdAt: string
  }): AIUsageLog {
    return {
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      provider: row.provider,
      providerMode: row.providerMode,
      modelLabel: row.modelLabel,
      requestType: row.requestType as RequestType,
      status: row.status as AIUsageLog['status'],
      inputScope: row.inputScope ? JSON.parse(row.inputScope) : null,
      targetRecords: row.targetRecords ? JSON.parse(row.targetRecords) : null,
      redactionSummary: row.redactionSummary ? JSON.parse(row.redactionSummary) : null,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      cached: row.cached === null ? null : row.cached === 1,
      latencyMs: row.latencyMs,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    }
  }
}
