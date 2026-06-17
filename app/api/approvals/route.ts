import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs, userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { isoControls, riskTreatments, risks, soaVersions } from '@/lib/db/drizzle/schema/risks'
import { ApprovalService, type ApprovalRequestStatus } from '@/lib/services/approval'
import { AuditService } from '@/lib/services/audit'
import { DocumentService } from '@/lib/services/document'
import { IncidentService } from '@/lib/services/incident'

const APPROVAL_VIEWER_ROLES = new Set(['approver', 'org_admin', 'system_operator'])
const REVERT_ROLES = new Set(['org_admin', 'system_operator'])

async function approveIsoControlSoa(input: {
  requestId: string
  controlId: string
  actorId: string
  comment?: string
}) {
  const db = getDb()
  const [control] = await db
    .select()
    .from(isoControls)
    .where(eq(isoControls.id, input.controlId))
    .limit(1)

  if (!control) {
    throw new Error('適用管理策判断の対象管理策が見つかりません')
  }

  const approvalService = new ApprovalService()
  await approvalService.approveRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    comment: input.comment,
  })

  const now = new Date().toISOString()
  await db
    .update(isoControls)
    .set({
      soaApprovalStatus: 'approved',
      soaApprovedBy: input.actorId,
      soaApprovedAt: now,
      soaRejectionReason: null,
      updatedAt: now,
    })
    .where(eq(isoControls.id, input.controlId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: control.organizationId,
    userId: input.actorId,
    action: 'control.soa.approved',
    resourceType: 'iso_control',
    resourceId: input.controlId,
    changes: JSON.stringify({ approval_request_id: input.requestId, comment: input.comment ?? null }),
    scope: 'tenant',
  })
}

async function rejectIsoControlSoa(input: {
  requestId: string
  controlId: string
  actorId: string
  reason: string
}) {
  const db = getDb()
  const [control] = await db
    .select()
    .from(isoControls)
    .where(eq(isoControls.id, input.controlId))
    .limit(1)

  if (!control) {
    throw new Error('適用管理策判断の対象管理策が見つかりません')
  }

  const approvalService = new ApprovalService()
  await approvalService.rejectRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    reason: input.reason,
  })

  const now = new Date().toISOString()
  await db
    .update(isoControls)
    .set({
      soaApprovalStatus: 'rejected',
      soaApprovedBy: null,
      soaApprovedAt: null,
      soaRejectionReason: input.reason,
      updatedAt: now,
    })
    .where(eq(isoControls.id, input.controlId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: control.organizationId,
    userId: input.actorId,
    action: 'control.soa.rejected',
    resourceType: 'iso_control',
    resourceId: input.controlId,
    changes: JSON.stringify({ approval_request_id: input.requestId, reason: input.reason }),
    scope: 'tenant',
  })
}

async function approveSoaVersion(input: {
  requestId: string
  versionId: string
  actorId: string
  comment?: string
}) {
  const db = getDb()
  const [version] = await db
    .select()
    .from(soaVersions)
    .where(eq(soaVersions.id, input.versionId))
    .limit(1)

  if (!version) {
    throw new Error('適用管理策判断版が見つかりません')
  }

  const approvalService = new ApprovalService()
  await approvalService.approveRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    comment: input.comment,
  })

  const now = new Date().toISOString()
  await db
    .update(soaVersions)
    .set({
      reviewStatus: 'approved',
      reviewedBy: input.actorId,
      reviewedAt: now,
      rejectionReason: null,
    })
    .where(eq(soaVersions.id, input.versionId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: version.organizationId,
    userId: input.actorId,
    action: 'control.soa.version_review_approved',
    resourceType: 'soa_version',
    resourceId: input.versionId,
    changes: JSON.stringify({
      approval_request_id: input.requestId,
      version_number: version.versionNumber,
      comment: input.comment ?? null,
    }),
    scope: 'tenant',
  })
}

async function rejectSoaVersion(input: {
  requestId: string
  versionId: string
  actorId: string
  reason: string
}) {
  const db = getDb()
  const [version] = await db
    .select()
    .from(soaVersions)
    .where(eq(soaVersions.id, input.versionId))
    .limit(1)

  if (!version) {
    throw new Error('適用管理策判断版が見つかりません')
  }

  const approvalService = new ApprovalService()
  await approvalService.rejectRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    reason: input.reason,
  })

  const now = new Date().toISOString()
  await db
    .update(soaVersions)
    .set({
      reviewStatus: 'rejected',
      reviewedBy: null,
      reviewedAt: now,
      rejectionReason: input.reason,
    })
    .where(eq(soaVersions.id, input.versionId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: version.organizationId,
    userId: input.actorId,
    action: 'control.soa.version_review_rejected',
    resourceType: 'soa_version',
    resourceId: input.versionId,
    changes: JSON.stringify({
      approval_request_id: input.requestId,
      version_number: version.versionNumber,
      reason: input.reason,
    }),
    scope: 'tenant',
  })
}

