import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { auditChecklists, auditPlans, auditReports, correctiveActions, followUpRecords, nonconformities } from '@/lib/db/drizzle/schema/audit'
import { documents } from '@/lib/db/drizzle/schema/documents'
import { incidents } from '@/lib/db/drizzle/schema/incidents'
import { organizationDepartments } from '@/lib/db/drizzle/schema/organizations'
import { isoControls, risks, riskTreatments, soaVersions } from '@/lib/db/drizzle/schema/risks'
import { residualAcceptanceApprovalBindings } from '@/lib/db/drizzle/schema/approvals'
import {
  type UserRole,
  userDepartmentScopes,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema/users'
import {
  isEligibleApprovalMembershipRole,
  resolveApprovalEligibility,
} from '@/lib/server/approvals/approvalEligibility'
import { resolveDocumentApprovalResourceScopes } from '@/lib/server/approvals/approvalResourceScope'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { applyDepartmentAccessFilters } from '@/lib/server/auth/departmentAccessFilters'
import type { ApprovalQueueContext, ApprovalQueueItem, ApprovalRequest, ApprovalResourceType } from '@/lib/services/approval'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'

type ResourceContext = Pick<ApprovalQueueContext, 'title' | 'summary' | 'target_path'>

interface ResidualQueueRelation {
  riskId: string
  responsibleId: string | null
  departmentId: string | null
  treatmentType: string
  materialVersion: number
}

const FALLBACK_PATHS: Record<ApprovalResourceType, string> = {
  document: '/documents',
  incident: '/incidents',
  audit_plan: '/audit',
  audit_report: '/audit/reports',
  nonconformity_closure: '/audit/nonconformities',
  followup_record: '/audit',
  iso_control_soa: '/settings/controls',
  soa_version: '/settings/controls',
  risk_residual_acceptance: '/risks',
}

function compactSummary(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized
}

function groupResourceIds(requests: ApprovalRequest[]) {
  const grouped = new Map<ApprovalResourceType, string[]>()
  for (const request of requests) {
    const ids = grouped.get(request.resource_type) ?? []
    if (!ids.includes(request.resource_id)) ids.push(request.resource_id)
    grouped.set(request.resource_type, ids)
  }
  return grouped
}

function canAccessDepartment(
  access: TenantAuthorizationContext['departmentAccess'],
  departmentId: string | null
): boolean {
  if (access.mode === 'all') return true
  if (departmentId === null) return access.includeUnassigned
  return access.departmentIds.includes(departmentId)
}

export async function enrichApprovalQueueItems(
  requests: ApprovalRequest[],
  inputAuthorization: TenantAuthorizationContext
): Promise<ApprovalQueueItem[]> {
  const db = getDb()
  const authorization = await resolveApprovalEligibility(
    db,
    inputAuthorization.userId,
    inputAuthorization.organizationId
  )
  if (!authorization) return []
  const tenantRequests = requests.filter(
    request => request.organization_id === authorization.organizationId
  )
  if (tenantRequests.length === 0) return []

  const grouped = groupResourceIds(tenantRequests)
  const contexts = new Map<string, ResourceContext>()
  const key = (type: ApprovalResourceType, id: string) => `${type}:${id}`

  const userIds = Array.from(new Set(tenantRequests.flatMap((request) => [request.requested_by, request.approver_id]).filter((id): id is string => Boolean(id))))
  const userRows = userIds.length
    ? await db
        .select({
          id: userProfiles.id,
          fullName: userProfiles.fullName,
          membershipRole: userMemberships.role,
          membershipDepartmentScope: userMemberships.departmentScope,
          primaryDepartmentId: userProfiles.primaryDepartmentId,
          departmentId: organizationDepartments.id,
        })
        .from(userProfiles)
        .innerJoin(
          userMemberships,
          and(
            eq(userMemberships.userId, userProfiles.id),
            eq(userMemberships.organizationId, authorization.organizationId),
            eq(userMemberships.status, 'active')
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
          inArray(userProfiles.id, userIds),
          eq(userProfiles.isActive, true)
        ))
    : []
  const userNames = new Map(userRows.map((row) => [row.id, row.fullName]))
  const validUserIds = new Set(userRows.map((row) => row.id))
  const eligibleApproverIds = new Set(userRows
    .filter(row => (
      isEligibleApprovalMembershipRole(row.membershipRole as UserRole)
      && (
        row.primaryDepartmentId === null
        || row.departmentId !== null
      )
    ))
    .map(row => row.id))
  const eligibleApproverScopeRows = eligibleApproverIds.size > 0
    ? await db
        .select({
          userId: userDepartmentScopes.userId,
          departmentId: organizationDepartments.id,
        })
        .from(userDepartmentScopes)
        .innerJoin(
          organizationDepartments,
          and(
            eq(organizationDepartments.id, userDepartmentScopes.departmentId),
            eq(organizationDepartments.organizationId, authorization.organizationId)
          )
        )
        .where(and(
          eq(userDepartmentScopes.organizationId, authorization.organizationId),
          inArray(userDepartmentScopes.userId, [...eligibleApproverIds])
        ))
    : []
  const eligibleApproverDepartmentIds = new Map<string, string[]>()
  for (const row of eligibleApproverScopeRows) {
    const ids = eligibleApproverDepartmentIds.get(row.userId) ?? []
    if (row.departmentId && !ids.includes(row.departmentId)) ids.push(row.departmentId)
    eligibleApproverDepartmentIds.set(row.userId, ids)
  }
  const eligibleApproverAccess = new Map<
    string,
    TenantAuthorizationContext['departmentAccess']
  >()
  for (const row of userRows) {
    if (!eligibleApproverIds.has(row.id)) continue
    eligibleApproverAccess.set(
      row.id,
      hasFullDepartmentAccess(row.membershipRole as UserRole)
        || row.membershipDepartmentScope === 'all'
        ? { mode: 'all' }
        : {
            mode: 'scoped',
            departmentIds: eligibleApproverDepartmentIds.get(row.id) ?? [],
            includeUnassigned: true,
          }
    )
  }

  const documentIds = grouped.get('document') ?? []
  if (documentIds.length) {
    const scopes = await resolveDocumentApprovalResourceScopes(
      db,
      authorization.organizationId,
      documentIds
    )
    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        summary: documents.description,
      })
      .from(documents)
      .where(and(
        inArray(documents.id, documentIds),
        eq(documents.organizationId, authorization.organizationId)
      ))
    for (const row of rows) {
      const scope = scopes.get(row.id)
      if (scope?.ok && canAccessDepartment(
        authorization.departmentAccess,
        scope.departmentId
      )) contexts.set(key('document', row.id), {
        title: row.title,
        summary: compactSummary(row.summary),
        target_path: '/documents',
      })
    }
  }

  const incidentIds = grouped.get('incident') ?? []
  if (incidentIds.length) {
    const incidentFilters = applyDepartmentAccessFilters(
      undefined,
      authorization.departmentAccess
    )
    const scopedDepartmentIds = incidentFilters.departmentIds ?? []
    const scopedAccess = authorization.departmentAccess.mode === 'scoped'
      ? or(
          incidentFilters.includeNoDepartment ? isNull(incidents.departmentId) : undefined,
          scopedDepartmentIds.length > 0
            ? inArray(organizationDepartments.id, scopedDepartmentIds)
            : undefined
        )
      : undefined
    const rows = await db
      .select({ id: incidents.id, title: incidents.title, summary: incidents.description })
      .from(incidents)
      .leftJoin(
        organizationDepartments,
        and(
          eq(organizationDepartments.id, incidents.departmentId),
          eq(organizationDepartments.organizationId, authorization.organizationId)
        )
      )
      .where(and(
        inArray(incidents.id, incidentIds),
        eq(incidents.organizationId, authorization.organizationId),
        or(isNull(incidents.departmentId), isNotNull(organizationDepartments.id)),
        scopedAccess
      ))
    for (const row of rows) contexts.set(key('incident', row.id), { title: row.title, summary: compactSummary(row.summary), target_path: `/incidents/${row.id}` })
  }

  const auditPlanIds = grouped.get('audit_plan') ?? []
  if (auditPlanIds.length) {
    const rows = await db.select({ id: auditPlans.id, title: auditPlans.title, summary: auditPlans.description }).from(auditPlans).where(and(
      inArray(auditPlans.id, auditPlanIds),
      eq(auditPlans.organizationId, authorization.organizationId)
    ))
    for (const row of rows) contexts.set(key('audit_plan', row.id), { title: row.title, summary: compactSummary(row.summary), target_path: `/audit/plans/${row.id}` })
  }

  const auditReportIds = grouped.get('audit_report') ?? []
  if (auditReportIds.length) {
    const rows = await db
      .select({ id: auditReports.id, planId: auditReports.auditPlanId, title: auditPlans.title, summary: auditReports.executiveSummary })
      .from(auditReports)
      .leftJoin(auditPlans, eq(auditReports.auditPlanId, auditPlans.id))
      .where(and(
        inArray(auditReports.id, auditReportIds),
        eq(auditPlans.organizationId, authorization.organizationId)
      ))
    for (const row of rows) contexts.set(key('audit_report', row.id), {
      title: row.title ? `${row.title} 監査報告書` : '監査報告書',
      summary: compactSummary(row.summary),
      target_path: row.planId ? `/audit/plans/${row.planId}/report` : '/audit/reports',
    })
  }

  const closureIds = grouped.get('nonconformity_closure') ?? []
  if (closureIds.length) {
    const rows = await db
      .select({ id: correctiveActions.id, action: correctiveActions.actionDescription, number: nonconformities.ncNumber, summary: nonconformities.description })
      .from(correctiveActions)
      .leftJoin(nonconformities, eq(correctiveActions.nonconformityId, nonconformities.id))
      .leftJoin(auditChecklists, eq(nonconformities.auditChecklistId, auditChecklists.id))
      .leftJoin(auditPlans, eq(auditChecklists.auditPlanId, auditPlans.id))
      .where(and(
        inArray(correctiveActions.id, closureIds),
        eq(auditPlans.organizationId, authorization.organizationId)
      ))
    for (const row of rows) contexts.set(key('nonconformity_closure', row.id), {
      title: row.number ? `${row.number} 是正処置完了` : '是正処置完了',
      summary: compactSummary(row.action || row.summary),
      target_path: '/audit/nonconformities',
    })
  }

  const followupIds = grouped.get('followup_record') ?? []
  if (followupIds.length) {
    const rows = await db
      .select({ id: followUpRecords.id, planId: followUpRecords.auditPlanId, title: followUpRecords.title, summary: followUpRecords.description })
      .from(followUpRecords)
      .innerJoin(auditPlans, eq(followUpRecords.auditPlanId, auditPlans.id))
      .where(and(
        inArray(followUpRecords.id, followupIds),
        eq(followUpRecords.organizationId, authorization.organizationId),
        eq(auditPlans.organizationId, authorization.organizationId)
      ))
    for (const row of rows) contexts.set(key('followup_record', row.id), { title: row.title, summary: compactSummary(row.summary), target_path: `/audit/plans/${row.planId}` })
  }

  const controlIds = grouped.get('iso_control_soa') ?? []
  if (controlIds.length) {
    const rows = await db.select({ id: isoControls.id, code: isoControls.controlCode, title: isoControls.title, summary: isoControls.soaApplicabilityReason }).from(isoControls).where(and(
      inArray(isoControls.id, controlIds),
      eq(isoControls.organizationId, authorization.organizationId)
    ))
    for (const row of rows) contexts.set(key('iso_control_soa', row.id), { title: row.code ? `${row.code} ${row.title}` : row.title, summary: compactSummary(row.summary), target_path: '/settings/controls' })
  }

  const versionIds = grouped.get('soa_version') ?? []
  if (versionIds.length) {
    const rows = await db.select({ id: soaVersions.id, title: soaVersions.title, version: soaVersions.versionNumber, summary: soaVersions.changeSummary }).from(soaVersions).where(and(
      inArray(soaVersions.id, versionIds),
      eq(soaVersions.organizationId, authorization.organizationId)
    ))
    for (const row of rows) contexts.set(key('soa_version', row.id), { title: `${row.title} v${row.version}`, summary: compactSummary(row.summary), target_path: '/settings/controls' })
  }

  const treatmentIds = grouped.get('risk_residual_acceptance') ?? []
  const residualRelations = new Map<string, ResidualQueueRelation>()
  const residualRequestIds = tenantRequests
    .filter(request => request.resource_type === 'risk_residual_acceptance')
    .map(request => request.id)
  const residualBindingRows = residualRequestIds.length
    ? await db
        .select()
        .from(residualAcceptanceApprovalBindings)
        .where(inArray(
          residualAcceptanceApprovalBindings.approvalRequestId,
          residualRequestIds
        ))
    : []
  const residualBindings = new Map(
    residualBindingRows.map(binding => [binding.approvalRequestId, binding])
  )
  if (treatmentIds.length) {
    const rows = await db
      .select({
        id: riskTreatments.id,
        riskId: riskTreatments.riskId,
        title: risks.title,
        summary: riskTreatments.description,
        treatmentType: riskTreatments.treatmentType,
        responsibleId: riskTreatments.responsibleId,
        ownerId: risks.ownerId,
        materialVersion: riskTreatments.materialVersion,
      })
      .from(riskTreatments)
      .innerJoin(risks, eq(riskTreatments.riskId, risks.id))
      .where(and(
        inArray(riskTreatments.id, treatmentIds),
        eq(risks.organizationId, authorization.organizationId)
      ))
    const ownerIds = Array.from(new Set(
      rows.map(row => row.ownerId).filter((id): id is string => id !== null)
    ))
    const ownerRows = ownerIds.length
      ? await db
          .select({
            id: userProfiles.id,
            profileOrganizationId: userProfiles.organizationId,
            isActive: userProfiles.isActive,
            primaryDepartmentId: userProfiles.primaryDepartmentId,
            membershipId: userMemberships.id,
            membershipStatus: userMemberships.status,
            departmentId: organizationDepartments.id,
          })
          .from(userProfiles)
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
          .where(inArray(userProfiles.id, ownerIds))
      : []
    const validOwnerIds = new Set(ownerRows
      .filter(owner => (
        owner.profileOrganizationId === authorization.organizationId
        && owner.isActive === true
        && owner.membershipId !== null
        && owner.membershipStatus === 'active'
        && owner.primaryDepartmentId !== null
        && owner.departmentId !== null
      ))
      .map(owner => owner.id))
    const ownerDepartments = new Map(ownerRows
      .filter(owner => validOwnerIds.has(owner.id))
      .map(owner => [owner.id, owner.departmentId]))

    for (const row of rows) {
      if (
        row.treatmentType !== 'accept'
        || !row.riskId
        || (row.ownerId !== null && !validOwnerIds.has(row.ownerId))
      ) continue
      contexts.set(key('risk_residual_acceptance', row.id), {
        title: row.title ? `${row.title} 残留リスク受容` : '残留リスク受容',
        summary: compactSummary(row.summary),
        target_path: row.riskId ? `/risks/${row.riskId}` : '/risks',
      })
      residualRelations.set(row.id, {
        riskId: row.riskId,
        responsibleId: row.responsibleId,
        departmentId: row.ownerId === null
          ? null
          : ownerDepartments.get(row.ownerId) ?? null,
        treatmentType: row.treatmentType,
        materialVersion: row.materialVersion,
      })
    }
  }

  return tenantRequests.flatMap((request) => {
    const resolved = contexts.get(key(request.resource_type, request.resource_id))
    if (!resolved) return []
    if (request.resource_type === 'risk_residual_acceptance') {
      const relation = residualRelations.get(request.resource_id)
      const binding = residualBindings.get(request.id)
      const responsibleAccess = binding
        ? eligibleApproverAccess.get(binding.approverId)
        : undefined
      if (
        !relation
        || !binding
        || binding.organizationId !== request.organization_id
        || binding.organizationId !== authorization.organizationId
        || binding.resourceId !== request.resource_id
        || !binding.riskId
        || binding.riskId !== relation.riskId
        || binding.approverId !== request.approver_id
        || binding.responsibleId !== relation.responsibleId
        || binding.resourceMaterialVersion !== relation.materialVersion
        || relation.treatmentType !== 'accept'
        || binding.responsibleId !== binding.approverId
        || !eligibleApproverIds.has(binding.approverId)
        || !responsibleAccess
        || !canAccessDepartment(responsibleAccess, relation.departmentId)
        || request.requested_by === binding.approverId
        || (
          authorization.departmentAccess.mode === 'scoped'
          && (
            relation.departmentId === null
              ? !authorization.departmentAccess.includeUnassigned
              : !authorization.departmentAccess.departmentIds.includes(relation.departmentId)
          )
        )
      ) return []
    }
    const requestedBy = request.requested_by && validUserIds.has(request.requested_by)
      ? request.requested_by
      : null
    const approverId = request.approver_id && validUserIds.has(request.approver_id)
      ? request.approver_id
      : null
    return [{
      ...request,
      requested_by: requestedBy,
      approver_id: approverId,
      context: {
        title: resolved.title,
        summary: resolved.summary ?? null,
        requester_name: requestedBy ? userNames.get(requestedBy) ?? null : null,
        approver_name: approverId ? userNames.get(approverId) ?? null : null,
        target_path: resolved.target_path ?? FALLBACK_PATHS[request.resource_type],
        reference: request.resource_id,
      },
    }]
  })
}
