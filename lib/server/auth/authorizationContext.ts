import { and, eq } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  userDepartmentScopes,
  userMemberships,
  userProfiles,
  userRoleValues,
  type UserRole,
} from '@/lib/db/drizzle/schema'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'

export interface TenantAuthorizationContext {
  userId: string
  organizationId: string
  role: UserRole
  departmentAccess:
    | { mode: 'all' }
    | { mode: 'scoped'; departmentIds: string[]; includeUnassigned: true }
}

export type TenantAuthorizationDenial =
  | 'profile_not_found'
  | 'profile_inactive'
  | 'membership_not_found'
  | 'membership_inactive'
  | 'membership_role_invalid'

export type TenantAuthorizationResult =
  | { ok: true; context: TenantAuthorizationContext }
  | { ok: false; reason: TenantAuthorizationDenial }

function isUserRole(role: string): role is UserRole {
  return (userRoleValues as readonly string[]).includes(role)
}

export async function resolveTenantAuthorizationContext(
  db: ReturnType<typeof getDb>,
  userId: string,
  organizationId: string
): Promise<TenantAuthorizationResult> {
  const [profile] = await db
    .select({ isActive: userProfiles.isActive })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!profile) {
    return { ok: false, reason: 'profile_not_found' }
  }
  if (profile.isActive !== true) {
    return { ok: false, reason: 'profile_inactive' }
  }

  const [membership] = await db
    .select({
      role: userMemberships.role,
      status: userMemberships.status,
      departmentScope: userMemberships.departmentScope,
    })
    .from(userMemberships)
    .where(and(
      eq(userMemberships.userId, userId),
      eq(userMemberships.organizationId, organizationId)
    ))
    .limit(1)

  if (!membership) {
    return { ok: false, reason: 'membership_not_found' }
  }
  if (membership.status !== 'active') {
    return { ok: false, reason: 'membership_inactive' }
  }
  if (!isUserRole(membership.role)) {
    return { ok: false, reason: 'membership_role_invalid' }
  }

  const baseContext = {
    userId,
    organizationId,
    role: membership.role,
  }

  if (hasFullDepartmentAccess(membership.role) || membership.departmentScope === 'all') {
    return {
      ok: true,
      context: {
        ...baseContext,
        departmentAccess: { mode: 'all' },
      },
    }
  }

  const departmentScopes = await db
    .select({ departmentId: userDepartmentScopes.departmentId })
    .from(userDepartmentScopes)
    .where(and(
      eq(userDepartmentScopes.userId, userId),
      eq(userDepartmentScopes.organizationId, organizationId)
    ))

  return {
    ok: true,
    context: {
      ...baseContext,
      departmentAccess: {
        mode: 'scoped',
        departmentIds: [...new Set(departmentScopes.map(scope => scope.departmentId))],
        includeUnassigned: true,
      },
    },
  }
}