async function approveResidualAcceptance(input: {
  requestId: string
  treatmentId: string
  actorId: string
  comment?: string
}) {
  const db = getDb()
  const [treatment] = await db
    .select({
      id: riskTreatments.id,
      riskId: riskTreatments.riskId,
      organizationId: risks.organizationId,
    })
    .from(riskTreatments)
    .innerJoin(risks, eq(riskTreatments.riskId, risks.id))
    .where(eq(riskTreatments.id, input.treatmentId))
    .limit(1)

  if (!treatment) {
    throw new Error('Residual acceptance treatment not found')
  }
  if (!treatment.organizationId) {
    throw new Error('Residual acceptance organization not found')
  }

  const approvalService = new ApprovalService()
  await approvalService.approveRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    comment: input.comment,
  })

  const now = new Date().toISOString()
  await db
    .update(riskTreatments)
    .set({
      residualApprovalStatus: 'approved',
      residualApprovedBy: input.actorId,
      residualApprovedAt: now,
      residualRejectionReason: null,
      updatedAt: now,
    })
    .where(eq(riskTreatments.id, input.treatmentId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: treatment.organizationId,
    userId: input.actorId,
    action: 'risk.residual_acceptance.approved',
    resourceType: 'risk_treatment',
    resourceId: input.treatmentId,
    changes: JSON.stringify({
      risk_id: treatment.riskId,
      approval_request_id: input.requestId,
      comment: input.comment ?? null,
    }),
    scope: 'tenant',
  })
}

