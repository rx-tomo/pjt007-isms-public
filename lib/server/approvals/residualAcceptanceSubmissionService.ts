import { and, eq, exists, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  approvalEvents,
  approvalRequests,
  auditLogs,
  isoControls,
  organizationDepartments,
  riskControlLinks,
  residualAcceptanceApprovalBindings,
  risks,
  riskTreatments,
  type UserRole,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import {
  isEligibleApprovalMembershipRole,
  resolveApprovalEligibility,
} from '@/lib/server/approvals/approvalEligibility'
import { resolveRiskApprovalResourceScope } from '@/lib/server/approvals/approvalResourceScope'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
} from '@/lib/server/auth/authorizationContext'
import type { ApprovalRequest } from '@/lib/services/approval'
import type { TreatmentPayload } from '@/lib/services/risk'

const RESPONSIBLE_ASSIGNMENT_ROLES = new Set(['org_admin', 'system_operator'])

const MATERIAL_TREATMENT_FIELDS = new Set<keyof TreatmentPayload>([
  'treatment_type',
  'description',
  'responsible_id',
  'due_date',
  'status',
  'residual_review_due_date',
  'cost_estimate',
  'actual_cost',
  'effectiveness_rating',
])

export interface ResidualAcceptanceApproverEligibility {
  id: string
  membershipRole: string
  primaryDepartmentId: string | null
  departmentId: string | null
}

export interface RiskTreatmentResourceScope {
  treatmentId: string
  treatmentType: string
  treatmentStatus: string | null
  residualApprovalStatus: string | null
  residualReviewDueDate: string | null
  materialVersion: number
  responsibleId: string | null
  riskId: string
  riskTitle: string
  ownerId: string | null
  departmentId: string | null
}

interface RiskResourceScope {
  riskId: string
  riskTitle: string
  ownerId: string | null
  departmentId: string | null
}

const DIRECT_RESIDUAL_ACCEPTANCE_FIELDS = [
  'residual_approval_status',
  'residual_approved_by',
  'residual_approved_at',
  'residual_rejection_reason',
] as const

export class ResidualAcceptanceSubmissionError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'ResidualAcceptanceSubmissionError'
  }
}

export function isResidualAcceptanceSubmissionError(
  error: unknown
): error is ResidualAcceptanceSubmissionError {
  return error instanceof ResidualAcceptanceSubmissionError
}

export function assertNoDirectResidualAcceptanceMutation(
  body: Record<string, unknown>
): void {
  if (
    DIRECT_RESIDUAL_ACCEPTANCE_FIELDS.some(field => (
      Object.prototype.hasOwnProperty.call(body, field)
    ))
  ) {
    throw new ResidualAcceptanceSubmissionError(
      400,
      'Residual acceptance approval fields cannot be updated directly'
    )
  }
}

function isPendingApprovalUniqueViolation(error: unknown): boolean {
  const candidates: unknown[] = [error]
  if (error && typeof error === 'object' && 'cause' in error) {
    candidates.push(error.cause)
  }

  return candidates.some(candidate => {
    if (!candidate || typeof candidate !== 'object') return false
    const code = 'code' in candidate ? String(candidate.code) : ''
    const message = 'message' in candidate ? String(candidate.message) : ''
    const isConstraint = code.includes('SQLITE_CONSTRAINT')
      || message.includes('UNIQUE constraint failed')
    return isConstraint && (
      message.includes('idx_approval_requests_single_pending_unique')
      || message.includes('approval_requests.organization_id')
    )
  })
}

function sameDepartmentAccess(
  left: TenantAuthorizationContext['departmentAccess'],
  right: TenantAuthorizationContext['departmentAccess']
): boolean {
  if (left.mode !== right.mode) return false
  if (left.mode === 'all' || right.mode === 'all') return true
  return left.includeUnassigned === right.includeUnassigned
    && [...left.departmentIds].sort().join('\0') === [...right.departmentIds].sort().join('\0')
}

async function resolveFreshActorAuthorization(
  db: ReturnType<typeof getDb>,
  authorization: TenantAuthorizationContext
): Promise<TenantAuthorizationContext> {
  const fresh = await resolveTenantAuthorizationContext(
    db,
    authorization.userId,
    authorization.organizationId
  )
  if (!fresh.ok) {
    throw new ResidualAcceptanceSubmissionError(403, 'Forbidden')
  }
  return fresh.context
}

async function resolveRiskResourceScope(
  organizationId: string,
  riskId: string,
  db: ReturnType<typeof getDb>
): Promise<RiskResourceScope | null> {
  const [risk] = await db
    .select({
      riskId: risks.id,
      riskTitle: risks.title,
      ownerId: risks.ownerId,
    })
    .from(risks)
    .where(and(
      eq(risks.id, riskId),
      eq(risks.organizationId, organizationId)
    ))
    .limit(1)
  if (!risk) return null
  const scope = await resolveRiskApprovalResourceScope(db, organizationId, riskId)
  return scope.ok ? { ...risk, departmentId: scope.departmentId } : null
}

