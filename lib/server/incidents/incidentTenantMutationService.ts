import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  approvalEscalationRules,
  approvalEvents,
  approvalRequests,
  auditLogs,
  incidentLinks,
  incidents,
  informationAssets,
  notifications,
  organizationDepartments,
  risks,
  tasks,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
} from '@/lib/server/auth/authorizationContext'
import {
  ELIGIBLE_APPROVAL_MEMBERSHIP_ROLES,
  resolveApprovalEligibility,
} from '@/lib/server/approvals/approvalEligibility'
import type {
  IncidentLink,
  IncidentLinkType,
  IncidentRecord,
  IncidentSeverity,
} from '@/lib/services/incident'

type IncidentDb = ReturnType<typeof getDb>

export interface IncidentMutationAuditContext {
  userAgent?: string | null
  ipAddress?: string | null
}

export type IncidentMutationFailureStage =
  | 'after_incident_insert'
  | 'after_approval_insert'
  | 'after_link_insert'
  | 'after_link_delete'

export type IncidentMutationFailureInjector = (
  stage: IncidentMutationFailureStage
) => void | Promise<void>

interface NormalizedIncidentLink {
  linkType: IncidentLinkType
  linkId: string
}

export interface IncidentRelatedResourceLink {
  linkType: string
  linkId: string
}

export interface NormalizedIncidentCreateBody {
  title: string
  description: string | null
  occurredAt: string
  severity: IncidentSeverity
  departmentId: string
  approverId: string | null
  links: NormalizedIncidentLink[]
}

export class IncidentTenantMutationError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'IncidentTenantMutationError'
  }
}

export function isIncidentTenantMutationError(
  error: unknown
): error is IncidentTenantMutationError {
  return error instanceof IncidentTenantMutationError
}

function badRequest(message = 'Invalid incident payload'): never {
  throw new IncidentTenantMutationError(400, message)
}

function notFound(): never {
  throw new IncidentTenantMutationError(404, 'Not found')
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badRequest()
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): void {
  const allowed = new Set(allowedKeys)
  if (Object.keys(value).some(key => !allowed.has(key))) badRequest()
}

function normalizeRequiredText(value: unknown, maximum: number): string {
  if (typeof value !== 'string') badRequest()
  const normalized = value.trim()
  if (!normalized || normalized.length > maximum) badRequest()
  return normalized
}

function normalizeOptionalText(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') badRequest()
  const normalized = value.trim()
  if (normalized.length > maximum) badRequest()
  return normalized || null
}

function normalizeOptionalId(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return normalizeRequiredText(value, 255)
}

function normalizeLink(value: unknown): NormalizedIncidentLink {
  assertPlainObject(value)
  assertAllowedKeys(value, ['link_type', 'link_id'])
  if (!['task', 'risk', 'asset'].includes(String(value.link_type))) badRequest()
  return {
    linkType: value.link_type as IncidentLinkType,
    linkId: normalizeRequiredText(value.link_id, 255),
  }
}

export function normalizeIncidentCreateBody(
  value: unknown
): NormalizedIncidentCreateBody {
  assertPlainObject(value)
  assertAllowedKeys(value, [
    'title',
    'description',
    'occurred_at',
    'severity',
    'department_id',
    'approver_id',
    'links',
  ])

  const occurredAtInput = normalizeRequiredText(value.occurred_at, 64)
  const occurredAt = new Date(occurredAtInput)
  if (Number.isNaN(occurredAt.getTime())) badRequest()

  if (!['low', 'medium', 'high', 'critical'].includes(String(value.severity))) {
    badRequest()
  }

  if (value.links !== undefined && !Array.isArray(value.links)) badRequest()
  const links = (value.links ?? []).map(normalizeLink)
  if (links.length > 50) badRequest()
  const uniqueLinks = new Set(links.map(link => `${link.linkType}:${link.linkId}`))
  if (uniqueLinks.size !== links.length) badRequest('Duplicate incident link')

  return {
    title: normalizeRequiredText(value.title, 200),
    description: normalizeOptionalText(value.description, 10_000),
    occurredAt: occurredAt.toISOString(),
    severity: value.severity as IncidentSeverity,
    departmentId: normalizeRequiredText(value.department_id, 255),
    approverId: normalizeOptionalId(value.approver_id),
    links,
  }
}

