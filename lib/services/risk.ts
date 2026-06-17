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
import { getRiskRepository, getAuditLogRepository, getAuthProvider, getUserRepository } from '@/lib/container'
import type {
  IRiskRepository,
  RiskCategory,
  RiskFilters,
  RiskWithRelations,
  TreatmentPayload
} from '@/lib/db/repositories/interfaces/IRiskRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { IUserRepository, UserProfile } from '@/lib/db/repositories/interfaces/IUserRepository'
import type { Database, Json } from '@/types/database.types'
import type { RiskAssetWithDetails } from '@/lib/services/informationAsset'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { hasFullDepartmentAccess } from '@/lib/utils/departmentScope'

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

// Re-export for backward compatibility
export type { RiskInsert, RiskUpdate }

export class RiskService {
  private repositoryPromise: Promise<IRiskRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null
  private userRepositoryPromise: Promise<IUserRepository> | null = null

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

  private async updateRiskApi<T>(id: string, updates: RiskUpdate): Promise<T> {
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

  private async getUserRepository(): Promise<IUserRepository> {
    if (!this.userRepositoryPromise) {
      this.userRepositoryPromise = getUserRepository()
    }
    return this.userRepositoryPromise
  }

  private async getCurrentUserId(): Promise<string | null> {
    const auth = await this.getAuth()
    const user = await auth.getUser()
    return user?.id ?? null
  }

  private async getRequestingUserProfile(requestingUserId: string): Promise<UserProfile | null> {
    const userRepository = await this.getUserRepository()
    return userRepository.findById(requestingUserId)
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
    requestingUserId: string,
    filters?: {
      status?: 'identified' | 'analyzing' | 'treating' | 'monitoring' | 'closed'
      assessmentPeriod?: string
    }
  ) {
    if (typeof window !== 'undefined') {
      return this.fetchRisksApi<RiskWithRelations[]>({
        action: 'risksScoped',
        organizationId,
        requestingUserId,
        status: filters?.status,
        assessmentPeriod: filters?.assessmentPeriod,
      })
    }

    const requestingUser = await this.getRequestingUserProfile(requestingUserId)
    if (!requestingUser) {
      throw new Error('Requesting user not found')
    }

    if (hasFullDepartmentAccess(requestingUser.role)) {
      return this.getRisks(organizationId, filters)
    }

    const departmentId = requestingUser.primary_department_id ?? DEPARTMENT_UNASSIGNED_VALUE
    return this.getRisks(organizationId, {
      ...(filters ?? {}),
      departmentId,
      includeNoDepartment: true
    })
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

    const userId = await this.getCurrentUserId()
    if (!userId) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    const data = await repo.create({
      ...risk,
      identified_by: userId
    })

    if (assetIds.length > 0) {
      await repo.setRiskAssets(data.id, assetIds)
    }

    await this.logAudit({
      action: 'risk.created',
      resourceType: 'risk',
      resourceId: data.id,
      changes: { title: risk.title, assetIds }
    })

    return data
  }

  /**
   * Update a risk
   */
  async updateRisk(id: string, updates: RiskUpdate) {
    if (typeof window !== 'undefined') {
      return this.updateRiskApi<RiskWithRelations | null>(id, updates)
    }

    const repo = await this.getRepository()
    const previousRisk = updates.impact_level !== undefined || updates.likelihood_level !== undefined
      ? await repo.findById(id)
      : null
    const data = await repo.update(id, updates)

    await this.logAudit({
      action: 'risk.updated',
      resourceType: 'risk',
      resourceId: id,
      changes: updates as Record<string, unknown>
    })

    // Create assessment history if impact or likelihood changed
    if (updates.impact_level !== undefined || updates.likelihood_level !== undefined) {
      const userId = await this.getCurrentUserId()
      if (userId) {
        await repo.createAssessmentHistory(id, userId, {
          impactLevel: previousRisk?.impact_level ?? null,
          likelihoodLevel: previousRisk?.likelihood_level ?? null,
        })
      }
    }

    return data
  }

  /**
   * Delete a risk
   */
  async deleteRisk(id: string): Promise<void> {
    const repo = await this.getRepository()
    await repo.delete(id)

    await this.logAudit({
      action: 'risk.deleted',
      resourceType: 'risk',
      resourceId: id
    })
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

    const repo = await this.getRepository()
    return repo.createTreatment(riskId, treatment, controlIds)
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

    const repo = await this.getRepository()
    return repo.updateTreatment(id, updates, controlIds)
  }

  /**
   * Set risk assets (replace existing)
   */
  async setRiskAssets(riskId: string, assetIds: string[]): Promise<void> {
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