async function isActiveOrganizationMember(
  organizationId: string,
  userId: string,
  db: ReturnType<typeof getDb>
): Promise<boolean> {
  const [member] = await db
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
    .where(and(
      eq(userProfiles.id, userId),
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isActive, true)
    ))
    .limit(1)
  return Boolean(member)
}

function activeOrganizationMemberPredicate(
  organizationId: string,
  userId: string,
  db: ReturnType<typeof getDb>
) {
  return exists(
    db
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
      .where(and(
        eq(userProfiles.id, userId),
        eq(userProfiles.organizationId, organizationId),
        eq(userProfiles.isActive, true)
      ))
  )
}

export async function resolveResidualAcceptanceApproverEligibility(
  organizationId: string,
  responsibleId?: string | null,
  db = getDb()
): Promise<ResidualAcceptanceApproverEligibility | null> {
  const baseSelection = {
    id: userProfiles.id,
    membershipRole: userMemberships.role,
    primaryDepartmentId: userProfiles.primaryDepartmentId,
    departmentId: organizationDepartments.id,
  }
  const joinMembership = and(
    eq(userMemberships.userId, userProfiles.id),
    eq(userMemberships.organizationId, organizationId),
    eq(userMemberships.status, 'active')
  )
  const joinDepartment = and(
    eq(organizationDepartments.id, userProfiles.primaryDepartmentId),
    eq(organizationDepartments.organizationId, organizationId)
  )

  if (responsibleId) {
    const [candidate] = await db
      .select(baseSelection)
      .from(userProfiles)
      .innerJoin(userMemberships, joinMembership)
      .leftJoin(organizationDepartments, joinDepartment)
      .where(and(
        eq(userProfiles.id, responsibleId),
        eq(userProfiles.isActive, true)
      ))
      .limit(1)
    if (
      !candidate
      || !isEligibleApprovalMembershipRole(candidate.membershipRole as UserRole)
      || (
        candidate.primaryDepartmentId !== null
        && candidate.departmentId === null
      )
    ) return null
    return candidate
  }

  const candidates = await db
    .select({ ...baseSelection, isCiso: userProfiles.isCiso })
    .from(userProfiles)
    .innerJoin(userMemberships, joinMembership)
    .leftJoin(organizationDepartments, joinDepartment)
    .where(eq(userProfiles.isActive, true))
  const validCandidates = candidates.filter(candidate => (
    isEligibleApprovalMembershipRole(candidate.membershipRole as UserRole)
    && (
      candidate.primaryDepartmentId === null
      || candidate.departmentId !== null
    )
  ))
  const selected = validCandidates.find(candidate => candidate.isCiso)
    ?? validCandidates.find(candidate => candidate.membershipRole === 'org_admin')
    ?? validCandidates.find(candidate => candidate.membershipRole === 'system_operator')

  return selected ? {
    id: selected.id,
    membershipRole: selected.membershipRole,
    primaryDepartmentId: selected.primaryDepartmentId,
    departmentId: selected.departmentId,
  } : null
}

export async function resolveResidualAcceptanceApprover(
  organizationId: string,
  responsibleId?: string | null,
  db = getDb()
): Promise<string | null> {
  return (await resolveResidualAcceptanceApproverEligibility(
    organizationId,
    responsibleId,
    db
  ))?.id ?? null
}

export async function resolveRiskTreatmentResourceScope(
  organizationId: string,
  treatmentId: string,
  db = getDb()
): Promise<RiskTreatmentResourceScope | null> {
  const [scope] = await db
    .select({
      treatmentId: riskTreatments.id,
      treatmentType: riskTreatments.treatmentType,
      treatmentStatus: riskTreatments.status,
      residualApprovalStatus: riskTreatments.residualApprovalStatus,
      residualReviewDueDate: riskTreatments.residualReviewDueDate,
      materialVersion: riskTreatments.materialVersion,
      responsibleId: riskTreatments.responsibleId,
      riskId: risks.id,
      riskTitle: risks.title,
      ownerId: risks.ownerId,
    })
    .from(riskTreatments)
    .innerJoin(risks, eq(riskTreatments.riskId, risks.id))
    .where(and(
      eq(riskTreatments.id, treatmentId),
      eq(risks.organizationId, organizationId)
    ))
    .limit(1)

  if (!scope?.riskId) return null
  const riskScope = await resolveRiskResourceScope(organizationId, scope.riskId, db)
  if (!riskScope || riskScope.ownerId !== scope.ownerId) return null
  return { ...scope, departmentId: riskScope.departmentId }
}

function canAccessResourceDepartment(
  authorization: TenantAuthorizationContext,
  scope: Pick<RiskTreatmentResourceScope, 'ownerId' | 'departmentId'>
): boolean {
  if (authorization.departmentAccess.mode === 'all') return true
  if (scope.ownerId === null) {
    return authorization.departmentAccess.includeUnassigned
  }
  return scope.departmentId !== null
    && authorization.departmentAccess.departmentIds.includes(scope.departmentId)
}