export function normalizeIncidentLinkBody(value: unknown): NormalizedIncidentLink {
  return normalizeLink(value)
}

export function normalizeIncidentLinkDeleteBody(value: unknown): { linkId: string } {
  assertPlainObject(value)
  assertAllowedKeys(value, ['link_id'])
  return { linkId: normalizeRequiredText(value.link_id, 255) }
}

function normalizeIncidentStatusBody(value: unknown): IncidentRecord['status'] {
  assertPlainObject(value)
  assertAllowedKeys(value, ['status'])
  if (!['draft', 'in_progress', 'resolved', 'closed'].includes(String(value.status))) {
    badRequest()
  }
  return value.status as IncidentRecord['status']
}

function canAccessDepartment(
  authorization: TenantAuthorizationContext,
  departmentId: string | null
): boolean {
  if (authorization.departmentAccess.mode === 'all') return true
  if (departmentId === null) return authorization.departmentAccess.includeUnassigned
  return authorization.departmentAccess.departmentIds.includes(departmentId)
}

function mapIncident(row: typeof incidents.$inferSelect): IncidentRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    title: row.title,
    description: row.description ?? null,
    occurred_at: row.occurredAt,
    severity: row.severity as IncidentRecord['severity'],
    status: row.status as IncidentRecord['status'],
    reporter_id: row.reporterId ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapLink(row: typeof incidentLinks.$inferSelect): IncidentLink {
  return {
    id: row.id,
    incident_id: row.incidentId,
    link_type: row.linkType as IncidentLinkType,
    link_id: row.linkId,
    created_at: row.createdAt,
  }
}

async function refreshAuthorization(
  db: IncidentDb,
  expected: TenantAuthorizationContext
): Promise<TenantAuthorizationContext> {
  const refreshed = await resolveTenantAuthorizationContext(
    db,
    expected.userId,
    expected.organizationId
  )
  if (!refreshed.ok) return notFound()
  return refreshed.context
}

async function assertIncidentAccess(
  db: IncidentDb,
  authorization: TenantAuthorizationContext,
  incidentId: string
): Promise<typeof incidents.$inferSelect> {
  const [row] = await db
    .select({
      incident: incidents,
      validDepartmentId: organizationDepartments.id,
    })
    .from(incidents)
    .leftJoin(
      organizationDepartments,
      and(
        eq(organizationDepartments.id, incidents.departmentId),
        eq(organizationDepartments.organizationId, authorization.organizationId)
      )
    )
    .where(and(
      eq(incidents.id, incidentId),
      eq(incidents.organizationId, authorization.organizationId)
    ))
    .limit(1)

  if (
    !row
    || (row.incident.departmentId !== null && row.validDepartmentId === null)
    || !canAccessDepartment(authorization, row.incident.departmentId)
  ) {
    return notFound()
  }
  return row.incident
}

