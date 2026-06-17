import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { educationPlans, educationRecords, userProfiles } from '@/lib/db/drizzle/schema'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const FOLLOW_UP_STATUSES = new Set(['draft', 'scheduled', 'in_progress'])

function isPastDate(value: string | null) {
  if (!value) return false
  const end = new Date(`${value}T23:59:59.999Z`)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < Date.now()
}

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const db = getDb()
    const limitParam = request.nextUrl.searchParams.get('limit')
    const itemLimit = limitParam === 'all' ? null : 5

    const [plans, activeUsers] = await Promise.all([
      db
        .select()
        .from(educationPlans)
        .where(eq(educationPlans.organizationId, caller.organizationId)),
      db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.organizationId, caller.organizationId),
            eq(userProfiles.isActive, true)
          )
        ),
    ])

    const planIds = plans.map(plan => plan.id)
    const records = planIds.length > 0
      ? await db
          .select()
          .from(educationRecords)
          .where(inArray(educationRecords.planId, planIds))
      : []

    const recordsByPlan = new Map<string, typeof records>()
    for (const record of records) {
      if (!record.planId) continue
      const current = recordsByPlan.get(record.planId) ?? []
      current.push(record)
      recordsByPlan.set(record.planId, current)
    }

    const items = plans.map(plan => {
      const planRecords = recordsByPlan.get(plan.id) ?? []
      const passedRecords = planRecords.filter(record => record.result === 'passed').length
      const pendingRecords = planRecords.filter(record =>
        record.result === 'pending' || record.result === 'incomplete' || record.result === 'failed'
      ).length
      const overdue = isPastDate(plan.endDate)
      const activePlan = FOLLOW_UP_STATUSES.has(plan.status ?? '')
      const needsFollowUp = activePlan && (overdue || passedRecords === 0 || pendingRecords > 0)

      return {
        id: plan.id,
        title: plan.title,
        status: plan.status ?? 'draft',
        end_date: plan.endDate,
        total_records: planRecords.length,
        passed_records: passedRecords,
        pending_records: pendingRecords,
        active_user_count: activeUsers.length,
        is_overdue: overdue,
        needs_follow_up: needsFollowUp,
        updated_at: plan.updatedAt,
        created_at: plan.createdAt,
      }
    })

    const followUpItems = items
      .filter(item => item.needs_follow_up)
      .sort((a, b) => {
        const overdueDiff = Number(b.is_overdue) - Number(a.is_overdue)
        if (overdueDiff !== 0) return overdueDiff

        const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime()
        const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime()
        return bTime - aTime
      })

    return NextResponse.json({
      data: {
        total_plans: plans.length,
        active_user_count: activeUsers.length,
        needs_follow_up_count: followUpItems.length,
        overdue_count: followUpItems.filter(item => item.is_overdue).length,
        pending_record_count: followUpItems.reduce((sum, item) => sum + item.pending_records, 0),
        items: itemLimit === null ? followUpItems : followUpItems.slice(0, itemLimit),
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
