import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { educationPlans, educationRecords, userProfiles } from '@/lib/db/drizzle/schema'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const ALL_TARGET_LABELS = new Set(['全社員', '全員', '全従業員', 'all', 'all employees', 'everyone'])

const ROLE_TARGET_LABELS: Record<string, string[]> = {
  org_admin: ['組織管理者', '管理者', 'org_admin', 'organization admin'],
  auditor: ['監査員', '内部監査員', 'auditor'],
  approver: ['承認者', 'approver'],
  user: ['メンバー', '一般ユーザー', 'user', 'member'],
  system_operator: ['システム運営者', 'system_operator', 'system operator'],
}

function parseTargetAudience(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    }
  } catch {
    // Existing plans may store this as free text.
  }
  return value
    .split(/[,\n、]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function labelMatchesUser(label: string, user: typeof userProfiles.$inferSelect) {
  const selectedUserPrefix = 'user:'
  if (label.startsWith(selectedUserPrefix)) {
    return label.slice(selectedUserPrefix.length) === user.id
  }

  const selectedRolePrefix = 'role:'
  if (label.startsWith(selectedRolePrefix)) {
    return label.slice(selectedRolePrefix.length) === user.role
  }

  const selectedDepartmentPrefix = 'department:'
  if (label.startsWith(selectedDepartmentPrefix)) {
    return label
      .slice(selectedDepartmentPrefix.length)
      .toLowerCase() === (user.department ?? '').toLowerCase()
  }

  if (ALL_TARGET_LABELS.has(label.toLowerCase())) {
    return true
  }

  const normalized = label.toLowerCase()
  const values = [user.department, user.position, user.role, user.fullName, user.email]
    .filter((item): item is string => Boolean(item))
    .map(item => item.toLowerCase())

  if (values.some(value => value.includes(normalized) || normalized.includes(value))) {
    return true
  }

  return (ROLE_TARGET_LABELS[user.role ?? ''] ?? [])
    .some(roleLabel => roleLabel.toLowerCase() === normalized)
}

function planTargetsUser(targetAudience: string | null, user: typeof userProfiles.$inferSelect) {
  const labels = parseTargetAudience(targetAudience)
  if (labels.length === 0) {
    return true
  }
  return labels.some(label => labelMatchesUser(label, user))
}

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const db = getDb()
    const profileRows = await db
      .select()
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.id, caller.userId),
          eq(userProfiles.organizationId, caller.organizationId)
        )
      )
      .limit(1)

    const profile = profileRows[0]
    if (!profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const plans = await db
      .select()
      .from(educationPlans)
      .where(eq(educationPlans.organizationId, caller.organizationId))

    const targetPlans = plans
      .filter(plan => planTargetsUser(plan.targetAudience, profile))
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt ?? '').getTime()
        const bTime = new Date(b.updatedAt ?? b.createdAt ?? '').getTime()
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
      })
    const planIds = targetPlans.map(plan => plan.id)
    const records = planIds.length > 0
      ? await db
          .select()
          .from(educationRecords)
          .where(inArray(educationRecords.planId, planIds))
      : []

    const myRecords = records.filter(record => record.attendeeId === caller.userId)

    const items = targetPlans.map(plan => {
      const myRecord = myRecords.find(record => record.planId === plan.id)
      const result = myRecord?.result ?? 'pending'
      const progress = result === 'passed' ? 100 : myRecord ? 50 : 0

      return {
        id: plan.id,
        title: plan.title,
        status: plan.status ?? 'draft',
        end_date: plan.endDate,
        result,
        progress,
        record_id: myRecord?.id ?? null,
      }
    })

    return NextResponse.json({
      data: {
        total: items.length,
        incomplete_count: items.filter(item => item.progress < 100).length,
        items: items.slice(0, 5),
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