async function assertOwnedResourceDepartmentAccess(
  db: IncidentDb,
  authorization: TenantAuthorizationContext,
  resource: 'risk' | 'asset',
  resourceId: string
): Promise<void> {
  const source = resource === 'risk' ? risks : informationAssets
  const [row] = await db
    .select({
      id: source.id,
      organizationId: source.organizationId,
      ownerId: source.ownerId,
      ownerProfileId: userProfiles.id,
      ownerActive: userProfiles.isActive,
      ownerPrimaryDepartmentId: userProfiles.primaryDepartmentId,
      ownerMembershipUserId: userMemberships.userId,
      ownerMembershipStatus: userMemberships.status,
      validDepartmentId: organizationDepartments.id,
    })
    .from(source)
    .leftJoin(userProfiles, eq(userProfiles.id, source.ownerId))
    .leftJoin(
      userMemberships,
      and(
        eq(userMemberships.userId, userProfiles.id),
        eq(userMemberships.organizationId, authorization.organizationId)
      )
    )
    .leftJoin(
      organizationDepartments,
      and(
        eq(organizationDepartments.id, userProfiles.primaryDepartmentId),
        eq(organizationDepartments.organizationId, authorization.organizationId)
      )
    )
    .where(and(
      eq(source.id, resourceId),
      eq(source.organizationId, authorization.organizationId)
    ))
    .limit(1)

  if (!row) return notFound()
  if (row.ownerId === null) {
    if (
      authorization.departmentAccess.mode === 'scoped'
      && !authorization.departmentAccess.includeUnassigned
    ) return notFound()
    return
  }
  if (
    row.ownerProfileId === null
    || row.ownerActive !== true
    || row.ownerMembershipUserId === null
    || row.ownerMembershipStatus !== 'active'
  ) {
    return notFound()
  }
  if (
    row.ownerPrimaryDepartmentId !== null
    && row.validDepartmentId === null
  ) return notFound()
  if (authorization.departmentAccess.mode === 'all') return
  if (
    row.ownerPrimaryDepartmentId === null
    || row.validDepartmentId === null
    || !authorization.departmentAccess.departmentIds.includes(row.validDepartmentId)
  ) return notFound()
}

export async function assertIncidentRelatedResourceAccess(
  db: IncidentDb,
  authorization: TenantAuthorizationContext,
  link: IncidentRelatedResourceLink
): Promise<void> {
  if (link.linkType === 'task') {
    const [task] = await db
      .select({ id: tasks.id, organizationId: tasks.organizationId })
      .from(tasks)
      .where(and(
        eq(tasks.id, link.linkId),
        eq(tasks.organizationId, authorization.organizationId)
      ))
      .limit(1)
    if (!task?.organizationId) return notFound()

    // tasks has no persisted department relation yet. Scoped access must not
    // infer one from assignee or reporter data.
    if (authorization.departmentAccess.mode === 'scoped') return notFound()
    return
  }

  if (link.linkType !== 'risk' && link.linkType !== 'asset') return notFound()

  await assertOwnedResourceDepartmentAccess(
    db,
    authorization,
    link.linkType,
    link.linkId
  )
}

async function resolveEligibleApprover(
  db: IncidentDb,
  organizationId: string,
  userId: string,
  excludedUserId: string,
  departmentId: string
): Promise<string | null> {
  if (userId === excludedUserId) return null
  const eligibility = await resolveApprovalEligibility(db, userId, organizationId)
  return eligibility && canAccessDepartment(eligibility, departmentId)
    ? eligibility.userId
    : null
}

async function resolveNextEligibleApprover(
  db: IncidentDb,
  organizationId: string,
  excludedUserId: string,
  departmentId: string
): Promise<string | null> {
  const candidates = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .innerJoin(
      userMemberships,
      and(
        eq(userMemberships.userId, userProfiles.id),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active'),
        inArray(userMemberships.role, ELIGIBLE_APPROVAL_MEMBERSHIP_ROLES)
      )
    )
    .where(and(
      eq(userProfiles.isActive, true),
      ne(userProfiles.id, excludedUserId)
    ))
    .orderBy(asc(userProfiles.id))

  for (const candidate of candidates) {
    const eligible = await resolveEligibleApprover(
      db,
      organizationId,
      candidate.id,
      excludedUserId,
      departmentId
    )
    if (eligible) return eligible
  }
  return null
}

