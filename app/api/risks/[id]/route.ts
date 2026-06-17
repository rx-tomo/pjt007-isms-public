import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { getAuditLogRepository, getRiskRepository } from '@/lib/container'
import { RiskService } from '@/lib/services/risk'
import type { RiskStatus, RiskUpdate } from '@/lib/services/risk'
import type { Json } from '@/types/database.types'

type Params = { id: string }

const service = new RiskService()
const riskStatuses: RiskStatus[] = ['identified', 'analyzing', 'treating', 'monitoring', 'closed']

function isRiskLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

function isRiskStatus(value: unknown): value is RiskStatus {
  return typeof value === 'string' && riskStatuses.includes(value as RiskStatus)
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseAssetIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return undefined
  return value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
}

function buildRiskUpdate(body: Record<string, unknown>): RiskUpdate {
  const updates: RiskUpdate = {}

  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
  if (body.description !== undefined) updates.description = normalizeOptionalString(body.description)
  if (body.category_id !== undefined) updates.category_id = normalizeOptionalString(body.category_id)
  if (isRiskLevel(body.impact_level)) updates.impact_level = body.impact_level
  if (isRiskLevel(body.likelihood_level)) updates.likelihood_level = body.likelihood_level
  if (isRiskStatus(body.status)) updates.status = body.status
  if (body.identified_date !== undefined) updates.identified_date = normalizeOptionalString(body.identified_date)
  if (body.owner_id !== undefined) updates.owner_id = normalizeOptionalString(body.owner_id)

  return updates
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const risk = await service.getRiskById(params.id)

  if (!risk || risk.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ data: risk })
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const repo = await getRiskRepository()
  const existing = await repo.findByIdWithRelations(params.id)

  if (!existing || existing.organization_id !== caller.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates = buildRiskUpdate(body as Record<string, unknown>)
  const assetIds = parseAssetIds((body as Record<string, unknown>).assetIds)
  const updatesCount = Object.keys(updates).length
  if (updatesCount === 0 && assetIds === undefined) {
    return NextResponse.json({ data: existing })
  }

  let updated = existing
  if (updatesCount > 0) {
    const updateResult = await repo.update(params.id, updates)
    if (!updateResult) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    updated = updateResult
  }

  if (updates.impact_level !== undefined || updates.likelihood_level !== undefined) {
    await repo.createAssessmentHistory(params.id, caller.userId, {
      impactLevel: existing.impact_level,
      likelihoodLevel: existing.likelihood_level,
    })
  }

  const auditLog = await getAuditLogRepository()
  if (assetIds !== undefined) {
    await repo.setRiskAssets(params.id, assetIds)
  }

  await auditLog.log({
    organizationId: caller.organizationId,
    userId: caller.userId,
    action: 'risk.updated',
    resourceType: 'risk',
    resourceId: params.id,
    changes: {
      ...updates,
      ...(assetIds !== undefined ? { assetIds } : {}),
    } as Json,
    userAgent: request.headers.get('user-agent'),
  })

  const risk = await repo.findByIdWithRelations(params.id)
  return NextResponse.json({ data: risk ?? updated })
}