async function resolveResponsibleForResource(
  organizationId: string,
  responsibleId: string | null,
  actorId: string,
  resource: Pick<RiskResourceScope, 'ownerId' | 'departmentId'>,
  db: ReturnType<typeof getDb>
): Promise<ResidualAcceptanceApproverEligibility | null> {
  if (!responsibleId || responsibleId === actorId) return null
  const candidate = await resolveResidualAcceptanceApproverEligibility(
    organizationId,
    responsibleId,
    db
  )
  const candidateAuthorization = candidate
    ? await resolveApprovalEligibility(db, candidate.id, organizationId)
    : null
  if (
    !candidate
    || !candidateAuthorization
    || !canAccessResourceDepartment(candidateAuthorization, {
      ownerId: resource.ownerId,
      departmentId: resource.departmentId,
    })
  ) return null
  return candidate
}

function toApprovalRequest(
  row: typeof approvalRequests.$inferSelect
): ApprovalRequest {
  return {
    id: row.id,
    organization_id: row.organizationId,
    resource_type: 'risk_residual_acceptance',
    resource_id: row.resourceId,
    status: row.status as ApprovalRequest['status'],
    requested_by: row.requestedBy ?? null,
    requested_at: row.requestedAt,
    approver_id: row.approverId ?? null,
    approved_at: row.approvedAt ?? null,
    rejection_reason: row.rejectionReason ?? null,
    due_at: row.dueAt ?? null,
    notified_at: row.notifiedAt ?? null,
    escalation_notified_at: row.escalationNotifiedAt ?? null,
    step_number: row.stepNumber ?? null,
    reverted_at: row.revertedAt ?? null,
    revert_reason: row.revertReason ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toTreatmentResponse(row: typeof riskTreatments.$inferSelect) {
  return {
    id: row.id,
    risk_id: row.riskId,
    treatment_type: row.treatmentType,
    description: row.description,
    responsible_id: row.responsibleId,
    due_date: row.dueDate,
    status: row.status,
    residual_approval_status: row.residualApprovalStatus ?? 'draft',
    residual_approved_by: row.residualApprovedBy,
    residual_approved_at: row.residualApprovedAt,
    residual_rejection_reason: row.residualRejectionReason,
    residual_review_due_date: row.residualReviewDueDate,
    material_version: row.materialVersion,
    cost_estimate: row.costEstimate,
    actual_cost: row.actualCost,
    effectiveness_rating: row.effectivenessRating,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class ResidualAcceptanceSubmissionService {
  constructor(private readonly db = getDb()) {}

  async prepareForRiskOwnerChange(input: { riskId: string; now: string }) {
    const affected = await this.db
      .select({
        id: riskTreatments.id,
        approvalStatus: riskTreatments.residualApprovalStatus,
      })
      .from(riskTreatments)
      .where(and(
        eq(riskTreatments.riskId, input.riskId),
        eq(riskTreatments.treatmentType, 'accept')
      ))
    if (affected.some(treatment => treatment.approvalStatus === 'submitted')) {
      throw new ResidualAcceptanceSubmissionError(409, 'Submitted residual acceptance owner cannot change')
    }

    const resetTreatmentIds = affected
      .filter(treatment => treatment.approvalStatus === 'approved' || treatment.approvalStatus === 'rejected')
      .map(treatment => treatment.id)
    if (resetTreatmentIds.length === 0) return { resetTreatmentIds }

    const resetResult = await this.db
      .update(riskTreatments)
      .set({
        residualApprovalStatus: 'draft',
        residualApprovedBy: null,
        residualApprovedAt: null,
        residualRejectionReason: null,
        materialVersion: sql`${riskTreatments.materialVersion} + 1`,
        updatedAt: input.now,
      })
      .where(and(
        eq(riskTreatments.riskId, input.riskId),
        eq(riskTreatments.treatmentType, 'accept'),
        inArray(riskTreatments.id, resetTreatmentIds),
        inArray(riskTreatments.residualApprovalStatus, ['approved', 'rejected'])
      ))
    if (resetResult.rowsAffected !== resetTreatmentIds.length) {
      throw new ResidualAcceptanceSubmissionError(409, 'Residual acceptance owner change conflict')
    }
    return { resetTreatmentIds }
  }

  async createTreatment(input: {
    authorization: TenantAuthorizationContext
    riskId: string
    treatment: TreatmentPayload
    controlIds?: string[]
    userAgent?: string | null
  }) {
    assertNoDirectResidualAcceptanceMutation(
      input.treatment as unknown as Record<string, unknown>
    )

    return this.db.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof this.db
      const authorization = await resolveFreshActorAuthorization(
        transactionDb,
        input.authorization
      )
      const scope = await resolveRiskResourceScope(
        authorization.organizationId,
        input.riskId,
        transactionDb
      )
      if (!scope || !canAccessResourceDepartment(authorization, scope)) {
        throw new ResidualAcceptanceSubmissionError(404, 'Not found')
      }

      const controlIds = input.controlIds ?? []
      const controls = controlIds.length === 0
        ? []
        : await tx
            .select({ id: isoControls.id })
            .from(isoControls)
            .where(and(
              eq(isoControls.organizationId, authorization.organizationId),
              inArray(isoControls.id, controlIds)
            ))
      if (new Set(controls.map(control => control.id)).size !== controlIds.length) {
        throw new ResidualAcceptanceSubmissionError(400, 'Invalid controlIds')
      }

      const responsibleId = input.treatment.responsible_id ?? null
      const responsible = input.treatment.treatment_type === 'accept'
        ? await resolveResponsibleForResource(
            authorization.organizationId,
            responsibleId,
            authorization.userId,
            scope,
            transactionDb
          )
        : null
      if (input.treatment.treatment_type === 'accept' && !responsible) {
        throw new ResidualAcceptanceSubmissionError(
          400,
          'A valid residual acceptance approver other than the requester is required'
        )
      }
      if (
        input.treatment.treatment_type !== 'accept'
        && responsibleId !== null
        && !await isActiveOrganizationMember(
          authorization.organizationId,
          responsibleId,
          transactionDb
        )
      ) {
        throw new ResidualAcceptanceSubmissionError(400, 'Invalid responsibleId')
      }

      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const [createdTreatment] = input.treatment.treatment_type !== 'accept' && responsibleId !== null
        ? await tx
            .insert(riskTreatments)
            .select(tx.select({
              id: sql<string>`${id}`.as('id'),
              riskId: risks.id,
              treatmentType: sql<string>`${input.treatment.treatment_type}`.as('treatment_type'),
              description: sql<string>`${input.treatment.description}`.as('description'),
              responsibleId: sql<string>`${responsibleId}`.as('responsible_id'),
              dueDate: sql<string | null>`${input.treatment.due_date ?? null}`.as('due_date'),
              status: sql<string>`${input.treatment.status ?? 'planned'}`.as('status'),
              residualApprovalStatus: sql<string>`'draft'`.as('residual_approval_status'),
              residualApprovedBy: sql<string | null>`NULL`.as('residual_approved_by'),
              residualApprovedAt: sql<string | null>`NULL`.as('residual_approved_at'),
              residualRejectionReason: sql<string | null>`NULL`.as('residual_rejection_reason'),
              residualReviewDueDate: sql<string | null>`${input.treatment.residual_review_due_date ?? null}`.as('residual_review_due_date'),
              materialVersion: sql<number>`1`.as('material_version'),
              costEstimate: sql<number | null>`${input.treatment.cost_estimate ?? null}`.as('cost_estimate'),
              actualCost: sql<number | null>`${input.treatment.actual_cost ?? null}`.as('actual_cost'),
              effectivenessRating: sql<number | null>`${input.treatment.effectiveness_rating ?? null}`.as('effectiveness_rating'),
              createdAt: sql<string>`${now}`.as('created_at'),
              updatedAt: sql<string>`${now}`.as('updated_at'),
            })
              .from(risks)
              .where(and(
                eq(risks.id, scope.riskId),
                eq(risks.organizationId, authorization.organizationId),
                activeOrganizationMemberPredicate(
                  authorization.organizationId,
                  responsibleId,
                  transactionDb
                )
              )))
            .returning()
        : await tx.insert(riskTreatments).values({
            id,
            riskId: scope.riskId,
            treatmentType: input.treatment.treatment_type,
            description: input.treatment.description,
            responsibleId,
            dueDate: input.treatment.due_date ?? null,
            status: input.treatment.status ?? 'planned',
            residualApprovalStatus: 'draft',
            residualApprovedBy: null,
            residualApprovedAt: null,
            residualRejectionReason: null,
            residualReviewDueDate: input.treatment.residual_review_due_date ?? null,
            materialVersion: 1,
            costEstimate: input.treatment.cost_estimate ?? null,
            actualCost: input.treatment.actual_cost ?? null,
            effectivenessRating: input.treatment.effectiveness_rating ?? null,
            createdAt: now,
            updatedAt: now,
          }).returning()
      if (!createdTreatment) {
        if (input.treatment.treatment_type !== 'accept' && responsibleId !== null) {
          throw new ResidualAcceptanceSubmissionError(400, 'Invalid responsibleId')
        }
        throw new Error('Failed to create risk treatment')
      }

      if (controlIds.length > 0) {
        await tx.insert(riskControlLinks).values(controlIds.map(controlId => ({
          id: crypto.randomUUID(),
          riskTreatmentId: id,
          isoControlId: controlId,
          createdAt: now,
          updatedAt: now,
        })))
      }

      const refreshedAuthorization = await resolveFreshActorAuthorization(
        transactionDb,
        input.authorization
      )
      const refreshedScope = await resolveRiskResourceScope(
        authorization.organizationId,
        input.riskId,
        transactionDb
      )
      const refreshedResponsible = input.treatment.treatment_type === 'accept' && refreshedScope
        ? await resolveResponsibleForResource(
            authorization.organizationId,
            responsibleId,
            authorization.userId,
            refreshedScope,
            transactionDb
          )
        : null
      const [persisted] = await tx
        .select({
          riskId: riskTreatments.riskId,
          treatmentType: riskTreatments.treatmentType,
          responsibleId: riskTreatments.responsibleId,
        })
        .from(riskTreatments)
        .where(eq(riskTreatments.id, id))
        .limit(1)
      if (
        !refreshedScope
        || refreshedScope.ownerId !== scope.ownerId
        || refreshedScope.departmentId !== scope.departmentId
        || refreshedAuthorization.role !== authorization.role
        || !sameDepartmentAccess(refreshedAuthorization.departmentAccess, authorization.departmentAccess)
        || !canAccessResourceDepartment(refreshedAuthorization, refreshedScope)
        || !persisted
        || persisted.riskId !== scope.riskId
        || persisted.treatmentType !== input.treatment.treatment_type
        || persisted.responsibleId !== responsibleId
        || (input.treatment.treatment_type === 'accept' && refreshedResponsible?.id !== responsible?.id)
      ) {
        throw new ResidualAcceptanceSubmissionError(409, 'Risk treatment relation has changed')
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: authorization.organizationId,
        userId: authorization.userId,
        action: 'risk.treatment.created',
        resourceType: 'risk_treatment',
        resourceId: id,
        changes: JSON.stringify({ risk_id: scope.riskId, controlIds }),
        userAgent: input.userAgent ?? null,
        scope: 'tenant',
        createdAt: now,
      })

      return toTreatmentResponse(createdTreatment)
    })
  }

  async assertTreatmentDepartmentAccess(
    authorization: TenantAuthorizationContext,
    treatmentId: string
  ): Promise<RiskTreatmentResourceScope> {
    const scope = await resolveRiskTreatmentResourceScope(
      authorization.organizationId,
      treatmentId,
      this.db
    )
    if (!scope || !canAccessResourceDepartment(authorization, scope)) {
      throw new ResidualAcceptanceSubmissionError(404, 'Not found')
    }
    return scope
  }

  async updateTreatment(input: {
    authorization: TenantAuthorizationContext
    treatmentId: string
    updates: Partial<TreatmentPayload>
    controlIds?: string[]
    userAgent?: string | null
  }) {
    assertNoDirectResidualAcceptanceMutation(
      input.updates as Record<string, unknown>
    )

    return this.db.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof this.db
      const authorization = await resolveFreshActorAuthorization(
        transactionDb,
        input.authorization
      )
      const scope = await resolveRiskTreatmentResourceScope(
        authorization.organizationId,
        input.treatmentId,
        transactionDb
      )
      if (!scope || !canAccessResourceDepartment(authorization, scope)) {
        throw new ResidualAcceptanceSubmissionError(404, 'Not found')
      }

      const effectiveUpdates = { ...input.updates }
      const [currentTreatment] = await tx
        .select()
        .from(riskTreatments)
        .where(eq(riskTreatments.id, input.treatmentId))
        .limit(1)
      if (!currentTreatment) {
        throw new ResidualAcceptanceSubmissionError(404, 'Not found')
      }
      const currentMaterialValues: Record<string, unknown> = {
        treatment_type: currentTreatment.treatmentType,
        description: currentTreatment.description,
        responsible_id: currentTreatment.responsibleId,
        due_date: currentTreatment.dueDate,
        status: currentTreatment.status,
        residual_review_due_date: currentTreatment.residualReviewDueDate,
        cost_estimate: currentTreatment.costEstimate,
        actual_cost: currentTreatment.actualCost,
        effectiveness_rating: currentTreatment.effectivenessRating,
      }
      const materialFieldChanged = Object.entries(effectiveUpdates).some(([field, value]) => (
        MATERIAL_TREATMENT_FIELDS.has(field as keyof TreatmentPayload)
        && currentMaterialValues[field] !== value
      ))
      const existingControlLinks = input.controlIds !== undefined
        ? await tx
            .select({ id: riskControlLinks.id, controlId: riskControlLinks.isoControlId })
            .from(riskControlLinks)
            .where(eq(riskControlLinks.riskTreatmentId, input.treatmentId))
        : []
      const currentControlIds = new Set(existingControlLinks.map(link => link.controlId))
      const nextControlIds = new Set(input.controlIds ?? [])
      const controlsChanged = input.controlIds !== undefined && (
        currentControlIds.size !== nextControlIds.size
        || [...currentControlIds].some(controlId => !nextControlIds.has(controlId))
      )
      const hasMaterialMutation = materialFieldChanged || controlsChanged
      if (
        scope.treatmentType === 'accept'
        && scope.residualApprovalStatus === 'submitted'
        && hasMaterialMutation
      ) {
        throw new ResidualAcceptanceSubmissionError(
          409,
          'Submitted residual acceptance cannot be changed'
        )
      }

      const responsibleWillChange = effectiveUpdates.responsible_id !== undefined
        && effectiveUpdates.responsible_id !== scope.responsibleId
      if (responsibleWillChange) {
        const freshAuthorization = await resolveApprovalEligibility(
          transactionDb,
          authorization.userId,
          authorization.organizationId
        )
        if (
          !freshAuthorization
          || !RESPONSIBLE_ASSIGNMENT_ROLES.has(freshAuthorization.role)
        ) {
          throw new ResidualAcceptanceSubmissionError(
            403,
            'Residual acceptance responsible assignment is forbidden'
          )
        }
      }

      if (input.controlIds) {
        const controls = input.controlIds.length === 0
          ? []
          : await tx
              .select({ id: isoControls.id })
              .from(isoControls)
              .where(and(
                eq(isoControls.organizationId, input.authorization.organizationId),
                inArray(isoControls.id, input.controlIds)
              ))
        if (new Set(controls.map(control => control.id)).size !== input.controlIds.length) {
          throw new ResidualAcceptanceSubmissionError(400, 'Invalid controlIds')
        }
      }

      const resultingTreatmentType = effectiveUpdates.treatment_type ?? scope.treatmentType
      const shouldInitializeResidualAcceptance =
        scope.treatmentType !== 'accept'
        && resultingTreatmentType === 'accept'
      const shouldResetResidualAcceptance =
        scope.treatmentType === 'accept'
        && ['approved', 'rejected'].includes(scope.residualApprovalStatus ?? '')
        && hasMaterialMutation

      if (shouldInitializeResidualAcceptance || shouldResetResidualAcceptance) {
        effectiveUpdates.residual_approval_status = 'draft'
        effectiveUpdates.residual_approved_by = null
        effectiveUpdates.residual_approved_at = null
        effectiveUpdates.residual_rejection_reason = null
      }

      const resultingResponsibleId = effectiveUpdates.responsible_id === undefined
        ? scope.responsibleId
        : effectiveUpdates.responsible_id
      if (resultingTreatmentType === 'accept') {
        if (resultingResponsibleId === null) {
          throw new ResidualAcceptanceSubmissionError(
            400,
            'A valid residual acceptance approver other than the requester is required'
          )
        }
        const resultingApprover = await resolveResponsibleForResource(
          authorization.organizationId,
          resultingResponsibleId,
          authorization.userId,
          scope,
          transactionDb
        )
        if (!resultingApprover) {
          throw new ResidualAcceptanceSubmissionError(
            400,
            'A valid residual acceptance approver other than the requester is required'
          )
        }
      } else if (
        responsibleWillChange
        &&
        resultingResponsibleId !== null
        && !await isActiveOrganizationMember(
          authorization.organizationId,
          resultingResponsibleId,
          transactionDb
        )
      ) {
        throw new ResidualAcceptanceSubmissionError(400, 'Invalid responsibleId')
      }

      const now = new Date().toISOString()
      const setPayload: Partial<typeof riskTreatments.$inferInsert> = { updatedAt: now }
      if (hasMaterialMutation) {
        setPayload.materialVersion = scope.materialVersion + 1
      }
      if (effectiveUpdates.treatment_type !== undefined) setPayload.treatmentType = effectiveUpdates.treatment_type
      if (effectiveUpdates.description !== undefined) setPayload.description = effectiveUpdates.description
      if (effectiveUpdates.responsible_id !== undefined) setPayload.responsibleId = effectiveUpdates.responsible_id
      if (effectiveUpdates.due_date !== undefined) setPayload.dueDate = effectiveUpdates.due_date
      if (effectiveUpdates.status !== undefined) setPayload.status = effectiveUpdates.status
      if ('residual_approval_status' in effectiveUpdates) setPayload.residualApprovalStatus = effectiveUpdates.residual_approval_status
      if ('residual_approved_by' in effectiveUpdates) setPayload.residualApprovedBy = effectiveUpdates.residual_approved_by
      if ('residual_approved_at' in effectiveUpdates) setPayload.residualApprovedAt = effectiveUpdates.residual_approved_at
      if ('residual_rejection_reason' in effectiveUpdates) setPayload.residualRejectionReason = effectiveUpdates.residual_rejection_reason
      if ('residual_review_due_date' in effectiveUpdates) setPayload.residualReviewDueDate = effectiveUpdates.residual_review_due_date
      if (effectiveUpdates.cost_estimate !== undefined) setPayload.costEstimate = effectiveUpdates.cost_estimate
      if (effectiveUpdates.actual_cost !== undefined) setPayload.actualCost = effectiveUpdates.actual_cost
      if (effectiveUpdates.effectiveness_rating !== undefined) setPayload.effectivenessRating = effectiveUpdates.effectiveness_rating

      const enforceResponsibleWritePredicate = resultingTreatmentType !== 'accept'
        && responsibleWillChange
        && resultingResponsibleId !== null

      const [updatedTreatment] = await tx
        .update(riskTreatments)
        .set(setPayload)
        .where(and(
          eq(riskTreatments.id, input.treatmentId),
          eq(riskTreatments.riskId, scope.riskId),
          eq(riskTreatments.treatmentType, scope.treatmentType),
          scope.treatmentStatus === null
            ? isNull(riskTreatments.status)
            : eq(riskTreatments.status, scope.treatmentStatus),
          scope.residualApprovalStatus === null
            ? isNull(riskTreatments.residualApprovalStatus)
            : eq(riskTreatments.residualApprovalStatus, scope.residualApprovalStatus),
          scope.responsibleId === null
            ? isNull(riskTreatments.responsibleId)
            : eq(riskTreatments.responsibleId, scope.responsibleId),
          eq(riskTreatments.materialVersion, scope.materialVersion),
          enforceResponsibleWritePredicate
            ? activeOrganizationMemberPredicate(
                authorization.organizationId,
                resultingResponsibleId,
                transactionDb
              )
            : undefined,
          inArray(
            riskTreatments.riskId,
            tx
              .select({ id: risks.id })
              .from(risks)
              .where(and(
                eq(risks.organizationId, input.authorization.organizationId),
                scope.ownerId === null
                  ? isNull(risks.ownerId)
                  : eq(risks.ownerId, scope.ownerId)
              ))
          )
        ))
        .returning()

      if (!updatedTreatment) {
        throw new ResidualAcceptanceSubmissionError(
          409,
          'Risk treatment is no longer update-able'
        )
      }

      if (input.controlIds) {
        const nextIds = new Set(input.controlIds)
        const obsoleteIds = existingControlLinks
          .filter(link => !nextIds.has(link.controlId))
          .map(link => link.id)
        if (obsoleteIds.length > 0) {
          await tx.delete(riskControlLinks).where(inArray(riskControlLinks.id, obsoleteIds))
        }
        const existingIds = new Set(existingControlLinks.map(link => link.controlId))
        const newIds = input.controlIds.filter(controlId => !existingIds.has(controlId))
        if (newIds.length > 0) {
          await tx.insert(riskControlLinks).values(newIds.map(controlId => ({
            id: crypto.randomUUID(),
            riskTreatmentId: input.treatmentId,
            isoControlId: controlId,
            createdAt: now,
            updatedAt: now,
          })))
        }
      }

      const refreshedScope = await resolveRiskTreatmentResourceScope(
        authorization.organizationId,
        input.treatmentId,
        transactionDb
      )
      const refreshedAuthorization = await resolveFreshActorAuthorization(
        transactionDb,
        input.authorization
      )
      const refreshedResponsible = resultingTreatmentType === 'accept' && refreshedScope
        ? await resolveResponsibleForResource(
            authorization.organizationId,
            resultingResponsibleId,
            authorization.userId,
            refreshedScope,
            transactionDb
          )
        : null
      if (
        !refreshedScope
        || !canAccessResourceDepartment(refreshedAuthorization, refreshedScope)
        || refreshedScope.riskId !== scope.riskId
        || refreshedScope.ownerId !== scope.ownerId
        || refreshedScope.departmentId !== scope.departmentId
        || refreshedScope.materialVersion !== scope.materialVersion + (hasMaterialMutation ? 1 : 0)
        || refreshedAuthorization.role !== authorization.role
        || !sameDepartmentAccess(refreshedAuthorization.departmentAccess, authorization.departmentAccess)
        || (resultingTreatmentType === 'accept' && !refreshedResponsible)
      ) {
        throw new ResidualAcceptanceSubmissionError(
          409,
          'Risk treatment resource relation has changed'
        )
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: authorization.organizationId,
        userId: authorization.userId,
        action: 'risk.treatment.updated',
        resourceType: 'risk_treatment',
        resourceId: input.treatmentId,
        changes: JSON.stringify({
          risk_id: scope.riskId,
          ...effectiveUpdates,
          controlIds: input.controlIds,
        }),
        userAgent: input.userAgent ?? null,
        scope: 'tenant',
        createdAt: now,
      })

      if (shouldResetResidualAcceptance) {
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: authorization.organizationId,
          userId: authorization.userId,
          action: 'risk.residual_acceptance.revised',
          resourceType: 'risk_treatment',
          resourceId: input.treatmentId,
          changes: JSON.stringify({
            risk_id: scope.riskId,
            risk_title: scope.riskTitle,
            residual_approval_status: 'draft',
            revised_fields: Object.keys(effectiveUpdates),
            controlIds: input.controlIds,
          }),
          userAgent: input.userAgent ?? null,
          scope: 'tenant',
          createdAt: now,
        })
      }

      return toTreatmentResponse(updatedTreatment)
    })
  }

  async submit(input: {
    authorization: TenantAuthorizationContext
    treatmentId: string
    userAgent?: string | null
  }): Promise<ApprovalRequest> {
    try {
      return await this.db.transaction(async (tx) => {
        const transactionDb = tx as unknown as typeof this.db
        const authorization = await resolveFreshActorAuthorization(
          transactionDb,
          input.authorization
        )
        const scope = await resolveRiskTreatmentResourceScope(
          authorization.organizationId,
          input.treatmentId,
          transactionDb
        )
        if (!scope || !canAccessResourceDepartment(authorization, scope)) {
          throw new ResidualAcceptanceSubmissionError(404, 'Not found')
        }
        if (scope.treatmentType !== 'accept') {
          throw new ResidualAcceptanceSubmissionError(
            400,
            'Only accept treatments can be submitted'
          )
        }
        if (scope.treatmentStatus !== 'completed') {
          throw new ResidualAcceptanceSubmissionError(
            400,
            'Residual acceptance must be completed before approval request'
          )
        }
        if (!scope.residualReviewDueDate) {
          throw new ResidualAcceptanceSubmissionError(
            400,
            'Residual acceptance review due date is required before approval request'
          )
        }
        if (
          scope.residualApprovalStatus === 'submitted'
          || scope.residualApprovalStatus === 'approved'
        ) {
          throw new ResidualAcceptanceSubmissionError(
            409,
            'Residual acceptance approval request already exists'
          )
        }

        if (scope.responsibleId === authorization.userId) {
          throw new ResidualAcceptanceSubmissionError(
            409,
            'Requester cannot approve their own residual acceptance'
          )
        }
        const approver = await resolveResponsibleForResource(
          authorization.organizationId,
          scope.responsibleId,
          authorization.userId,
          scope,
          transactionDb
        )
        if (!scope.responsibleId || !approver) {
          throw new ResidualAcceptanceSubmissionError(
            400,
            'A valid residual acceptance approver is required'
          )
        }
        const now = new Date().toISOString()
        const defaultDue = new Date(now)
        defaultDue.setDate(defaultDue.getDate() + 7)

        const [updatedTreatment] = await tx
          .update(riskTreatments)
          .set({
            residualApprovalStatus: 'submitted',
            residualApprovedBy: null,
            residualApprovedAt: null,
            residualRejectionReason: null,
            updatedAt: now,
          })
          .where(and(
            eq(riskTreatments.id, input.treatmentId),
            eq(riskTreatments.riskId, scope.riskId),
            eq(riskTreatments.treatmentType, 'accept'),
            eq(riskTreatments.status, 'completed'),
            eq(riskTreatments.materialVersion, scope.materialVersion),
            isNotNull(riskTreatments.residualReviewDueDate),
            scope.responsibleId === null
              ? isNull(riskTreatments.responsibleId)
              : eq(riskTreatments.responsibleId, scope.responsibleId),
            or(
              isNull(riskTreatments.residualApprovalStatus),
              eq(riskTreatments.residualApprovalStatus, 'draft'),
              eq(riskTreatments.residualApprovalStatus, 'rejected')
            ),
            inArray(
              riskTreatments.riskId,
              tx
                .select({ id: risks.id })
                .from(risks)
                .where(eq(risks.organizationId, input.authorization.organizationId))
            )
          ))
          .returning({ id: riskTreatments.id })

        if (!updatedTreatment) {
          throw new ResidualAcceptanceSubmissionError(
            409,
            'Residual acceptance is no longer submit-able'
          )
        }

        const refreshedScope = await resolveRiskTreatmentResourceScope(
          authorization.organizationId,
          input.treatmentId,
          transactionDb
        )
        const refreshedApprover = refreshedScope
          ? await resolveResponsibleForResource(
              authorization.organizationId,
              refreshedScope.responsibleId,
              authorization.userId,
              refreshedScope,
              transactionDb
            )
          : null
        const refreshedAuthorization = await resolveFreshActorAuthorization(
          transactionDb,
          input.authorization
        )
        if (
          !refreshedScope
          || !canAccessResourceDepartment(refreshedAuthorization, refreshedScope)
          || refreshedScope.riskId !== scope.riskId
          || refreshedScope.ownerId !== scope.ownerId
          || refreshedScope.departmentId !== scope.departmentId
          || refreshedScope.responsibleId !== scope.responsibleId
          || refreshedScope.materialVersion !== scope.materialVersion
          || refreshedApprover?.id !== approver.id
          || refreshedApprover.membershipRole !== approver.membershipRole
          || refreshedApprover.departmentId !== approver.departmentId
          || refreshedAuthorization.role !== authorization.role
          || !sameDepartmentAccess(refreshedAuthorization.departmentAccess, authorization.departmentAccess)
        ) {
          throw new ResidualAcceptanceSubmissionError(
            409,
            'Residual acceptance approver eligibility has changed'
          )
        }

        const requestId = crypto.randomUUID()
        const dueAt = defaultDue.toISOString()
        const [request] = await tx
          .insert(approvalRequests)
          .values({
            id: requestId,
            organizationId: authorization.organizationId,
            resourceType: 'risk_residual_acceptance',
            resourceId: input.treatmentId,
            status: 'pending',
            requestedBy: authorization.userId,
            requestedAt: now,
            approverId: approver.id,
            dueAt,
            stepNumber: 1,
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        if (!request) {
          throw new Error('Failed to create approval request')
        }

        await tx.insert(residualAcceptanceApprovalBindings).values({
          approvalRequestId: request.id,
          organizationId: authorization.organizationId,
          resourceId: input.treatmentId,
          riskId: scope.riskId,
          approverId: approver.id,
          responsibleId: scope.responsibleId,
          resourceMaterialVersion: scope.materialVersion,
        })

        await tx.insert(approvalEvents).values({
          id: crypto.randomUUID(),
          approvalRequestId: request.id,
          eventType: 'requested',
          actorId: authorization.userId,
          payload: JSON.stringify({
            approver_id: approver.id,
            due_at: dueAt,
            step_number: 1,
          }),
          createdAt: now,
        })

        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: authorization.organizationId,
          userId: authorization.userId,
          action: 'risk.residual_acceptance.approval_requested',
          resourceType: 'risk_treatment',
          resourceId: input.treatmentId,
          changes: JSON.stringify({
            risk_id: scope.riskId,
            risk_title: scope.riskTitle,
            approval_request_id: request.id,
            approver_id: approver.id,
          }),
          userAgent: input.userAgent ?? null,
          scope: 'tenant',
          createdAt: now,
        })

        return toApprovalRequest(request)
      })
    } catch (error) {
      if (isPendingApprovalUniqueViolation(error)) {
        throw new ResidualAcceptanceSubmissionError(
          409,
          'Residual acceptance approval request already exists'
        )
      }
      throw error
    }
  }
}