async function resolveAutomaticApprover(
  db: IncidentDb,
  organizationId: string,
  departmentId: string,
  requesterId: string
): Promise<string | null> {
  const [rule] = await db
    .select()
    .from(approvalEscalationRules)
    .where(and(
      eq(approvalEscalationRules.organizationId, organizationId),
      eq(approvalEscalationRules.resourceType, 'incident'),
      eq(approvalEscalationRules.isActive, true)
    ))
    .limit(1)
  if (!rule) return null

  let approverId: string | null = null

  if (rule.escalationTargetType === 'user' && rule.escalationUserId) {
    approverId = await resolveEligibleApprover(
      db,
      organizationId,
      rule.escalationUserId,
      requesterId,
      departmentId
    )
  }

  if (!approverId && rule.escalationTargetType === 'department_manager' && departmentId) {
    const [department] = await db
      .select({ manager: organizationDepartments.manager })
      .from(organizationDepartments)
      .where(and(
        eq(organizationDepartments.id, departmentId),
        eq(organizationDepartments.organizationId, organizationId)
      ))
      .limit(1)
    if (department?.manager) {
      approverId = await resolveEligibleApprover(
        db,
        organizationId,
        department.manager,
        requesterId,
        departmentId
      )
    }
  }

  if (!approverId && rule.escalationTargetType === 'role_flag' && rule.escalationRoleFlag) {
    const flagConditions = {
      is_ciso: eq(userProfiles.isCiso, true),
      is_security_manager: eq(userProfiles.isSecurityManager, true),
      is_org_admin: eq(userProfiles.isOrgAdmin, true),
      is_audit_committee: eq(userProfiles.isAuditCommittee, true),
      is_isms_promoter: eq(userProfiles.isIsmsPromoter, true),
    } as const
    const flagCondition = flagConditions[
      rule.escalationRoleFlag as keyof typeof flagConditions
    ]
    if (!flagCondition) return null

    const candidates = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .innerJoin(
        userMemberships,
        and(
          eq(userMemberships.userId, userProfiles.id),
          eq(userMemberships.organizationId, organizationId),
          eq(userMemberships.status, 'active')
        )
      )
      .where(and(eq(userProfiles.isActive, true), flagCondition))
    for (const candidate of candidates) {
      const eligible = await resolveEligibleApprover(
        db,
        organizationId,
        candidate.id,
        requesterId,
        departmentId
      )
      if (eligible) {
        approverId = eligible
        break
      }
    }
  }

  return approverId ?? resolveNextEligibleApprover(
    db,
    organizationId,
    requesterId,
    departmentId
  )
}

async function insertAudit(
  db: IncidentDb,
  authorization: TenantAuthorizationContext,
  audit: IncidentMutationAuditContext,
  action: string,
  resourceType: string,
  resourceId: string,
  changes: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: authorization.organizationId,
    userId: authorization.userId,
    action,
    resourceType,
    resourceId,
    changes: JSON.stringify(changes),
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
    scope: 'tenant',
  })
}

export class IncidentTenantMutationService {
  constructor(
    private readonly db: IncidentDb = getDb(),
    private readonly injectFailure?: IncidentMutationFailureInjector
  ) {}

