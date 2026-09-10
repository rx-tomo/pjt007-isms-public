import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations, organizationDepartments } from '@/lib/db/drizzle/schema/organizations'
import { eq } from 'drizzle-orm'
import { createRiskExcelBuffer, type RiskExportRecord } from '@/lib/utils/exporters/riskExcel'
import { createRiskReportPdf, buildRiskReportFileName } from '@/lib/utils/exporters/riskPdf'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import type { RiskStatus } from '@/lib/services/risk'
import { RiskTenantLifecycleService } from '@/lib/server/risks/riskTenantLifecycleService'
import { projectRiskForCapabilities } from '@/lib/server/risks/riskOutputProjection'

export const runtime = 'nodejs'

const RISK_STATUSES: RiskStatus[] = ['identified', 'analyzing', 'treating', 'monitoring', 'closed']

function parseRiskMatrixLevel(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null
}

export async function GET(request: NextRequest) {
  const { user } = await getRouteAuth(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const organizationId = request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }
  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    organizationId,
    'risks.read'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    )
  }

  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant',
    organizationId,
    actionName: 'risks.export',
    logContext: { organizationId }
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isTemplate = request.nextUrl.searchParams.get('template') === 'true'
  const templateFormat = request.nextUrl.searchParams.get('format')

  if (isTemplate && templateFormat === 'csv') {
    const BOM = '\uFEFF'
    const headers = 'title,description,category,impact_level,likelihood_level,status,owner_email'
    const csv = BOM + headers + '\n'

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="risk_import_template.csv"'
      }
    })
  }

  const formatParam = request.nextUrl.searchParams.get('format')?.toLowerCase()
  const format: 'excel' | 'pdf' = formatParam === 'pdf' ? 'pdf' : 'excel'
  const statusParam = request.nextUrl.searchParams.get('status')
  const categoryParam = request.nextUrl.searchParams.get('categoryId')
  const departmentParam = request.nextUrl.searchParams.get('departmentId')
  const searchParam = request.nextUrl.searchParams.get('search')
  const assessmentPeriodParam = request.nextUrl.searchParams.get('assessmentPeriod')
  const matrixImpactFilter = parseRiskMatrixLevel(request.nextUrl.searchParams.get('matrixImpact'))
  const matrixLikelihoodFilter = parseRiskMatrixLevel(request.nextUrl.searchParams.get('matrixLikelihood'))

  const statusFilter =
    statusParam && RISK_STATUSES.includes(statusParam as RiskStatus) ? (statusParam as RiskStatus) : null
  const categoryFilter = categoryParam?.trim() || null
  const departmentFilter = departmentParam?.trim() || null
  const searchFilterRaw = searchParam?.trim() ?? ''
  const searchFilter = searchFilterRaw.toLowerCase()
  const assessmentPeriodFilter = assessmentPeriodParam?.trim() || null
  const matrixFilterLabel =
    matrixImpactFilter && matrixLikelihoodFilter
      ? `影響度 ${matrixImpactFilter} × 発生可能性 ${matrixLikelihoodFilter}`
      : null
  let departmentFilterLabel: string | null = null

  const db = getDb()
  let departmentNameMap: Map<string, string> | null = null

  let organizationName = 'Riscala AI for ISMS'
  if (format === 'pdf') {
    const orgRows = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (orgRows[0]?.name) {
      organizationName = orgRows[0].name
    }
  }

  // The lifecycle projection is the canonical boundary for department scope and
  // every related tenant resource. Never rebuild export rows from unscoped IDs.
  let riskRows = (await new RiskTenantLifecycleService(db).listRisks(
    authorization.context,
    {
      status: statusFilter ?? undefined,
      assessmentPeriod: assessmentPeriodFilter ?? undefined,
    }
  )).map(risk => projectRiskForCapabilities(risk, authorization.capabilities))

  if (categoryFilter) {
    riskRows = riskRows.filter(r => r.category_id === categoryFilter)
  }
  if (matrixImpactFilter && matrixLikelihoodFilter) {
    riskRows = riskRows.filter(
      r => r.impact_level === matrixImpactFilter && r.likelihood_level === matrixLikelihoodFilter
    )
  }

  if (searchFilter) {
    riskRows = riskRows.filter(risk => {
      const title = (risk.title ?? '').toLowerCase()
      const description = (risk.description ?? '').toLowerCase()
      return title.includes(searchFilter) || description.includes(searchFilter)
    })
  }

  if (departmentFilter) {
    if (departmentFilter !== DEPARTMENT_UNASSIGNED_VALUE && !departmentNameMap) {
      const departmentRows = await db
        .select({ id: organizationDepartments.id, name: organizationDepartments.name })
        .from(organizationDepartments)
        .where(eq(organizationDepartments.organizationId, organizationId))

      departmentNameMap = new Map(departmentRows.map(row => [row.id, row.name]))
    }

    if (departmentFilter === DEPARTMENT_UNASSIGNED_VALUE) {
      departmentFilterLabel = '未割当'
    } else if (departmentNameMap) {
      departmentFilterLabel = departmentNameMap.get(departmentFilter) ?? departmentFilter
    }

    riskRows = riskRows.filter(risk =>
      departmentFilter === DEPARTMENT_UNASSIGNED_VALUE
        ? risk.department_id === null
        : risk.department_id === departmentFilter
    )
  }

  if (riskRows.length === 0) {
    if (format === 'pdf') {
      const pdfString = createRiskReportPdf({
        organizationName,
        generatedAt: new Date().toISOString(),
        filters: {
          status: statusFilter,
          category: categoryFilter,
          department: departmentFilter,
          assessmentPeriod: assessmentPeriodFilter,
          matrix: matrixFilterLabel,
          search: searchFilterRaw || null
        },
        records: []
      })

      const filename = `${buildRiskReportFileName(organizationName)}.pdf`
      return new NextResponse(Buffer.from(pdfString, 'utf-8'), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    const emptyBuffer = createRiskExcelBuffer([])
    return new NextResponse(new Uint8Array(emptyBuffer), {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': 'attachment; filename="risks-export.xls"'
      }
    })
  }

  const categoryFilterLabel = categoryFilter
    ? riskRows.find(risk => risk.category_id === categoryFilter)?.category?.name
      ?? categoryFilter
    : null

  const exportRecords: RiskExportRecord[] = riskRows.map(risk => {
    const riskTreatmentsList = risk.treatments ?? []
    const treatmentLabels = riskTreatmentsList.map(treatment => {
      // Responsible user details are deliberately not re-queried by ID. The
      // canonical lifecycle has already nulled invalid tenant relationships.
      const dueDate = treatment.due_date ? ` – due ${treatment.due_date}` : ''
      return `${treatment.treatment_type.toUpperCase()}: ${treatment.description}${dueDate}`
    })
    const controlLabels = riskTreatmentsList.flatMap(treatment =>
      (treatment.control_links ?? []).flatMap(link => {
        const control = link.iso_control
        if (!control) return []
        return [
          control.control_code
            ? `${control.control_code} ${control.title}`
            : `${control.title} (${control.category})`,
        ]
      })
    )
    const assetLabels = (risk.assets ?? []).flatMap(link => {
      const asset = link.asset
      if (!asset) return []
      return [
        `${asset.name} [${asset.asset_type}/${asset.classification}/${asset.criticality}]`,
      ]
    })
    const ownerName = risk.owner?.full_name || risk.owner?.email || risk.owner?.id || null

    return {
      id: risk.id,
      title: risk.title,
      status: risk.status ?? '',
      assessmentPeriod: risk.assessment_period ?? null,
      category: risk.category?.name ?? null,
      score: risk.risk_score ?? (risk.impact_level && risk.likelihood_level
        ? risk.impact_level * risk.likelihood_level
        : null),
      impact: risk.impact_level ?? null,
      likelihood: risk.likelihood_level ?? null,
      ownerName,
      ownerEmail: risk.owner?.email ?? null,
      assets: assetLabels,
      treatments: treatmentLabels,
      controls: controlLabels,
      identifiedDate: risk.identified_date ?? null,
      updatedAt: risk.updated_at ?? null
    }
  })

  if (format === 'pdf') {
    const pdfString = createRiskReportPdf({
      organizationName,
      generatedAt: new Date().toISOString(),
      filters: {
        status: statusFilter,
        category: categoryFilterLabel,
        department: departmentFilterLabel,
        assessmentPeriod: assessmentPeriodFilter,
        matrix: matrixFilterLabel,
        search: searchFilterRaw || null
      },
      records: exportRecords
    })

    const filename = `${buildRiskReportFileName(organizationName)}.pdf`
    return new NextResponse(Buffer.from(pdfString, 'utf-8'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  }

  const buffer = createRiskExcelBuffer(exportRecords)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': 'attachment; filename="risks-export.xls"'
    }
  })
}
