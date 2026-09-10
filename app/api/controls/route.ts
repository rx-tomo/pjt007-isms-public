import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships, auditLogs } from '@/lib/db/drizzle/schema'
import { isoControls, riskControlLinks, riskTreatments, risks, soaVersions } from '@/lib/db/drizzle/schema/risks'
import { IsoControlService } from '@/lib/services/isoControl'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import {
  publishSoaVersionWithAudit,
  isSoaApprovalSubmissionError,
  submitSoaApprovalWithAudit,
  updateControlSoaWithAudit,
} from '@/lib/services/tenantAuditedMutations'

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

async function resolveCisoApproverId(
  db: ReturnType<typeof getDb>,
  organizationId: string,
  requesterId: string
) {
  const candidates = await db
    .select({
      id: userProfiles.id,
      isCiso: userProfiles.isCiso,
      role: userMemberships.role,
    })
    .from(userMemberships)
    .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
    .where(and(
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active'),
      eq(userProfiles.isActive, true)
    ))

  return candidates.find(candidate => candidate.id !== requesterId && candidate.isCiso === true)?.id
    ?? candidates.find(candidate => candidate.id !== requesterId && candidate.role === 'org_admin')?.id
    ?? null
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
  const authorization = await authorizeTenantAction(
    db,
    user.id,
    organizationId,
    'controls.read'
  )
  if (!authorization.ok) {
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

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const organizationId = searchParams.get('organizationId')
  if (!id || !organizationId) {
    return NextResponse.json({ error: 'Missing control id or organization id' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant',
    organizationId,
    allowedRoles: ['org_admin', 'system_operator'],
    actionName: 'iso_control.delete',
  })
  if (error || !guard) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  try {
    await db.transaction(async tx => {
      const authorization = await resolveTenantAuthorizationContext(
        tx as unknown as ReturnType<typeof getDb>,
        guard.userId,
        organizationId
      )
      if (
        !authorization.ok
        || !['org_admin', 'system_operator'].includes(authorization.context.role)
      ) {
        throw new Error('CONTROL_FORBIDDEN')
      }

      const [control] = await tx
        .select({ id: isoControls.id, title: isoControls.title })
        .from(isoControls)
        .where(and(eq(isoControls.id, id), eq(isoControls.organizationId, organizationId)))
        .limit(1)
      if (!control) throw new Error('CONTROL_NOT_FOUND')

      const linked = await tx
        .select({ id: riskControlLinks.id })
        .from(riskControlLinks)
        .where(eq(riskControlLinks.isoControlId, id))
        .limit(1)
      if (linked.length > 0) throw new Error('CONTROL_IN_USE')

      const result = await tx
        .delete(isoControls)
        .where(and(
          eq(isoControls.id, id),
          eq(isoControls.organizationId, organizationId)
        ))
      if (result.rowsAffected !== 1) throw new Error('CONTROL_DELETE_CONFLICT')

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: guard.userId,
        action: 'iso_control.deleted',
        resourceType: 'iso_control',
        resourceId: id,
        changes: JSON.stringify({ title: control.title }),
        userAgent: request.headers.get('user-agent'),
        scope: 'tenant',
        createdAt: new Date().toISOString(),
      })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('CONTROL_FORBIDDEN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message.includes('CONTROL_NOT_FOUND')) {
      return NextResponse.json({ error: 'Control not found' }, { status: 404 })
    }
    if (message.includes('CONTROL_IN_USE') || message.includes('linked to a risk treatment')) {
      return NextResponse.json({ error: 'Control is in use' }, { status: 409 })
    }
    if (message.includes('CONTROL_DELETE_CONFLICT')) {
      return NextResponse.json({ error: 'Conflict' }, { status: 409 })
    }
    console.error('Controls API DELETE failed', error)
    return NextResponse.json({ error: 'Failed to delete control' }, { status: 500 })
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
  const authorization = await authorizeTenantAction(
    db,
    user.id,
    body.organizationId,
    'controls.update'
  )
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const applicabilityReason = typeof body.soaApplicabilityReason === 'string'
    ? body.soaApplicabilityReason.trim()
    : ''
  const exclusionReason = typeof body.soaExclusionReason === 'string'
    ? body.soaExclusionReason.trim()
    : ''

  const updated = await updateControlSoaWithAudit(db, {
    organizationId: body.organizationId,
    actorUserId: user.id,
    controlId: body.id,
    soaStatus: body.soaStatus,
    soaApplicabilityReason: applicabilityReason || null,
    soaExclusionReason: exclusionReason || null,
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  if (!updated) {
    return applyCookies(NextResponse.json({ error: 'Control not found' }, { status: 404 }))
  }

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
  const authorization = await authorizeTenantAction(
    db,
    user.id,
    body.organizationId,
    body.action === 'publish_soa_version'
      ? 'controls.publish'
      : 'controls.submit'
  )
  if (!authorization.ok) {
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

    const approvedControlCount = snapshot.filter((control) => control.soa_approval_status === 'approved').length
    const changeSummary = typeof body.changeSummary === 'string'
      ? body.changeSummary.trim()
      : ''
    const created = await publishSoaVersionWithAudit(db, {
      organizationId: body.organizationId,
      actorUserId: user.id,
      snapshot,
      approvedControlCount,
      changeSummary: changeSummary || null,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
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

    const approverId = await resolveCisoApproverId(db, body.organizationId, user.id)
    if (!approverId) {
      return applyCookies(NextResponse.json(
        { error: '有効な承認者が見つかりません' },
        { status: 409 }
      ))
    }
    try {
      const requestRow = await submitSoaApprovalWithAudit(db, {
        organizationId: body.organizationId,
        actorUserId: user.id,
        resourceType: 'soa_version',
        resourceId: body.id,
        approverId,
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      })
      return applyCookies(NextResponse.json({ ok: true, request: requestRow }))
    } catch (error) {
      if (isSoaApprovalSubmissionError(error)) {
        return applyCookies(NextResponse.json(
          { error: error.message },
          { status: error.status }
        ))
      }
      throw error
    }
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

  const approverId = await resolveCisoApproverId(db, body.organizationId, user.id)
  if (!approverId) {
    return applyCookies(NextResponse.json(
      { error: '有効な承認者が見つかりません' },
      { status: 409 }
    ))
  }
  try {
    const requestRow = await submitSoaApprovalWithAudit(db, {
      organizationId: body.organizationId,
      actorUserId: user.id,
      resourceType: 'iso_control_soa',
      resourceId: body.id,
      approverId,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    })
    return applyCookies(NextResponse.json({ ok: true, request: requestRow }))
  } catch (error) {
    if (isSoaApprovalSubmissionError(error)) {
      return applyCookies(NextResponse.json(
        { error: error.message },
        { status: error.status }
      ))
    }
    throw error
  }
}
