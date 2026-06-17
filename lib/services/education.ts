/**
 * Education Service
 *
 * Business logic for education/training management.
 * Delegates data operations to IEducationRepository via the DI container.
 */

import { getEducationRepository, getAuditLogRepository, getAuthProvider } from '@/lib/container'
import type { IEducationRepository, EducationPlanFilters } from '@/lib/db/repositories/interfaces/IEducationRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { Json } from '@/types/database.types'

// Re-export types for convenience
export type {
  EducationPlanEntity,
  EducationPlanInsertPayload,
  EducationPlanUpdatePayload,
  EducationPlanWithRelations,
  EducationPlanFilters,
  EducationRecordEntity,
  EducationRecordInsertPayload,
  EducationRecordUpdatePayload,
  EducationRecordWithAttendee,
  EducationMaterialEntity,
  EducationMaterialInsertPayload,
  EducationStats,
} from '@/lib/db/repositories/interfaces/IEducationRepository'

export class EducationService {
  private repositoryPromise: Promise<IEducationRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null
  private authProviderPromise: Promise<IAuthProvider> | null = null

  private async fetchEducationApi<T>(path: string, init?: RequestInit): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchEducationApi must only be called from the browser')
    }

    const response = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    const payload = await response.json()
    return payload.data as T
  }

  private async getRepository(): Promise<IEducationRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getEducationRepository()
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

  // =========================================
  // Plan operations
  // =========================================

  async getPlans(organizationId: string, filters?: EducationPlanFilters) {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.search) params.set('search', filters.search)
      const query = params.toString()
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationPlanEntity[]>(
        `/api/education${query ? `?${query}` : ''}`
      )
    }

    const repo = await this.getRepository()
    return repo.findByOrganizationId(organizationId, filters)
  }

  async getPlanById(id: string) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationPlanWithRelations>(`/api/education/${id}`)
    }

    const repo = await this.getRepository()
    return repo.findByIdWithRelations(id)
  }

  async createPlan(data: {
    organization_id: string
    title: string
    description?: string | null
    target_audience?: string | null
    start_date?: string | null
    end_date?: string | null
    status?: string | null
  }) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationPlanEntity>('/api/education', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }

    const userId = await this.getCurrentUserId()
    if (!userId) throw new Error('Not authenticated')

    const repo = await this.getRepository()
    const plan = await repo.create({
      ...data,
      created_by: userId,
    })

    await this.logAudit({
      organizationId: data.organization_id,
      action: 'education_plan.created',
      resourceType: 'education_plan',
      resourceId: plan.id,
      changes: { title: data.title },
    })

    return plan
  }

  async updatePlan(id: string, updates: {
    title?: string
    description?: string | null
    target_audience?: string | null
    start_date?: string | null
    end_date?: string | null
    status?: string | null
  }) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationPlanEntity>(`/api/education/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    }

    const repo = await this.getRepository()
    const plan = await repo.update(id, updates)

    await this.logAudit({
      organizationId: plan?.organization_id ?? undefined,
      action: 'education_plan.updated',
      resourceType: 'education_plan',
      resourceId: id,
      changes: updates as Record<string, unknown>,
    })

    return plan
  }

  async deletePlan(id: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchEducationApi<void>(`/api/education/${id}`, { method: 'DELETE' })
      return
    }

    const repo = await this.getRepository()
    await repo.delete(id)

    await this.logAudit({
      action: 'education_plan.deleted',
      resourceType: 'education_plan',
      resourceId: id,
    })
  }

  // =========================================
  // Record operations
  // =========================================

  async getRecordsByPlanId(planId: string) {
    const repo = await this.getRepository()
    return repo.getRecordsByPlanId(planId)
  }

  async createRecord(data: {
    plan_id: string
    attendee_id: string
    attended_at?: string | null
    completed_at?: string | null
    score?: number | null
    result?: string | null
    feedback?: string | null
  }) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationRecordEntity>(`/api/education/${data.plan_id}/records`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }

    const repo = await this.getRepository()
    const plan = await repo.findById(data.plan_id)
    const record = await repo.createRecord(data)

    await this.logAudit({
      organizationId: plan?.organization_id ?? undefined,
      action: 'education_record.created',
      resourceType: 'education_record',
      resourceId: record.id,
      changes: { plan_id: data.plan_id, attendee_id: data.attendee_id },
    })

    return record
  }

  async updateRecord(id: string, updates: {
    attended_at?: string | null
    completed_at?: string | null
    score?: number | null
    result?: string | null
    feedback?: string | null
  }) {
    const repo = await this.getRepository()
    return repo.updateRecord(id, updates)
  }

  async deleteRecord(id: string): Promise<void> {
    const repo = await this.getRepository()
    await repo.deleteRecord(id)
  }

  // =========================================
  // Material operations
  // =========================================

  async getMaterials(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationMaterialEntity[]>('/api/education/materials')
    }

    const repo = await this.getRepository()
    return repo.getMaterialsByOrganizationId(organizationId)
  }

  async createMaterial(data: {
    organization_id: string
    title: string
    material_type?: string | null
    url?: string | null
    file_reference?: string | null
    description?: string | null
  }) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationMaterialEntity>('/api/education/materials', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }

    const repo = await this.getRepository()
    return repo.createMaterial(data)
  }

  async createMaterialForPlan(planId: string, data: {
    title: string
    material_type?: string | null
    url?: string | null
    file_reference?: string | null
    description?: string | null
  }) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationMaterialEntity>(`/api/education/${planId}/materials`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }

    const plan = await this.getPlanById(planId)
    if (!plan?.organization_id) {
      throw new Error('Education plan not found')
    }

    const material = await this.createMaterial({
      organization_id: plan.organization_id,
      ...data,
    })
    await this.setPlanMaterials(planId, [
      ...(plan.materials ?? []).map((item) => item.id),
      material.id,
    ])
    return material
  }

  async updateMaterial(id: string, data: Partial<{
    title: string
    material_type: string | null
    url: string | null
    file_reference: string | null
    description: string | null
  }>) {
    if (typeof window !== 'undefined') {
      return this.fetchEducationApi<import('@/lib/db/repositories/interfaces/IEducationRepository').EducationMaterialEntity>(`/api/education/materials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    }

    const repo = await this.getRepository()
    return repo.updateMaterial(id, data)
  }

  async deleteMaterial(id: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchEducationApi<void>(`/api/education/materials/${id}`, { method: 'DELETE' })
      return
    }

    const repo = await this.getRepository()
    await repo.deleteMaterial(id)
  }

  // =========================================
  // Plan-Material association
  // =========================================

  async setPlanMaterials(planId: string, materialIds: string[]): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.fetchEducationApi<void>(`/api/education/${planId}/materials`, {
        method: 'PATCH',
        body: JSON.stringify({ material_ids: materialIds }),
      })
      return
    }

    const repo = await this.getRepository()
    return repo.setPlanMaterials(planId, materialIds)
  }

  async getPlanMaterials(planId: string) {
    const repo = await this.getRepository()
    return repo.getPlanMaterials(planId)
  }

  // =========================================
  // Statistics
  // =========================================

  async getStats(organizationId: string) {
    const repo = await this.getRepository()
    return repo.getStats(organizationId)
  }
}
