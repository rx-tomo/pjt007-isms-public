import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  approvalEvents,
  approvalRequests,
  isoControls,
  organizationInvitations,
  soaVersions,
  taskTags,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'

type Database = ReturnType<typeof getDb>

type AuditContext = {
  organizationId: string
  actorUserId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export class SoaApprovalSubmissionError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'SoaApprovalSubmissionError'
  }
}

export function isSoaApprovalSubmissionError(
  error: unknown
): error is SoaApprovalSubmissionError {
  return error instanceof SoaApprovalSubmissionError
}

async function insertAuditLog(
  tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  context: AuditContext,
  event: {
    action: string
    resourceType: string
    resourceId: string
    changes: Record<string, unknown>
  },
  createdAt: string
) {
  await tx.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: context.organizationId,
    userId: context.actorUserId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    changes: JSON.stringify(event.changes),
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
    scope: 'tenant',
    createdAt,
  })
}

export async function updateControlSoaWithAudit(
  db: Database,
  input: AuditContext & {
    controlId: string
    soaStatus: 'not_reviewed' | 'applicable' | 'not_applicable'
    soaApplicabilityReason: string | null
    soaExclusionReason: string | null
  }
) {
  return db.transaction(async tx => {
    const [current] = await tx
      .select()
      .from(isoControls)
      .where(and(
        eq(isoControls.id, input.controlId),
        eq(isoControls.organizationId, input.organizationId)
      ))
      .limit(1)
    if (!current) return null

    const now = new Date().toISOString()
    const [updated] = await tx
      .update(isoControls)
      .set({
        soaStatus: input.soaStatus,
        soaApplicabilityReason: input.soaApplicabilityReason,
        soaExclusionReason: input.soaStatus === 'not_applicable'
          ? input.soaExclusionReason
          : null,
        soaReviewedBy: input.actorUserId,
        soaReviewedAt: now,
        soaApprovalStatus: 'draft',
        soaApprovedBy: null,
        soaApprovedAt: null,
        soaRejectionReason: null,
        updatedAt: now,
      })
      .where(and(
        eq(isoControls.id, input.controlId),
        eq(isoControls.organizationId, input.organizationId)
      ))
      .returning()

    await insertAuditLog(tx, input, {
      action: 'control.soa_decision.updated',
      resourceType: 'iso_control',
      resourceId: input.controlId,
      changes: {
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
      },
    }, now)

    return updated
  })
}

