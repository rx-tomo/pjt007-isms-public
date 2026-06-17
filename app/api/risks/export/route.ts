import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import {
  risks,
  riskCategories,
  riskAssets,
  riskTreatments,
  riskControlLinks,
  informationAssets,
  isoControls,
} from '@/lib/db/drizzle/schema/risks'
import { organizations, organizationDepartments } from '@/lib/db/drizzle/schema/organizations'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, desc, inArray } from 'drizzle-orm'
import { createRiskExcelBuffer, type RiskExportRecord } from '@/lib/utils/exporters/riskExcel'
import { createRiskReportPdf, buildRiskReportFileName } from '@/lib/utils/exporters/riskPdf'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import type { RiskStatus } from '@/lib/services/risk'

export const runtime = 'nodejs'

const RISK_STATUSES: RiskStatus[] = ['identified', 'analyzing', 'treating', 'monitoring', 'closed']

function parseRiskMatrixLevel(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator', 'auditor'],
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

  let organizationName = 'ISMS Manager'
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

  // Build base query with filters
  let riskRows = await db
    .select()
    .from(risks)
    .where(eq(risks.organizationId, organizationId))
    .orderBy(desc(risks.riskScore))

  // Apply filters in JS (simpler than building dynamic Drizzle where clauses)
  if (statusFilter) {
    riskRows = riskRows.filter(r => r.status === statusFilter)
  }
  if (categoryFilter) {
    riskRows = riskRows.filter(r => r.categoryId === categoryFilter)
  }
  if (assessmentPeriodFilter) {
    riskRows = riskRows.filter(r => r.assessmentPeriod === assessmentPeriodFilter)
  }
  if (matrixImpactFilter && matrixLikelihoodFilter) {
    riskRows = riskRows.filter(
      r => r.impactLevel === matrixImpactFilter && r.likelihoodLevel === matrixLikelihoodFilter
    )
  }

  if (searchFilter) {
    riskRows = riskRows.filter(risk => {
      const title = (risk.title ?? '').toLowerCase()
      const description = (risk.description ?? '').toLowerCase()
      return title.includes(searchFilter) || description.includes(searchFilter)
    })
  }

  const userMap = new Map<string, { name: string; email: string | null; department: string | null }>()

  const ownerIdsForFilter = new Set<string>()
  riskRows.forEach(risk => {
    if (risk.ownerId) {
      ownerIdsForFilter.add(risk.ownerId)
    }
  })

  if (ownerIdsForFilter.size) {
    const ownerProfileRows = await db
      .select({
        id: userProfiles.id,
        fullName: userProfiles.fullName,
        email: userProfiles.email,
        department: userProfiles.department,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.id, Array.from(ownerIdsForFilter)))

    ownerProfileRows.forEach(profile => {
      userMap.set(profile.id, {
        name: profile.fullName || profile.email || profile.id,
        email: profile.email || null,
        department: profile.department ?? null
      })
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

    riskRows = riskRows.filter(risk => {
      const ownerProfile = risk.ownerId ? userMap.get(risk.ownerId) : undefined

      if (departmentFilter === DEPARTMENT_UNASSIGNED_VALUE) {
        return !ownerProfile?.department
      }

      if (!departmentNameMap) {
        return false
      }

      const expectedName = departmentNameMap.get(departmentFilter)
      if (!expectedName) {
        return false
      }

      return ownerProfile?.department === expectedName
    })
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

  const riskIds = riskRows.map(risk => risk.id)
  const categoryIds = Array.from(new Set(riskRows.map(risk => risk.categoryId).filter(Boolean))) as string[]
  const ownerIds = new Set<string>()
  riskRows.forEach(risk => {
    if (risk.ownerId) {
      ownerIds.add(risk.ownerId)
    }
  })

  const [categoriesResult, riskAssetsResult, treatmentsResult] = await Promise.all([
    categoryIds.length
      ? db.select({ id: riskCategories.id, name: riskCategories.name })
          .from(riskCategories)
          .where(inArray(riskCategories.id, categoryIds))
      : Promise.resolve([] as { id: string; name: string }[]),
    db.select({ riskId: riskAssets.riskId, assetId: riskAssets.assetId })
      .from(riskAssets)
      .where(inArray(riskAssets.riskId, riskIds)),
    db.select()
      .from(riskTreatments)
      .where(inArray(riskTreatments.riskId, riskIds))
  ])

  treatmentsResult.forEach(treatment => {
    if (treatment.responsibleId) {
      ownerIds.add(treatment.responsibleId)
    }
  })

  const treatmentIds = treatmentsResult.map(treatment => treatment.id)
  const controlLinksResult = treatmentIds.length
    ? await db
        .select({ riskTreatmentId: riskControlLinks.riskTreatmentId, isoControlId: riskControlLinks.isoControlId })
        .from(riskControlLinks)
        .where(inArray(riskControlLinks.riskTreatmentId, treatmentIds))
    : []

  const assetIds = Array.from(new Set(riskAssetsResult.map(asset => asset.assetId)))
  const controlIds = Array.from(new Set(controlLinksResult.map(link => link.isoControlId)))

  const [assetRecords, controlRecords] = await Promise.all([
    assetIds.length
      ? db.select({
          id: informationAssets.id,
          name: informationAssets.name,
          assetType: informationAssets.assetType,
          classification: informationAssets.classification,
          criticality: informationAssets.criticality,
        })
        .from(informationAssets)
        .where(inArray(informationAssets.id, assetIds))
      : Promise.resolve([] as any[]),
    controlIds.length
      ? db.select({
          id: isoControls.id,
          controlCode: isoControls.controlCode,
          title: isoControls.title,
          category: isoControls.category,
        })
        .from(isoControls)
        .where(inArray(isoControls.id, controlIds))
      : Promise.resolve([] as any[])
  ])

  const missingProfileIds = Array.from(ownerIds).filter(id => !userMap.has(id))
  if (missingProfileIds.length) {
    const extraProfiles = await db
      .select({
        id: userProfiles.id,
        fullName: userProfiles.fullName,
        email: userProfiles.email,
        department: userProfiles.department,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.id, missingProfileIds))

    extraProfiles.forEach(profile => {
      userMap.set(profile.id, {
        name: profile.fullName || profile.email || profile.id,
        email: profile.email || null,
        department: profile.department ?? null
      })
    })
  }

  const categoryMap = new Map<string, string>()
  categoriesResult.forEach(category => {
    categoryMap.set(category.id, category.name)
  })
  const categoryFilterLabel = categoryFilter ? categoryMap.get(categoryFilter) ?? categoryFilter : null

  const assetMap = new Map<string, { name: string; type: string; classification: string; criticality: string }>()
  assetRecords.forEach((asset: any) => {
    assetMap.set(asset.id, {
      name: asset.name,
      type: asset.assetType,
      classification: asset.classification,
      criticality: asset.criticality
    })
  })

  const controlMap = new Map<string, { code: string | null; title: string; category: string }>()
  controlRecords.forEach((control: any) => {
    controlMap.set(control.id, {
      code: control.controlCode || null,
      title: control.title,
      category: control.category
    })
  })

  const treatmentsByRisk = new Map<string, typeof treatmentsResult>()
  treatmentsResult.forEach(treatment => {
    const list = treatmentsByRisk.get(treatment.riskId!) || []
    list.push(treatment)
    treatmentsByRisk.set(treatment.riskId!, list)
  })

  const controlsByTreatment = new Map<string, string[]>()
  controlLinksResult.forEach(link => {
    const control = controlMap.get(link.isoControlId)
    const label = control
      ? control.code
        ? `${control.code} ${control.title}`
        : `${control.title} (${control.category})`
      : link.isoControlId
    const list = controlsByTreatment.get(link.riskTreatmentId) || []
    list.push(label)
    controlsByTreatment.set(link.riskTreatmentId, list)
  })

  const assetsByRisk = new Map<string, string[]>()
  riskAssetsResult.forEach(assetLink => {
    const asset = assetMap.get(assetLink.assetId)
    const label = asset
      ? `${asset.name} [${asset.type}/${asset.classification}/${asset.criticality}]`
      : assetLink.assetId
    const list = assetsByRisk.get(assetLink.riskId) || []
    list.push(label)
    assetsByRisk.set(assetLink.riskId, list)
  })

  const exportRecords: RiskExportRecord[] = riskRows.map(risk => {
    const owner = risk.ownerId ? userMap.get(risk.ownerId) : undefined
    const riskTreatmentsList = treatmentsByRisk.get(risk.id) || []
    const treatmentLabels = riskTreatmentsList.map(treatment => {
      const responsible = treatment.responsibleId ? userMap.get(treatment.responsibleId) : null
      const responsibleLabel = responsible?.name ? ` (${responsible.name})` : ''
      const dueDate = treatment.dueDate ? ` – due ${treatment.dueDate}` : ''
      return `${treatment.treatmentType.toUpperCase()}: ${treatment.description}${responsibleLabel}${dueDate}`
    })
    const controlLabels = riskTreatmentsList.flatMap(treatment => controlsByTreatment.get(treatment.id) || [])

    return {
      id: risk.id,
      title: risk.title,
      status: risk.status ?? '',
      assessmentPeriod: risk.assessmentPeriod ?? null,
      category: risk.categoryId ? categoryMap.get(risk.categoryId) || null : null,
      score: risk.riskScore ?? (risk.impactLevel && risk.likelihoodLevel
        ? risk.impactLevel * risk.likelihoodLevel
        : null),
      impact: risk.impactLevel ?? null,
      likelihood: risk.likelihoodLevel ?? null,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      assets: assetsByRisk.get(risk.id) || [],
      treatments: treatmentLabels,
      controls: controlLabels,
      identifiedDate: risk.identifiedDate ?? null,
      updatedAt: risk.updatedAt ?? null
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
