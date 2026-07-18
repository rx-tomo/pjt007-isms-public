import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  incidents,
  organizationDepartments,
} from '@/lib/db/drizzle/schema'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
} from '@/lib/server/auth/authorizationContext'

type IncidentDb = ReturnType<typeof getDb>

async function resolveAuthorization(
  db: IncidentDb,
  userId: string,
  organizationId: string | null
): Promise<TenantAuthorizationContext | null> {
  if (!organizationId) return null
  const authorization = await resolveTenantAuthorizationContext(db, userId, organizationId)
  return authorization.ok ? authorization.context : null
}

export async function resolveIncidentCreateAuthorization(
  db: IncidentDb,
  userId: string,
  departmentId: string
): Promise<TenantAuthorizationContext | null> {
  const [department] = await db
    .select({ organizationId: organizationDepartments.organizationId })
    .from(organizationDepartments)
    .where(eq(organizationDepartments.id, departmentId))
    .limit(1)

  return resolveAuthorization(db, userId, department?.organizationId ?? null)
}

export async function resolveIncidentTargetAuthorization(
  db: IncidentDb,
  userId: string,
  incidentId: string
): Promise<TenantAuthorizationContext | null> {
  const [incident] = await db
    .select({ organizationId: incidents.organizationId })
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1)

  return resolveAuthorization(db, userId, incident?.organizationId ?? null)
}
