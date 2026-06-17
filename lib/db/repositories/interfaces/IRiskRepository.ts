/**
 * Risk Repository Interface
 *
 * Handles all risk-related data operations including:
 * - Risk CRUD
 * - Risk treatments
 * - Risk categories
 * - Risk criteria
 * - Risk assets
 * - Risk matrix and statistics
 */

import type { Database } from '@/types/database.types'
import type { IBaseRepository, QueryOptions } from './IBaseRepository'
import type { RiskAssetWithDetails } from '@/lib/services/informationAsset'

// Database types
type Risk = Database['public']['Tables']['risks']['Row']
type RiskInsert = Database['public']['Tables']['risks']['Insert']
type RiskUpdate = Database['public']['Tables']['risks']['Update']
type RiskCategory = Database['public']['Tables']['risk_categories']['Row']
type RiskTreatment = Database['public']['Tables']['risk_treatments']['Row']
type RiskControlLink = Database['public']['Tables']['risk_control_links']['Row']
type IsoControl = Database['public']['Tables']['iso_controls']['Row']
type RiskCriteria = Database['public']['Tables']['risk_criteria']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

// Re-export for convenience
// Note: RiskControlLink is NOT exported here to avoid collision with IIsoControlRepository
// Note: UserProfile is NOT exported here to avoid collision with IUserRepository
export type {
  Risk,
  RiskInsert,
  RiskUpdate,
  RiskCategory,
  RiskTreatment,
  RiskCriteria
}

/**
 * Treatment type enum
 */
export type TreatmentType = 'avoid' | 'reduce' | 'transfer' | 'accept'

/**
 * Risk status enum
 */
export type RiskStatus = 'identified' | 'analyzing' | 'treating' | 'monitoring' | 'closed'

/**
 * Risk treatment with control links
 */
export interface RiskTreatmentWithControls extends RiskTreatment {
  control_links?: (RiskControlLink & { iso_control: IsoControl | null })[]
}

/**
 * Risk with all related entities
 */
export interface RiskWithRelations extends Risk {
  category?: RiskCategory | null
  treatments?: RiskTreatmentWithControls[]
  owner?: UserProfile | null
  assets?: RiskAssetWithDetails[]
}

/**
 * Risk matrix entry for visualization
 */
export interface RiskMatrixEntry {
  id: string
  title: string
  impact: number | null
  likelihood: number | null
  score: number | null
}

/**
 * Risk matrix data
 */
export interface RiskMatrixData {
  matrix: number[][]
  risks: RiskMatrixEntry[]
}

/**
 * Risk statistics
 */
export interface RiskStats {
  total: number
  byStatus: Record<string, number>
  highRisk: number
  mediumRisk: number
  lowRisk: number
  averageScore: number
}

/**
 * Risk filter options
 */
export interface RiskFilters {
  status?: RiskStatus
  assessmentPeriod?: string
  departmentId?: string | null
  includeNoDepartment?: boolean
}

/**
 * Treatment payload for create/update
 */
export interface TreatmentPayload {
  treatment_type: string
  description: string
  status?: string | null
  residual_approval_status?: string | null
  residual_approved_by?: string | null
  residual_approved_at?: string | null
  residual_rejection_reason?: string | null
  residual_review_due_date?: string | null
  responsible_id?: string | null
  due_date?: string | null
  cost_estimate?: number | null
  actual_cost?: number | null
  effectiveness_rating?: number | null
}

/**
 * Risk Repository Interface
 */
export interface IRiskRepository extends IBaseRepository<Risk, RiskInsert, RiskUpdate> {
  // Risk CRUD with relations
  findByIdWithRelations(id: string): Promise<RiskWithRelations | null>
  findByOrganizationId(
    organizationId: string,
    filters?: RiskFilters,
    options?: QueryOptions
  ): Promise<RiskWithRelations[]>

  // Risk Treatment operations
  createTreatment(
    riskId: string,
    treatment: TreatmentPayload,
    controlIds?: string[]
  ): Promise<RiskTreatment>
  updateTreatment(
    id: string,
    updates: Partial<TreatmentPayload>,
    controlIds?: string[]
  ): Promise<RiskTreatment>
  deleteTreatment(id: string): Promise<void>
  syncTreatmentControls(treatmentId: string, controlIds: string[]): Promise<void>

  // Risk Asset operations
  getRiskAssets(riskId: string): Promise<RiskAssetWithDetails[]>
  setRiskAssets(riskId: string, assetIds: string[]): Promise<void>

  // Risk Category operations
  getCategories(organizationId: string, options?: QueryOptions): Promise<RiskCategory[]>
  createCategory(organizationId: string, payload: {
    name: string
    description?: string | null
    color?: string | null
    display_order?: number | null
  }): Promise<RiskCategory>
  updateCategory(id: string, payload: {
    name?: string
    description?: string | null
    color?: string | null
    display_order?: number | null
  }): Promise<RiskCategory>
  deleteCategory(id: string): Promise<void>

  // Risk Criteria operations
  getCriteria(organizationId: string, options?: QueryOptions): Promise<RiskCriteria[]>

  // Risk Assessment History
  createAssessmentHistory(
    riskId: string,
    assessedBy: string,
    previous?: {
      impactLevel?: number | null
      likelihoodLevel?: number | null
    }
  ): Promise<void>

  // Statistics and Matrix
  getRiskMatrix(organizationId: string): Promise<RiskMatrixData>
  getRiskStats(organizationId: string): Promise<RiskStats | null>
}
