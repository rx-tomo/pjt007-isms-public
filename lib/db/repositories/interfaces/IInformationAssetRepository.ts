import type { Database } from '@/types/database.types'
import type { IOrganizationScopedRepository, QueryOptions } from './IBaseRepository'

// Database types
type InformationAsset = Database['public']['Tables']['information_assets']['Row']
type InformationAssetInsert = Database['public']['Tables']['information_assets']['Insert']
type InformationAssetUpdate = Database['public']['Tables']['information_assets']['Update']
type RiskAssetRow = Database['public']['Tables']['risk_assets']['Row']

// Re-export for convenience
export type {
  InformationAsset,
  InformationAssetInsert,
  InformationAssetUpdate,
  RiskAssetRow
}

/**
 * Information asset with owner details for risk views
 */
export interface InformationAssetForRisk extends InformationAsset {
  owner_name?: string | null
  owner_department?: string | null
  owner_email?: string | null
}

/**
 * Risk-asset link with asset details
 */
export interface RiskAssetWithDetails extends RiskAssetRow {
  asset?: InformationAsset | null
}

/**
 * Payload type for create operations
 */
export type InformationAssetCreatePayload = Omit<InformationAssetInsert, 'id' | 'created_at' | 'updated_at'>

/**
 * Information Asset Repository Interface
 *
 * Handles all information asset-related data operations including:
 * - Asset CRUD
 * - Risk-asset relationships
 */
export interface IInformationAssetRepository
  extends IOrganizationScopedRepository<InformationAsset, InformationAssetInsert, InformationAssetUpdate> {
  /**
   * Get all assets for an organization
   */
  getAssets(organizationId: string, options?: QueryOptions): Promise<InformationAsset[]>

  /**
   * Get assets with owner details for risk views
   */
  getAssetsForRisk(organizationId: string): Promise<InformationAssetForRisk[]>

  /**
   * Create a new asset
   */
  createAsset(asset: InformationAssetCreatePayload): Promise<InformationAsset>

  /**
   * Update an existing asset
   */
  updateAsset(id: string, updates: InformationAssetUpdate): Promise<InformationAsset>

  /**
   * Delete an asset
   */
  deleteAsset(id: string): Promise<void>

  /**
   * Get assets linked to a specific risk
   */
  getRiskAssets(riskId: string): Promise<RiskAssetWithDetails[]>
}