async function rejectResidualAcceptance(input: {
  requestId: string
  treatmentId: string
  actorId: string
  reason: string
}) {
  const db = getDb()
  const [treatment] = await db
    .select({
      id: riskTreatments.id,
      riskId: riskTreatments.riskId,
      organizationId: risks.organizationId,
    })
    .from(riskTreatments)
    .innerJoin(risks, eq(riskTreatments.riskId, risks.id))
    .where(eq(riskTreatments.id, input.treatmentId))
    .limit(1)

  if (!treatment) {
    throw new Error('Residual acceptance treatment not found')
  }
  if (!treatment.organizationId) {
    throw new Error('Residual acceptance organization not found')
  }

  const approvalService = new ApprovalService()
  await approvalService.rejectRequest({
    requestId: input.requestId,
    actorId: input.actorId,
    reason: input.reason,
  })

  const now = new Date().toISOString()
  await db
    .update(riskTreatments)
    .set({
      residualApprovalStatus: 'rejected',
      residualApprovedBy: null,
      residualApprovedAt: null,
      residualRejectionReason: input.reason,
      updatedAt: now,
    })
    .where(eq(riskTreatments.id, input.treatmentId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: treatment.organizationId,
    userId: input.actorId,
    action: 'risk.residual_acceptance.rejected',
    resourceType: 'risk_treatment',
    resourceId: input.treatmentId,
    changes: JSON.stringify({
      risk_id: treatment.riskId,
      approval_request_id: input.requestId,
      reason: input.reason,
    }),
    scope: 'tenant',
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: string | null): ApprovalRequestStatus | undefined {
  if (!value) return undefined
  if (['pending', 'approved', 'rejected', 'expired'].includes(value)) {
    return value as ApprovalRequestStatus
  }
  return undefined
}

async function getOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({
        id: userMemberships.id,
        role: userMemberships.role,
      })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  const profileAccess = profile?.organizationId === organizationId
  const membershipAccess = Boolean(membership)
  const role = membership?.role ?? (profileAccess ? profile?.role : null)

  return {
    hasAccess: profileAccess || membershipAccess,
    role,
    canView: Boolean(role && APPROVAL_VIEWER_ROLES.has(role)),
    canRevert: Boolean(role && REVERT_ROLES.has(role)),
  }
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const access = await getOrganizationAccess(db, user.id, organizationId)
  if (!access.hasAccess || !access.canView) {
    return applyCookies(forbidden())
  }

  const service = new ApprovalService()
  const status = parseStatus(searchParams.get('status'))
  const requests = await service.listRequests(organizationId, {
    status,
    approverId: access.role === 'approver' && status === 'pending' ? user.id : undefined,
  })

  return applyCookies(NextResponse.json(requests))
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null)
    if (!isRecord(body) || typeof body.action !== 'string' || typeof body.requestId !== 'string') {
      return applyCookies(NextResponse.json({ error: 'Invalid approval action payload' }, { status: 400 }))
    }

    const approvalService = new ApprovalService()
    const requestRow = await approvalService.getRequestById(body.requestId)
    if (!requestRow) {
      return applyCookies(NextResponse.json({ error: 'Approval request not found' }, { status: 404 }))
    }

    const db = getDb()
    const access = await getOrganizationAccess(db, user.id, requestRow.organization_id)
    if (!access.hasAccess || !access.canView) {
      return applyCookies(forbidden())
    }

    if (access.role === 'approver' && requestRow.approver_id && requestRow.approver_id !== user.id) {
      return applyCookies(forbidden())
    }

    const action = body.action
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const comment = typeof body.comment === 'string' ? body.comment.trim() : undefined

    if (action === 'approve') {
      if (requestRow.resource_type === 'document') {
        await new DocumentService().approveDocument(requestRow.resource_id)
      } else if (requestRow.resource_type === 'incident') {
        await new IncidentService().approveIncident({
          incidentId: requestRow.resource_id,
          actorId: user.id,
        })
      } else if (requestRow.resource_type === 'audit_plan') {
        await new AuditService().approveAuditPlan({
          planId: requestRow.resource_id,
          actorId: user.id,
          comment,
        })
      } else if (requestRow.resource_type === 'audit_report') {
        await new AuditService().approveAuditReport({
          reportId: requestRow.resource_id,
          actorId: user.id,
          comment,
        })
      } else if (requestRow.resource_type === 'nonconformity_closure') {
        await new AuditService().approveCorrectiveActionClosure({
          actionId: requestRow.resource_id,
          actorId: user.id,
          comment,
        })
      } else if (requestRow.resource_type === 'iso_control_soa') {
        await approveIsoControlSoa({
          requestId: requestRow.id,
          controlId: requestRow.resource_id,
          actorId: user.id,
          comment,
        })
      } else if (requestRow.resource_type === 'soa_version') {
        await approveSoaVersion({
          requestId: requestRow.id,
          versionId: requestRow.resource_id,
          actorId: user.id,
          comment,
        })
      } else if (requestRow.resource_type === 'risk_residual_acceptance') {
        await approveResidualAcceptance({
          requestId: requestRow.id,
          treatmentId: requestRow.resource_id,
          actorId: user.id,
          comment,
        })
      } else {
        await approvalService.approveRequest({
          requestId: requestRow.id,
          actorId: user.id,
          comment,
        })
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'reject') {
      if (!reason) {
        return applyCookies(NextResponse.json({ error: 'Missing rejection reason' }, { status: 400 }))
      }

      if (requestRow.resource_type === 'document') {
        await new DocumentService().rejectDocument(requestRow.resource_id, reason)
      } else if (requestRow.resource_type === 'incident') {
        await new IncidentService().rejectIncident({
          incidentId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else if (requestRow.resource_type === 'audit_plan') {
        await new AuditService().rejectAuditPlan({
          planId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else if (requestRow.resource_type === 'audit_report') {
        await new AuditService().rejectAuditReport({
          reportId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else if (requestRow.resource_type === 'nonconformity_closure') {
        await new AuditService().rejectCorrectiveActionClosure({
          actionId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else if (requestRow.resource_type === 'iso_control_soa') {
        await rejectIsoControlSoa({
          requestId: requestRow.id,
          controlId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else if (requestRow.resource_type === 'soa_version') {
        await rejectSoaVersion({
          requestId: requestRow.id,
          versionId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else if (requestRow.resource_type === 'risk_residual_acceptance') {
        await rejectResidualAcceptance({
          requestId: requestRow.id,
          treatmentId: requestRow.resource_id,
          actorId: user.id,
          reason,
        })
      } else {
        await approvalService.rejectRequest({
          requestId: requestRow.id,
          actorId: user.id,
          reason,
        })
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'revert') {
      if (!access.canRevert) {
        return applyCookies(forbidden())
      }
      if (!reason) {
        return applyCookies(NextResponse.json({ error: 'Missing revert reason' }, { status: 400 }))
      }

      await approvalService.revertApprovalRequest({
        requestId: requestRow.id,
        revertedBy: user.id,
        reason,
        organizationId: requestRow.organization_id,
      })

      return applyCookies(NextResponse.json({ ok: true }))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 }))
  } catch (error) {
    console.error('Approvals API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update approval request' }, { status: 500 }))
  }
}
