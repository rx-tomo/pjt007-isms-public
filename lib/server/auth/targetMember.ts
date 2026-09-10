import { and, eq } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  userMemberships,
  userProfiles,
  userRoleValues,
  type UserRole,
} from '@/lib/db/drizzle/schema/users'

type TargetMemberDb = Pick<ReturnType<typeof getDb>, 'select'>

export interface ActiveTenantMember {
  userId: string
  organizationId: string
  role: UserRole
}

export class TargetMemberNotFoundError extends Error {
  readonly status = 404

  constructor() {
    super('Member not found')
    this.name = 'TargetMemberNotFoundError'
  }
}

function isUserRole(value: string): value is UserRole {
  return value !== 'super_admin'
    && (userRoleValues as readonly string[]).includes(value)
}

export async function resolveActiveTenantMember(
  db: TargetMemberDb,
  organizationId: string,
  userId: string
): Promise<ActiveTenantMember | null> {
  const [row] = await db
    .select({
      userId: userMemberships.userId,
      organizationId: userMemberships.organizationId,
      role: userMemberships.role,
      membershipStatus: userMemberships.status,
      profileActive: userProfiles.isActive,
    })
    .from(userMemberships)
    .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
    .where(and(
      eq(userMemberships.userId, userId),
      eq(userMemberships.organizationId, organizationId)
    ))
    .limit(1)

  if (
    !row
    || row.membershipStatus !== 'active'
    || row.profileActive !== true
    || !isUserRole(row.role)
  ) {
    return null
  }

  return {
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
  }
}

export async function resolveActiveTenantMemberByEmail(
  db: TargetMemberDb,
  organizationId: string,
  email: string
): Promise<ActiveTenantMember | null> {
  const rows = await db
    .select({
      userId: userMemberships.userId,
      organizationId: userMemberships.organizationId,
      role: userMemberships.role,
      membershipStatus: userMemberships.status,
      profileActive: userProfiles.isActive,
    })
    .from(userMemberships)
    .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
    .where(and(
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active'),
      eq(userProfiles.email, email),
      eq(userProfiles.isActive, true)
    ))

  if (rows.length !== 1 || !isUserRole(rows[0].role)) {
    return null
  }

  return {
    userId: rows[0].userId,
    organizationId: rows[0].organizationId,
    role: rows[0].role,
  }
}

export async function assertActiveTenantMember(
  db: TargetMemberDb,
  organizationId: string,
  userId: string
): Promise<ActiveTenantMember> {
  const member = await resolveActiveTenantMember(db, organizationId, userId)
  if (!member) throw new TargetMemberNotFoundError()
  return member
}

export function isTargetMemberNotFoundError(
  error: unknown
): error is TargetMemberNotFoundError {
  return error instanceof TargetMemberNotFoundError
}
