import { NextResponse } from 'next/server'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { getUser } from '@/lib/server/auth/getUser'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema/users'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'

const TENANT_ROLES = [
  'system_operator',
  'org_admin',
  'auditor',
  'approver',
  'user',
] as const

function serializeOrganization(row: {
  id: string
  name: string
  nameEn: string | null
  subscriptionPlan: string | null
  subscriptionStatus: string | null
  employeeCountRange: string | null
  industry: string | null
  isoCertificationStatus: string | null
  trialEndsAt: string | null
  ismsPhase: string | null
  ismsPhaseSetAt: string | null
  createdAt: string | null
  updatedAt: string | null
}) {
  return {
    id: row.id,
    name: row.name,
    name_en: row.nameEn,
    subscription_plan: row.subscriptionPlan,
    subscription_status: row.subscriptionStatus,
    employee_count_range: row.employeeCountRange,
    industry: row.industry,
    iso_certification_status: row.isoCertificationStatus,
    trial_ends_at: row.trialEndsAt,
    isms_phase: row.ismsPhase,
    isms_phase_set_at: row.ismsPhaseSetAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const db = getDb()

    const profileRows = await db
      .select({
        organizationId: userProfiles.organizationId,
        isActive: userProfiles.isActive,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    const profile = profileRows[0]
    if (!profile?.organizationId || profile.isActive !== true) {
      return NextResponse.json({ error: 'organization not found' }, { status: 404 })
    }

    const accessibleOrgRows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        nameEn: organizations.nameEn,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        employeeCountRange: organizations.employeeCountRange,
        industry: organizations.industry,
        isoCertificationStatus: organizations.isoCertificationStatus,
        trialEndsAt: organizations.trialEndsAt,
        ismsPhase: organizations.ismsPhase,
        ismsPhaseSetAt: organizations.ismsPhaseSetAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(userMemberships)
      .innerJoin(organizations, eq(userMemberships.organizationId, organizations.id))
      .where(and(
        eq(userMemberships.userId, user.id),
        eq(userMemberships.status, 'active'),
        inArray(userMemberships.role, TENANT_ROLES),
        isNull(organizations.deletedAt)
      ))
      .orderBy(asc(organizations.name))

    const orgRows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        nameEn: organizations.nameEn,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        employeeCountRange: organizations.employeeCountRange,
        industry: organizations.industry,
        isoCertificationStatus: organizations.isoCertificationStatus,
        trialEndsAt: organizations.trialEndsAt,
        ismsPhase: organizations.ismsPhase,
        ismsPhaseSetAt: organizations.ismsPhaseSetAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(userMemberships)
      .innerJoin(organizations, eq(userMemberships.organizationId, organizations.id))
      .where(and(
        eq(userMemberships.userId, user.id),
        eq(userMemberships.organizationId, profile.organizationId),
        eq(userMemberships.status, 'active'),
        inArray(userMemberships.role, TENANT_ROLES),
        eq(organizations.id, profile.organizationId),
        isNull(organizations.deletedAt)
      ))
      .limit(1)

    const row = orgRows[0]
    if (!row) {
      return NextResponse.json({ error: 'organization not found' }, { status: 404 })
    }

    const authorization = await resolveTenantAuthorizationContext(
      db,
      user.id,
      profile.organizationId
    )
    if (!authorization.ok || authorization.context.role === 'super_admin') {
      return NextResponse.json({ error: 'organization not found' }, { status: 404 })
    }

    return NextResponse.json({
      organization: serializeOrganization(row),
      organizations: accessibleOrgRows.map(serializeOrganization),
    })
  } catch (error) {
    console.error('[Auth/Organization] failed to resolve current organization', error)
    return NextResponse.json({ error: 'failed to resolve organization' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { organizationId?: unknown }
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const db = getDb()
    const authorization = await resolveTenantAuthorizationContext(
      db,
      user.id,
      organizationId
    )
    if (!authorization.ok || authorization.context.role !== 'system_operator') {
      return NextResponse.json({ error: 'organization switch is restricted to system operators' }, { status: 403 })
    }

    const membershipRows = await db
      .select({ id: userMemberships.id, role: userMemberships.role })
      .from(userMemberships)
      .innerJoin(organizations, eq(userMemberships.organizationId, organizations.id))
      .where(and(
        eq(userMemberships.userId, user.id),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active'),
        isNull(organizations.deletedAt)
      ))
      .limit(1)

    const membership = membershipRows[0]
    if (!membership || membership.role !== 'system_operator') {
      return NextResponse.json({ error: 'organization is not accessible' }, { status: 403 })
    }

    await db
      .update(userProfiles)
      .set({
        organizationId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userProfiles.id, user.id))

    const orgRows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        nameEn: organizations.nameEn,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        employeeCountRange: organizations.employeeCountRange,
        industry: organizations.industry,
        isoCertificationStatus: organizations.isoCertificationStatus,
        trialEndsAt: organizations.trialEndsAt,
        ismsPhase: organizations.ismsPhase,
        ismsPhaseSetAt: organizations.ismsPhaseSetAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    return NextResponse.json({
      organization: orgRows[0] ? serializeOrganization(orgRows[0]) : null,
    })
  } catch (error) {
    console.error('[Auth/Organization] failed to switch organization', error)
    return NextResponse.json({ error: 'failed to switch organization' }, { status: 500 })
  }
}
