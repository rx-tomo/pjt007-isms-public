import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships } from '@/lib/db/drizzle/schema'
import { getAuditLogRepository, getRiskRepository } from '@/lib/container'
import { RiskService } from '@/lib/services/risk'
import type { RiskStatus } from '@/lib/db/repositories/interfaces/IRiskRepository'
import type { Json } from '@/types/database.types'

async function assertOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  return profile?.organizationId === organizationId || Boolean(membership)
}

function parseStatus(value: string | null): RiskStatus | undefined {
  if (!value) return undefined
  if (['identified', 'analyzing', 'treating', 'monitoring', 'closed'].includes(value)) {
    return value as RiskStatus
  }
  return undefined
}

function isRiskLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'risks'
  const organizationId = searchParams.get('organizationId')

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new RiskService()

  try {
    if (action === 'categories') {
      const data = await service.getCategories(organizationId)
      return applyCookies(NextResponse.json(data))
    }

    const filters = {
      status: parseStatus(searchParams.get('status')),
      assessmentPeriod: searchParams.get('assessmentPeriod') ?? undefined,
    }

    if (action === 'risksScoped') {
      const requestingUserId = searchParams.get('requestingUserId') ?? user.id
      const data = await service.getRisksScoped(organizationId, requestingUserId, filters)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'risks') {
      const data = await service.getRisks(organizationId, {
        ...filters,
        departmentId: searchParams.get('departmentId') ?? undefined,
        includeNoDepartment: searchParams.get('includeNoDepartment') === 'true',
      })
      return applyCookies(NextResponse.json(data))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch (error) {
    console.error('Risks API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load risks' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }

  const payload = body as Record<string, unknown>
  const organizationId = normalizeOptionalString(payload.organization_id)
  const title = normalizeOptionalString(payload.title)
  const categoryId = normalizeOptionalString(payload.category_id)

  if (!organizationId || !title || !categoryId) {
    return applyCookies(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
  }

  if (!isRiskLevel(payload.impact_level) || !isRiskLevel(payload.likelihood_level)) {
    return applyCookies(NextResponse.json({ error: 'Invalid risk level' }, { status: 400 }))
  }

  const db = getDb()
  const hasAccess = await assertOrganizationAccess(db, user.id, organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const repo = await getRiskRepository()
  const assetIds = parseAssetIds(payload.assetIds)

  try {
    const created = await repo.create({
      organization_id: organizationId,
      title,
      description: normalizeOptionalString(payload.description),
      category_id: categoryId,
      impact_level: payload.impact_level,
      likelihood_level: payload.likelihood_level,
      owner_id: normalizeOptionalString(payload.owner_id),
      identified_date: normalizeOptionalString(payload.identified_date),
      identified_by: user.id,
      status: parseStatus(typeof payload.status === 'string' ? payload.status : null) ?? 'identified',
    })

    if (assetIds.length > 0) {
      await repo.setRiskAssets(created.id, assetIds)
    }

    const auditLog = await getAuditLogRepository()
    await auditLog.log({
      organizationId,
      userId: user.id,
      action: 'risk.created',
      resourceType: 'risk',
      resourceId: created.id,
      changes: {
        title: created.title,
        assetIds,
      } as Json,
      userAgent: request.headers.get('user-agent'),
    })

    const risk = await repo.findByIdWithRelations(created.id)
    return applyCookies(NextResponse.json({ data: risk ?? created }))
  } catch (error) {
    console.error('Risks API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to create risk' }, { status: 500 }))
  }
}
