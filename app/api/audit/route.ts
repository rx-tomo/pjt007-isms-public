import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { auditChecklists, auditEvidence, auditPlans, auditReports, auditTeamMembers, correctiveActions, followUpRecords, nonconformities } from '@/lib/db/drizzle/schema/audit'
import { AuditService } from '@/lib/services/audit'
import type {
  AuditApprovalStatus,
  AuditPlan,
  AuditReport,
  AuditStatus,
  AuditType,
  CorrectiveAction,
  CorrectiveActionStatus,
  NonconformityStatus,
  NonconformityType,
  TeamRole,
} from '@/lib/db/repositories/interfaces/IAuditPlanRepository'

const auditManagerRoles = new Set(['system_operator', 'org_admin', 'auditor'])

const supportedPostActions = new Set([
  'auditPlan',
  'teamMember',
  'updateTeamMember',
  'removeTeamMember',
  'deleteEvidence',
  'correctiveAction',
  'followUp',
  'auditReport',
  'submitAuditReportApproval',
  'submitAuditPlanApproval',
  'startAuditPlan',
  'submitCorrectiveActionClosureApproval',
])

async function getOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({
        id: userMemberships.id,
        role: userMemberships.role,
      })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  const profileAccess = profile?.organizationId === organizationId
  const membershipAccess = Boolean(membership)
  const role = membership?.role ?? (profileAccess ? profile?.role : null)

  return {
    hasAccess: profileAccess || membershipAccess,
    canManageAudit: Boolean(role && auditManagerRoles.has(role)),
  }
}

function parseAuditStatus(value: string | null): AuditStatus | undefined {
  if (!value) return undefined
  if (['planning', 'scheduled', 'in_progress', 'completed', 'cancelled'].includes(value)) {
    return value as AuditStatus
  }
  return undefined
}

function parseAuditType(value: unknown): AuditType | undefined {
  if (typeof value !== 'string') return undefined
  if (['internal', 'external', 'certification', 'surveillance'].includes(value)) {
    return value as AuditType
  }
  return undefined
}

function parseTeamRole(value: unknown): TeamRole | undefined {
  if (typeof value !== 'string') return undefined
  if (['lead', 'auditor', 'observer'].includes(value)) {
    return value as TeamRole
  }
  return undefined
}

function parseAuditApprovalStatus(value: unknown): AuditApprovalStatus | undefined {
  if (typeof value !== 'string') return undefined
  if (['draft', 'submitted', 'approved', 'rejected'].includes(value)) {
    return value as AuditApprovalStatus
  }
  return undefined
}

function parseNonconformityStatus(value: string | null): NonconformityStatus | undefined {
  if (!value) return undefined
  if (['open', 'in_progress', 'resolved', 'closed', 'verified'].includes(value)) {
    return value as NonconformityStatus
  }
  return undefined
}

