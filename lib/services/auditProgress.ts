import type { AuditStatus } from './audit'

export type AuditFollowUpStatus = 'completed' | 'on_hold' | 'reopened'

export interface AuditPlanProgressSummary {
  totalChecklistItems: number
  completedChecklistItems: number
  inProgressChecklistItems: number
  notStartedChecklistItems: number
  completionRate: number
  openNonconformities: number
  totalNonconformities: number
  followUpStatus: AuditFollowUpStatus
}

export const deriveAuditFollowUpStatus = (
  auditStatus: AuditStatus,
  openNonconformities: number
): AuditFollowUpStatus => {
  if (openNonconformities <= 0) {
    return 'completed'
  }

  return auditStatus === 'completed' ? 'reopened' : 'on_hold'
}
