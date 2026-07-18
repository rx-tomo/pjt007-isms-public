import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  approvalEvents,
  approvalRequests,
  auditChecklists,
  auditLogs,
  auditPlans,
  auditReports,
  correctiveActions,
  followUpRecords,
  incidents,
  isoControls,
  nonconformities,
  organizationDepartments,
  residualAcceptanceApprovalBindings,
  riskTreatments,
  soaVersions,
} from '@/lib/db/drizzle/schema'
import {
  resolveResidualAcceptanceApprover,
  resolveResidualAcceptanceApproverEligibility,
  resolveRiskTreatmentResourceScope,
} from '@/lib/server/approvals/residualAcceptanceSubmissionService'
import { resolveApprovalEligibility } from '@/lib/server/approvals/approvalEligibility'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import type { ApprovalResourceType } from '@/lib/services/approval'

export { resolveResidualAcceptanceApprover }

type ApprovalAction =
  | { type: 'approve'; comment?: string }
  | { type: 'reject'; reason: string }
  | { type: 'revert'; reason: string }

type ResolvedResource =
  | { kind: 'incident'; id: string; status: string; departmentId: string | null }
  | { kind: 'audit_plan'; id: string; status: string | null }
  | { kind: 'audit_report'; id: string; auditPlanId: string; approvalStatus: string }
  | {
      kind: 'nonconformity_closure'
      id: string
      nonconformityId: string
      actionStatus: string | null
      nonconformityStatus: string | null
    }
  | { kind: 'followup_record'; id: string; status: string }
  | { kind: 'iso_control_soa'; id: string; approvalStatus: string }
  | { kind: 'soa_version'; id: string; versionNumber: number; reviewStatus: string }
  | {
      kind: 'risk_residual_acceptance'
      id: string
      riskId: string
      departmentId: string | null
      treatmentType: string
      responsibleId: string
      residualApprovalStatus: string | null
      materialVersion: number
    }

const NON_DOCUMENT_RESOURCE_TYPES = new Set<ApprovalResourceType>([
  'incident',
  'audit_plan',
  'audit_report',
  'nonconformity_closure',
  'followup_record',
  'iso_control_soa',
  'soa_version',
  'risk_residual_acceptance',
])

export class NonDocumentApprovalMutationError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message = 'Approval request not found'
  ) {
    super(message)
    this.name = 'NonDocumentApprovalMutationError'
  }
}

export function isNonDocumentApprovalMutationError(
  error: unknown
): error is NonDocumentApprovalMutationError {
  return error instanceof NonDocumentApprovalMutationError
}

function notFound(): never {
  throw new NonDocumentApprovalMutationError(404)
}

function stateConflict(): never {
  throw new NonDocumentApprovalMutationError(
    409,
    'Approval resource state has changed'
  )
}

