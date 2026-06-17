import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { getAuditLogRepository, getRiskRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema'
import { isoControls, riskTreatments, risks } from '@/lib/db/drizzle/schema/risks'
import { ApprovalService } from '@/lib/services/approval'
import type { TreatmentPayload } from '@/lib/services/risk'
import type { Json } from '@/types/database.types'

type Params = { id: string }

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildTreatmentUpdates(body: Record<string, unknown>): Partial<TreatmentPayload> {
  const updates: Partial<TreatmentPayload> = {}
  if (typeof body.treatment_type === 'string') updates.treatment_type = body.treatment_type
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (body.status !== undefined) updates.status = normalizeOptionalString(body.status)
  if (body.responsible_id !== undefined) updates.responsible_id = normalizeOptionalString(body.responsible_id)
  if (body.due_date !== undefined) updates.due_date = normalizeOptionalString(body.due_date)
  if (typeof body.cost_estimate === 'number') updates.cost_estimate = body.cost_estimate
  if (typeof body.actual_cost === 'number') updates.actual_cost = body.actual_cost
  if (typeof body.effectiveness_rating === 'number') updates.effectiveness_rating = body.effectiveness_rating
  if (typeof body.residual_approval_status === 'string') updates.residual_approval_status = body.residual_approval_status
  if (body.residual_approved_by !== undefined) updates.residual_approved_by = normalizeOptionalString(body.residual_approved_by)
  if (body.residual_approved_at !== undefined) updates.residual_approved_at = normalizeOptionalString(body.residual_approved_at)
  if (body.residual_rejection_reason !== undefined) updates.residual_rejection_reason = normalizeOptionalString(body.residual_rejection_reason)
  if (body.residual_review_due_date !== undefined) updates.residual_review_due_date = normalizeOptionalString(body.residual_review_due_date)
  return updates
}

async function getTreatmentScope(treatmentId: string) {
  const db = getDb()
  const rows = await db
    .select({
      treatmentId: riskTreatments.id,
      treatmentType: riskTreatments.treatmentType,
      treatmentStatus: riskTreatments.status,
      residualApprovalStatus: riskTreatments.residualApprovalStatus,
      residualReviewDueDate: riskTreatments.residualReviewDueDate,
      responsibleId: riskTreatments.responsibleId,
      riskId: riskTreatments.riskId,
      riskTitle: risks.title,
      organizationId: risks.organizationId,
    })
    .from(riskTreatments)
    .innerJoin(risks, eq(riskTreatments.riskId, risks.id))
    .where(eq(riskTreatments.id, treatmentId))
    .limit(1)

  return rows[0] ?? null
}

async function resolveResidualAcceptanceApprover(organizationId: string, responsibleId?: string | null) {
  const db = getDb()
  if (responsibleId) {
    const [responsible] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(and(
        eq(userProfiles.id, responsibleId),
        eq(userProfiles.organizationId, organizationId)
      ))
      .limit(1)

    if (responsible?.id) return responsible.id
  }

  const [ciso] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isCiso, true)
    ))
    .limit(1)

  if (ciso?.id) return ciso.id

  const [orgAdmin] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.role, 'org_admin')
    ))
    .limit(1)

  return orgAdmin?.id ?? null
}

