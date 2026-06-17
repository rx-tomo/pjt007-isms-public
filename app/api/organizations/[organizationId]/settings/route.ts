import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { OrganizationService } from '@/lib/services/organization'

type Params = { organizationId: string }

// ---------------------------------------------------------------------------
// GET /api/organizations/[organizationId]/settings?action=<action>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params;
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId: params.organizationId,
    actionName: 'organization.settings.read',
    logContext: { organizationId: params.organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { organizationId } = params
  const action = request.nextUrl.searchParams.get('action')
  const service = new OrganizationService()

  try {
    switch (action) {
      case 'scope': {
        const scope = await service.getOrganizationScope(organizationId)
        return guard.json(scope)
      }

      case 'departments': {
        const departments = await service.getOrganizationDepartments(organizationId)
        return guard.json(departments)
      }

      case 'phaseHistory': {
        const history = await service.getPhaseHistory(organizationId)
        return guard.json(history)
      }

      case 'stats': {
        const stats = await service.getOrganizationStats(organizationId)
        return guard.json(stats)
      }

      default:
        return guard.json(
          { error: `Invalid action: ${action}. Valid actions: scope, departments, phaseHistory, stats` },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error(`[Settings GET] action=${action} failed`, err)
    return guard.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/organizations/[organizationId]/settings
// body.action determines the operation
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params;
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId: params.organizationId,
    actionName: 'organization.settings.write',
    logContext: { organizationId: params.organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { organizationId } = params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const action = body.action as string | undefined
  if (!action) {
    return guard.json({ error: 'Missing action in request body' }, { status: 400 })
  }

  const service = new OrganizationService()

  try {
    switch (action) {
      case 'updateOrganization': {
        const updates = body.updates as Record<string, unknown> | undefined
        if (!updates || typeof updates !== 'object') {
          return guard.json({ error: 'updates object is required for updateOrganization' }, { status: 400 })
        }
        // Whitelist: only allow org_admin to update non-sensitive fields
        const ALLOWED_FIELDS = ['name', 'name_en', 'employee_count_range', 'industry', 'iso_certification_status'] as const
        const sanitized: Record<string, unknown> = {}
        for (const key of ALLOWED_FIELDS) {
          if (key in updates) {
            sanitized[key] = updates[key]
          }
        }
        if (Object.keys(sanitized).length === 0) {
          return guard.json({ error: 'No valid fields to update' }, { status: 400 })
        }
        const result = await service.updateOrganization(organizationId, sanitized as any)
        return guard.json(result)
      }

      case 'upsertScope': {
        const scope = body.scope as Record<string, unknown> | undefined
        if (!scope || typeof scope !== 'object') {
          return guard.json({ error: 'scope object is required for upsertScope' }, { status: 400 })
        }
        const result = await service.upsertOrganizationScope(organizationId, scope as any)
        return guard.json(result)
      }

      case 'createDepartment': {
        const payload = body.payload as Record<string, unknown> | undefined
        if (!payload || typeof payload !== 'object') {
          return guard.json({ error: 'payload object is required for createDepartment' }, { status: 400 })
        }
        const result = await service.createDepartment(organizationId, payload as any)
        return guard.json(result)
      }

      case 'updateDepartment': {
        const departmentId = body.departmentId as string | undefined
        const payload = body.payload as Record<string, unknown> | undefined
        if (!departmentId || typeof departmentId !== 'string') {
          return guard.json({ error: 'departmentId is required for updateDepartment' }, { status: 400 })
        }
        if (!payload || typeof payload !== 'object') {
          return guard.json({ error: 'payload object is required for updateDepartment' }, { status: 400 })
        }
        const result = await service.updateDepartment(organizationId, departmentId, payload as any)
        return guard.json(result)
      }

      case 'deleteDepartment': {
        const departmentId = body.departmentId as string | undefined
        if (!departmentId || typeof departmentId !== 'string') {
          return guard.json({ error: 'departmentId is required for deleteDepartment' }, { status: 400 })
        }
        await service.deleteDepartment(organizationId, departmentId)
        return guard.json({ status: 'ok' })
      }

      case 'updateIsmsPhase': {
        const phase = body.phase as string | undefined
        const source = (body.source as string) ?? 'settings'
        if (!phase) {
          return guard.json({ error: 'phase is required' }, { status: 400 })
        }
        const result = await service.updateIsmsPhase(organizationId, phase as any, source as any)
        return guard.json(result)
      }

      default:
        return guard.json(
          { error: `Invalid action: ${action}. Valid actions: updateOrganization, upsertScope, createDepartment, updateDepartment, deleteDepartment, updateIsmsPhase` },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error(`[Settings POST] action=${action} failed`, err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return guard.json({ error: message }, { status: 500 })
  }
}
