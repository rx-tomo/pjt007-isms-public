import type { ApprovalQueueItem } from '@/lib/services/approval'

const APPROVAL_VIEWER_ROLES = new Set(['approver', 'org_admin', 'system_operator'])
const REVERT_ROLES = new Set(['org_admin', 'system_operator'])

export function canViewApprovals(effectiveRole: string | null | undefined): boolean {
  return effectiveRole != null && APPROVAL_VIEWER_ROLES.has(effectiveRole)
}

export function canDecideApproval(
  request: Pick<ApprovalQueueItem, 'status' | 'approver_id'>,
  profileId: string | null | undefined,
): boolean {
  return Boolean(
    profileId &&
    request.status === 'pending' &&
    request.approver_id != null &&
    request.approver_id === profileId,
  )
}

export function canRevertApproval(
  effectiveRole: string | null | undefined,
  request: Pick<ApprovalQueueItem, 'status' | 'approver_id'>,
  profileId: string | null | undefined,
): boolean {
  return Boolean(
    effectiveRole &&
    REVERT_ROLES.has(effectiveRole) &&
    (request.status === 'approved' || request.status === 'rejected') &&
    request.approver_id != null &&
    request.approver_id !== profileId,
  )
}
