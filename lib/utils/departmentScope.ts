import { DEPARTMENT_UNASSIGNED_VALUE } from '../constants/departments'
import type { UserRole } from '../types/user-role'

const FULL_ACCESS_ROLES: UserRole[] = ['super_admin', 'system_operator', 'org_admin', 'auditor']

export type DepartmentScopeReason = 'role_limited' | 'missing_department' | null

export interface DepartmentScopeEvaluation {
  enforcedFilterValue: string | typeof DEPARTMENT_UNASSIGNED_VALUE | null
  reason: DepartmentScopeReason
}

interface EvaluateDepartmentScopeParams {
  role?: UserRole | null
  departmentName?: string | null
  departmentNameToId: Map<string, string>
}

export function hasFullDepartmentAccess(role?: UserRole | null): boolean {
  if (!role) return false
  return FULL_ACCESS_ROLES.includes(role)
}

export function evaluateDepartmentScope({
  role,
  departmentName,
  departmentNameToId
}: EvaluateDepartmentScopeParams): DepartmentScopeEvaluation {
  if (!role || hasFullDepartmentAccess(role)) {
    return { enforcedFilterValue: null, reason: null }
  }

  const normalized = departmentName?.trim()
  if (!normalized) {
    return { enforcedFilterValue: DEPARTMENT_UNASSIGNED_VALUE, reason: 'missing_department' }
  }

  const departmentId = departmentNameToId.get(normalized)
  if (departmentId) {
    return { enforcedFilterValue: departmentId, reason: 'role_limited' }
  }

  // Fallback: use the raw department name so comparisons downstream still work
  return { enforcedFilterValue: normalized, reason: 'role_limited' }
}
