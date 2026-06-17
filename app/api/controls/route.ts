import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships, auditLogs } from '@/lib/db/drizzle/schema'
import { isoControls, riskControlLinks, riskTreatments, risks, soaVersions } from '@/lib/db/drizzle/schema/risks'
import { IsoControlService } from '@/lib/services/isoControl'
import { ApprovalService } from '@/lib/services/approval'

async function assertOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  return profile?.organizationId === organizationId || Boolean(membership)
}

const soaStatusValues = ['not_reviewed', 'applicable', 'not_applicable'] as const
type SoaStatus = typeof soaStatusValues[number]

function isSoaStatus(value: unknown): value is SoaStatus {
  return typeof value === 'string' && soaStatusValues.includes(value as SoaStatus)
}

type SoaVersionControlSnapshot = {
  id: string
  title?: string | null
  soa_status?: string | null
  soa_applicability_reason?: string | null
  soa_exclusion_reason?: string | null
  linkedRiskCount?: number | null
  linkedTreatmentCount?: number | null
  completedTreatmentCount?: number | null
}

type SoaVersionSnapshot = {
  controls?: SoaVersionControlSnapshot[]
}

function parseSoaVersionSnapshot(value: string): SoaVersionSnapshot {
  try {
    const parsed = JSON.parse(value) as SoaVersionSnapshot
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function buildSoaVersionDiff(
  currentSnapshotText: string,
  previousSnapshotText?: string | null
) {
  if (!previousSnapshotText) {
    return null
  }

  const currentControls = parseSoaVersionSnapshot(currentSnapshotText).controls ?? []
  const previousControls = parseSoaVersionSnapshot(previousSnapshotText).controls ?? []
  const currentById = new Map(currentControls.map((control) => [control.id, control]))
  const previousById = new Map(previousControls.map((control) => [control.id, control]))

  const addedControls = currentControls.filter((control) => !previousById.has(control.id))
  const removedControls = previousControls.filter((control) => !currentById.has(control.id))
  const changedControls = currentControls
    .filter((control) => {
      const previous = previousById.get(control.id)
      if (!previous) return false

      return (
        previous.soa_status !== control.soa_status ||
        (previous.soa_applicability_reason ?? '') !== (control.soa_applicability_reason ?? '') ||
        (previous.soa_exclusion_reason ?? '') !== (control.soa_exclusion_reason ?? '') ||
        (previous.linkedRiskCount ?? 0) !== (control.linkedRiskCount ?? 0) ||
        (previous.linkedTreatmentCount ?? 0) !== (control.linkedTreatmentCount ?? 0) ||
        (previous.completedTreatmentCount ?? 0) !== (control.completedTreatmentCount ?? 0)
      )
    })
    .map((control) => {
      const previous = previousById.get(control.id)
      return {
        id: control.id,
        title: control.title ?? previous?.title ?? control.id,
        before: {
          soaStatus: previous?.soa_status ?? null,
          applicabilityReason: previous?.soa_applicability_reason ?? null,
          exclusionReason: previous?.soa_exclusion_reason ?? null,
          linkedRiskCount: previous?.linkedRiskCount ?? 0,
          linkedTreatmentCount: previous?.linkedTreatmentCount ?? 0,
          completedTreatmentCount: previous?.completedTreatmentCount ?? 0,
        },
        after: {
          soaStatus: control.soa_status ?? null,
          applicabilityReason: control.soa_applicability_reason ?? null,
          exclusionReason: control.soa_exclusion_reason ?? null,
          linkedRiskCount: control.linkedRiskCount ?? 0,
          linkedTreatmentCount: control.linkedTreatmentCount ?? 0,
          completedTreatmentCount: control.completedTreatmentCount ?? 0,
        },
      }
    })

  return {
    baseVersionAvailable: true,
    addedCount: addedControls.length,
    removedCount: removedControls.length,
    changedCount: changedControls.length,
    addedControls: addedControls.map((control) => ({
      id: control.id,
      title: control.title ?? control.id,
      soaStatus: control.soa_status ?? null,
    })),
    removedControls: removedControls.map((control) => ({
      id: control.id,
      title: control.title ?? control.id,
      soaStatus: control.soa_status ?? null,
    })),
    changedControls,
  }
}

async function resolveCisoApproverId(db: ReturnType<typeof getDb>, organizationId: string) {
  const [ciso] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isCiso, true)
    ))
    .limit(1)

  if (ciso?.id) return ciso.id

  const [fallbackApprover] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.role, 'org_admin')
    ))
    .limit(1)

  return fallbackApprover?.id ?? null
}

