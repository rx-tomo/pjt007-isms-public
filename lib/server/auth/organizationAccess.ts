/**
 * Organization Access Helper
 *
 * Resolves whether a user belongs to an organization via the user profile
 * or an active membership. Used by API routes for tenant isolation checks.
 */

import { and, eq } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema'

export interface OrganizationAccess {
  hasAccess: boolean
  role: string | null
}

export async function getOrganizationAccess(
  db: ReturnType<typeof getDb>,
  userId: string,
  organizationId: string
): Promise<OrganizationAccess> {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({
        id: userMemberships.id,
        role: userMemberships.role,
      })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  const profileAccess = profile?.organizationId === organizationId
  const membershipAccess = Boolean(membership)
  const role = membership?.role ?? (profileAccess ? profile?.role ?? null : null)

  return {
    hasAccess: profileAccess || membershipAccess,
    role,
  }
}
