import type { ProjectAssignmentDetails, ProjectRole } from '@/lib/services/organization'

export interface ProjectStructureSummary {
  requiredCount: number
  satisfiedRequiredRoles: number
  optionalRoleCount: number
  optionalRolesWithAssignments: number
  totalAssignments: number
  completionRatio: number
  isComplete: boolean
}

function hasAssignmentForRole(assignments: ProjectAssignmentDetails[], roleId: string): boolean {
  return assignments.some(assignment => assignment.role_id === roleId && (assignment.user_id || assignment.invitation_id))
}

export function calculateProjectStructureSummary(
  roles: ProjectRole[],
  assignments: ProjectAssignmentDetails[]
): ProjectStructureSummary {
  const requiredRoles = roles.filter(role => role.is_required)
  const optionalRoles = roles.filter(role => !role.is_required)

  const satisfiedRequiredRoles = requiredRoles.filter(role => hasAssignmentForRole(assignments, role.id)).length
  const optionalRolesWithAssignments = optionalRoles.filter(role => hasAssignmentForRole(assignments, role.id)).length

  const totalAssignments = assignments.reduce((acc, assignment) => {
    if (assignment.user_id || assignment.invitation_id) {
      return acc + 1
    }
    return acc
  }, 0)

  const completionRatio = requiredRoles.length
    ? Math.round((satisfiedRequiredRoles / requiredRoles.length) * 100)
    : totalAssignments > 0
      ? 100
      : 0

  const isComplete = requiredRoles.length
    ? satisfiedRequiredRoles === requiredRoles.length
    : totalAssignments > 0

  return {
    requiredCount: requiredRoles.length,
    satisfiedRequiredRoles,
    optionalRoleCount: optionalRoles.length,
    optionalRolesWithAssignments,
    totalAssignments,
    completionRatio,
    isComplete
  }
}
