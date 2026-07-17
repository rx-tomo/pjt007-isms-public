import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  RiskTenantLifecycleError,
  RiskTenantLifecycleService,
  type RiskPatchInput,
} from '@/lib/server/risks/riskTenantLifecycleService'
import type { RiskStatus, RiskUpdate } from '@/lib/services/risk'

type Params = { id: string }

const riskStatuses: RiskStatus[] = ['identified', 'analyzing', 'treating', 'monitoring', 'closed']

function isRiskLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

function isRiskStatus(value: unknown): value is RiskStatus {
  return typeof value === 'string' && riskStatuses.includes(value as RiskStatus)
}

function parseNullableString(value: unknown): string | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseAssetIds(value: unknown): string[] | undefined | false {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return false
  if (value.some(id => typeof id !== 'string' || id.trim().length === 0)) return false
  return [...new Set(value.map(id => (id as string).trim()))]
}

function parsePatch(body: Record<string, unknown>): RiskPatchInput | null {
  const updates: RiskUpdate = {}
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) return null
    updates.title = body.title.trim()
  }
  const description = parseNullableString(body.description)
  const categoryId = parseNullableString(body.category_id)
  const identifiedDate = parseNullableString(body.identified_date)
  const ownerId = parseNullableString(body.owner_id)
  if ([description, categoryId, identifiedDate, ownerId].includes(false)) return null
  if (description !== undefined) updates.description = description as string | null
  if (categoryId !== undefined) updates.category_id = categoryId as string | null
  if (identifiedDate !== undefined) updates.identified_date = identifiedDate as string | null
  if (ownerId !== undefined) updates.owner_id = ownerId as string | null
  if (body.impact_level !== undefined) {
    if (!isRiskLevel(body.impact_level)) return null
    updates.impact_level = body.impact_level
  }
  if (body.likelihood_level !== undefined) {
    if (!isRiskLevel(body.likelihood_level)) return null
    updates.likelihood_level = body.likelihood_level
  }
  if (body.status !== undefined) {
    if (!isRiskStatus(body.status)) return null
    updates.status = body.status
  }
  const assetIds = parseAssetIds(body.assetIds)
  if (assetIds === false) return null
  if (typeof body.expected_updated_at !== 'string' || !body.expected_updated_at.trim()) return null
  if (Object.keys(updates).length === 0 && assetIds === undefined) return null
  return { updates, assetIds, expectedUpdatedAt: body.expected_updated_at }
}

function errorResponse(error: unknown) {
  if (error instanceof RiskTenantLifecycleError) {
    const status = error.kind === 'malformed' ? 400 : error.kind === 'conflict' ? 409 : 404
    const message = status === 409 ? 'Conflict' : status === 400 ? 'Invalid request body' : 'Not found'
    return NextResponse.json({ error: message }, { status })
  }
  console.error('Risk detail API failed', error)
  return NextResponse.json({ error: 'Failed to process risk' }, { status: 500 })
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  const { id } = await props.params
  try {
    const data = await new RiskTenantLifecycleService(getDb()).getRisk(user.id, id)
    return applyCookies(NextResponse.json({ data }))
  } catch (error) {
    return applyCookies(errorResponse(error))
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const input = parsePatch(body as Record<string, unknown>)
  if (!input) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const { id } = await props.params
  try {
    const data = await new RiskTenantLifecycleService(getDb()).patchRisk(
      user.id,
      id,
      input,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data }))
  } catch (error) {
    return applyCookies(errorResponse(error))
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<Params> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  const { id } = await props.params
  try {
    await new RiskTenantLifecycleService(getDb()).deleteRisk(
      user.id,
      id,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ success: true }))
  } catch (error) {
    return applyCookies(errorResponse(error))
  }
}
