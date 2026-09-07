import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  userMemberships,
  userProfiles,
  type UserRole,
} from '@/lib/db/drizzle/schema'
import {
  approvalCandidateRoleValues,
  getDocumentApprovalCandidateRolesForStep,
  isApprovalCandidateRole,
  type ApprovalCandidateRole,
} from '@/lib/approvals/approvalCandidateContract'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
} from '@/lib/server/auth/authorizationContext'

export const ELIGIBLE_APPROVAL_MEMBERSHIP_ROLES = approvalCandidateRoleValues

export type EligibleApprovalMembershipRole = ApprovalCandidateRole

export function isEligibleApprovalMembershipRole(
  role: UserRole
): role is EligibleApprovalMembershipRole {
  return isApprovalCandidateRole(role)
}

export async function resolveApprovalEligibility(
  db: ReturnType<typeof getDb>,
  userId: string,
  organizationId: string
): Promise<TenantAuthorizationContext | null> {
  const result = await resolveTenantAuthorizationContext(db, userId, organizationId)
  if (!result.ok || !isEligibleApprovalMembershipRole(result.context.role)) {
    return null
  }

  return result.context
}

export function isEligibleDocumentApprovalStepRole(
  role: UserRole,
  step: number
): role is EligibleApprovalMembershipRole {
  return isApprovalCandidateRole(role)
    && (getDocumentApprovalCandidateRolesForStep(step) as readonly string[]).includes(role)
}

export interface DocumentApprovalStepApproverResolution {
  userId: string
  role: EligibleApprovalMembershipRole
}

/**
 * 文書承認の次段（2段目 = org_admin）の担当者を決定的に解決する（設計 §5.1 / §5.6）。
 *
 * 候補が複数いる場合は「membership の作成日時が最古（同時刻なら userId 昇順）」の1名を選ぶ。
 * 起案者と現段の承認者は、二人チェックの構造を保つため候補から除外する。
 */
export async function resolveDocumentApprovalStepApprover(
  db: ReturnType<typeof getDb>,
  organizationId: string,
  step: number,
  excludedUserIds: readonly string[]
): Promise<DocumentApprovalStepApproverResolution | null> {
  const eligibleRoles = getDocumentApprovalCandidateRolesForStep(step)
  const rows = await db
    .select({
      userId: userMemberships.userId,
      role: userMemberships.role,
      createdAt: userMemberships.createdAt,
    })
    .from(userMemberships)
    .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
    .where(and(
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active'),
      inArray(userMemberships.role, [...eligibleRoles]),
      eq(userProfiles.isActive, true),
      ...excludedUserIds.map(excluded => ne(userMemberships.userId, excluded))
    ))
    .orderBy(asc(userMemberships.createdAt), asc(userMemberships.userId))

  for (const row of rows) {
    if (!isApprovalCandidateRole(row.role)) continue
    return { userId: row.userId, role: row.role }
  }
  return null
}
