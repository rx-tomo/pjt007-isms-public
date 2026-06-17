import type { UserRole } from '@/lib/services/user'

const TASK_AUTHOR_ROLES: UserRole[] = ['system_operator', 'org_admin', 'approver']
const TASK_PROGRESS_ROLES: UserRole[] = ['system_operator', 'org_admin', 'approver', 'user']

export function canCreateTask(role?: string | null): boolean {
  return typeof role === 'string' && TASK_AUTHOR_ROLES.includes(role as UserRole)
}

export function canEditTask(role?: string | null): boolean {
  return typeof role === 'string' && TASK_AUTHOR_ROLES.includes(role as UserRole)
}

export function canUpdateTaskProgress(role?: string | null): boolean {
  return typeof role === 'string' && TASK_PROGRESS_ROLES.includes(role as UserRole)
}
