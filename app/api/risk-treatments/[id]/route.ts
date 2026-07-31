import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { getDb } from '@/lib/db/drizzle/client'
import {
  assertNoDirectResidualAcceptanceMutation,
  isResidualAcceptanceSubmissionError,
  ResidualAcceptanceSubmissionService,
} from '@/lib/server/approvals/residualAcceptanceSubmissionService'
import type { TreatmentPayload } from '@/lib/services/risk'

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
  if (body.residual_review_due_date !== undefined) updates.residual_review_due_date = normalizeOptionalString(body.residual_review_due_date)
  return updates
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const patch = body as Record<string, unknown>
  try {
    assertNoDirectResidualAcceptanceMutation(patch)
  } catch (error) {
    if (isResidualAcceptanceSubmissionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const db = getDb()
  const authorization = await authorizeTenantAction(
    db,
    caller.userId,
    caller.organizationId,
    'risks.update'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    )
  }
  const submissionService = new ResidualAcceptanceSubmissionService(db)

  const action = patch.action
  if (
    action === 'submitResidualAcceptance'
    || action === 'submit_residual_acceptance_approval'
  ) {
    try {
      const requestRow = await submissionService.submit({
        authorization: authorization.context,
        treatmentId: params.id,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json({
        ok: true,
        approvalRequest: requestRow,
        residualApprovalStatus: 'submitted',
      })
    } catch (error) {
      if (isResidualAcceptanceSubmissionError(error)) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }
  }

  const controlIds = Array.isArray(patch.controlIds)
    ? (patch.controlIds as unknown[]).filter((value): value is string => typeof value === 'string')
    : undefined
  const updates = buildTreatmentUpdates(patch)
  try {
    const treatment = await submissionService.updateTreatment({
      authorization: authorization.context,
      treatmentId: params.id,
      updates,
      controlIds,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json({ data: treatment })
  } catch (error) {
    if (isResidualAcceptanceSubmissionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
