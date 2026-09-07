import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import {
  RiskTenantLifecycleError,
  RiskTenantLifecycleService,
  type RiskCreateInput,
} from '@/lib/server/risks/riskTenantLifecycleService'
import { projectRiskForCapabilities } from '@/lib/server/risks/riskOutputProjection'
import { RiskService } from '@/lib/services/risk'
import type { RiskStatus } from '@/lib/db/repositories/interfaces/IRiskRepository'

const statuses: RiskStatus[] = ['identified', 'analyzing', 'treating', 'monitoring', 'closed']

function parseStatus(value: unknown): RiskStatus | undefined {
  return typeof value === 'string' && statuses.includes(value as RiskStatus)
    ? value as RiskStatus
    : undefined
}

function isRiskLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

function nullableString(value: unknown): string | null | false {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  return normalized || null
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function assetIds(value: unknown): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  if (value.some(id => typeof id !== 'string' || !id.trim())) return null
  return [...new Set(value.map(id => (id as string).trim()))]
}

function parseCreate(payload: Record<string, unknown>): RiskCreateInput | null {
  const organizationId = requiredString(payload.organization_id)
  const title = requiredString(payload.title)
  const description = nullableString(payload.description)
  const categoryId = nullableString(payload.category_id)
  const ownerId = nullableString(payload.owner_id)
  const identifiedDate = nullableString(payload.identified_date)
  const assets = assetIds(payload.assetIds)
  if (!organizationId || !title || description === false || categoryId === false
    || ownerId === false || identifiedDate === false || assets === null
    || !isRiskLevel(payload.impact_level) || !isRiskLevel(payload.likelihood_level)) return null
  if (payload.status !== undefined && !parseStatus(payload.status)) return null
  return {
    organizationId,
    title,
    description,
    categoryId,
    impactLevel: payload.impact_level,
    likelihoodLevel: payload.likelihood_level,
    ownerId,
    identifiedDate,
    status: parseStatus(payload.status) ?? 'identified',
    assetIds: assets,
  }
}

function lifecycleError(error: unknown) {
  if (error instanceof RiskTenantLifecycleError) {
    const status = error.kind === 'conflict' ? 409 : error.kind === 'malformed' ? 400 : 404
    return NextResponse.json({ error: status === 404 ? 'Not found' : status === 409 ? 'Conflict' : 'Invalid request body' }, { status })
  }
  console.error('Risks API failed', error)
  return NextResponse.json({ error: 'Failed to process risks' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }
  const db = getDb()
  const authorization = await authorizeTenantAction(
    db,
    user.id,
    organizationId,
    'risks.read'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }
  try {
    const action = searchParams.get('action') ?? 'risks'
    if (action === 'categories') {
      return applyCookies(NextResponse.json(await new RiskService().getCategories(organizationId)))
    }
    if (action !== 'risks' && action !== 'risksScoped') {
      return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
    }
    const statusValue = searchParams.get('status')
    if (statusValue && !parseStatus(statusValue)) {
      return applyCookies(NextResponse.json({ error: 'Invalid status' }, { status: 400 }))
    }
    const data = await new RiskTenantLifecycleService(db).listRisks(authorization.context, {
      status: parseStatus(statusValue),
      assessmentPeriod: searchParams.get('assessmentPeriod') ?? undefined,
    })
    return applyCookies(NextResponse.json(
      data.map(risk => projectRiskForCapabilities(risk, authorization.capabilities))
    ))
  } catch (error) {
    return applyCookies(lifecycleError(error))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const input = parseCreate(body as Record<string, unknown>)
  if (!input) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const authorization = await authorizeTenantAction(
    getDb(),
    user.id,
    input.organizationId,
    'risks.create'
  )
  if (!authorization.ok) {
    const status = tenantActionDenialStatus(authorization)
    return applyCookies(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }
  try {
    const data = await new RiskTenantLifecycleService(getDb()).createRisk(
      user.id,
      input,
      { userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data }))
  } catch (error) {
    return applyCookies(lifecycleError(error))
  }
}
