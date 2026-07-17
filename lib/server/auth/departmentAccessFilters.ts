import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'

export interface DepartmentAccessFilter {
  departmentId?: string | null
  departmentIds?: string[]
  includeNoDepartment?: boolean
}

type DepartmentAccess = TenantAuthorizationContext['departmentAccess']

export function applyDepartmentAccessFilters<T extends DepartmentAccessFilter>(
  clientFilters: T | undefined,
  departmentAccess: DepartmentAccess
): T & DepartmentAccessFilter {
  if (departmentAccess.mode === 'all') {
    return { ...(clientFilters ?? {}) } as T & DepartmentAccessFilter
  }

  const {
    departmentId,
    departmentIds,
    includeNoDepartment,
    ...otherFilters
  } = clientFilters ?? ({} as T)
  const clientSpecifiedDepartment = departmentIds !== undefined
    || departmentId !== undefined
    || includeNoDepartment === true
  const requestedDepartmentIds = [
    ...(departmentIds ?? []),
    ...(typeof departmentId === 'string' && departmentId !== DEPARTMENT_UNASSIGNED_VALUE
      ? [departmentId]
      : []),
  ]
  const allowedDepartmentIds = new Set(departmentAccess.departmentIds)
  const effectiveDepartmentIds = clientSpecifiedDepartment
    ? requestedDepartmentIds.filter((id, index, values) => (
        allowedDepartmentIds.has(id) && values.indexOf(id) === index
      ))
    : departmentAccess.departmentIds.filter((id, index, values) => values.indexOf(id) === index)

  return {
    ...otherFilters,
    departmentIds: effectiveDepartmentIds,
    includeNoDepartment: departmentAccess.includeUnassigned,
  } as T & DepartmentAccessFilter
}
