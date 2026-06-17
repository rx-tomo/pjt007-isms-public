/**
 * ISO Control Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IIsoControlRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 */
import { getIsoControlRepository } from '@/lib/container'
import type {
  IIsoControlRepository,
  IsoControl
} from '@/lib/db/repositories/interfaces/IIsoControlRepository'

export interface SoaReadinessTreatment {
  id: string
  description: string
  status: string | null
  dueDate: string | null
  riskId: string
  riskTitle: string
  riskStatus: string | null
}

export interface SoaReadinessControl extends IsoControl {
  applicability: 'linked' | 'unlinked'
  linkedRiskCount: number
  linkedTreatmentCount: number
  completedTreatmentCount: number
  treatments: SoaReadinessTreatment[]
}

export type SoaDecisionStatus = 'not_reviewed' | 'applicable' | 'not_applicable'

export interface UpdateSoaDecisionInput {
  id: string
  organizationId: string
  soaStatus: SoaDecisionStatus
  soaApplicabilityReason: string
  soaExclusionReason: string
}

export interface SubmitSoaApprovalInput {
  id: string
  organizationId: string
}

export interface SoaVersion {
  id: string
  organizationId?: string
  organization_id?: string
  versionNumber?: number
  version_number?: number
  title: string
  changeSummary?: string | null
  change_summary?: string | null
  snapshot: string
  controlCount?: number
  control_count?: number
  approvedControlCount?: number
  approved_control_count?: number
  publishedBy?: string | null
  published_by?: string | null
  publishedAt?: string
  published_at?: string
  reviewStatus?: string
  review_status?: string
  reviewedBy?: string | null
  reviewed_by?: string | null
  reviewedAt?: string | null
  reviewed_at?: string | null
  rejectionReason?: string | null
  rejection_reason?: string | null
  createdAt?: string
  created_at?: string
  diffFromPrevious?: {
    baseVersionAvailable: boolean
    addedCount: number
    removedCount: number
    changedCount: number
    addedControls: Array<{ id: string; title: string; soaStatus: string | null }>
    removedControls: Array<{ id: string; title: string; soaStatus: string | null }>
    changedControls: Array<{
      id: string
      title: string
      before: {
        soaStatus: string | null
        applicabilityReason: string | null
        exclusionReason: string | null
        linkedRiskCount: number
        linkedTreatmentCount: number
        completedTreatmentCount: number
      }
      after: {
        soaStatus: string | null
        applicabilityReason: string | null
        exclusionReason: string | null
        linkedRiskCount: number
        linkedTreatmentCount: number
        completedTreatmentCount: number
      }
    }>
  } | null
}

// Re-export types from the repository interface for backward compatibility
export type {
  IsoControl,
  IsoControlInsert,
  IsoControlUpdate,
  ControlTemplate,
  RiskControlLink
} from '@/lib/db/repositories/interfaces/IIsoControlRepository'

export class IsoControlService {
  private repositoryPromise: Promise<IIsoControlRepository> | null = null

  private async fetchControlsApi<T>(params: Record<string, string | undefined>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchControlsApi must only be called from the browser')
    }

    const url = new URL('/api/controls', window.location.origin)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  private async patchControlsApi<T>(payload: Record<string, unknown>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('patchControlsApi must only be called from the browser')
    }

    const response = await fetch('/api/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  private async postControlsApi<T>(payload: Record<string, unknown>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('postControlsApi must only be called from the browser')
    }