async function buildSoaReadinessSnapshot(db: ReturnType<typeof getDb>, organizationId: string) {
  const service = new IsoControlService()
  const controls = await service.searchControls(organizationId)
  const linkRows = await db
    .select({
      controlId: riskControlLinks.isoControlId,
      treatmentId: riskTreatments.id,
      treatmentDescription: riskTreatments.description,
      treatmentStatus: riskTreatments.status,
      treatmentDueDate: riskTreatments.dueDate,
      riskId: risks.id,
      riskTitle: risks.title,
      riskStatus: risks.status,
    })
    .from(riskControlLinks)
    .innerJoin(riskTreatments, eq(riskControlLinks.riskTreatmentId, riskTreatments.id))
    .innerJoin(risks, eq(riskTreatments.riskId, risks.id))
    .where(eq(risks.organizationId, organizationId))

  const linksByControl = new Map<string, typeof linkRows>()
  linkRows.forEach((row) => {
    const current = linksByControl.get(row.controlId) ?? []
    current.push(row)
    linksByControl.set(row.controlId, current)
  })

  return controls.map((control) => {
    const links = linksByControl.get(control.id) ?? []
    const linkedRiskIds = new Set(links.map((link) => link.riskId))
    const linkedTreatmentIds = new Set(links.map((link) => link.treatmentId))
    const completedTreatmentIds = new Set(
      links
        .filter((link) => link.treatmentStatus === 'completed')
        .map((link) => link.treatmentId)
    )

    return {
      ...control,
      applicability: links.length > 0 ? 'linked' : 'unlinked',
      linkedRiskCount: linkedRiskIds.size,
      linkedTreatmentCount: linkedTreatmentIds.size,
      completedTreatmentCount: completedTreatmentIds.size,
      treatments: links.map((link) => ({
        id: link.treatmentId,
        description: link.treatmentDescription,
        status: link.treatmentStatus,
        dueDate: link.treatmentDueDate,
        riskId: link.riskId,
        riskTitle: link.riskTitle,
        riskStatus: link.riskStatus,
      })),
    }
  })
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'search'
  const organizationId = searchParams.get('organizationId')

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new IsoControlService()

  try {
    if (action === 'soa') {
      const data = await buildSoaReadinessSnapshot(db, organizationId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'soa_versions') {
      const rows = await db
        .select()
        .from(soaVersions)
        .where(eq(soaVersions.organizationId, organizationId))
        .orderBy(sql`${soaVersions.versionNumber} desc`)
      const data = rows.map((version, index) => {
        const previous = rows[index + 1]
        return {
          ...version,
          diffFromPrevious: buildSoaVersionDiff(version.snapshot, previous?.snapshot),
        }
      })

      return applyCookies(NextResponse.json(data))
    }

    if (action === 'categories') {
      const data = await service.getCategories(organizationId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'search') {
      const data = await service.searchControls(
        organizationId,
        searchParams.get('keyword') ?? undefined,
        searchParams.get('category') ?? undefined
      )
      return applyCookies(NextResponse.json(data))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch (error) {
    console.error('Controls API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load controls' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  let body: {
    id?: string
    organizationId?: string
    soaStatus?: unknown
    soaApplicabilityReason?: unknown
    soaExclusionReason?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  if (!body.id || !body.organizationId || !isSoaStatus(body.soaStatus)) {
    return applyCookies(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
  }

  const db = getDb()
  const hasAccess = await assertOrganizationAccess(db, user.id, body.organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const [current] = await db
    .select()
    .from(isoControls)
    .where(and(eq(isoControls.id, body.id), eq(isoControls.organizationId, body.organizationId)))
    .limit(1)

  if (!current) {
    return applyCookies(NextResponse.json({ error: 'Control not found' }, { status: 404 }))
  }

  const now = new Date().toISOString()
  const applicabilityReason = typeof body.soaApplicabilityReason === 'string'
    ? body.soaApplicabilityReason.trim()
    : ''
  const exclusionReason = typeof body.soaExclusionReason === 'string'
    ? body.soaExclusionReason.trim()
    : ''

  const [updated] = await db
    .update(isoControls)
    .set({
      soaStatus: body.soaStatus,
      soaApplicabilityReason: applicabilityReason || null,
      soaExclusionReason: body.soaStatus === 'not_applicable' ? exclusionReason || null : null,
      soaReviewedBy: user.id,
      soaReviewedAt: now,
      soaApprovalStatus: 'draft',
      soaApprovedBy: null,
      soaApprovedAt: null,
      soaRejectionReason: null,
      updatedAt: now,
    })
    .where(and(eq(isoControls.id, body.id), eq(isoControls.organizationId, body.organizationId)))
    .returning()

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: body.organizationId,
    userId: user.id,
    action: 'control.soa_decision.updated',
    resourceType: 'iso_control',
    resourceId: body.id,
    changes: JSON.stringify({
      before: {
        soaStatus: current.soaStatus,
        soaApplicabilityReason: current.soaApplicabilityReason,
        soaExclusionReason: current.soaExclusionReason,
      },
      after: {
        soaStatus: updated.soaStatus,
        soaApplicabilityReason: updated.soaApplicabilityReason,
        soaExclusionReason: updated.soaExclusionReason,
      },
    }),
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
    scope: 'tenant',
  })

  return applyCookies(NextResponse.json(updated))
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  let body: {
    action?: unknown
    id?: string
    organizationId?: string
    changeSummary?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  if (
    body.action !== 'submit_soa_approval' &&
    body.action !== 'publish_soa_version' &&
    body.action !== 'submit_soa_version_review'
  ) {
    return applyCookies(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
  }

  if (!body.organizationId) {
    return applyCookies(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
  }

  const db = getDb()
  const hasAccess = await assertOrganizationAccess(db, user.id, body.organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  if (body.action === 'publish_soa_version') {
    const snapshot = await buildSoaReadinessSnapshot(db, body.organizationId)
    if (snapshot.length === 0) {
      return applyCookies(NextResponse.json({ error: 'No controls to publish' }, { status: 400 }))
    }

    const notReviewedCount = snapshot.filter((control) => control.soa_status === 'not_reviewed').length
    if (notReviewedCount > 0) {
      return applyCookies(NextResponse.json({ error: '適用管理策の判断に未判断の管理策が含まれています' }, { status: 400 }))
    }

    const submittedCount = snapshot.filter((control) => control.soa_approval_status === 'submitted').length
    if (submittedCount > 0) {
      return applyCookies(NextResponse.json({ error: '適用管理策の判断に承認待ちの管理策が含まれています' }, { status: 400 }))
    }

    const [{ maxVersion }] = await db
      .select({ maxVersion: sql<number>`coalesce(max(${soaVersions.versionNumber}), 0)` })
      .from(soaVersions)
      .where(eq(soaVersions.organizationId, body.organizationId))

    const versionNumber = Number(maxVersion ?? 0) + 1
    const now = new Date().toISOString()
    const approvedControlCount = snapshot.filter((control) => control.soa_approval_status === 'approved').length
    const changeSummary = typeof body.changeSummary === 'string'
      ? body.changeSummary.trim()
      : ''
    const version = {
      id: crypto.randomUUID(),
      organizationId: body.organizationId,
      versionNumber,
      title: `適用管理策判断 v${versionNumber}`,
      changeSummary: changeSummary || null,
      snapshot: JSON.stringify({
        generatedAt: now,
        organizationId: body.organizationId,
        changeSummary: changeSummary || null,
        controls: snapshot,
      }),
      controlCount: snapshot.length,
      approvedControlCount,
      publishedBy: user.id,
      publishedAt: now,
      reviewStatus: 'draft',
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: now,
    }

    const [created] = await db.insert(soaVersions).values(version).returning()

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: body.organizationId,
      userId: user.id,
      action: 'control.soa.version_published',
      resourceType: 'soa_version',
      resourceId: created.id,
      changes: JSON.stringify({
        version_number: created.versionNumber,
        change_summary: created.changeSummary,
        control_count: created.controlCount,
        approved_control_count: created.approvedControlCount,
      }),
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      scope: 'tenant',
    })

    return applyCookies(NextResponse.json({ ok: true, version: created }))
  }

  if (!body.id) {
    return applyCookies(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
  }

  if (body.action === 'submit_soa_version_review') {
    const [version] = await db
      .select()
      .from(soaVersions)
      .where(and(eq(soaVersions.id, body.id), eq(soaVersions.organizationId, body.organizationId)))
      .limit(1)

    if (!version) {
      return applyCookies(NextResponse.json({ error: '適用管理策判断版が見つかりません' }, { status: 404 }))
    }

    if (version.reviewStatus === 'submitted') {
      return applyCookies(NextResponse.json({ error: '適用管理策判断版はすでにレビュー申請中です' }, { status: 409 }))
    }

    const approvalService = new ApprovalService()
    const existingRequests = await approvalService.listRequests(body.organizationId, {
      status: 'pending',
      resourceType: 'soa_version',
    })
    if (existingRequests.some(request => request.resource_id === body.id)) {
      return applyCookies(NextResponse.json({ error: '適用管理策判断版のレビュー申請がすでに存在します' }, { status: 409 }))
    }

    const approverId = await resolveCisoApproverId(db, body.organizationId)
    const requestRow = await approvalService.createRequest({
      organization_id: body.organizationId,
      resource_type: 'soa_version',
      resource_id: body.id,
      requested_by: user.id,
      approver_id: approverId,
    })

    const now = new Date().toISOString()
    await db
      .update(soaVersions)
      .set({
        reviewStatus: 'submitted',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      })
      .where(and(eq(soaVersions.id, body.id), eq(soaVersions.organizationId, body.organizationId)))

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: body.organizationId,
      userId: user.id,
      action: 'control.soa.version_review_requested',
      resourceType: 'soa_version',
      resourceId: body.id,
      changes: JSON.stringify({
        version_number: version.versionNumber,
        approver_id: approverId,
        approval_request_id: requestRow.id,
        requested_at: now,
      }),
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      scope: 'tenant',
    })

    return applyCookies(NextResponse.json({ ok: true, request: requestRow }))
  }

  const [control] = await db
    .select()
    .from(isoControls)
    .where(and(eq(isoControls.id, body.id), eq(isoControls.organizationId, body.organizationId)))
    .limit(1)

  if (!control) {
    return applyCookies(NextResponse.json({ error: 'Control not found' }, { status: 404 }))
  }

  if (control.soaStatus === 'not_reviewed') {
    return applyCookies(NextResponse.json({ error: '適用管理策の判断が未完了です' }, { status: 400 }))
  }

  const approvalService = new ApprovalService()
  const existingRequests = await approvalService.listRequests(body.organizationId, {
    status: 'pending',
    resourceType: 'iso_control_soa',
  })
  if (existingRequests.some(request => request.resource_id === body.id)) {
    return applyCookies(NextResponse.json({ error: '適用管理策判断の承認申請がすでに存在します' }, { status: 409 }))
  }

  const approverId = await resolveCisoApproverId(db, body.organizationId)
  const requestRow = await approvalService.createRequest({
    organization_id: body.organizationId,
    resource_type: 'iso_control_soa',
    resource_id: body.id,
    requested_by: user.id,
    approver_id: approverId,
  })

  const now = new Date().toISOString()
  await db
    .update(isoControls)
    .set({
      soaApprovalStatus: 'submitted',
      soaRejectionReason: null,
      updatedAt: now,
    })
    .where(and(eq(isoControls.id, body.id), eq(isoControls.organizationId, body.organizationId)))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: body.organizationId,
    userId: user.id,
    action: 'control.soa.approval_requested',
    resourceType: 'iso_control',
    resourceId: body.id,
    changes: JSON.stringify({
      approver_id: approverId,
      approval_request_id: requestRow.id,
      soa_status: control.soaStatus,
    }),
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
    scope: 'tenant',
  })

  return applyCookies(NextResponse.json({ ok: true, request: requestRow }))
}
