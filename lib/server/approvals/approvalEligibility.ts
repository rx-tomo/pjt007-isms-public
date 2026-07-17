import type { getDb } from '@/lib/db/drizzle/client'
import type { UserRole } from '@/lib/db/drizzle/schema'
import {
  approvalCandidateRoleValues,
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
