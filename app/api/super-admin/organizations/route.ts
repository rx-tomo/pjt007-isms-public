import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations } from '@/lib/db/drizzle/schema'
import { asc, eq, isNull, isNotNull, sql } from 'drizzle-orm'
import { auditLogs } from '@/lib/db/drizzle/schema'
import { SuperAdminService, type TenantCreatePayload } from '@/lib/services/superAdmin'

function normalizeIsmsPhase(value: string | null | undefined) {
  return value === 'initial' || value === 'surveillance' ? value : null
}

export async function GET(request: NextRequest) {
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
  })
  if (error || !guard) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const db = getDb()

    const { searchParams } = new URL(request.url)
    const showDeleted = searchParams.get('deleted') === 'true'
    const rawLimit = Number(searchParams.get('limit') ?? '500')
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 500, 500))
    const rawOffset = Number(searchParams.get('offset') ?? '0')
    const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0)

    const deletedFilter = showDeleted ? isNotNull(organizations.deletedAt) : isNull(organizations.deletedAt)

    const auditCountSubquery = db
      .select({
        organizationId: auditLogs.organizationId,
        count: sql<number>`count(*)`.as('audit_count'),
        lastAuditAt: sql<string>`max(${auditLogs.createdAt})`.as('last_audit_at'),
      })
      .from(auditLogs)
      .groupBy(auditLogs.organizationId)
      .as('audit_stats')

    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        ismsPhase: organizations.ismsPhase,
        trialEndsAt: organizations.trialEndsAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        deletedAt: organizations.deletedAt,
        auditCount: auditCountSubquery.count,
        lastAuditAt: auditCountSubquery.lastAuditAt,
      })
      .from(organizations)
      .leftJoin(auditCountSubquery, eq(organizations.id, auditCountSubquery.organizationId))
      .where(deletedFilter)
      .orderBy(asc(organizations.name))
      .limit(limit)
      .offset(offset)

    const data = rows.map(row => ({
      id: row.id,
      name: row.name ?? row.id.slice(0, 8),
      subscription_plan: row.subscriptionPlan ?? 'trial',
      subscription_status: row.subscriptionStatus ?? 'active',
      isms_phase: normalizeIsmsPhase(row.ismsPhase),
      trial_ends_at: row.trialEndsAt ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
      deleted_at: row.deletedAt ?? null,
      locked: row.subscriptionStatus === 'suspended',
      audit_log_count: row.auditCount ?? 0,
      last_audit_at: row.lastAuditAt ?? null,
    }))

    return guard.json(data)
  } catch (err) {
    console.error('[SuperAdmin/Organizations] GET failed', err)
    return guard.json({ error: 'Failed to load organizations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.organizations.create',
  })
  if (error || !guard) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as Partial<TenantCreatePayload>

    if (!body.name?.trim() || !body.operatorEmail?.trim()) {
      return guard.json(
        { error: 'name and operatorEmail are required' },
        { status: 400 }
      )
    }

    // Normalize inputs
    const name = body.name.trim()
    const operatorEmail = body.operatorEmail.trim().toLowerCase()

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(operatorEmail)) {
      return guard.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Plan enum validation
    const ALLOWED_PLANS = ['trial', 'starter', 'standard', 'enterprise'] as const
    if (body.plan && !ALLOWED_PLANS.includes(body.plan as any)) {
      return guard.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Status enum validation
    const ALLOWED_STATUSES = ['active', 'inactive', 'suspended', 'cancelled'] as const
    if (body.status && !ALLOWED_STATUSES.includes(body.status as any)) {
      return guard.json({ error: 'Invalid status' }, { status: 400 })
    }

    // trialDays range validation
    if (body.trialDays !== undefined) {
      const days = Number(body.trialDays)
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return guard.json({ error: 'trialDays must be 1-365' }, { status: 400 })
      }
    }

    const payload: TenantCreatePayload = {
      name,
      plan: body.plan,
      status: body.status,
      trialDays: body.trialDays,
      operatorEmail,
      operatorName: body.operatorName,
      operatorLocale: body.operatorLocale,
    }

    const service = new SuperAdminService()
    const result = await service.createTenant(payload)

    return guard.json(result, { status: 201 })
  } catch (err) {
    console.error('[SuperAdmin/Organizations] POST failed', err)
    const message = err instanceof Error ? err.message : 'Failed to create tenant'
    const status = message.includes('already belongs to another organization') ? 409 : 500
    return guard.json({ error: message }, { status })
  }
}
