import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { getDb } from '@/lib/db/drizzle/client'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import {
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

function buildTreatmentPayload(body: Record<string, unknown>): TreatmentPayload | null {
  if (typeof body.treatment_type !== 'string' || typeof body.description !== 'string' || !body.description.trim()) {
    return null
  }

  return {
    treatment_type: body.treatment_type,
    description: body.description.trim(),
    status: normalizeOptionalString(body.status),
    responsible_id: normalizeOptionalString(body.responsible_id),
    due_date: normalizeOptionalString(body.due_date),
    residual_review_due_date: normalizeOptionalString(body.residual_review_due_date),
    cost_estimate: typeof body.cost_estimate === 'number' ? body.cost_estimate : null,
    actual_cost: typeof body.actual_cost === 'number' ? body.actual_cost : null,
    effectiveness_rating: typeof body.effectiveness_rating === 'number' ? body.effectiveness_rating : null,
  }
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const controlIds = Array.isArray((body as Record<string, unknown>).controlIds)
    ? ((body as Record<string, unknown>).controlIds as unknown[]).filter((value): value is string => typeof value === 'string')
    : []
  const payload = buildTreatmentPayload(body as Record<string, unknown>)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid treatment payload' }, { status: 400 })
  }

  const db = getDb()
  const authorization = await resolveTenantAuthorizationContext(
    db,
    caller.userId,
    caller.organizationId
  )
  if (!authorization.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const treatment = await new ResidualAcceptanceSubmissionService(db).createTreatment({
      authorization: authorization.context,
      riskId: params.id,
      treatment: payload,
      controlIds,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json({ data: treatment }, { status: 201 })
  } catch (error) {
    if (isResidualAcceptanceSubmissionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
