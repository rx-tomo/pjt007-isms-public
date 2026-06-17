/**
 * SQLite Information Asset Repository
 *
 * Implements IInformationAssetRepository using Drizzle ORM with SQLite.
 * Handles CRUD operations for information assets with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - All queries include organization_id filtering for multi-tenant isolation
 * - Supports pagination via limit/offset
 * - Owner details joined from userProfiles table for risk views
 *
 * @module lib/db/repositories/sqlite/InformationAssetRepository
 */

import { eq, and, sql, asc, desc } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import { informationAssetImportRows, informationAssets, riskAssets } from '@/lib/db/drizzle/schema/risks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import type {
  IInformationAssetRepository,
  InformationAsset,
  InformationAssetInsert,
  InformationAssetUpdate,
  InformationAssetForRisk,
  InformationAssetCreatePayload,
  RiskAssetWithDetails,
} from '../interfaces/IInformationAssetRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteInformationAssetRepository extends BaseSQLiteRepository implements IInformationAssetRepository {
  /**
   * Constructor accepts an optional db override for testing (dependency injection)
   */
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  // =========================================
  // Base repository methods
  // =========================================

  /**
   * Find an asset by its ID
   */
  async findById(id: string): Promise<InformationAsset | null> {
    const rows = await this.db
      .select()
      .from(informationAssets)
      .where(eq(informationAssets.id, id))

    if (rows.length === 0) return null

    return this.mapRowToEntity(rows[0])
  }

  /**
   * Find multiple assets with optional filters
   */
  async findMany(filters?: Record<string, unknown>): Promise<InformationAsset[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db
        .select()
        .from(informationAssets)
        .orderBy(asc(informationAssets.name))

      return rows.map(row => this.mapRowToEntity(row))
    }

    // Build conditions from filters
    const conditions = Object.entries(filters).map(([key, value]) => {
      const column = informationAssets[key as keyof typeof informationAssets.$inferSelect]
      if (column) {
        return eq(column as never, value as never)
      }
      return null
    }).filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db
        .select()
        .from(informationAssets)
        .orderBy(asc(informationAssets.name))

      return rows.map(row => this.mapRowToEntity(row))
    }

    const rows = await this.db
      .select()
      .from(informationAssets)
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions as never[]))
      .orderBy(asc(informationAssets.name))

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Find all assets for an organization
   */
  async findByOrganizationId(organizationId: string): Promise<InformationAsset[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    return this.getAssets(organizationId)
  }

  /**
   * Create a new asset
   */
  async create(data: InformationAssetInsert): Promise<InformationAsset> {
    this.requireOrganizationId(data.organization_id, 'create information asset')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id,
      name: data.name,
      assetType: data.asset_type ?? 'data',
      classification: data.classification ?? 'internal',
      criticality: data.criticality ?? 'medium',
      ownerId: data.owner_id ?? null,
      location: data.location ?? null,
      status: data.status ?? 'in_use',
      description: data.description ?? null,
      createdAt: data.created_at ?? now,
      updatedAt: data.updated_at ?? now,
    }

    await this.db.insert(informationAssets).values(row)

    this.logDataAccess('create information asset', data.organization_id, { id })

    return this.mapRowToEntity(row)
  }

  /**
   * Update an existing asset
   */
  async update(id: string, updates: InformationAssetUpdate): Promise<InformationAsset | null> {
    const now = new Date().toISOString()

    // Build the update payload, converting snake_case to camelCase
    const setPayload: Record<string, unknown> = {
      updatedAt: now,
    }

    if (updates.name !== undefined) setPayload.name = updates.name
    if (updates.asset_type !== undefined) setPayload.assetType = updates.asset_type
    if (updates.classification !== undefined) setPayload.classification = updates.classification
    if (updates.criticality !== undefined) setPayload.criticality = updates.criticality
    if (updates.owner_id !== undefined) setPayload.ownerId = updates.owner_id
    if (updates.location !== undefined) setPayload.location = updates.location
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.description !== undefined) setPayload.description = updates.description

    await this.db
      .update(informationAssets)
      .set(setPayload)
      .where(eq(informationAssets.id, id))

    // Re-fetch the updated row
    const rows = await this.db
      .select()
      .from(informationAssets)
      .where(eq(informationAssets.id, id))

    if (rows.length === 0) return null

    return this.mapRowToEntity(rows[0])
  }

  /**
   * Delete an asset
   */
  async delete(id: string): Promise<void> {
    await this.db
      .update(informationAssetImportRows)
      .set({ assetId: null })
      .where(eq(informationAssetImportRows.assetId, id))

    await this.db
      .delete(informationAssets)
      .where(eq(informationAssets.id, id))
  }

  // =========================================
  // Information Asset specific methods
  // =========================================

  /**
   * Get all assets for an organization with optional sorting and pagination
   */
  async getAssets(organizationId: string, options?: QueryOptions): Promise<InformationAsset[]> {
    this.requireOrganizationId(organizationId, 'getAssets')

    const orderColumn = options?.orderBy || 'name'
    const orderDir = options?.orderDirection || 'asc'

    // Resolve column reference
    const columnRef = informationAssets[orderColumn as keyof typeof informationAssets.$inferSelect] ?? informationAssets.name
    const orderExpr = orderDir === 'desc' ? desc(columnRef as never) : asc(columnRef as never)

    let query = this.db
      .select()
      .from(informationAssets)
      .where(eq(informationAssets.organizationId, organizationId))
      .orderBy(orderExpr)

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query
    }

    if (options?.offset) {
      query = query.offset(options.offset) as typeof query
    }

    const rows = await query

    this.logDataAccess('getAssets', organizationId, { count: rows.length })

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Get assets with owner details for risk views
   *
   * Performs a LEFT JOIN with userProfiles to include owner name, department, email.
   */
  async getAssetsForRisk(organizationId: string): Promise<InformationAssetForRisk[]> {
    this.requireOrganizationId(organizationId, 'getAssetsForRisk')

    const rows = await this.db
      .select({
        id: informationAssets.id,
        organization_id: informationAssets.organizationId,
        name: informationAssets.name,
        asset_type: informationAssets.assetType,
        classification: informationAssets.classification,
        criticality: informationAssets.criticality,
        owner_id: informationAssets.ownerId,
        location: informationAssets.location,
        status: informationAssets.status,
        description: informationAssets.description,
        created_at: informationAssets.createdAt,
        updated_at: informationAssets.updatedAt,
        owner_name: userProfiles.fullName,
        owner_department: userProfiles.department,
        owner_email: userProfiles.email,
      })
      .from(informationAssets)
      .leftJoin(userProfiles, eq(informationAssets.ownerId, userProfiles.id))
      .where(eq(informationAssets.organizationId, organizationId))
      .orderBy(asc(informationAssets.name))

    this.logDataAccess('getAssetsForRisk', organizationId, { count: rows.length })

    return rows.map(row => ({
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      asset_type: row.asset_type,
      classification: row.classification,
      criticality: row.criticality,
      owner_id: row.owner_id,
      location: row.location,
      status: row.status,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_name: row.owner_name ?? null,
      owner_department: row.owner_department ?? null,
      owner_email: row.owner_email ?? null,
    }))
  }

  /**
   * Create a new asset (convenience method)
   */
  async createAsset(asset: InformationAssetCreatePayload): Promise<InformationAsset> {
    return this.create(asset)
  }

  /**
   * Update an existing asset (convenience method, throws if not found)
   */
  async updateAsset(id: string, updates: InformationAssetUpdate): Promise<InformationAsset> {
    const result = await this.update(id, updates)
    if (!result) {
      throw new Error('情報資産の更新に失敗しました')
    }
    return result
  }

  /**
   * Delete an asset (convenience method)
   */
  async deleteAsset(id: string): Promise<void> {
    return this.delete(id)
  }

  /**
   * Get assets linked to a specific risk
   *
   * Performs a LEFT JOIN between risk_assets and information_assets
   * to return risk-asset links with full asset details.
   */
  async getRiskAssets(riskId: string): Promise<RiskAssetWithDetails[]> {
    const rows = await this.db
      .select({
        id: riskAssets.id,
        risk_id: riskAssets.riskId,
        asset_id: riskAssets.assetId,
        created_at: riskAssets.createdAt,
        // asset details
        asset_full_id: informationAssets.id,
        asset_organization_id: informationAssets.organizationId,
        asset_name: informationAssets.name,
        asset_type: informationAssets.assetType,
        asset_classification: informationAssets.classification,
        asset_criticality: informationAssets.criticality,
        asset_owner_id: informationAssets.ownerId,
        asset_location: informationAssets.location,
        asset_status: informationAssets.status,
        asset_description: informationAssets.description,
        asset_created_at: informationAssets.createdAt,
        asset_updated_at: informationAssets.updatedAt,
      })
      .from(riskAssets)
      .leftJoin(informationAssets, eq(riskAssets.assetId, informationAssets.id))
      .where(eq(riskAssets.riskId, riskId))
      .orderBy(asc(riskAssets.createdAt))

    return rows.map(row => ({
      id: row.id,
      risk_id: row.risk_id,
      asset_id: row.asset_id,
      created_at: row.created_at,
      asset: row.asset_full_id
        ? {
            id: row.asset_full_id,
            organization_id: row.asset_organization_id!,
            name: row.asset_name!,
            asset_type: row.asset_type,
            classification: row.asset_classification,
            criticality: row.asset_criticality,
            owner_id: row.asset_owner_id,
            location: row.asset_location,
            status: row.asset_status,
            description: row.asset_description,
            created_at: row.asset_created_at,
            updated_at: row.asset_updated_at,
          }
        : null,
    }))
  }

  // =========================================
  // Private helpers
  // =========================================

  /**
   * Maps a Drizzle database row (camelCase) to the InformationAsset entity (snake_case)
   *
   * The interface uses snake_case matching the SQLite/libSQL column names,
   * while Drizzle schema uses camelCase.
   */
  private mapRowToEntity(row: {
    id: string
    organizationId: string
    name: string
    assetType: string | null
    classification: string | null
    criticality: string | null
    ownerId: string | null
    location: string | null
    status: string | null
    description: string | null
    createdAt: string | null
    updatedAt: string | null
  }): InformationAsset {
    return {
      id: row.id,
      organization_id: row.organizationId,
      name: row.name,
      asset_type: row.assetType,
      classification: row.classification,
      criticality: row.criticality,
      owner_id: row.ownerId,
      location: row.location,
      status: row.status,
      description: row.description,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