function hasExpectedResourceState(
  resource: ResolvedResource,
  requestStatus: string,
  action: ApprovalAction
): boolean {
  const decisionStatus = action.type === 'revert' ? requestStatus : 'pending'

  switch (resource.kind) {
    case 'incident':
      return resource.status === (decisionStatus === 'approved' ? 'in_progress' : 'draft')
    case 'audit_plan':
      return resource.status === (decisionStatus === 'approved' ? 'scheduled' : 'planning')
    case 'audit_report':
      return resource.approvalStatus === (
        decisionStatus === 'approved'
          ? 'approved'
          : decisionStatus === 'rejected'
            ? 'rejected'
            : 'submitted'
      )
    case 'nonconformity_closure':
      return decisionStatus === 'approved'
        ? resource.actionStatus === 'verified' && resource.nonconformityStatus === 'verified'
        : resource.actionStatus === 'completed'
          && ['resolved', 'pending_verification'].includes(resource.nonconformityStatus ?? '')
    case 'followup_record':
      return resource.status === (
        decisionStatus === 'approved'
          ? 'verified'
          : decisionStatus === 'rejected'
            ? 'in_progress'
            : 'completed'
      )
    case 'iso_control_soa':
      return resource.approvalStatus === (
        decisionStatus === 'approved'
          ? 'approved'
          : decisionStatus === 'rejected'
            ? 'rejected'
            : 'submitted'
      )
    case 'soa_version':
      return resource.reviewStatus === (
        decisionStatus === 'approved'
          ? 'approved'
          : decisionStatus === 'rejected'
            ? 'rejected'
            : 'submitted'
      )
    case 'risk_residual_acceptance':
      return resource.residualApprovalStatus === (
        decisionStatus === 'approved'
          ? 'approved'
          : decisionStatus === 'rejected'
            ? 'rejected'
            : 'submitted'
      )
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const text = value.trim()
  if (text.length > 2_000) {
    throw new NonDocumentApprovalMutationError(400, 'Invalid approval payload')
  }
  return text || undefined
}

function normalizeRequiredText(value: string): string {
  const text = normalizeOptionalText(value)
  if (!text) {
    throw new NonDocumentApprovalMutationError(400, 'Invalid approval payload')
  }
  return text
}

function canAccessDepartment(
  authorization: TenantAuthorizationContext,
  departmentId: string | null
): boolean {
  if (authorization.departmentAccess.mode === 'all') return true
  if (departmentId === null) return authorization.departmentAccess.includeUnassigned
  return authorization.departmentAccess.departmentIds.includes(departmentId)
}

export class NonDocumentApprovalMutationService {
  constructor(private readonly db = getDb()) {}

  async approve(
    authorization: TenantAuthorizationContext,
    requestId: string,
    comment?: string
  ): Promise<void> {
    await this.mutate(authorization, requestId, {
      type: 'approve',
      comment: normalizeOptionalText(comment),
    })
  }

  async reject(
    authorization: TenantAuthorizationContext,
    requestId: string,
    reason: string
  ): Promise<void> {
    await this.mutate(authorization, requestId, {
      type: 'reject',
      reason: normalizeRequiredText(reason),
    })
  }

  async revert(
    authorization: TenantAuthorizationContext,
    requestId: string,
    reason: string
  ): Promise<void> {
    await this.mutate(authorization, requestId, {
      type: 'revert',
      reason: normalizeRequiredText(reason),
    })
  }

  private async mutate(
    inputAuthorization: TenantAuthorizationContext,
    requestId: string,
    action: ApprovalAction
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const authorization = await resolveApprovalEligibility(
        tx as unknown as typeof this.db,
        inputAuthorization.userId,
        inputAuthorization.organizationId
      )
      if (!authorization) return notFound()

      const [request] = await tx
        .select()
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.id, requestId),
          eq(approvalRequests.organizationId, authorization.organizationId)
        ))
        .limit(1)

      if (
        !request
        || !NON_DOCUMENT_RESOURCE_TYPES.has(request.resourceType as ApprovalResourceType)
      ) {
        return notFound()
      }

      const [residualBinding] = request.resourceType === 'risk_residual_acceptance'
        ? await tx
            .select()
            .from(residualAcceptanceApprovalBindings)
            .where(eq(residualAcceptanceApprovalBindings.approvalRequestId, request.id))
            .limit(1)
        : [undefined]
      if (
        request.resourceType === 'risk_residual_acceptance'
        && (
          !residualBinding
          || residualBinding.organizationId !== request.organizationId
          || residualBinding.resourceId !== request.resourceId
          || !residualBinding.riskId
          || residualBinding.approverId !== request.approverId
        )
      ) return notFound()

      if (action.type === 'revert') {
        if (
          !['org_admin', 'system_operator'].includes(authorization.role)
          || !['approved', 'rejected'].includes(request.status)
        ) return notFound()
        if (request.approverId === authorization.userId) {
          throw new NonDocumentApprovalMutationError(
            409,
            '自分が処理した承認を差し戻すことはできません'
          )
        }
      } else if (
        !request.approverId
        || request.approverId !== authorization.userId
        || request.requestedBy === authorization.userId
      ) {
        return notFound()
      } else if (request.status !== 'pending') {
        return stateConflict()
      }

      let resource: ResolvedResource
      switch (request.resourceType as ApprovalResourceType) {
        case 'incident': {
          const [row] = await tx
            .select({
              id: incidents.id,
              status: incidents.status,
              rawDepartmentId: incidents.departmentId,
              departmentId: organizationDepartments.id,
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
              eq(incidents.id, request.resourceId),
              eq(incidents.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (
            !row
            || (row.rawDepartmentId !== null && row.departmentId === null)
            || !canAccessDepartment(authorization, row.departmentId)
          ) return notFound()
          resource = {
            kind: 'incident',
            id: row.id,
            status: row.status,
            departmentId: row.departmentId,
          }
          break
        }
        case 'audit_plan': {
          const [row] = await tx
            .select({ id: auditPlans.id, status: auditPlans.status })
            .from(auditPlans)
            .where(and(
              eq(auditPlans.id, request.resourceId),
              eq(auditPlans.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (!row) return notFound()
          resource = { kind: 'audit_plan', id: row.id, status: row.status }
          break
        }
        case 'audit_report': {
          const [row] = await tx
            .select({
              id: auditReports.id,
              auditPlanId: auditReports.auditPlanId,
              approvalStatus: auditReports.approvalStatus,
            })
            .from(auditReports)
            .innerJoin(auditPlans, eq(auditReports.auditPlanId, auditPlans.id))
            .where(and(
              eq(auditReports.id, request.resourceId),
              eq(auditPlans.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (!row || !row.auditPlanId) return notFound()
          resource = {
            kind: 'audit_report',
            id: row.id,
            auditPlanId: row.auditPlanId,
            approvalStatus: row.approvalStatus,
          }
          break
        }
        case 'nonconformity_closure': {
          const [row] = await tx
            .select({
              id: correctiveActions.id,
              nonconformityId: correctiveActions.nonconformityId,
              actionStatus: correctiveActions.status,
              nonconformityStatus: nonconformities.status,
            })
            .from(correctiveActions)
            .innerJoin(
              nonconformities,
              eq(correctiveActions.nonconformityId, nonconformities.id)
            )
            .innerJoin(
              auditChecklists,
              eq(nonconformities.auditChecklistId, auditChecklists.id)
            )
            .innerJoin(auditPlans, eq(auditChecklists.auditPlanId, auditPlans.id))
            .where(and(
              eq(correctiveActions.id, request.resourceId),
              eq(auditPlans.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (!row || !row.nonconformityId) return notFound()
          resource = {
            kind: 'nonconformity_closure',
            id: row.id,
            nonconformityId: row.nonconformityId,
            actionStatus: row.actionStatus,
            nonconformityStatus: row.nonconformityStatus,
          }
          break
        }
        case 'followup_record': {
          const [row] = await tx
            .select({ id: followUpRecords.id, status: followUpRecords.status })
            .from(followUpRecords)
            .innerJoin(auditPlans, eq(followUpRecords.auditPlanId, auditPlans.id))
            .where(and(
              eq(followUpRecords.id, request.resourceId),
              eq(followUpRecords.organizationId, authorization.organizationId),
              eq(auditPlans.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (!row) return notFound()
          resource = { kind: 'followup_record', id: row.id, status: row.status }
          break
        }
        case 'iso_control_soa': {
          const [row] = await tx
            .select({
              id: isoControls.id,
              approvalStatus: isoControls.soaApprovalStatus,
            })
            .from(isoControls)
            .where(and(
              eq(isoControls.id, request.resourceId),
              eq(isoControls.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (!row) return notFound()
          resource = {
            kind: 'iso_control_soa',
            id: row.id,
            approvalStatus: row.approvalStatus,
          }
          break
        }
        case 'soa_version': {
          const [row] = await tx
            .select({
              id: soaVersions.id,
              versionNumber: soaVersions.versionNumber,
              reviewStatus: soaVersions.reviewStatus,
            })
            .from(soaVersions)
            .where(and(
              eq(soaVersions.id, request.resourceId),
              eq(soaVersions.organizationId, authorization.organizationId)
            ))
            .limit(1)
          if (!row) return notFound()
          resource = {
            kind: 'soa_version',
            id: row.id,
            versionNumber: row.versionNumber,
            reviewStatus: row.reviewStatus,
          }
          break
        }
        case 'risk_residual_acceptance': {
          if (!residualBinding) return notFound()
          const assignedApproverId = residualBinding.approverId
          const transactionDb = tx as unknown as typeof this.db
          const row = await resolveRiskTreatmentResourceScope(
            authorization.organizationId,
            residualBinding.resourceId,
            transactionDb
          )
          if (!row) return notFound()
          if (
            row.treatmentType !== 'accept'
            || row.riskId !== residualBinding.riskId
            || row.responsibleId !== residualBinding.responsibleId
            || residualBinding.responsibleId !== assignedApproverId
            || request.requestedBy === assignedApproverId
          ) return notFound()
          if (row.materialVersion !== residualBinding.resourceMaterialVersion) {
            return stateConflict()
          }

          const approver = await resolveResidualAcceptanceApproverEligibility(
            authorization.organizationId,
            assignedApproverId,
            transactionDb
          )
          const responsibleAuthorization = approver
            ? await resolveApprovalEligibility(
                transactionDb,
                assignedApproverId,
                authorization.organizationId
              )
            : null
          if (
            !approver
            || approver.id !== assignedApproverId
            || !responsibleAuthorization
            || approver.membershipRole !== responsibleAuthorization.role
            || !canAccessDepartment(responsibleAuthorization, row.departmentId)
            || (
              action.type !== 'revert'
              && responsibleAuthorization.userId !== authorization.userId
            )
          ) return notFound()
          if (!canAccessDepartment(authorization, row.departmentId)) return notFound()
          resource = {
            kind: 'risk_residual_acceptance',
            id: row.treatmentId,
            riskId: row.riskId,
            departmentId: row.departmentId,
            treatmentType: row.treatmentType,
            responsibleId: assignedApproverId,
            residualApprovalStatus: row.residualApprovalStatus,
            materialVersion: residualBinding.resourceMaterialVersion,
          }
          break
        }
        default:
          return notFound()
      }

      if (!hasExpectedResourceState(resource, request.status, action)) {
        return stateConflict()
      }

      const now = new Date().toISOString()
      const status = action.type === 'approve'
        ? 'approved'
        : action.type === 'reject'
          ? 'rejected'
          : 'pending'
      const [updated] = await tx
        .update(approvalRequests)
        .set({
          status,
          approvedAt: action.type === 'approve' ? now : null,
          rejectionReason: action.type === 'reject' ? action.reason : null,
          revertedAt: action.type === 'revert' ? now : request.revertedAt,
          revertReason: action.type === 'revert' ? action.reason : request.revertReason,
          updatedAt: now,
        })
        .where(and(
          eq(approvalRequests.id, request.id),
          eq(
            approvalRequests.organizationId,
            residualBinding?.organizationId ?? authorization.organizationId
          ),
          eq(approvalRequests.resourceType, request.resourceType),
          eq(
            approvalRequests.resourceId,
            residualBinding?.resourceId ?? request.resourceId
          ),
          eq(approvalRequests.status, request.status),
          residualBinding
            ? eq(approvalRequests.approverId, residualBinding.approverId)
            : request.approverId === null
            ? isNull(approvalRequests.approverId)
            : eq(approvalRequests.approverId, request.approverId),
          request.requestedBy === null
            ? isNull(approvalRequests.requestedBy)
            : eq(approvalRequests.requestedBy, request.requestedBy)
        ))
        .returning({ id: approvalRequests.id })
      if (!updated) return stateConflict()

      await tx.insert(approvalEvents).values({
        id: crypto.randomUUID(),
        approvalRequestId: request.id,
        eventType: action.type === 'revert' ? 'reverted' : action.type === 'approve' ? 'approved' : 'rejected',
        actorId: authorization.userId,
        payload: JSON.stringify(
          action.type === 'approve'
            ? action.comment ? { comment: action.comment } : {}
            : action.type === 'reject'
              ? { reason: action.reason }
              : { reason: action.reason, previous_status: request.status }
        ),
        createdAt: now,
      })

      const appendAudit = async (input: {
        action: string
        resourceType: string
        resourceId: string
        changes: Record<string, unknown>
      }) => {
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: authorization.organizationId,
          userId: authorization.userId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          changes: JSON.stringify(input.changes),
          scope: 'tenant',
          createdAt: now,
        })
      }

      switch (resource.kind) {
        case 'incident': {
          const nextStatus = action.type === 'approve'
            ? resource.status === 'draft' ? 'in_progress' : resource.status
            : 'draft'
          const [updatedIncident] = await tx
            .update(incidents)
            .set({
              status: nextStatus,
              updatedAt: now,
            })
            .where(and(
              eq(incidents.id, resource.id),
              eq(incidents.organizationId, authorization.organizationId),
              eq(incidents.status, resource.status)
            ))
            .returning({ id: incidents.id })
          if (!updatedIncident) return stateConflict()
          await appendAudit({
            action: `incident.approval_${action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'reverted'}`,
            resourceType: 'incident',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? { approved_by: authorization.userId, comment: action.comment ?? null, status: nextStatus }
              : action.type === 'reject'
                ? { rejected_by: authorization.userId, reason: action.reason, status: nextStatus }
                : { reverted_by: authorization.userId, reason: action.reason, status: nextStatus },
          })
          break
        }
        case 'audit_plan': {
          const nextStatus = action.type === 'approve' ? 'scheduled' : 'planning'
          const [updatedPlan] = await tx
            .update(auditPlans)
            .set({ status: nextStatus, updatedAt: now })
            .where(and(
              eq(auditPlans.id, resource.id),
              eq(auditPlans.organizationId, authorization.organizationId),
              eq(auditPlans.status, resource.status!)
            ))
            .returning({ id: auditPlans.id })
          if (!updatedPlan) return stateConflict()
          await appendAudit({
            action: `audit.plan.${action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'reverted'}`,
            resourceType: 'audit_plan',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? { approved_by: authorization.userId, comment: action.comment ?? null, status: nextStatus }
              : action.type === 'reject'
                ? { rejected_by: authorization.userId, reason: action.reason, status: nextStatus }
                : { reverted_by: authorization.userId, reason: action.reason, status: nextStatus },
          })
          break
        }
        case 'audit_report': {
          const [updatedReport] = await tx
            .update(auditReports)
            .set(
              action.type === 'approve' ? {
                  approvalStatus: 'approved',
                  approvedBy: authorization.userId,
                  approvedAt: now,
                  rejectionReason: null,
                  updatedAt: now,
                } : action.type === 'reject' ? {
                  approvalStatus: 'rejected',
                  approvedBy: null,
                  approvedAt: null,
                  rejectionReason: action.reason,
                  updatedAt: now,
                } : {
                  approvalStatus: 'submitted',
                  approvedBy: null,
                  approvedAt: null,
                  rejectionReason: null,
                  updatedAt: now,
                }
            )
            .where(and(
              eq(auditReports.id, resource.id),
              eq(auditReports.auditPlanId, resource.auditPlanId),
              eq(auditReports.approvalStatus, resource.approvalStatus)
            ))
            .returning({ id: auditReports.id })
          if (!updatedReport) return stateConflict()
          await appendAudit({
            action: `audit.report.${action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'reverted'}`,
            resourceType: 'audit_report',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? { approved_by: authorization.userId, comment: action.comment ?? null, approval_status: 'approved' }
              : action.type === 'reject'
                ? { rejected_by: authorization.userId, reason: action.reason, approval_status: 'rejected' }
                : { reverted_by: authorization.userId, reason: action.reason, approval_status: 'submitted' },
          })
          break
        }
        case 'nonconformity_closure': {
          if (action.type === 'approve') {
            const [updatedAction] = await tx
              .update(correctiveActions)
              .set({
                status: 'verified',
                reviewedBy: authorization.userId,
                reviewedAt: now,
                updatedAt: now,
              })
              .where(and(
                eq(correctiveActions.id, resource.id),
                eq(correctiveActions.nonconformityId, resource.nonconformityId),
                eq(correctiveActions.status, resource.actionStatus!)
              ))
              .returning({ id: correctiveActions.id })
            if (!updatedAction) return stateConflict()
            const [updatedNonconformity] = await tx
              .update(nonconformities)
              .set({
                status: 'verified',
                verificationDate: now.slice(0, 10),
                verifiedBy: authorization.userId,
                updatedAt: now,
              })
              .where(and(
                eq(nonconformities.id, resource.nonconformityId),
                eq(nonconformities.status, resource.nonconformityStatus!)
              ))
              .returning({ id: nonconformities.id })
            if (!updatedNonconformity) return stateConflict()
          } else {
            const [updatedAction] = await tx
              .update(correctiveActions)
              .set({
                status: 'completed',
                reviewedBy: null,
                reviewedAt: null,
                updatedAt: now,
              })
              .where(and(
                eq(correctiveActions.id, resource.id),
                eq(correctiveActions.nonconformityId, resource.nonconformityId),
                eq(correctiveActions.status, resource.actionStatus!)
              ))
              .returning({ id: correctiveActions.id })
            if (!updatedAction) return stateConflict()
            const [updatedNonconformity] = await tx
              .update(nonconformities)
              .set({
                status: 'pending_verification',
                verificationDate: null,
                verifiedBy: null,
                updatedAt: now,
              })
              .where(and(
                eq(nonconformities.id, resource.nonconformityId),
                eq(nonconformities.status, resource.nonconformityStatus!)
              ))
              .returning({ id: nonconformities.id })
            if (!updatedNonconformity) return stateConflict()
          }
          await appendAudit({
            action: action.type === 'approve'
              ? 'audit.corrective_action.closure_approved'
              : action.type === 'reject'
                ? 'audit.corrective_action.closure_rejected'
                : 'audit.corrective_action.closure_reverted',
            resourceType: 'corrective_action',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? {
                  nonconformity_id: resource.nonconformityId,
                  approved_by: authorization.userId,
                  comment: action.comment ?? null,
                  status: 'verified',
                }
              : action.type === 'reject'
                ? {
                    nonconformity_id: resource.nonconformityId,
                    rejected_by: authorization.userId,
                    reason: action.reason,
                    status: 'completed',
                  }
                : {
                    nonconformity_id: resource.nonconformityId,
                    reverted_by: authorization.userId,
                    reason: action.reason,
                    status: 'completed',
                  },
          })
          if (action.type === 'approve' || action.type === 'revert') {
            await appendAudit({
              action: action.type === 'approve'
                ? 'audit.nonconformity.verified'
                : 'audit.nonconformity.verification_reverted',
              resourceType: 'nonconformity',
              resourceId: resource.nonconformityId,
              changes: action.type === 'approve'
                ? {
                    corrective_action_id: resource.id,
                    verified_by: authorization.userId,
                    status: 'verified',
                  }
                : {
                    corrective_action_id: resource.id,
                    reverted_by: authorization.userId,
                    reason: action.reason,
                    status: 'pending_verification',
                  },
            })
          }
          break
        }
        case 'followup_record': {
          const [updatedFollowUp] = await tx
            .update(followUpRecords)
            .set(
              action.type === 'approve' ? {
                status: 'verified',
                verifiedAt: now,
                verifiedBy: authorization.userId,
                updatedAt: now,
              } : action.type === 'reject' ? {
                status: 'in_progress',
                completedAt: null,
                verifiedAt: null,
                verifiedBy: null,
                updatedAt: now,
              } : {
                status: 'completed',
                verifiedAt: null,
                verifiedBy: null,
                updatedAt: now,
              }
            )
            .where(and(
              eq(followUpRecords.id, resource.id),
              eq(followUpRecords.organizationId, authorization.organizationId),
              eq(followUpRecords.status, resource.status)
            ))
            .returning({ id: followUpRecords.id })
          if (!updatedFollowUp) return stateConflict()
          await appendAudit({
            action: `audit.follow_up.approval_${action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'reverted'}`,
            resourceType: 'follow_up_record',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? { approved_by: authorization.userId, comment: action.comment ?? null, status: 'verified' }
              : action.type === 'reject'
                ? { rejected_by: authorization.userId, reason: action.reason, status: 'in_progress' }
                : { reverted_by: authorization.userId, reason: action.reason, status: 'completed' },
          })
          break
        }
        case 'iso_control_soa': {
          const [updatedControl] = await tx
            .update(isoControls)
            .set(
              action.type === 'approve' ? {
                  soaApprovalStatus: 'approved',
                  soaApprovedBy: authorization.userId,
                  soaApprovedAt: now,
                  soaRejectionReason: null,
                  updatedAt: now,
                } : action.type === 'reject' ? {
                  soaApprovalStatus: 'rejected',
                  soaApprovedBy: null,
                  soaApprovedAt: null,
                  soaRejectionReason: action.reason,
                  updatedAt: now,
                } : {
                  soaApprovalStatus: 'submitted',
                  soaApprovedBy: null,
                  soaApprovedAt: null,
                  soaRejectionReason: null,
                  updatedAt: now,
                }
            )
            .where(and(
              eq(isoControls.id, resource.id),
              eq(isoControls.organizationId, authorization.organizationId),
              eq(isoControls.soaApprovalStatus, resource.approvalStatus)
            ))
            .returning({ id: isoControls.id })
          if (!updatedControl) return stateConflict()
          await appendAudit({
            action: `control.soa.${action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'reverted'}`,
            resourceType: 'iso_control',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? { approval_request_id: request.id, comment: action.comment ?? null }
              : action.type === 'reject'
                ? { approval_request_id: request.id, reason: action.reason }
                : { approval_request_id: request.id, reason: action.reason, status: 'submitted' },
          })
          break
        }
        case 'soa_version': {
          const [updatedVersion] = await tx
            .update(soaVersions)
            .set(
              action.type === 'approve' ? {
                  reviewStatus: 'approved',
                  reviewedBy: authorization.userId,
                  reviewedAt: now,
                  rejectionReason: null,
                } : action.type === 'reject' ? {
                  reviewStatus: 'rejected',
                  reviewedBy: null,
                  reviewedAt: now,
                  rejectionReason: action.reason,
                } : {
                  reviewStatus: 'submitted',
                  reviewedBy: null,
                  reviewedAt: null,
                  rejectionReason: null,
                }
            )
            .where(and(
              eq(soaVersions.id, resource.id),
              eq(soaVersions.organizationId, authorization.organizationId),
              eq(soaVersions.reviewStatus, resource.reviewStatus)
            ))
            .returning({ id: soaVersions.id })
          if (!updatedVersion) return stateConflict()
          await appendAudit({
            action: action.type === 'approve'
              ? 'control.soa.version_review_approved'
              : action.type === 'reject'
                ? 'control.soa.version_review_rejected'
                : 'control.soa.version_review_reverted',
            resourceType: 'soa_version',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? {
                  approval_request_id: request.id,
                  version_number: resource.versionNumber,
                  comment: action.comment ?? null,
                }
              : action.type === 'reject'
                ? {
                    approval_request_id: request.id,
                    version_number: resource.versionNumber,
                    reason: action.reason,
                  }
                : {
                    approval_request_id: request.id,
                    version_number: resource.versionNumber,
                    reason: action.reason,
                    status: 'submitted',
                  },
          })
          break
        }
        case 'risk_residual_acceptance': {
          const [updatedTreatment] = await tx
            .update(riskTreatments)
            .set(
              action.type === 'approve' ? {
                  residualApprovalStatus: 'approved',
                  residualApprovedBy: authorization.userId,
                  residualApprovedAt: now,
                  residualRejectionReason: null,
                  updatedAt: now,
                } : action.type === 'reject' ? {
                  residualApprovalStatus: 'rejected',
                  residualApprovedBy: null,
                  residualApprovedAt: null,
                  residualRejectionReason: action.reason,
                  updatedAt: now,
                } : {
                  residualApprovalStatus: 'submitted',
                  residualApprovedBy: null,
                  residualApprovedAt: null,
                  residualRejectionReason: null,
                  updatedAt: now,
                }
            )
            .where(and(
              eq(riskTreatments.id, resource.id),
              eq(riskTreatments.riskId, resource.riskId),
              eq(riskTreatments.treatmentType, resource.treatmentType),
              eq(riskTreatments.responsibleId, resource.responsibleId),
              eq(riskTreatments.materialVersion, resource.materialVersion),
              eq(riskTreatments.residualApprovalStatus, resource.residualApprovalStatus!)
            ))
            .returning({ id: riskTreatments.id })
          if (!updatedTreatment) return stateConflict()
          await appendAudit({
            action: action.type === 'approve'
              ? 'risk.residual_acceptance.approved'
              : action.type === 'reject'
                ? 'risk.residual_acceptance.rejected'
                : 'risk.residual_acceptance.reverted',
            resourceType: 'risk_treatment',
            resourceId: resource.id,
            changes: action.type === 'approve'
              ? {
                  risk_id: resource.riskId,
                  approval_request_id: request.id,
                  comment: action.comment ?? null,
                }
              : action.type === 'reject'
                ? {
                    risk_id: resource.riskId,
                    approval_request_id: request.id,
                    reason: action.reason,
                  }
                : {
                    risk_id: resource.riskId,
                    approval_request_id: request.id,
                    reason: action.reason,
                    status: 'submitted',
                  },
          })
          break
        }
      }
    })
  }
}