    const response = await fetch('/api/controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  private async getRepository(): Promise<IIsoControlRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getIsoControlRepository()
    }
    return this.repositoryPromise
  }

  /**
   * Search ISO controls with optional keyword and category filters
   */
  async searchControls(
    organizationId: string,
    keyword?: string,
    category?: string
  ) {
    if (typeof window !== 'undefined') {
      return this.fetchControlsApi<IsoControl[]>({
        action: 'search',
        organizationId,
        keyword,
        category,
      })
    }

    const repo = await this.getRepository()
    return repo.search(organizationId, { keyword, category })
  }

  /**
   * Get control templates for a specific locale
   */
  async getControlTemplates(locale: string) {
    const repo = await this.getRepository()
    return repo.getTemplates(locale)
  }

  /**
   * Get a single ISO control by ID
   */
  async getControl(id: string) {
    const repo = await this.getRepository()
    return repo.findById(id)
  }

  /**
   * Create a new ISO control
   */
  async createControl(
    control: Parameters<IIsoControlRepository['create']>[0]
  ) {
    const repo = await this.getRepository()
    return repo.create(control)
  }

  /**
   * Update an existing ISO control
   */
  async updateControl(
    id: string,
    updates: Parameters<IIsoControlRepository['update']>[1]
  ) {
    const repo = await this.getRepository()
    const result = await repo.update(id, updates)
    if (!result) {
      throw new Error('管理策の更新に失敗しました')
    }
    return result
  }

  /**
   * Delete an ISO control
   */
  async deleteControl(id: string) {
    const repo = await this.getRepository()
    return repo.delete(id)
  }

  /**
   * Get unique categories for an organization
   */
  async getCategories(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchControlsApi<string[]>({
        action: 'categories',
        organizationId,
      })
    }

    const repo = await this.getRepository()
    return repo.getCategories(organizationId)
  }

  /**
   * Build an applicability decision readiness view from existing control links.
   */
  async getSoaReadiness(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchControlsApi<SoaReadinessControl[]>({
        action: 'soa',
        organizationId,
      })
    }

    throw new Error('getSoaReadiness is currently served through /api/controls?action=soa')
  }

  /**
   * Get published applicability decision versions for an organization.
   */
  async getSoaVersions(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchControlsApi<SoaVersion[]>({
        action: 'soa_versions',
        organizationId,
      })
    }

    throw new Error('getSoaVersions is currently served through /api/controls?action=soa_versions')
  }

  /**
   * Save the formal applicability decision for one registered control.
   */
  async updateSoaDecision(input: UpdateSoaDecisionInput) {
    if (typeof window !== 'undefined') {
      return this.patchControlsApi<IsoControl>({
        id: input.id,
        organizationId: input.organizationId,
        soaStatus: input.soaStatus,
        soaApplicabilityReason: input.soaApplicabilityReason,
        soaExclusionReason: input.soaExclusionReason,
      })
    }

    return this.updateControl(input.id, {
      soa_status: input.soaStatus,
      soa_applicability_reason: input.soaApplicabilityReason || null,
      soa_exclusion_reason: input.soaStatus === 'not_applicable'
        ? input.soaExclusionReason || null
        : null,
      soa_reviewed_at: new Date().toISOString(),
    })
  }

  /**
   * Submit a saved applicability decision for approval.
   */
  async submitSoaApproval(input: SubmitSoaApprovalInput) {
    if (typeof window !== 'undefined') {
      return this.postControlsApi<{ ok: boolean; request: unknown }>({
        action: 'submit_soa_approval',
        id: input.id,
        organizationId: input.organizationId,
      })
    }

    throw new Error('submitSoaApproval is currently served through /api/controls')
  }

  /**
   * Publish a versioned applicability decision snapshot from the current per-control decisions.
   */
  async publishSoaVersion(organizationId: string, changeSummary?: string) {
    if (typeof window !== 'undefined') {
      return this.postControlsApi<{ ok: boolean; version: SoaVersion }>({
        action: 'publish_soa_version',
        organizationId,
        changeSummary,
      })
    }

    throw new Error('publishSoaVersion is currently served through /api/controls')
  }

  /**
   * Submit a versioned applicability decision snapshot for review approval.
   */
  async submitSoaVersionReview(organizationId: string, versionId: string) {
    if (typeof window !== 'undefined') {
      return this.postControlsApi<{ ok: boolean; request: unknown }>({
        action: 'submit_soa_version_review',
        id: versionId,
        organizationId,
      })
    }

    throw new Error('submitSoaVersionReview is currently served through /api/controls')
  }

  /**
   * Get controls linked to a specific risk treatment
   */
  async getControlsForTreatment(treatmentId: string) {
    const repo = await this.getRepository()
    return repo.getControlsForTreatment(treatmentId)
  }

  /**
   * Link a control to a risk treatment
   */
  async linkControlToTreatment(treatmentId: string, controlId: string) {
    const repo = await this.getRepository()
    return repo.linkControlToTreatment(treatmentId, controlId)
  }

  /**
   * Unlink a control from a risk treatment
   */
  async unlinkControlFromTreatment(treatmentId: string, controlId: string) {
    const repo = await this.getRepository()
    return repo.unlinkControlFromTreatment(treatmentId, controlId)
  }

  /**
   * Set all controls for a risk treatment (sync operation)
   * Adds new links, removes old links, and keeps existing ones
   */
  async setTreatmentControls(treatmentId: string, controlIds: string[]) {
    const repo = await this.getRepository()
    return repo.setTreatmentControls(treatmentId, controlIds)
  }
}