async function assertControlsBelongToOrganization(controlIds: string[], organizationId: string) {
  if (controlIds.length === 0) return true
  const db = getDb()
  const rows = await db
    .select({ id: isoControls.id })
    .from(isoControls)
    .where(and(
      eq(isoControls.organizationId, organizationId),
      inArray(isoControls.id, controlIds)
    ))

  return new Set(rows.map(row => row.id)).size === controlIds.length
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const scope = await getTreatmentScope(params.id)
  if (!scope || scope.organizationId !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const action = (body as Record<string, unknown>).action
  if (action === 'submit_residual_acceptance_approval') {
    if (scope.treatmentType !== 'accept') {
      return NextResponse.json({ error: 'Only accept treatments can be submitted' }, { status: 400 })
    }
    if (scope.treatmentStatus !== 'completed') {
      return NextResponse.json({ error: 'Residual acceptance must be completed before approval request' }, { status: 400 })
    }
    if (!scope.residualReviewDueDate) {
      return NextResponse.json({ error: 'Residual acceptance review due date is required before approval request' }, { status: 400 })
    }
    if (scope.residualApprovalStatus === 'submitted' || scope.residualApprovalStatus === 'approved') {
      return NextResponse.json({ error: 'Residual acceptance approval request already exists' }, { status: 409 })
    }

    const approvalService = new ApprovalService()
    const existingRequests = await approvalService.listRequests(caller.organizationId, {
      status: 'pending',
      resourceType: 'risk_residual_acceptance',
    })
    if (existingRequests.some((requestRow) => requestRow.resource_id === params.id)) {
      return NextResponse.json({ error: 'Residual acceptance approval request already exists' }, { status: 409 })
    }

    const approverId = await resolveResidualAcceptanceApprover(caller.organizationId, scope.responsibleId)
    const requestRow = await approvalService.createRequest({
      organization_id: caller.organizationId,
      resource_type: 'risk_residual_acceptance',
      resource_id: params.id,
      requested_by: caller.userId,
      approver_id: approverId,
      step_number: 1,
    })

    const now = new Date().toISOString()
    await getDb()
      .update(riskTreatments)
      .set({
        residualApprovalStatus: 'submitted',
        residualApprovedBy: null,
        residualApprovedAt: null,
        residualRejectionReason: null,
        updatedAt: now,
      })
      .where(eq(riskTreatments.id, params.id))

    const auditLog = await getAuditLogRepository()
    await auditLog.log({
      organizationId: caller.organizationId,
      userId: caller.userId,
      action: 'risk.residual_acceptance.approval_requested',
      resourceType: 'risk_treatment',
      resourceId: params.id,
      changes: {
        risk_id: scope.riskId,
        risk_title: scope.riskTitle,
        approval_request_id: requestRow.id,
        approver_id: approverId,
      } as Json,
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      ok: true,
      approvalRequest: requestRow,
      residualApprovalStatus: 'submitted',
    })
  }

  const controlIds = Array.isArray((body as Record<string, unknown>).controlIds)
    ? ((body as Record<string, unknown>).controlIds as unknown[]).filter((value): value is string => typeof value === 'string')
    : undefined

  if (controlIds && !(await assertControlsBelongToOrganization(controlIds, caller.organizationId))) {
    return NextResponse.json({ error: 'Invalid controlIds' }, { status: 400 })
  }

  const updates = buildTreatmentUpdates(body as Record<string, unknown>)
  const shouldResetRejectedResidualAcceptance =
    scope.treatmentType === 'accept' &&
    scope.residualApprovalStatus === 'rejected' &&
    (Object.keys(updates).length > 0 || controlIds !== undefined)

  if (shouldResetRejectedResidualAcceptance) {
    updates.residual_approval_status = 'draft'
    updates.residual_approved_by = null
    updates.residual_approved_at = null
    updates.residual_rejection_reason = null
  }

  const repo = await getRiskRepository()
  const treatment = await repo.updateTreatment(params.id, updates, controlIds)

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: caller.organizationId,
    userId: caller.userId,
    action: 'risk.treatment.updated',
    resourceType: 'risk_treatment',
    resourceId: params.id,
    changes: { risk_id: scope.riskId, ...updates, controlIds } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  if (shouldResetRejectedResidualAcceptance) {
    await auditLog.log({
      organizationId: caller.organizationId,
      userId: caller.userId,
      action: 'risk.residual_acceptance.revised',
      resourceType: 'risk_treatment',
      resourceId: params.id,
      changes: {
        risk_id: scope.riskId,
        risk_title: scope.riskTitle,
        residual_approval_status: 'draft',
        revised_fields: Object.keys(updates),
        controlIds,
      } as Json,
      userAgent: request.headers.get('user-agent'),
    })
  }

  return NextResponse.json({ data: treatment })
}