  async createIncident(
    authorization: TenantAuthorizationContext,
    body: unknown,
    audit: IncidentMutationAuditContext = {}
  ): Promise<{ incident: IncidentRecord; links: IncidentLink[] }> {
    const input = normalizeIncidentCreateBody(body)

    return this.db.transaction(async tx => {
      const transactionDb = tx as unknown as IncidentDb
      const freshAuthorization = await refreshAuthorization(transactionDb, authorization)

      if (input.departmentId !== null) {
        const [department] = await tx
          .select({ id: organizationDepartments.id })
          .from(organizationDepartments)
          .where(and(
            eq(organizationDepartments.id, input.departmentId),
            eq(organizationDepartments.organizationId, freshAuthorization.organizationId)
          ))
          .limit(1)
        if (!department || !canAccessDepartment(freshAuthorization, department.id)) {
          return notFound()
        }
      } else if (!canAccessDepartment(freshAuthorization, null)) {
        return notFound()
      }

      let approverId: string | null
      if (input.approverId) {
        if (input.approverId === freshAuthorization.userId) {
          badRequest('Requester cannot approve own incident')
        }
        approverId = await resolveEligibleApprover(
          transactionDb,
          freshAuthorization.organizationId,
          input.approverId,
          freshAuthorization.userId,
          input.departmentId
        )
        if (!approverId) badRequest('Invalid approver')
      } else {
        approverId = await resolveAutomaticApprover(
          transactionDb,
          freshAuthorization.organizationId,
          input.departmentId,
          freshAuthorization.userId
        )
      }

      if (approverId) {
        const approverAuthorization = await resolveApprovalEligibility(
          transactionDb,
          approverId,
          freshAuthorization.organizationId
        )
        if (!approverAuthorization || !canAccessDepartment(approverAuthorization, input.departmentId)) {
          badRequest('Invalid approver')
        }
      }

      for (const link of input.links) {
        await assertIncidentRelatedResourceAccess(transactionDb, freshAuthorization, link)
      }

      const incidentId = crypto.randomUUID()
      const [created] = await tx
        .insert(incidents)
        .values({
          id: incidentId,
          organizationId: freshAuthorization.organizationId,
          title: input.title,
          description: input.description,
          occurredAt: input.occurredAt,
          severity: input.severity,
          status: 'draft',
          departmentId: input.departmentId,
          reporterId: freshAuthorization.userId,
        })
        .returning()
      if (!created) throw new Error('Failed to create incident')
      await this.injectFailure?.('after_incident_insert')

      if (approverId) {
        const approvalRequestId = crypto.randomUUID()
        await tx.insert(approvalRequests).values({
          id: approvalRequestId,
          organizationId: freshAuthorization.organizationId,
          resourceType: 'incident',
          resourceId: incidentId,
          status: 'pending',
          requestedBy: freshAuthorization.userId,
          approverId,
        })
        await tx.insert(approvalEvents).values({
          id: crypto.randomUUID(),
          approvalRequestId,
          eventType: 'requested',
          actorId: freshAuthorization.userId,
          payload: JSON.stringify({ incident_id: incidentId }),
        })
        await tx.insert(notifications).values({
          id: crypto.randomUUID(),
          organizationId: freshAuthorization.organizationId,
          userId: approverId,
          title: 'インシデント承認依頼',
          message: `インシデント「${input.title}」の承認が必要です。`,
          type: 'system',
          priority: 'high',
          status: 'unread',
          link: `/incidents/${incidentId}`,
          metadata: JSON.stringify({
            incident_id: incidentId,
            requester_id: freshAuthorization.userId,
          }),
        })
        await this.injectFailure?.('after_approval_insert')
      }

      await insertAudit(
        transactionDb,
        freshAuthorization,
        audit,
        'incident.created',
        'incident',
        incidentId,
        {
          status: 'draft',
          severity: input.severity,
          department_id: input.departmentId,
          reporter_id: freshAuthorization.userId,
          approver_id: approverId,
        }
      )

      const links: IncidentLink[] = []
      for (const link of input.links) {
        const [createdLink] = await tx
          .insert(incidentLinks)
          .values({
            id: crypto.randomUUID(),
            incidentId,
            linkType: link.linkType,
            linkId: link.linkId,
          })
          .returning()
        if (!createdLink) throw new Error('Failed to create incident link')
        await insertAudit(
          transactionDb,
          freshAuthorization,
          audit,
          'incident.link_created',
          'incident_link',
          createdLink.id,
          {
            incident_id: incidentId,
            link_type: link.linkType,
            link_id: link.linkId,
          }
        )
        links.push(mapLink(createdLink))
        await this.injectFailure?.('after_link_insert')
      }

      return { incident: mapIncident(created), links }
    })
  }

