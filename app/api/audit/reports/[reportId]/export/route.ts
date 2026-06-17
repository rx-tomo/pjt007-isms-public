import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getOrganizationAccess } from '@/lib/server/auth/organizationAccess'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditReports,
  auditPlans,
  auditChecklists,
  auditEvidence,
  nonconformities,
} from '@/lib/db/drizzle/schema'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, inArray, sql } from 'drizzle-orm'
import { createAuditReportPdf, buildAuditReportFileName } from '@/lib/utils/exporters/auditReportPdf'
import type { AuditType, AuditStatus } from '@/lib/services/audit'

interface RouteParams {
  params: Promise<{
    reportId: string
  }>
}

export async function GET(request: NextRequest, props: RouteParams) {
  const { user } = await getRouteAuth(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = await props.params;
  const reportId = params.reportId

  if (!reportId) {
    return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
  }

  const db = getDb()

  try {
    // Fetch report
    const reportRows = await db
      .select()
      .from(auditReports)
      .where(eq(auditReports.id, reportId))
      .limit(1)

    const reportRow = reportRows[0]
    if (!reportRow) {
      return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
    }

    // Fetch associated audit plan
    if (!reportRow.auditPlanId) {
      return NextResponse.json({ error: 'Audit report has no associated plan' }, { status: 404 })
    }

    const planRows = await db
      .select()
      .from(auditPlans)
      .where(eq(auditPlans.id, reportRow.auditPlanId))
      .limit(1)

    const plan = planRows[0]
    if (!plan) {
      return NextResponse.json({ error: 'Audit plan not found' }, { status: 404 })
    }

    // Fetch organization
    if (!plan.organizationId) {
      return NextResponse.json({ error: 'Audit plan has no organization' }, { status: 404 })
    }

    const access = await getOrganizationAccess(db, user.id, plan.organizationId)
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgRows = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, plan.organizationId))
      .limit(1)

    const organization = orgRows[0]

    // Fetch lead auditor profile
    let leadAuditor: { fullName: string | null; email: string | null } | null = null
    if (plan.leadAuditorId) {
      const auditorRows = await db
        .select({ fullName: userProfiles.fullName, email: userProfiles.email })
        .from(userProfiles)
        .where(eq(userProfiles.id, plan.leadAuditorId))
        .limit(1)
      leadAuditor = auditorRows[0] ?? null
    }

    // Fetch checklists
    const checklistRows = await db
      .select({ id: auditChecklists.id, status: auditChecklists.status })
      .from(auditChecklists)
      .where(eq(auditChecklists.auditPlanId, plan.id))

    const checklistIds = checklistRows.map(row => row.id)
    const checklistTotal = checklistRows.length
    const checklistCompleted = checklistRows.filter(row => row.status === 'completed').length

    let evidenceCount = 0
    let nonconformityCount = 0

    if (checklistIds.length > 0) {
      const evidenceResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditEvidence)
        .where(inArray(auditEvidence.auditChecklistId, checklistIds))
      evidenceCount = evidenceResult[0]?.count ?? 0

      const ncResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(nonconformities)
        .where(inArray(nonconformities.auditChecklistId, checklistIds))
      nonconformityCount = ncResult[0]?.count ?? 0
    }

    const pdfString = createAuditReportPdf({
      organizationName: organization?.name ?? 'Organization',
      plan: {
        title: plan.title,
        audit_type: plan.auditType as AuditType | null | undefined,
        status: (plan.status ?? 'planning') as AuditStatus,
        planned_start_date: plan.plannedStartDate,
        planned_end_date: plan.plannedEndDate,
        actual_start_date: plan.actualStartDate,
        actual_end_date: plan.actualEndDate,
        leadAuditorName: leadAuditor?.fullName ?? leadAuditor?.email ?? null
      },
      report: {
        executive_summary: reportRow.executiveSummary,
        scope: reportRow.scope,
        methodology: reportRow.methodology,
        positive_findings: reportRow.positiveFindings,
        improvement_opportunities: reportRow.improvementOpportunities,
        conclusion: reportRow.conclusion,
        report_date: reportRow.reportDate,
        approved_by: reportRow.approvedBy
      },
      checklistStats: {
        total: checklistTotal,
        completed: checklistCompleted
      },
      evidenceCount,
      nonconformityCount
    })

    const filename = `${buildAuditReportFileName(plan.title, reportRow.reportDate)}.pdf`

    return new Response(Buffer.from(pdfString, 'utf-8'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('[AuditReportExport] failed', error)
    return NextResponse.json({ error: 'Failed to export audit report' }, { status: 500 })
  }
}
