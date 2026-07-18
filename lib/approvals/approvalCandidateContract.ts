import type { UserRole } from '@/lib/db/drizzle/schema'

export const approvalCandidatePurposeValues = [
  'document',
  'incident',
  'risk_acceptance',
] as const

export type ApprovalCandidatePurpose =
  (typeof approvalCandidatePurposeValues)[number]

export const approvalCandidateRoleValues = [
  'approver',
  'org_admin',
  'system_operator',
] as const satisfies readonly UserRole[]

export type ApprovalCandidateRole =
  (typeof approvalCandidateRoleValues)[number]

const approvalCandidateRolesByPurpose = {
  document: approvalCandidateRoleValues,
  incident: approvalCandidateRoleValues,
  risk_acceptance: approvalCandidateRoleValues,
} as const satisfies Record<
  ApprovalCandidatePurpose,
  readonly ApprovalCandidateRole[]
>

export interface ApprovalCandidate {
  id: string
  displayName: string
  role: ApprovalCandidateRole
}

export interface ApprovalCandidateResponse {
  purpose: ApprovalCandidatePurpose
  candidates: ApprovalCandidate[]
}

export function parseApprovalCandidatePurpose(
  value: string | null
): ApprovalCandidatePurpose | null {
  return approvalCandidatePurposeValues.includes(value as ApprovalCandidatePurpose)
    ? value as ApprovalCandidatePurpose
    : null
}

export function isApprovalCandidateRole(
  role: string
): role is ApprovalCandidateRole {
  return (approvalCandidateRoleValues as readonly string[]).includes(role)
}

export function getApprovalCandidateRoles(
  purpose: ApprovalCandidatePurpose
): readonly ApprovalCandidateRole[] {
  return approvalCandidateRolesByPurpose[purpose]
}