  async createLink(
    authorization: TenantAuthorizationContext,
    incidentId: string,
    body: unknown,
    audit: IncidentMutationAuditContext = {}
  ): Promise<IncidentLink> {
    const input = normalizeIncidentLinkBody(body)

    try {
      return await this.db.transaction(async tx => {
        const transactionDb = tx as unknown as IncidentDb
        const freshAuthorization = await refreshAuthorization(transactionDb, authorization)
        await assertIncidentAccess(transactionDb, freshAuthorization, incidentId)
        await assertIncidentRelatedResourceAccess(transactionDb, freshAuthorization, input)

        const [created] = await tx
          .insert(incidentLinks)
          .values({
            id: crypto.randomUUID(),
            incidentId,
            linkType: input.linkType,
            linkId: input.linkId,
          })
          .returning()
        if (!created) throw new Error('Failed to create incident link')
        await insertAudit(
          transactionDb,
          freshAuthorization,
          audit,
          'incident.link_created',
          'incident_link',
          created.id,
          {
            incident_id: incidentId,
            link_type: input.linkType,
            link_id: input.linkId,
          }
        )
        await this.injectFailure?.('after_link_insert')
        return mapLink(created)
      })
    } catch (error) {
      if (
        error instanceof Error
        && error.message.includes('UNIQUE constraint failed')
      ) {
        throw new IncidentTenantMutationError(409, 'Incident link already exists')
      }
      throw error
    }
  }

  async updateIncidentStatus(
    authorization: TenantAuthorizationContext,
    incidentId: string,
    body: unknown,
    audit: IncidentMutationAuditContext = {}
  ): Promise<IncidentRecord> {
    const status = normalizeIncidentStatusBody(body)

    return this.db.transaction(async tx => {
      const transactionDb = tx as unknown as IncidentDb
      const freshAuthorization = await refreshAuthorization(transactionDb, authorization)
      const current = await assertIncidentAccess(
        transactionDb,
        freshAuthorization,
        incidentId
      )
      const [updated] = await tx
        .update(incidents)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(and(
          eq(incidents.id, incidentId),
          eq(incidents.organizationId, freshAuthorization.organizationId)
        ))
        .returning()
      if (!updated) return notFound()

      await insertAudit(
        transactionDb,
        freshAuthorization,
        audit,
        'incident.updated',
        'incident',
        incidentId,
        { status: { from: current.status, to: status } }
      )
      return mapIncident(updated)
    })
  }

  async deleteLink(
    authorization: TenantAuthorizationContext,
    incidentId: string,
    body: unknown,
    audit: IncidentMutationAuditContext = {}
  ): Promise<void> {
    const { linkId } = normalizeIncidentLinkDeleteBody(body)

    await this.db.transaction(async tx => {
      const transactionDb = tx as unknown as IncidentDb
      const freshAuthorization = await refreshAuthorization(transactionDb, authorization)
      await assertIncidentAccess(transactionDb, freshAuthorization, incidentId)

      const [link] = await tx
        .select()
        .from(incidentLinks)
        .where(and(
          eq(incidentLinks.id, linkId),
          eq(incidentLinks.incidentId, incidentId)
        ))
        .limit(1)
      if (!link) return notFound()

      await assertIncidentRelatedResourceAccess(transactionDb, freshAuthorization, {
        linkType: link.linkType as IncidentLinkType,
        linkId: link.linkId,
      })
      const deleted = await tx
        .delete(incidentLinks)
        .where(and(
          eq(incidentLinks.id, linkId),
          eq(incidentLinks.incidentId, incidentId)
        ))
        .returning({ id: incidentLinks.id })
      if (!deleted[0]) return notFound()

      await insertAudit(
        transactionDb,
        freshAuthorization,
        audit,
        'incident.link_deleted',
        'incident_link',
        linkId,
        {
          incident_id: incidentId,
          link_type: link.linkType,
          link_id: link.linkId,
        }
      )
      await this.injectFailure?.('after_link_delete')
    })
  }
}
