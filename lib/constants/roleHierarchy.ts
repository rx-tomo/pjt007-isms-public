/**
 * Role hierarchy for the Riscala AI for ISMS application.
 *
 * Each key lists the roles it is allowed to manage (invite, edit, deactivate).
 * Roles that are *not* listed as values cannot be managed by that actor.
 */
export const ROLE_HIERARCHY: Record<string, string[]> = {
  super_admin: ['system_operator', 'org_admin', 'auditor', 'approver', 'user'],
  system_operator: ['org_admin', 'auditor', 'approver', 'user'],
  org_admin: ['auditor', 'approver', 'user'],
  auditor: [],
  approver: [],
  user: [],
}

/**
 * Roles that are considered "admin" for page-level access checks.
 */
export const ADMIN_ROLES = ['org_admin', 'system_operator', 'super_admin'] as const

/**
 * Returns true when `actorRole` is allowed to manage (create / edit / deactivate)
 * a user who holds `targetRole`.
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  return ROLE_HIERARCHY[actorRole]?.includes(targetRole) ?? false
}
