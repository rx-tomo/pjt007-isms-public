/**
 * Education Repository Interface
 *
 * Handles all education/training management data operations including:
 * - Education Plan CRUD
 * - Education Records (attendance/completion)
 * - Education Materials
 * - Plan-Material associations
 * - Statistics
 */

import type { IBaseRepository, QueryOptions } from './IBaseRepository'

// =========================================
// Entity types (snake_case for API compatibility)
// =========================================

export interface EducationPlanEntity {
  id: string
  organization_id: string | null
  title: string
  description: string | null
  target_audience: string | null // JSON array string
  start_date: string | null
  end_date: string | null
  status: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface EducationRecordEntity {
  id: string
  plan_id: string | null
  attendee_id: string | null
  attended_at: string | null
  completed_at: string | null
  score: number | null
  result: string | null
  feedback: string | null
  created_at: string | null
  updated_at: string | null
}

export interface EducationMaterialEntity {
  id: string
  organization_id: string | null
  title: string
  material_type: string | null
  url: string | null
  file_reference: string | null
  description: string | null
  created_at: string | null
  updated_at: string | null
}

export interface EducationPlanMaterialEntity {
  id: string
  plan_id: string
  material_id: string
  display_order: number | null
  created_at: string | null
}

// =========================================
// Insert types
// =========================================

export interface EducationPlanInsertPayload {
  id?: string
  organization_id: string
  title: string
  description?: string | null
  target_audience?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
  created_by?: string | null
}

export interface EducationRecordInsertPayload {
  id?: string
  plan_id: string
  attendee_id: string
  attended_at?: string | null
  completed_at?: string | null
  score?: number | null
  result?: string | null
  feedback?: string | null
}

export interface EducationMaterialInsertPayload {
  id?: string
  organization_id: string
  title: string
  material_type?: string | null
  url?: string | null
  file_reference?: string | null
  description?: string | null
}

// =========================================
// Update types
// =========================================

export interface EducationPlanUpdatePayload {
  title?: string
  description?: string | null
  target_audience?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
}

export interface EducationRecordUpdatePayload {
  attended_at?: string | null
  completed_at?: string | null
  score?: number | null
  result?: string | null
  feedback?: string | null
}

// =========================================
// Composite types
// =========================================

export interface EducationPlanWithRelations extends EducationPlanEntity {
  records?: EducationRecordWithAttendee[]
  materials?: EducationMaterialEntity[]
  created_by_user?: {
    id: string
    full_name: string
    email: string
  } | null
}

export interface EducationRecordWithAttendee extends EducationRecordEntity {
  attendee?: {
    id: string
    full_name: string
    email: string
  } | null
}

// =========================================
// Filter types
// =========================================

export interface EducationPlanFilters {
  status?: string
  search?: string
}

// =========================================
// Stats type
// =========================================

export interface EducationStats {
  totalPlans: number
  byStatus: Record<string, number>
  totalRecords: number
  completionRate: number
  averageScore: number
}

// =========================================
// Repository Interface
// =========================================

export interface IEducationRepository
  extends IBaseRepository<EducationPlanEntity, EducationPlanInsertPayload, EducationPlanUpdatePayload> {

  // Plan operations
  findByOrganizationId(
    organizationId: string,
    filters?: EducationPlanFilters,
    options?: QueryOptions
  ): Promise<EducationPlanEntity[]>

  findByIdWithRelations(id: string): Promise<EducationPlanWithRelations | null>

  // Record operations
  createRecord(data: EducationRecordInsertPayload): Promise<EducationRecordEntity>
  updateRecord(id: string, data: EducationRecordUpdatePayload): Promise<EducationRecordEntity | null>
  deleteRecord(id: string): Promise<void>
  getRecordsByPlanId(planId: string): Promise<EducationRecordWithAttendee[]>

  // Material operations
  createMaterial(data: EducationMaterialInsertPayload): Promise<EducationMaterialEntity>
  updateMaterial(id: string, data: Partial<EducationMaterialInsertPayload>): Promise<EducationMaterialEntity | null>
  deleteMaterial(id: string): Promise<void>
  getMaterialsByOrganizationId(organizationId: string): Promise<EducationMaterialEntity[]>

  // Plan-Material association
  setPlanMaterials(planId: string, materialIds: string[]): Promise<void>
  getPlanMaterials(planId: string): Promise<EducationMaterialEntity[]>

  // Statistics
  getStats(organizationId: string): Promise<EducationStats | null>
}