export async function publishSoaVersionWithAudit(
  db: Database,
  input: AuditContext & {
    snapshot: unknown[]
    approvedControlCount: number
    changeSummary: string | null
  }
) {
  return db.transaction(async tx => {
    const [{ maxVersion }] = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${soaVersions.versionNumber}), 0)` })
      .from(soaVersions)
      .where(eq(soaVersions.organizationId, input.organizationId))

    const versionNumber = Number(maxVersion ?? 0) + 1
    const now = new Date().toISOString()
    const [created] = await tx
      .insert(soaVersions)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        versionNumber,
        title: `適用管理策判断 v${versionNumber}`,
        changeSummary: input.changeSummary,
        snapshot: JSON.stringify({
          generatedAt: now,
          organizationId: input.organizationId,
          changeSummary: input.changeSummary,
          controls: input.snapshot,
        }),
        controlCount: input.snapshot.length,
        approvedControlCount: input.approvedControlCount,
        publishedBy: input.actorUserId,
        publishedAt: now,
        reviewStatus: 'draft',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: now,
      })
      .returning()

    await insertAuditLog(tx, input, {
      action: 'control.soa.version_published',
      resourceType: 'soa_version',
      resourceId: created.id,
      changes: {
        version_number: created.versionNumber,
        change_summary: created.changeSummary,
        control_count: created.controlCount,
        approved_control_count: created.approvedControlCount,
      },
    }, now)

    return created
  })
}

export async function createTaskTagWithAudit(
  db: Database,
  input: AuditContext & {
    name: string
    color: string | null
  }
) {
  return db.transaction(async tx => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await tx.insert(taskTags).values({
      id,
      organizationId: input.organizationId,
      name: input.name,
      color: input.color,
      createdAt: now,
    })
    await insertAuditLog(tx, input, {
      action: 'task.tag.created',
      resourceType: 'task_tag',
      resourceId: id,
      changes: { name: input.name, color: input.color },
    }, now)

    return {
      id,
      organization_id: input.organizationId,
      name: input.name,
      color: input.color,
      created_at: now,
    }
  })
}

export async function createInvitationWithAudit(
  db: Database,
  input: AuditContext & {
    email: string
    role: string
    token: string
    expiresAt: string
    createdAt: string
  }
) {
  return db.transaction(async tx => {
    const [invitation] = await tx
      .insert(organizationInvitations)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        invitedBy: input.actorUserId,
        token: input.token,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      })
      .returning()

    await insertAuditLog(tx, input, {
      action: 'user.invited',
      resourceType: 'organization_invitation',
      resourceId: invitation.id,
      changes: { email: input.email, role: input.role },
    }, input.createdAt)

    return invitation
  })
}

export async function submitSoaApprovalWithAudit(
  db: Database,
  input: AuditContext & {
    resourceType: 'soa_version' | 'iso_control_soa'
    resourceId: string
    approverId: string
  }
) {
  return db.transaction(async tx => {
    if (input.actorUserId === input.approverId) {
      throw new SoaApprovalSubmissionError(409, 'Requester cannot approve their own request')
    }

    const [approver] = await tx
      .select({
        id: userProfiles.id,
        isActive: userProfiles.isActive,
        isCiso: userProfiles.isCiso,
        membershipRole: userMemberships.role,
        membershipStatus: userMemberships.status,
      })
      .from(userMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
      .where(and(
        eq(userMemberships.userId, input.approverId),
        eq(userMemberships.organizationId, input.organizationId)
      ))
      .limit(1)
    if (
      !approver
      || approver.isActive !== true
      || approver.membershipStatus !== 'active'
      || (approver.isCiso !== true && approver.membershipRole !== 'org_admin')
    ) {
      throw new SoaApprovalSubmissionError(409, 'Eligible approver not found')
    }

    const [pending] = await tx
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.organizationId, input.organizationId),
        eq(approvalRequests.resourceType, input.resourceType),
        eq(approvalRequests.resourceId, input.resourceId),
        eq(approvalRequests.status, 'pending')
      ))
      .limit(1)
    if (pending) {
      throw new SoaApprovalSubmissionError(409, 'Approval request already exists')
    }

    const now = new Date().toISOString()
    const due = new Date(now)
    due.setDate(due.getDate() + 7)
    const requestId = crypto.randomUUID()

    let resourceVersionNumber: number | null = null
    let resourceSoaStatus: string | null = null
    if (input.resourceType === 'soa_version') {
      const [version] = await tx
        .select({
          id: soaVersions.id,
          versionNumber: soaVersions.versionNumber,
          reviewStatus: soaVersions.reviewStatus,
        })
        .from(soaVersions)
        .where(and(
          eq(soaVersions.id, input.resourceId),
          eq(soaVersions.organizationId, input.organizationId)
        ))
        .limit(1)
      if (!version) {
        throw new SoaApprovalSubmissionError(404, 'SoA version not found')
      }
      if (version.reviewStatus === 'submitted') {
        throw new SoaApprovalSubmissionError(409, 'SoA version is already submitted')
      }
      resourceVersionNumber = version.versionNumber
    } else {
      const [control] = await tx
        .select({
          id: isoControls.id,
          soaStatus: isoControls.soaStatus,
        })
        .from(isoControls)
        .where(and(
          eq(isoControls.id, input.resourceId),
          eq(isoControls.organizationId, input.organizationId)
        ))
        .limit(1)
      if (!control) {
        throw new SoaApprovalSubmissionError(404, 'Control not found')
      }
      if (control.soaStatus === 'not_reviewed') {
        throw new SoaApprovalSubmissionError(400, 'SoA decision is not complete')
      }
      resourceSoaStatus = control.soaStatus
    }

    await tx.insert(approvalRequests).values({
      id: requestId,
      organizationId: input.organizationId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: 'pending',
      requestedBy: input.actorUserId,
      requestedAt: now,
      approverId: input.approverId,
      dueAt: due.toISOString(),
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(approvalEvents).values({
      id: crypto.randomUUID(),
      approvalRequestId: requestId,
      eventType: 'requested',
      actorId: input.actorUserId,
      payload: JSON.stringify({
        approver_id: input.approverId,
        due_at: due.toISOString(),
      }),
      createdAt: now,
    })

    if (input.resourceType === 'soa_version') {
      await tx
        .update(soaVersions)
        .set({
          reviewStatus: 'submitted',
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        })
        .where(and(
          eq(soaVersions.id, input.resourceId),
          eq(soaVersions.organizationId, input.organizationId)
        ))
    } else {
      await tx
        .update(isoControls)
        .set({
          soaApprovalStatus: 'submitted',
          soaRejectionReason: null,
          updatedAt: now,
        })
        .where(and(
          eq(isoControls.id, input.resourceId),
          eq(isoControls.organizationId, input.organizationId)
        ))
    }

    await insertAuditLog(tx, input, {
      action: input.resourceType === 'soa_version'
        ? 'control.soa.version_review_requested'
        : 'control.soa.approval_requested',
      resourceType: input.resourceType === 'soa_version'
        ? 'soa_version'
        : 'iso_control',
      resourceId: input.resourceId,
      changes: input.resourceType === 'soa_version'
        ? {
          version_number: resourceVersionNumber,
          approver_id: input.approverId,
          approval_request_id: requestId,
          requested_at: now,
        }
        : {
          approver_id: input.approverId,
          approval_request_id: requestId,
          soa_status: resourceSoaStatus,
        },
    }, now)

    return {
      id: requestId,
      organization_id: input.organizationId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      status: 'pending' as const,
      requested_by: input.actorUserId,
      requested_at: now,
      approver_id: input.approverId,
      approved_at: null,
      rejection_reason: null,
      due_at: due.toISOString(),
      notified_at: null,
      escalation_notified_at: null,
      step_number: null,
      reverted_at: null,
      revert_reason: null,
      created_at: now,
      updated_at: now,
    }
  })
}
