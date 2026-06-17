import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations, userMemberships } from '@/lib/db/drizzle/schema'
import { desc, eq, sql } from 'drizzle-orm'
import type { RoleScenarioOrganization } from '@/lib/dev-login/scenarios'
import { isDevApiAvailable } from '@/lib/dev-login/availability'

const MAX_ORGANIZATION_RESULTS = 100

type OrganizationSummary = RoleScenarioOrganization & {
  updatedAt: string | null
  ismsPhase: string | null
  employeeCountRange: string | null
  industry: string | null
  isoCertificationStatus: string | null
  userCount: number
}

export async function GET() {
  if (!isDevApiAvailable()) {
    return NextResponse.json({ error: 'Dev organizations API is disabled in production.' }, { status: 403 })
  }

  try {
    const db = getDb()

    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        employeeCountRange: organizations.employeeCountRange,
        industry: organizations.industry,
        isoCertificationStatus: organizations.isoCertificationStatus,
        ismsPhase: organizations.ismsPhase,
        updatedAt: organizations.updatedAt,
        userCount: sql<number>`count(${userMemberships.id})`,
      })
      .from(organizations)
      .leftJoin(userMemberships, eq(userMemberships.organizationId, organizations.id))
      .groupBy(organizations.id)
      .orderBy(desc(organizations.updatedAt))
      .limit(MAX_ORGANIZATION_RESULTS)

    const orgs: OrganizationSummary[] = rows.map(row => ({
      id: row.id,
      name: row.name ?? `Tenant ${row.id.slice(0, 8)}`,
      plan: (row.subscriptionPlan ?? 'starter') as RoleScenarioOrganization['plan'],
      status: (row.subscriptionStatus ?? 'active') as RoleScenarioOrganization['status'],
      updatedAt: row.updatedAt ?? null,
      employeeCountRange: row.employeeCountRange ?? null,
      industry: row.industry ?? null,
      isoCertificationStatus: row.isoCertificationStatus ?? null,
      ismsPhase: row.ismsPhase ?? null,
      userCount: Number(row.userCount ?? 0)
    }))

    return NextResponse.json({ organizations: orgs })
  } catch (error) {
    console.error('[DevOrganizations] failed to list tenants', error)
    return NextResponse.json({ error: 'Failed to load tenant list' }, { status: 500 })
  }
}
