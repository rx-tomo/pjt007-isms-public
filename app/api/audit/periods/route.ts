import { NextResponse } from 'next/server'
import { getOrganizationAccess } from '@/lib/server/auth/organizationAccess'
import { getDb } from '@/lib/db/drizzle/client'
import { auditPlans, auditChecklists, nonconformities } from '@/lib/db/drizzle/schema/audit'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and, inArray, sql } from 'drizzle-orm'

function comparePeriodsDesc(a: string, b: string) {
  const match = (value: string) => {
    const result = /^FY(\d{4})\s+Q([1-4])$/.exec(value)
    if (!result) {
      return { year: 0, quarter: 0 }
    }
    return { year: Number(result[1]), quarter: Number(result[2]) }
  }

  const periodA = match(a)
  const periodB = match(b)
  if (periodA.year === periodB.year) {
    return periodB.quarter - periodA.quarter
  }
  return periodB.year - periodA.year
}

export async function GET(request: Request) {
  try {
    // Get auth user via Better Auth
    let userId: string | null = null

    const { auth } = await import('@/lib/auth/better-auth')
    const session = await auth.api.getSession({ headers: request.headers })
    userId = session?.user?.id ?? null

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()

    const profileRows = await db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const profile = profileRows[0]
    if (!profile?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const organizationId = profile.organizationId

    const access = await getOrganizationAccess(db, userId, organizationId)
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all plans for the organization
    const plans = await db
      .select({
        id: auditPlans.id,
        auditPeriod: auditPlans.auditPeriod,
        status: auditPlans.status,
      })
      .from(auditPlans)
      .where(eq(auditPlans.organizationId, organizationId))

    // Unique periods
    const allPeriods = Array.from(
      new Set(
        plans
          .map(row => row.auditPeriod)
          .filter((value): value is string => Boolean(value))
      )
    ).sort(comparePeriodsDesc)

    // Group plans by period
    const periodPlanIds = new Map<string, string[]>()
    for (const plan of plans) {
      if (!plan.auditPeriod) continue
      const ids = periodPlanIds.get(plan.auditPeriod) ?? []
      ids.push(plan.id)
      periodPlanIds.set(plan.auditPeriod, ids)
    }

    // Fetch checklists for all plans
    const allPlanIds = plans.map(p => p.id)
    let checklistMap = new Map<string, string>() // checklist_id -> audit_plan_id
    if (allPlanIds.length > 0) {
      const checklistRows = await db
        .select({ id: auditChecklists.id, auditPlanId: auditChecklists.auditPlanId })
        .from(auditChecklists)
        .where(inArray(auditChecklists.auditPlanId, allPlanIds))

      for (const row of checklistRows) {
        if (row.auditPlanId) checklistMap.set(row.id, row.auditPlanId)
      }
    }

    // Fetch nonconformity counts
    const checklistIds = Array.from(checklistMap.keys())
    type NcByPlan = {
      open: number
      in_progress: number
      resolved: number
      closed: number
      verified: number
      active: number
    }
    const ncByPlan = new Map<string, NcByPlan>()

    if (checklistIds.length > 0) {
      const ncRows = await db
        .select({
          auditChecklistId: nonconformities.auditChecklistId,
          status: nonconformities.status,
        })
        .from(nonconformities)
        .where(inArray(nonconformities.auditChecklistId, checklistIds))

      for (const nc of ncRows) {
        const planId = nc.auditChecklistId ? checklistMap.get(nc.auditChecklistId) : null
        if (!planId) continue
        const existing = ncByPlan.get(planId) ?? { open: 0, in_progress: 0, resolved: 0, closed: 0, verified: 0, active: 0 }
        switch (nc.status) {
          case 'open': existing.open++; existing.active++; break
          case 'in_progress': existing.in_progress++; existing.active++; break
          case 'resolved': existing.resolved++; existing.active++; break
          case 'closed': existing.closed++; break
          case 'verified': existing.verified++; break
        }
        ncByPlan.set(planId, existing)
      }
    }

    // Build summary per period
    const summary = allPeriods.map(period => {
      const planIds = periodPlanIds.get(period) ?? []
      const periodPlans = plans.filter(p => p.auditPeriod === period)
      const totalPlans = periodPlans.length

      let followUpCompleted = 0
      let followUpOnHold = 0
      let followUpReopened = 0
      let openNc = 0
      let inProgressNc = 0
      let resolvedNc = 0
      let closedNc = 0
      let verifiedNc = 0

      for (const plan of periodPlans) {
        const nc = ncByPlan.get(plan.id) ?? { open: 0, in_progress: 0, resolved: 0, closed: 0, verified: 0, active: 0 }
        openNc += nc.open
        inProgressNc += nc.in_progress
        resolvedNc += nc.resolved
        closedNc += nc.closed
        verifiedNc += nc.verified

        if (nc.active <= 0) {
          followUpCompleted++
        } else if (plan.status === 'completed') {
          followUpReopened++
        } else {
          followUpOnHold++
        }
      }

      return {
        period,
        totalPlans,
        followUp: {
          completed: followUpCompleted,
          on_hold: followUpOnHold,
          reopened: followUpReopened
        },
        nonconformityStatus: {
          open: openNc,
          in_progress: inProgressNc,
          resolved: resolvedNc,
          closed: closedNc,
          verified: verifiedNc
        }
      }
    })

    return NextResponse.json({ periods: allPeriods, summary })
  } catch (error) {
    console.error('[AuditPeriodStatsAPI] Unexpected error', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
