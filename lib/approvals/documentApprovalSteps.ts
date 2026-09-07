/**
 * 文書の二段階承認（docs/03-architecture/two-step-document-approval-design.md）の段定義。
 *
 * - 1段目: 作成者が指名した上司によるダブルチェック承認。ここでは発行されない。
 * - 2段目: org_admin による正式発行承認。ここで初めて documents.status = 'approved' になる。
 *
 * 直列発行方式のため、2段目のレコードは 1段目の承認と同一トランザクション内で発行される（§2.4）。
 */

export const DOCUMENT_APPROVAL_FIRST_STEP = 1
export const DOCUMENT_APPROVAL_FINAL_STEP = 2

/** 二段化以降の文書承認は、進行中・未着手を問わず常に 2段である（§5.3）。 */
export const DOCUMENT_APPROVAL_TOTAL_STEPS = DOCUMENT_APPROVAL_FINAL_STEP

/**
 * 二段化以前に発行完了した文書の表示段数（§5.3）。
 * `documents.status = 'approved'` かつ step_number = 2 のレコードが1件も無い場合に限り使う。
 */
export const LEGACY_DOCUMENT_APPROVAL_TOTAL_STEPS = 1

export type DocumentApprovalStep =
  | typeof DOCUMENT_APPROVAL_FIRST_STEP
  | typeof DOCUMENT_APPROVAL_FINAL_STEP

/** step_number は nullable なため、未設定は 1段目として解釈する。 */
export function normalizeDocumentApprovalStep(
  stepNumber: number | null | undefined
): number {
  return stepNumber == null || stepNumber < DOCUMENT_APPROVAL_FIRST_STEP
    ? DOCUMENT_APPROVAL_FIRST_STEP
    : stepNumber
}

export function isFinalDocumentApprovalStep(
  stepNumber: number | null | undefined
): boolean {
  return normalizeDocumentApprovalStep(stepNumber) >= DOCUMENT_APPROVAL_FINAL_STEP
}

export function nextDocumentApprovalStep(
  stepNumber: number | null | undefined
): number | null {
  const current = normalizeDocumentApprovalStep(stepNumber)
  return current >= DOCUMENT_APPROVAL_FINAL_STEP ? null : current + 1
}
