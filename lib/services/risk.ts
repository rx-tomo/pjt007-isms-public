/**
 * Risk Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IRiskRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 */
import { getRiskRepository, getAuditLogRepository, getAuthProvider } from '@/lib/container'
import type {
  IRiskRepository,
  RiskCategory,
  RiskFilters,
  RiskWithRelations,
  TreatmentPayload
} from '@/lib/db/repositories/interfaces/IRiskRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { Database, Json } from '@/types/database.types'
import type { RiskAssetWithDetails } from '@/lib/services/informationAsset'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { applyDepartmentAccessFilters } from '@/lib/server/auth/departmentAccessFilters'

// Re-export types from the repository interface
export type {
  Risk,
  RiskCategory,
  RiskTreatment,
  RiskCriteria,
  RiskWithRelations,
  RiskTreatmentWithControls,
  RiskMatrixEntry,
  RiskMatrixData,
  RiskStats,
  TreatmentType,
  RiskStatus,
  TreatmentPayload
} from '@/lib/db/repositories/interfaces/IRiskRepository'

// Re-export RiskAssetWithDetails for backward compatibility
export type { RiskAssetWithDetails }

type RiskInsert = Database['public']['Tables']['risks']['Insert']
type RiskUpdate = Database['public']['Tables']['risks']['Update']
type RiskTreatment = Database['public']['Tables']['risk_treatments']['Row']
type RiskApiUpdate = RiskUpdate & {
  assetIds?: string[]
  expected_updated_at: string
}

// Re-export for backward compatibility
export type { RiskInsert, RiskUpdate }

export class RiskService {
  private repositoryPromise: Promise<IRiskRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null

  private async fetchRisksApi<T>(params: Record<string, string | undefined>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchRisksApi must only be called from the browser')
    }

    const url = new URL('/api/risks', window.location.origin)
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

