export type RiskReadinessStatus = 'ready' | 'needs_attention' | 'not_ready'

export interface TreatmentReadinessInput {
  id: string
  treatment_type: string
  description?: string | null
  responsible_id?: string | null
  residual_review_due_date?: string | null
  status?: string | null
  control_links?: Array<{
    iso_control?: {
      id?: string | null
    } | null
  }>
}

export interface ResidualAcceptanceReadiness {
  status: RiskReadinessStatus
  acceptedTreatments: number
  acceptedReady: number
  gaps: Array<'no_acceptance' | 'missing_owner' | 'missing_reason' | 'missing_review_due_date' | 'not_completed'>
}

export interface EvidenceVaultReadiness {
  status: RiskReadinessStatus
  linkedControls: number
  treatmentsWithControls: number
  totalTreatments: number
  gaps: Array<'no_treatments' | 'no_controls' | 'unlinked_treatments'>
}

const COMPLETED_TREATMENT_STATUSES = new Set(['completed'])

export function assessResidualAcceptanceReadiness(
  treatments: TreatmentReadinessInput[]
): ResidualAcceptanceReadiness {
  const acceptances = treatments.filter((treatment) => treatment.treatment_type === 'accept')
  const gaps = new Set<ResidualAcceptanceReadiness['gaps'][number]>()

  if (acceptances.length === 0) {
    gaps.add('no_acceptance')
  }

  let acceptedReady = 0

  for (const acceptance of acceptances) {
    const hasOwner = Boolean(acceptance.responsible_id)
    const hasReason = Boolean(acceptance.description?.trim())
    const hasReviewDueDate = Boolean(acceptance.residual_review_due_date)
    const isCompleted = COMPLETED_TREATMENT_STATUSES.has(acceptance.status ?? '')

    if (!hasOwner) gaps.add('missing_owner')
    if (!hasReason) gaps.add('missing_reason')
    if (!hasReviewDueDate) gaps.add('missing_review_due_date')
    if (!isCompleted) gaps.add('not_completed')

    if (hasOwner && hasReason && hasReviewDueDate && isCompleted) {
      acceptedReady += 1
    }
  }

  const status: RiskReadinessStatus =
    acceptances.length > 0 && acceptedReady === acceptances.length
      ? 'ready'
      : acceptances.length > 0
        ? 'needs_attention'
        : 'not_ready'

  return {
    status,
    acceptedTreatments: acceptances.length,
    acceptedReady,
    gaps: Array.from(gaps)
  }
}

export function assessEvidenceVaultReadiness(
  treatments: TreatmentReadinessInput[]
): EvidenceVaultReadiness {
  const gaps = new Set<EvidenceVaultReadiness['gaps'][number]>()
  const linkedControlIds = new Set<string>()
  let treatmentsWithControls = 0

  if (treatments.length === 0) {
    gaps.add('no_treatments')
  }

  for (const treatment of treatments) {
    const treatmentControlIds = new Set<string>()

    for (const link of treatment.control_links ?? []) {
      const controlId = link.iso_control?.id
      if (controlId) {
        linkedControlIds.add(controlId)
        treatmentControlIds.add(controlId)
      }
    }

    if (treatmentControlIds.size > 0) {
      treatmentsWithControls += 1
    }
  }

  if (linkedControlIds.size === 0) {
    gaps.add('no_controls')
  }

  if (treatments.length > 0 && treatmentsWithControls < treatments.length) {
    gaps.add('unlinked_treatments')
  }

  const status: RiskReadinessStatus =
    treatments.length > 0 && linkedControlIds.size > 0 && treatmentsWithControls === treatments.length
      ? 'ready'
      : linkedControlIds.size > 0
        ? 'needs_attention'
        : 'not_ready'

  return {
    status,
    linkedControls: linkedControlIds.size,
    treatmentsWithControls,
    totalTreatments: treatments.length,
    gaps: Array.from(gaps)
  }
}
