import type { Database, Json } from '@/types/database.types'

// Database types
type AuditLog = Database['public']['Tables']['audit_logs']['Row']
type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']

export type { AuditLog, AuditLogInsert }

/**
 * Audit log entry parameters
 */
export interface AuditLogParams {
  organizationId: string
  userId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  changes?: Json | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Audit Log Repository Interface
 *
 * Handles audit log operations for compliance and security
 */
export interface IAuditLogRepository {
  /**
   * Log an action
   */
  log(params: AuditLogParams): Promise<void>

  /**
   * Get audit logs for an organization
   */
  getByOrganizationId(
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
  ): Promise<AuditLog[]>

  /**
   * Get audit logs for a specific resource
   */
  getByResourceId(resourceType: string, resourceId: string): Promise<AuditLog[]>
}
