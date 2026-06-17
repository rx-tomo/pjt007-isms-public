/**
 * SQLite Audit Log Repository
 *
 * Implements IAuditLogRepository using Drizzle ORM with SQLite.
 * Handles audit log operations for compliance and security with
 * organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - Stores JSON `changes` field as stringified text
 * - Date range filtering uses ISO8601 string comparison
 * - Organization-scoped queries enforce multi-tenant isolation
 *
 * @module lib/db/repositories/sqlite/AuditLogRepository
 */

import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import type {
  IAuditLogRepository,
  AuditLog,
  AuditLogParams
} from '../interfaces/IAuditLogRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteAuditLogRepository extends BaseSQLiteRepository implements IAuditLogRepository {
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
   * Log an action
   *
   * - Generates a unique UUID
   * - Sets createdAt to current ISO8601 timestamp
   * - Stringifies JSON changes field for SQLite TEXT storage
   */
  async log(params: AuditLogParams): Promise<void> {
    this.requireOrganizationId(params.organizationId, 'log audit entry')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: params.organizationId,
      userId: params.userId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      changes: params.changes != null ? JSON.stringify(params.changes) : null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      scope: 'tenant' as const,
      createdAt: now,
    }

    await this.db.insert(auditLogs).values(row)

    this.logDataAccess('log audit entry', params.organizationId, {
      id,
      action: params.action,
      resourceType: params.resourceType,
    })
  }

  /**
   * Get audit logs for an organization
   *
   * Supports filtering by resourceType, action, userId, and date range.
   * Results are ordered by createdAt descending (newest first).
   *
   * @param organizationId - Organization to filter by
   * @param options - Optional filters for limit, offset, resourceType, action, userId, startDate, endDate
   */
  async getByOrganizationId(
    organizationId: string,
    options?: {
      limit?: number
      offset?: number
      resourceType?: string
      action?: string
      userId?: string
      startDate?: Date
      endDate?: Date
    }
  ): Promise<AuditLog[]> {
    this.requireOrganizationId(organizationId, 'getByOrganizationId')

    // Build conditions array
    const conditions = [eq(auditLogs.organizationId, organizationId)]

    if (options?.resourceType) {
      conditions.push(eq(auditLogs.resourceType, options.resourceType))
    }

    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action))
    }

    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId))
    }

    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate.toISOString()))
    }

    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate.toISOString()))
    }

    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    this.logDataAccess('getByOrganizationId', organizationId, {
      count: rows.length,
      limit,
      offset,
    })

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Get audit logs for a specific resource
   *
   * @param resourceType - Type of the resource
   * @param resourceId - ID of the resource
   * @returns Array of audit logs for the resource, ordered by createdAt desc
   */
  async getByResourceId(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceType, resourceType),
          eq(auditLogs.resourceId, resourceId)
        )
      )
      .orderBy(sql`${auditLogs.createdAt} DESC`)

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Maps a database row to the AuditLog domain entity
   *
   * Key transformations:
   * - changes: JSON text -> parsed object (or null)
   * - ip_address: mapped to unknown type for legacy compatibility
   * - snake_case column names are handled by Drizzle's camelCase mapping
   *
   * The returned type must match Database['public']['Tables']['audit_logs']['Row']
   */
  private mapRowToEntity(row: {
    id: string
    organizationId: string
    userId: string | null
    action: string
    resourceType: string
    resourceId: string | null
    changes: string | null
    ipAddress: string | null
    userAgent: string | null
    scope: string
    createdAt: string | null
  }): AuditLog {
    let parsedChanges = null
    if (row.changes) {
      try {
        parsedChanges = JSON.parse(row.changes)
      } catch {
        parsedChanges = row.changes
      }
    }

    return {
      id: row.id,
      organization_id: row.organizationId,
      user_id: row.userId,
      action: row.action,
      resource_type: row.resourceType,
      resource_id: row.resourceId,
      changes: parsedChanges,
      ip_address: row.ipAddress as unknown,
      user_agent: row.userAgent,
      scope: row.scope,
      created_at: row.createdAt,
    }
  }
}