  private async fetchRiskDetailApi<T>(id: string): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchRiskDetailApi must only be called from the browser')
    }

    const response = await fetch(`/api/risks/${id}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json()
    return payload.data
  }

  private async updateRiskApi<T>(id: string, updates: RiskApiUpdate): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('updateRiskApi must only be called from the browser')
    }

    const response = await fetch(`/api/risks/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json()
    return payload.data
  }

  private async createTreatmentApi<T>(
    riskId: string,
    treatment: {
      treatment_type: string
      description: string
      status?: string | null
      responsible_id?: string | null
      due_date?: string | null
      cost_estimate?: number | null
      actual_cost?: number | null
      effectiveness_rating?: number | null
    },
    controlIds: string[]
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('createTreatmentApi must only be called from the browser')
    }

    const response = await fetch(`/api/risks/${riskId}/treatments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...treatment, controlIds }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json()
    return payload.data
  }

  private async createRiskApi<T>(
    risk: Omit<RiskInsert, 'id' | 'created_at' | 'updated_at'>,
    assetIds: string[]
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('createRiskApi must only be called from the browser')
    }

    const response = await fetch('/api/risks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...risk, assetIds }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json()
    return payload.data
  }

  private async updateTreatmentApi<T>(
    id: string,
    updates: Partial<RiskTreatment>,
    controlIds?: string[]
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('updateTreatmentApi must only be called from the browser')
    }

    const response = await fetch(`/api/risk-treatments/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, controlIds }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json()
    return payload.data
  }

  private async getRepository(): Promise<IRiskRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getRiskRepository()
    }
    return this.repositoryPromise
  }

  private async getAuditLog(): Promise<IAuditLogRepository> {
    if (!this.auditLogPromise) {
      this.auditLogPromise = getAuditLogRepository()
    }
    return this.auditLogPromise
  }

  private async getAuth(): Promise<IAuthProvider> {
    if (!this.authProviderPromise) {
      this.authProviderPromise = getAuthProvider()
    }
    return this.authProviderPromise
  }

  private async getCurrentUserId(): Promise<string | null> {
    const auth = await this.getAuth()
    const user = await auth.getUser()
    return user?.id ?? null
  }

  private async logAudit(params: {
    organizationId?: string
    action: string
    resourceType: string
    resourceId?: string
    changes?: Record<string, unknown> | null
  }): Promise<void> {
    try {
      const [auditLog, userId] = await Promise.all([
        this.getAuditLog(),
        this.getCurrentUserId()
      ])

      await auditLog.log({
        organizationId: params.organizationId ?? '',
        userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        changes: params.changes as Json
      })
    } catch (err) {
      console.error('Audit logging failed:', err)
    }
  }

  /**
   * Get risks for an organization
   */
  async getRisks(
    organizationId: string,
    filters?: {
      status?: 'identified' | 'analyzing' | 'treating' | 'monitoring' | 'closed'
      assessmentPeriod?: string
      departmentId?: string | null
      includeNoDepartment?: boolean
    }
  ) {
    if (typeof window !== 'undefined') {
      return this.fetchRisksApi<RiskWithRelations[]>({
        action: 'risks',
        organizationId,
        status: filters?.status,
        assessmentPeriod: filters?.assessmentPeriod,
        departmentId: filters?.departmentId ?? undefined,
        includeNoDepartment: filters?.includeNoDepartment ? 'true' : undefined,
      })
    }

    const repo = await this.getRepository()
    return repo.findByOrganizationId(organizationId, filters as RiskFilters)
  }

  /**
   * Get risks for an organization with department scope
   */
  async getRisksScoped(
    organizationId: string,
    _requestingUserId: string,
    filters?: {
      status?: 'identified' | 'analyzing' | 'treating' | 'monitoring' | 'closed'
      assessmentPeriod?: string
    }
  ) {
    if (typeof window !== 'undefined') {
      return this.fetchRisksApi<RiskWithRelations[]>({
        action: 'risksScoped',
        organizationId,
        status: filters?.status,
        assessmentPeriod: filters?.assessmentPeriod,
      })
    }

    throw new Error('getRisksScoped is browser-only; use getRisksForDepartmentAccess on the server')
  }

  async getRisksForDepartmentAccess(
    organizationId: string,
    departmentAccess: TenantAuthorizationContext['departmentAccess'],
    filters?: RiskFilters
  ): Promise<RiskWithRelations[]> {
    if (typeof window !== 'undefined') {
      throw new Error('getRisksForDepartmentAccess must only be called from the server')
    }

    const repo = await this.getRepository()
    const effectiveFilters = applyDepartmentAccessFilters(filters, departmentAccess)
    return repo.findByOrganizationId(organizationId, effectiveFilters)
  }

  /**
   * Get a risk by ID with all relations
   */
  async getRiskById(id: string) {
    if (typeof window !== 'undefined') {
      return this.fetchRiskDetailApi<RiskWithRelations | null>(id)
    }

    const repo = await this.getRepository()
    return repo.findByIdWithRelations(id)
  }

  /**
   * Create a new risk
   */
  async createRisk(
    risk: Omit<RiskInsert, 'id' | 'created_at' | 'updated_at'>,
    assetIds: string[] = []
  ) {
    if (typeof window !== 'undefined') {
      return this.createRiskApi<RiskWithRelations>(risk, assetIds)
    }

    throw new Error('RiskService creation is a browser API adapter operation only')
  }

  /**
   * Update a risk
   */
  async updateRisk(id: string, updates: RiskApiUpdate) {
    if (typeof window !== 'undefined') {
      if (!updates.expected_updated_at) {
        throw new Error('expected_updated_at is required for browser risk updates')
      }
      return this.updateRiskApi<RiskWithRelations | null>(id, updates)
    }

    if (updates.owner_id !== undefined) {
      throw new Error('Risk owner changes must use RiskTenantLifecycleService')
    }

    throw new Error('RiskService updates are browser API adapter operations only')
  }

  /**
   * Delete a risk
   */
  async deleteRisk(id: string): Promise<void> {
    if (typeof window !== 'undefined') {
      const response = await fetch(`/api/risks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? `API error ${response.status}`)
      }
      return
    }

    throw new Error('RiskService deletion is a browser API adapter operation only')
  }

  /**
   * Create a risk treatment
   * @param riskId - The risk ID
   * @param treatment - Treatment data (only treatment_type and description are required)
   * @param controlIds - Optional control IDs to link
   */
  async createTreatment(
    riskId: string,
    treatment: TreatmentPayload,
    controlIds: string[] = []
  ) {
    if (typeof window !== 'undefined') {
      return this.createTreatmentApi<RiskTreatment>(riskId, treatment, controlIds)
    }

    throw new Error(
      'RiskService treatment mutations are browser API adapter operations only'
    )
  }

  /**
   * Add a risk treatment (alias for createTreatment)
   */
  async addRiskTreatment(
    riskId: string,
    treatment: TreatmentPayload,
    controlIds: string[] = []
  ) {
    return this.createTreatment(riskId, treatment, controlIds)
  }

  /**
   * Update a risk treatment
   */
  async updateTreatment(
    id: string,
    updates: Partial<RiskTreatment>,
    controlIds?: string[]
  ) {
    if (typeof window !== 'undefined') {
      return this.updateTreatmentApi<RiskTreatment>(id, updates, controlIds)
    }

    throw new Error(
      'RiskService treatment mutations are browser API adapter operations only'
    )
  }

  /**
   * Set risk assets (replace existing)
   */
  async setRiskAssets(
    riskId: string,
    assetIds: string[],
    expectedUpdatedAt?: string
  ): Promise<void> {
    if (typeof window !== 'undefined') {
      const current = expectedUpdatedAt
        ? null
        : await this.fetchRiskDetailApi<RiskWithRelations | null>(riskId)
      const expected = expectedUpdatedAt ?? current?.updated_at
      if (!expected) throw new Error('expected_updated_at is required for browser risk asset updates')
      await this.updateRiskApi(riskId, { assetIds, expected_updated_at: expected })
      return
    }
    const repo = await this.getRepository()
    return repo.setRiskAssets(riskId, assetIds)
  }

  /**
   * Get risk assets
   */
  async getRiskAssets(riskId: string): Promise<RiskAssetWithDetails[]> {
    const repo = await this.getRepository()
    return repo.getRiskAssets(riskId)
  }

  /**
   * Get risk categories
   */
  async getCategories(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchRisksApi<RiskCategory[]>({
        action: 'categories',
        organizationId,
      })
    }

    const repo = await this.getRepository()
    return repo.getCategories(organizationId)
  }

  /**
   * Get risk categories (alias for getCategories)
   */
  async getRiskCategories(organizationId: string) {
    return this.getCategories(organizationId)
  }

  /**
   * Get risk criteria
   */
  async getCriteria(organizationId: string) {
    const repo = await this.getRepository()
    return repo.getCriteria(organizationId)
  }

  /**
   * Get risk matrix data
   */
  async getRiskMatrix(organizationId: string) {
    const repo = await this.getRepository()
    return repo.getRiskMatrix(organizationId)
  }

  /**
   * Get risk statistics
   */
  async getRiskStats(organizationId: string) {
    const repo = await this.getRepository()
    return repo.getRiskStats(organizationId)
  }
}
