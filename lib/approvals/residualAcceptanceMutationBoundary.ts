export const RESIDUAL_ACCEPTANCE_RESOURCE_TYPE = 'risk_residual_acceptance' as const

const LEGACY_MUTATION_ERROR =
  'Residual acceptance mutations must use ResidualAcceptanceSubmissionService or NonDocumentApprovalMutationService'

export function assertGenericApprovalMutationAllowed(
  resourceType: string | null | undefined
): void {
  if (resourceType === RESIDUAL_ACCEPTANCE_RESOURCE_TYPE) {
    throw new Error(LEGACY_MUTATION_ERROR)
  }
}
