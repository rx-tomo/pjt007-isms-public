import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { getAuditLogRepository, getRiskRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import { isoControls } from '@/lib/db/drizzle/schema/risks'
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

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const repo = await getRiskRepository()
  const risk = await repo.findByIdWithRelations(params.id)
  if (!risk || risk.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const controlIds = Array.isArray((body as Record<string, unknown>).controlIds)
    ? ((body as Record<string, unknown>).controlIds as unknown[]).filter((value): value is string => typeof value === 'string')
    : []
  const controlsOk = await assertControlsBelongToOrganization(controlIds, caller.organizationId)
  if (!controlsOk) {
    return NextResponse.json({ error: 'Invalid controlIds' }, { status: 400 })
  }

  const payload = buildTreatmentPayload(body as Record<string, unknown>)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid treatment payload' }, { status: 400 })
  }

  const treatment = await repo.createTreatment(params.id, payload, controlIds)

  const auditLog = await getAuditLogRepository()
  await auditLog.log({
    organizationId: caller.organizationId,
    userId: caller.userId,
    action: 'risk.treatment.created',
    resourceType: 'risk_treatment',
    resourceId: treatment.id,
    changes: { risk_id: params.id, controlIds } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ data: treatment }, { status: 201 })
}
