/**
 * Tenant Soft Delete Utilities
 *
 * This module provides pure functions for tenant (organization) soft delete operations.
 * All functions are side-effect free and can be unit tested in isolation.
 *
 * Key Design Decisions:
 * - Organizations are never physically deleted; `deleted_at` timestamp is set instead
 * - Deleted organizations are excluded from normal listings but remain in the database
 * - All delete/restore operations are logged to audit_logs with scope: 'global'
 */

/**
 * Organization type with soft delete support
 */
export type Organization = {
  id: string
  name: string
  deleted_at: string | null | undefined
  [key: string]: unknown
}

/**
 * Payload for soft delete operation
 */
export type SoftDeletePayload = {
  organizationId: string
  deleted_at: string | null
}

/**
 * Audit log entry for tenant operations
 */
export type AuditLogEntry = {
  action: string
  organization_id: string
  user_id: string
  resource_type: 'organization'
  resource_id: string
  scope: 'global'
  changes: Record<string, unknown>
}

/**
 * Parameters for building audit log entries
 */
export type AuditLogParams = {
  action: 'soft_delete' | 'restore'
  organizationId: string
  userId: string
  reason?: string
}

/**
 * Check if an organization is soft-deleted
 *
 * @param org - Organization object to check
 * @returns true if deleted_at is a non-empty string, false otherwise
 */
export function isOrganizationDeleted(org: Organization): boolean {
  return typeof org.deleted_at === 'string' && org.deleted_at.length > 0
}

/**
 * Filter out soft-deleted organizations from a list
 *
 * @param organizations - Array of organizations to filter
 * @returns New array containing only active (non-deleted) organizations
 */
export function filterActiveOrganizations<T extends Organization>(organizations: T[]): T[] {
  return organizations.filter((org) => !isOrganizationDeleted(org))
}

/**
 * Build payload for soft delete operation
 *
 * @param organizationId - ID of the organization to delete
 * @param now - Optional timestamp to use (defaults to current time)
 * @returns Payload object with deleted_at set to ISO timestamp
 */
export function buildSoftDeletePayload(organizationId: string, now?: Date): SoftDeletePayload {
  const timestamp = (now ?? new Date()).toISOString()
  return {
    organizationId,
    deleted_at: timestamp
  }
}

/**
 * Build payload for restore operation
 *
 * @param organizationId - ID of the organization to restore
 * @returns Payload object with deleted_at set to null
 */
export function buildRestorePayload(organizationId: string): SoftDeletePayload {
  return {
    organizationId,
    deleted_at: null
  }
}

/**
 * Build audit log entry for tenant soft delete or restore operation
 *
 * @param params - Parameters for the audit log entry
 * @returns Audit log entry object ready for database insertion
 */
export function buildAuditLogEntry(params: AuditLogParams): AuditLogEntry {
  const { action, organizationId, userId, reason } = params

  const actionName = action === 'soft_delete' ? 'tenant.soft_delete' : 'tenant.restore'

  const changes: Record<string, unknown> = {
    deleted_at: action === 'soft_delete' ? new Date().toISOString() : null
  }

  if (reason) {
    changes.reason = reason
  }

  return {
    action: actionName,
    organization_id: organizationId,
    user_id: userId,
    resource_type: 'organization',
    resource_id: organizationId,
    scope: 'global',
    changes
  }
}
