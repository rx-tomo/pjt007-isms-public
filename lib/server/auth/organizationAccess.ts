/**
 * Organization Access Helper
 *
 * Compatibility adapter for callers that only need hasAccess and role.
 */

import type { getDb } from '@/lib/db/drizzle/client'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'

export interface OrganizationAccess {
  hasAccess: boolean
  role: string | null
}

export async function getOrganizationAccess(
  db: ReturnType<typeof getDb>,
  userId: string,
  organizationId: string
): Promise<OrganizationAccess> {
  const result = await resolveTenantAuthorizationContext(db, userId, organizationId)

  if (!result.ok) {
    return { hasAccess: false, role: null }
  }

  return { hasAccess: true, role: result.context.role }
}
