/**
 * Base SQLite Repository
 *
 * CRITICAL SECURITY NOTE:
 * SQLite does not support Row Level Security (RLS) like PostgreSQL.
 * ALL queries MUST include organization_id filtering to prevent data leakage
 * between tenants.
 *
 * This base class provides helper methods to enforce organization-scoped queries.
 */

import { getDb, type DrizzleDb } from '@/lib/db/drizzle/client'
import { logger } from '@/lib/logger'

/**
 * Security error thrown when organization_id is not provided
 */
export class OrganizationScopeError extends Error {
  constructor(operation: string) {
    super(`Organization ID is required for ${operation}. SQLite does not support RLS - all queries must be organization-scoped.`)
    this.name = 'OrganizationScopeError'
  }
}

/**
 * Base class for SQLite repositories
 *
 * Provides security enforcement for multi-tenant data isolation.
 */
export abstract class BaseSQLiteRepository {
  protected db: DrizzleDb

  constructor() {
    this.db = getDb()
  }

  /**
   * Validates that organization_id is provided.
   * Call this at the start of any method that accesses organization-scoped data.
   *
   * @throws OrganizationScopeError if organizationId is not provided
   */
  protected requireOrganizationId(organizationId: string | undefined | null, operation: string): asserts organizationId is string {
    if (!organizationId) {
      throw new OrganizationScopeError(operation)
    }
  }

  /**
   * Logs a data access operation for security audit.
   */
  protected logDataAccess(operation: string, organizationId: string, details?: Record<string, unknown>): void {
    logger.debug(`[SQLite] ${operation}`, { organizationId, ...details })
  }

  /**
   * Logs an error with context
   */
  protected logError(operation: string, error: unknown, context?: Record<string, unknown>): void {
    logger.error(`[SQLite] ${operation} failed`, {
      error: error instanceof Error ? error.message : String(error),
      ...context
    })
  }
}
