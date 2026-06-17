export const DEPARTMENT_UNASSIGNED_VALUE = '__unassigned__' as const

export type DepartmentFilterValue = typeof DEPARTMENT_UNASSIGNED_VALUE | string
