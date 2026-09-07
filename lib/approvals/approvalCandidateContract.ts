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

/**
 * 文書承認の段別候補ロール（設計 §5.1 / §5.6）。
 * - 1段目: 作成者が「上司」を手動選択する。候補集合は既存の承認候補ロールをそのまま使う（§5.1(i)）。
 * - 2段目: 組織文書としての正式発行判断のため org_admin に限定する。
 */
const documentApprovalCandidateRolesByStep = {
  1: approvalCandidateRoleValues,
  2: ['org_admin'],
} as const satisfies Record<1 | 2, readonly ApprovalCandidateRole[]>

export function getDocumentApprovalCandidateRolesForStep(
  step: number
): readonly ApprovalCandidateRole[] {
  return step >= 2
    ? documentApprovalCandidateRolesByStep[2]
    : documentApprovalCandidateRolesByStep[1]
}

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
