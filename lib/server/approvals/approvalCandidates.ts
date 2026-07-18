import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  organizationDepartments,
  userDepartmentScopes,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import {
  getApprovalCandidateRoles,
  isApprovalCandidateRole,
  type ApprovalCandidate,
  type ApprovalCandidatePurpose,
} from '@/lib/approvals/approvalCandidateContract'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationDenial,
} from '@/lib/server/auth/authorizationContext'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'
import {
  resolveDocumentApprovalResourceScope,
  resolveRiskApprovalResourceScope,
} from '@/lib/server/approvals/approvalResourceScope'

export type ApprovalCandidateLookupResult =
  | { ok: true; candidates: ApprovalCandidate[] }
  | { ok: false; reason: TenantAuthorizationDenial }

interface ApprovalCandidateLookupOptions {
  resourceId?: string | null
  departmentId?: string | null
}

function canAccessDepartment(
  authorization: Extract<Awaited<ReturnType<typeof resolveTenantAuthorizationContext>>, { ok: true }>['context'],
  departmentId: string | null
): boolean {
  if (authorization.departmentAccess.mode === 'all') return true
  if (departmentId === null) return authorization.departmentAccess.includeUnassigned
  return authorization.departmentAccess.departmentIds.includes(departmentId)
}

export async function listApprovalCandidatesForActor(
  db: ReturnType<typeof getDb>,
  actorId: string,
  organizationId: string,
  purpose: ApprovalCandidatePurpose,
  options: ApprovalCandidateLookupOptions = {}
): Promise<ApprovalCandidateLookupResult> {
  const authorization = await resolveTenantAuthorizationContext(
    db,
    actorId,
    organizationId
  )
  if (!authorization.ok) {
    return authorization
  }

  let targetDepartmentId: string | null
  if (purpose === 'incident') {
    if (!options.departmentId) return { ok: true, candidates: [] }
    const [department] = await db
      .select({ id: organizationDepartments.id })
      .from(organizationDepartments)
      .where(and(
        eq(organizationDepartments.id, options.departmentId),
        eq(organizationDepartments.organizationId, organizationId)
      ))
      .limit(1)
    if (!department || !canAccessDepartment(authorization.context, department.id)) {
      return { ok: true, candidates: [] }
    }
    targetDepartmentId = department.id
  } else if (purpose === 'document') {
    if (!options.resourceId) return { ok: true, candidates: [] }
    const target = await resolveDocumentApprovalResourceScope(
      db,
      organizationId,
      options.resourceId
    )
    if (!target.ok) {
      return { ok: true, candidates: [] }
    }
    targetDepartmentId = target.departmentId
    if (!canAccessDepartment(authorization.context, targetDepartmentId)) {
      return { ok: true, candidates: [] }
    }
  } else {
    if (!options.resourceId) return { ok: true, candidates: [] }
    const target = await resolveRiskApprovalResourceScope(
      db,
      organizationId,
      options.resourceId
    )
    if (!target.ok) {
      return { ok: true, candidates: [] }
    }
    targetDepartmentId = target.departmentId
    if (!canAccessDepartment(authorization.context, targetDepartmentId)) {
      return { ok: true, candidates: [] }
    }
  }

  const eligibleRoles = getApprovalCandidateRoles(purpose)
  const rows = await db
    .select({
      id: userProfiles.id,
      fullName: userProfiles.fullName,
      membershipRole: userMemberships.role,
      departmentScope: userMemberships.departmentScope,
    })
    .from(userMemberships)
    .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
    .where(and(
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active'),
      inArray(userMemberships.role, [...eligibleRoles]),
      eq(userProfiles.isActive, true),
      ne(userProfiles.id, actorId)
    ))
    .orderBy(asc(userProfiles.fullName), asc(userProfiles.id))

  const allowedCandidateIds = new Set(
    rows
      .filter(row => (
        isApprovalCandidateRole(row.membershipRole)
        && (
          hasFullDepartmentAccess(row.membershipRole)
          || row.departmentScope === 'all'
          || targetDepartmentId === null
        )
      ))
      .map(row => row.id)
  )

  if (targetDepartmentId !== null) {
    const scopedCandidateIds = rows
      .filter(row => !allowedCandidateIds.has(row.id))
      .map(row => row.id)
    if (scopedCandidateIds.length > 0) {
      const scopedRows = await db
        .select({ userId: userDepartmentScopes.userId })
        .from(userDepartmentScopes)
        .where(and(
          eq(userDepartmentScopes.organizationId, organizationId),
          eq(userDepartmentScopes.departmentId, targetDepartmentId),
          inArray(userDepartmentScopes.userId, scopedCandidateIds)
        ))
      for (const scopedRow of scopedRows) {
        allowedCandidateIds.add(scopedRow.userId)
      }
    }
  }

  const candidates: ApprovalCandidate[] = []
  for (const row of rows) {
    if (!isApprovalCandidateRole(row.membershipRole)) continue
    if (!allowedCandidateIds.has(row.id)) continue
    const displayName = row.fullName?.trim()
    if (!displayName) continue
    candidates.push({
      id: row.id,
      displayName,
      role: row.membershipRole,
    })
  }

  return { ok: true, candidates }
}
