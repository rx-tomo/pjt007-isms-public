import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { escapeCsvCellNullable } from '@/lib/utils/csv-sanitize'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new EducationService()
const FOLLOW_UP_STATUSES = new Set(['draft', 'scheduled', 'in_progress'])

function isPastDate(value: string | null) {
  if (!value) return false
  const end = new Date(`${value}T23:59:59.999Z`)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < Date.now()
}

/**
 * GET /api/education/export - Export education plans as CSV
 */
export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined
    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined
    const followUpFilter = request.nextUrl.searchParams.get('followUp') === 'needs_attention'

    const plans = await service.getPlans(caller.organizationId, { status, search })

    const rowsWithSummary = await Promise.all(plans.map(async plan => {
      const records = await service.getRecordsByPlanId(plan.id)
      const passedRecords = records.filter(record => record.result === 'passed').length
      const pendingRecords = records.filter(record =>
        record.result === 'pending' || record.result === 'incomplete' || record.result === 'failed'
      ).length
      const isOverdue = isPastDate(plan.end_date)
      const isActivePlan = FOLLOW_UP_STATUSES.has(plan.status ?? '')
      const needsFollowUp = isActivePlan && (isOverdue || passedRecords === 0 || pendingRecords > 0)

      return {
        plan,
        totalRecords: records.length,
        passedRecords,
        pendingRecords,
        completionRate: records.length > 0 ? Math.round((passedRecords / records.length) * 100) : 0,
        isOverdue,
        needsFollowUp,
      }
    }))

    const exportRows = followUpFilter
      ? rowsWithSummary.filter(row => row.needsFollowUp)
      : rowsWithSummary

    const BOM = '\uFEFF'
    const headers = [
      'ID',
      'タイトル',
      'ステータス',
      '開始日',
      '終了日',
      '対象者',
      '受講記録数',
      '合格数',
      '要フォロー件数',
      '修了率',
      '期限超過',
      '要フォロー',
      '説明',
      '作成日',
      '更新日',
    ].join(',')

    const rows = exportRows.map(row => {
      const { plan } = row
      return [
        escapeCsvCellNullable(plan.id),
        escapeCsvCellNullable(plan.title),
        escapeCsvCellNullable(plan.status),
        escapeCsvCellNullable(plan.start_date),
        escapeCsvCellNullable(plan.end_date),
        escapeCsvCellNullable(plan.target_audience),
        escapeCsvCellNullable(String(row.totalRecords)),
        escapeCsvCellNullable(String(row.passedRecords)),
        escapeCsvCellNullable(String(row.pendingRecords)),
        escapeCsvCellNullable(`${row.completionRate}%`),
        escapeCsvCellNullable(row.isOverdue ? 'yes' : 'no'),
        escapeCsvCellNullable(row.needsFollowUp ? 'yes' : 'no'),
        escapeCsvCellNullable(plan.description),
        escapeCsvCellNullable(plan.created_at),
        escapeCsvCellNullable(plan.updated_at),
      ].join(',')
    })

    const csv = BOM + headers + '\n' + rows.join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="education-plans-export.csv"',
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