function parseNonconformityType(value: string | null): NonconformityType | undefined {
  if (!value) return undefined
  if (['major', 'minor'].includes(value)) {
    return value as NonconformityType
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function parseCorrectiveActionStatus(value: unknown): CorrectiveActionStatus | undefined {
  if (typeof value !== 'string') return undefined
  if (['planned', 'in_progress', 'completed', 'verified'].includes(value)) {
    return value as CorrectiveActionStatus
  }
  return undefined
}

function parseFollowUpStatus(value: unknown) {
  if (typeof value !== 'string') return undefined
  if (['open', 'in_progress', 'completed', 'verified', 'closed'].includes(value)) {
    return value
  }
  return undefined
}

function parseNonconformityUpdates(value: unknown) {
  if (!isRecord(value)) return null
  const updates: Record<string, string | null> = {}

  if (typeof value.status === 'string') {
    const status = parseNonconformityStatus(value.status)
    if (!status) return null
    updates.status = status
  }
  if (typeof value.due_date === 'string' || value.due_date === null) {
    updates.due_date = value.due_date || null
  }
  if (typeof value.resolution_date === 'string' || value.resolution_date === null) {
    updates.resolution_date = value.resolution_date || null
  }
  if (typeof value.verification_date === 'string' || value.verification_date === null) {
    updates.verification_date = value.verification_date || null
  }
  if (typeof value.root_cause === 'string' || value.root_cause === null) {
    updates.root_cause = value.root_cause || null
  }
  if (typeof value.corrective_action === 'string' || value.corrective_action === null) {
    updates.corrective_action = value.corrective_action || null
  }
  if (typeof value.preventive_action === 'string' || value.preventive_action === null) {
    updates.preventive_action = value.preventive_action || null
  }
  if (typeof value.responsible_id === 'string' || value.responsible_id === null) {
    updates.responsible_id = value.responsible_id || null
  }

  return updates
}

function parseCorrectiveActionPayload(value: unknown) {
  if (!isRecord(value)) return null

  const description = typeof value.action_description === 'string'
    ? value.action_description.trim()
    : ''
  const nonconformityId = typeof value.nonconformity_id === 'string'
    ? value.nonconformity_id
    : ''

  if (!description || !nonconformityId) {
    return null
  }

  return {
    nonconformity_id: nonconformityId,
    action_description: description,
    responsible_id: typeof value.responsible_id === 'string' && value.responsible_id ? value.responsible_id : null,
    planned_date: typeof value.planned_date === 'string' && value.planned_date ? value.planned_date : null,
    completion_date: typeof value.completion_date === 'string' && value.completion_date ? value.completion_date : null,
    status: parseCorrectiveActionStatus(value.status) ?? 'planned',
    effectiveness_review: typeof value.effectiveness_review === 'string' && value.effectiveness_review ? value.effectiveness_review : null,
    reviewed_by: typeof value.reviewed_by === 'string' && value.reviewed_by ? value.reviewed_by : null,
    reviewed_at: typeof value.reviewed_at === 'string' && value.reviewed_at ? value.reviewed_at : null,
  }
}

function parseCorrectiveActionUpdates(value: unknown): Partial<CorrectiveAction> | null {
  if (!isRecord(value)) return null
  const updates: Partial<CorrectiveAction> = {}

  if (typeof value.action_description === 'string') {
    const description = value.action_description.trim()
    if (!description) return null
    updates.action_description = description
  }
  if (typeof value.responsible_id === 'string' || value.responsible_id === null) {
    updates.responsible_id = value.responsible_id || null
  }
  if (typeof value.planned_date === 'string' || value.planned_date === null) {
    updates.planned_date = value.planned_date || null
  }
  if (typeof value.completion_date === 'string' || value.completion_date === null) {
    updates.completion_date = value.completion_date || null
  }
  if (value.status !== undefined) {
    const status = parseCorrectiveActionStatus(value.status)
    if (!status) return null
    updates.status = status
  }
  if (typeof value.effectiveness_review === 'string' || value.effectiveness_review === null) {
    updates.effectiveness_review = value.effectiveness_review || null
  }
  if (typeof value.reviewed_by === 'string' || value.reviewed_by === null) {
    updates.reviewed_by = value.reviewed_by || null
  }
  if (typeof value.reviewed_at === 'string' || value.reviewed_at === null) {
    updates.reviewed_at = value.reviewed_at || null
  }

  return updates
}

function parseFollowUpPayload(value: unknown) {
  if (!isRecord(value)) return null

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const auditPlanId = typeof value.audit_plan_id === 'string'
    ? value.audit_plan_id
    : typeof value.auditPlanId === 'string'
      ? value.auditPlanId
      : ''

  const nonconformityId = typeof value.nonconformity_id === 'string' && value.nonconformity_id
    ? value.nonconformity_id
    : typeof value.nonconformityId === 'string' && value.nonconformityId
      ? value.nonconformityId
      : undefined

  if (!title || (!auditPlanId && !nonconformityId)) return null

  return {
    auditPlanId,
    nonconformityId,
    title,
    description: typeof value.description === 'string' && value.description ? value.description : undefined,
    assignedTo: typeof value.assigned_to === 'string' && value.assigned_to
      ? value.assigned_to
      : typeof value.assignedTo === 'string' && value.assignedTo
        ? value.assignedTo
        : undefined,
    dueDate: typeof value.due_date === 'string' && value.due_date
      ? value.due_date
      : typeof value.dueDate === 'string' && value.dueDate
        ? value.dueDate
        : undefined,
  }
}

function parseFollowUpUpdates(value: unknown) {
  if (!isRecord(value)) return null
  const updates: Partial<{
    title: string
    description: string | null
    assignedTo: string | null
    status: string
    dueDate: string | null
  }> = {}

  if (typeof value.title === 'string') {
    const title = value.title.trim()
    if (!title) return null
    updates.title = title
  }
  if (typeof value.description === 'string' || value.description === null) {
    updates.description = value.description || null
  }
  if (typeof value.assigned_to === 'string' || value.assigned_to === null) {
    updates.assignedTo = value.assigned_to || null
  }
  if (typeof value.assignedTo === 'string' || value.assignedTo === null) {
    updates.assignedTo = value.assignedTo || null
  }
  if (value.status !== undefined) {
    const status = parseFollowUpStatus(value.status)
    if (!status) return null
    updates.status = status
  }
  if (typeof value.due_date === 'string' || value.due_date === null) {
    updates.dueDate = value.due_date || null
  }
  if (typeof value.dueDate === 'string' || value.dueDate === null) {
    updates.dueDate = value.dueDate || null
  }

  return updates
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? value : null
}

function parseAuditReportPayload(value: unknown): Partial<AuditReport> | null {
  if (!isRecord(value)) return null

  const updates: Partial<AuditReport> = {}

  if ('executive_summary' in value) updates.executive_summary = normalizeNullableString(value.executive_summary)
  if ('scope' in value) updates.scope = normalizeNullableString(value.scope)
  if ('methodology' in value) updates.methodology = normalizeNullableString(value.methodology)
  if ('positive_findings' in value) updates.positive_findings = normalizeNullableString(value.positive_findings)
  if ('improvement_opportunities' in value) updates.improvement_opportunities = normalizeNullableString(value.improvement_opportunities)
  if ('conclusion' in value) updates.conclusion = normalizeNullableString(value.conclusion)
  if ('report_date' in value) updates.report_date = normalizeNullableString(value.report_date)

  if ('approval_status' in value) {
    const approvalStatus = parseAuditApprovalStatus(value.approval_status)
    if (!approvalStatus) return null
    updates.approval_status = approvalStatus
  }
  if ('rejection_reason' in value) updates.rejection_reason = normalizeNullableString(value.rejection_reason)
  if ('approved_by' in value) updates.approved_by = normalizeNullableString(value.approved_by)
  if ('approved_at' in value) updates.approved_at = normalizeNullableString(value.approved_at)

  return updates
}

function parseAuditPlanPayload(value: unknown): Omit<AuditPlan, 'id' | 'created_at' | 'updated_at'> | null {
  if (!isRecord(value)) return null

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const organizationId = typeof value.organization_id === 'string' ? value.organization_id : ''
  if (!title || !organizationId) return null

  return {
    organization_id: organizationId,
    title,
    description: normalizeNullableString(value.description) ?? null,
    audit_type: parseAuditType(value.audit_type) ?? 'internal',
    standard: typeof value.standard === 'string' && value.standard.trim() ? value.standard.trim() : 'ISO27001',
    planned_start_date: normalizeNullableString(value.planned_start_date) ?? null,
    planned_end_date: normalizeNullableString(value.planned_end_date) ?? null,
    actual_start_date: normalizeNullableString(value.actual_start_date) ?? null,
    actual_end_date: normalizeNullableString(value.actual_end_date) ?? null,
    lead_auditor_id: normalizeNullableString(value.lead_auditor_id) ?? null,
    audited_unit_id: normalizeNullableString(value.audited_unit_id) ?? null,
    auditor_signature: normalizeNullableString(value.auditor_signature) ?? null,
    auditor_signed_at: normalizeNullableString(value.auditor_signed_at) ?? null,
    status: parseAuditStatus(typeof value.status === 'string' ? value.status : null) ?? 'planning',
    audit_period: normalizeNullableString(value.audit_period) ?? null,
  }
}

function parseAuditPlanUpdates(value: unknown): Partial<AuditPlan> | null {
  if (!isRecord(value)) return null
  const updates: Partial<AuditPlan> = {}

  if (typeof value.title === 'string') {
    const title = value.title.trim()
    if (!title) return null
    updates.title = title
  }
  if ('description' in value) updates.description = normalizeNullableString(value.description)
  if ('audit_type' in value) {
    const auditType = parseAuditType(value.audit_type)
    if (!auditType) return null
    updates.audit_type = auditType
  }
  if ('standard' in value) updates.standard = normalizeNullableString(value.standard)
  if ('planned_start_date' in value) updates.planned_start_date = normalizeNullableString(value.planned_start_date)
  if ('planned_end_date' in value) updates.planned_end_date = normalizeNullableString(value.planned_end_date)
  if ('actual_start_date' in value) updates.actual_start_date = normalizeNullableString(value.actual_start_date)
  if ('actual_end_date' in value) updates.actual_end_date = normalizeNullableString(value.actual_end_date)
  if ('lead_auditor_id' in value) updates.lead_auditor_id = normalizeNullableString(value.lead_auditor_id)
  if ('audited_unit_id' in value) updates.audited_unit_id = normalizeNullableString(value.audited_unit_id)
  if ('auditor_signature' in value) updates.auditor_signature = normalizeNullableString(value.auditor_signature)
  if ('auditor_signed_at' in value) updates.auditor_signed_at = normalizeNullableString(value.auditor_signed_at)
  if ('audit_period' in value) updates.audit_period = normalizeNullableString(value.audit_period)
  if ('status' in value) {
    const status = parseAuditStatus(typeof value.status === 'string' ? value.status : null)
    if (!status) return null
    updates.status = status
  }

  return updates
}

async function findNonconformityOrganization(db: ReturnType<typeof getDb>, nonconformityId: string) {
  const [row] = await db
    .select({
      organizationId: auditPlans.organizationId,
    })
    .from(nonconformities)
    .innerJoin(auditChecklists, eq(nonconformities.auditChecklistId, auditChecklists.id))
    .innerJoin(auditPlans, eq(auditChecklists.auditPlanId, auditPlans.id))
    .where(eq(nonconformities.id, nonconformityId))
    .limit(1)

  return row?.organizationId ?? null
}

async function findNonconformityAuditPlanId(db: ReturnType<typeof getDb>, nonconformityId: string) {
  const [row] = await db
    .select({ auditPlanId: auditChecklists.auditPlanId })
    .from(nonconformities)
    .innerJoin(auditChecklists, eq(nonconformities.auditChecklistId, auditChecklists.id))
    .where(eq(nonconformities.id, nonconformityId))
    .limit(1)

  return row?.auditPlanId ?? null
}

async function findCorrectiveActionOrganization(db: ReturnType<typeof getDb>, actionId: string) {
  const [row] = await db
    .select({ nonconformityId: correctiveActions.nonconformityId })
    .from(correctiveActions)
    .where(eq(correctiveActions.id, actionId))
    .limit(1)

  if (!row?.nonconformityId) return null
  return findNonconformityOrganization(db, row.nonconformityId)
}

async function findAuditPlanOrganization(db: ReturnType<typeof getDb>, planId: string) {
  const [row] = await db
    .select({ organizationId: auditPlans.organizationId })
    .from(auditPlans)
    .where(eq(auditPlans.id, planId))
    .limit(1)

  return row?.organizationId ?? null
}

async function findAuditReportOrganization(db: ReturnType<typeof getDb>, reportId: string) {
  const [row] = await db
    .select({ organizationId: auditPlans.organizationId })
    .from(auditReports)
    .innerJoin(auditPlans, eq(auditReports.auditPlanId, auditPlans.id))
    .where(eq(auditReports.id, reportId))
    .limit(1)

  return row?.organizationId ?? null
}

async function findTeamMemberOrganization(db: ReturnType<typeof getDb>, memberId: string) {
  const [row] = await db
    .select({ organizationId: auditPlans.organizationId })
    .from(auditTeamMembers)
    .innerJoin(auditPlans, eq(auditTeamMembers.auditPlanId, auditPlans.id))
    .where(eq(auditTeamMembers.id, memberId))
    .limit(1)

  return row?.organizationId ?? null
}

async function findEvidenceOrganization(db: ReturnType<typeof getDb>, evidenceId: string) {
  const [row] = await db
    .select({ organizationId: auditPlans.organizationId })
    .from(auditEvidence)
    .innerJoin(auditChecklists, eq(auditEvidence.auditChecklistId, auditChecklists.id))
    .innerJoin(auditPlans, eq(auditChecklists.auditPlanId, auditPlans.id))
    .where(eq(auditEvidence.id, evidenceId))
    .limit(1)

  return row?.organizationId ?? null
}

async function findFollowUpOrganization(db: ReturnType<typeof getDb>, recordId: string) {
  const [row] = await db
    .select({ organizationId: followUpRecords.organizationId })
    .from(followUpRecords)
    .where(eq(followUpRecords.id, recordId))
    .limit(1)

  return row?.organizationId ?? null
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'plans'
  const db = getDb()
  const planId = searchParams.get('planId')
  const nonconformityId = searchParams.get('nonconformityId')
  const organizationId = searchParams.get('organizationId')
    ?? (planId ? await findAuditPlanOrganization(db, planId) : null)
    ?? (nonconformityId ? await findNonconformityOrganization(db, nonconformityId) : null)

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const access = await getOrganizationAccess(db, user.id, organizationId)
  if (!access.hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new AuditService()

  try {
    if (action === 'plans') {
      const data = await service.getAuditPlans(organizationId, {
        status: parseAuditStatus(searchParams.get('status')),
        period: searchParams.get('period') ?? undefined,
      })
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'plan') {
      if (!planId) {
        return applyCookies(badRequest('Missing planId'))
      }
      const data = await service.getAuditPlanById(planId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'units') {
      const data = await service.getAuditUnits(organizationId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'statistics') {
      const data = await service.getAuditStatistics(organizationId, {
        period: searchParams.get('period') ?? undefined,
      })
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'reports') {
      const data = await service.getAuditReportsList(organizationId, {
        status: parseAuditStatus(searchParams.get('status')) ?? '',
        period: searchParams.get('period') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        auditType: parseAuditType(searchParams.get('auditType')) ?? '',
      })
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'nonconformities') {
      const data = await service.getNonconformities({
        organizationId,
        status: parseNonconformityStatus(searchParams.get('status')),
        type: parseNonconformityType(searchParams.get('type')),
      })
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'followUps') {
      if (!planId) {
        return applyCookies(badRequest('Missing planId'))
      }
      const data = await service.getFollowUpRecords(planId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'followUpsByNonconformity') {
      if (!nonconformityId) {
        return applyCookies(badRequest('Missing nonconformityId'))
      }
      const data = await service.getFollowUpRecordsByNonconformity(nonconformityId)
      return applyCookies(NextResponse.json(data))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch (error) {
    console.error('Audit API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load audit data' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null)
    const action = isRecord(body) && typeof body.action === 'string' ? body.action : ''

    if (!supportedPostActions.has(action)) {
      return applyCookies(badRequest('Unsupported action'))
    }

    if (action === 'auditPlan') {
      const payload = parseAuditPlanPayload(isRecord(body) && isRecord(body.plan) ? body.plan : body)
      if (!payload) {
        return applyCookies(badRequest('Invalid audit plan payload'))
      }

      const db = getDb()
      const access = await getOrganizationAccess(db, user.id, payload.organization_id)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      const data = await service.createAuditPlan(payload)
      return applyCookies(NextResponse.json(data, { status: 201 }))
    }

    if (action === 'teamMember') {
      const planId = isRecord(body) && typeof body.planId === 'string' ? body.planId : ''
      const userId = isRecord(body) && typeof body.userId === 'string' ? body.userId : ''
      const role = isRecord(body) ? parseTeamRole(body.role) : undefined
      if (!planId || !userId || !role) {
        return applyCookies(badRequest('Invalid team member payload'))
      }

      const db = getDb()
      const organizationId = await findAuditPlanOrganization(db, planId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      const data = await service.addTeamMember(planId, userId, role)
      return applyCookies(NextResponse.json(data, { status: 201 }))
    }

    if (action === 'updateTeamMember') {
      const memberId = isRecord(body) && typeof body.memberId === 'string' ? body.memberId : ''
      const role = isRecord(body) ? parseTeamRole(body.role) : undefined
      if (!memberId || !role) {
        return applyCookies(badRequest('Invalid team member update payload'))
      }

      const db = getDb()
      const organizationId = await findTeamMemberOrganization(db, memberId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Team member not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      const data = await service.updateTeamMember(memberId, { role })
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'removeTeamMember') {
      const memberId = isRecord(body) && typeof body.memberId === 'string' ? body.memberId : ''
      if (!memberId) {
        return applyCookies(badRequest('Missing memberId'))
      }

      const db = getDb()
      const organizationId = await findTeamMemberOrganization(db, memberId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Team member not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      await service.removeTeamMember(memberId)
      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'deleteEvidence') {
      const evidenceId = isRecord(body) && typeof body.evidenceId === 'string' ? body.evidenceId : ''
      if (!evidenceId) {
        return applyCookies(badRequest('Missing evidenceId'))
      }

      const db = getDb()
      const organizationId = await findEvidenceOrganization(db, evidenceId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit evidence not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      await service.deleteEvidence(evidenceId)
      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'submitAuditPlanApproval') {
      const planId = isRecord(body) && typeof body.planId === 'string' ? body.planId : ''
      if (!planId) {
        return applyCookies(badRequest('Missing planId'))
      }

      const db = getDb()
      const organizationId = await findAuditPlanOrganization(db, planId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      await service.submitAuditPlanForApproval(planId, user.id)
      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'startAuditPlan') {
      const planId = isRecord(body) && typeof body.planId === 'string' ? body.planId : ''
      if (!planId) {
        return applyCookies(badRequest('Missing planId'))
      }

      const db = getDb()
      const organizationId = await findAuditPlanOrganization(db, planId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      const data = await service.startAuditPlan(planId, user.id)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'auditReport') {
      const reportInput = isRecord(body) && isRecord(body.report) ? body.report : body
      const planId = typeof reportInput.planId === 'string'
        ? reportInput.planId
        : typeof reportInput.audit_plan_id === 'string'
          ? reportInput.audit_plan_id
          : ''
      const reportId = typeof reportInput.id === 'string' ? reportInput.id : null

      if (!planId) {
        return applyCookies(badRequest('Missing audit plan id'))
      }

      const db = getDb()
      const organizationId = await findAuditPlanOrganization(db, planId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const parsedReport = parseAuditReportPayload(reportInput)
      if (!parsedReport) {
        return applyCookies(badRequest('Invalid audit report payload'))
      }

      const service = new AuditService()
      const data = reportId
        ? await service.updateAuditReport(reportId, parsedReport)
        : await service.createAuditReport({
          audit_plan_id: planId,
          ...parsedReport,
          approval_status: parsedReport.approval_status ?? 'draft',
        })
      return applyCookies(NextResponse.json(data, { status: reportId ? 200 : 201 }))
    }

    if (action === 'submitAuditReportApproval') {
      const reportId = isRecord(body) && typeof body.reportId === 'string' ? body.reportId : ''
      if (!reportId) {
        return applyCookies(badRequest('Missing reportId'))
      }

      const db = getDb()
      const organizationId = await findAuditReportOrganization(db, reportId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit report not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      await service.submitAuditReportForApproval(reportId, user.id)
      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'submitCorrectiveActionClosureApproval') {
      const actionId = isRecord(body) && typeof body.actionId === 'string' ? body.actionId : ''
      if (!actionId) {
        return applyCookies(badRequest('Missing actionId'))
      }

      const db = getDb()
      const organizationId = await findCorrectiveActionOrganization(db, actionId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Corrective action not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      await service.submitCorrectiveActionClosureApproval(actionId, user.id)
      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'followUp') {
      const payload = parseFollowUpPayload(isRecord(body) && 'followUp' in body ? body.followUp : body)
      if (!payload) {
        return applyCookies(badRequest('Invalid follow-up payload'))
      }

      const db = getDb()
      const auditPlanId = payload.auditPlanId || (payload.nonconformityId
        ? await findNonconformityAuditPlanId(db, payload.nonconformityId)
        : null)
      if (!auditPlanId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }
      const organizationId = await findAuditPlanOrganization(db, auditPlanId)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const service = new AuditService()
      const data = await service.createFollowUpRecord({ ...payload, auditPlanId })
      return applyCookies(NextResponse.json(data, { status: 201 }))
    }

    const payload = parseCorrectiveActionPayload(isRecord(body) && 'correctiveAction' in body ? body.correctiveAction : body)
    if (!payload) {
      return applyCookies(badRequest('Invalid corrective action payload'))
    }

    const db = getDb()
    const organizationId = await findNonconformityOrganization(db, payload.nonconformity_id)
    if (!organizationId) {
      return applyCookies(NextResponse.json({ error: 'Nonconformity not found' }, { status: 404 }))
    }

    const access = await getOrganizationAccess(db, user.id, organizationId)
    if (!access.hasAccess || !access.canManageAudit) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const service = new AuditService()
    const data = await service.createCorrectiveAction(payload)
    return applyCookies(NextResponse.json(data, { status: 201 }))
  } catch (error) {
    console.error('Audit API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update audit data' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null)
    if (!isRecord(body) || typeof body.id !== 'string' || typeof body.resourceType !== 'string') {
      return applyCookies(badRequest('Invalid audit update payload'))
    }

    const db = getDb()
    const service = new AuditService()

    if (body.resourceType === 'plan') {
      const organizationId = await findAuditPlanOrganization(db, body.id)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Audit plan not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const updates = parseAuditPlanUpdates(isRecord(body.updates) ? body.updates : body)
      if (!updates || Object.keys(updates).length === 0) {
        return applyCookies(badRequest('Invalid audit plan update payload'))
      }

      const data = await service.updateAuditPlan(body.id, updates)
      return applyCookies(NextResponse.json(data))
    }

    if (body.resourceType === 'nonconformity') {
      const organizationId = await findNonconformityOrganization(db, body.id)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Nonconformity not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const updates = parseNonconformityUpdates(isRecord(body.updates) ? body.updates : body)
      if (!updates) {
        return applyCookies(badRequest('Invalid nonconformity update payload'))
      }

      const data = await service.updateNonconformity(body.id, updates)
      return applyCookies(NextResponse.json(data))
    }

    if (body.resourceType === 'correctiveAction') {
      const organizationId = await findCorrectiveActionOrganization(db, body.id)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Corrective action not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const updates = parseCorrectiveActionUpdates(isRecord(body.updates) ? body.updates : body)
      if (!updates) {
        return applyCookies(badRequest('Invalid corrective action update payload'))
      }

      const data = await service.updateCorrectiveAction(body.id, updates)
      return applyCookies(NextResponse.json(data))
    }

    if (body.resourceType === 'followUpRecord') {
      const organizationId = await findFollowUpOrganization(db, body.id)
      if (!organizationId) {
        return applyCookies(NextResponse.json({ error: 'Follow-up record not found' }, { status: 404 }))
      }

      const access = await getOrganizationAccess(db, user.id, organizationId)
      if (!access.hasAccess || !access.canManageAudit) {
        return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }

      const updates = parseFollowUpUpdates(isRecord(body.updates) ? body.updates : body)
      if (!updates) {
        return applyCookies(badRequest('Invalid follow-up update payload'))
      }

      const status = updates.status
      const data = status === 'completed'
        ? await service.completeFollowUpRecord(body.id)
        : status === 'verified'
          ? await service.verifyFollowUpRecord(body.id)
          : await service.updateFollowUpRecord(body.id, updates)
      return applyCookies(NextResponse.json(data))
    }

    return applyCookies(badRequest('Unsupported resourceType'))
  } catch (error) {
    console.error('Audit API PATCH failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update audit data' }, { status: 500 }))
  }
}
