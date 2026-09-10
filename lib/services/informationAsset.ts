/**
 * Information Asset Service
 *
 * This service has been refactored to use the Repository pattern.
 * It delegates data operations to IInformationAssetRepository while maintaining
 * the same public API for backward compatibility.
 *
 * The repository is obtained through the DI container, allowing seamless
 * switching between different database backends via DI container.
 */
import { getInformationAssetRepository, getAuditLogRepository } from '@/lib/container'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  informationAssetImportRows,
  informationAssets,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import type {
  IInformationAssetRepository,
  InformationAssetForRisk
} from '@/lib/db/repositories/interfaces/IInformationAssetRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { Database, Json } from '@/types/database.types'

// Re-export types from the repository interface for backward compatibility
export type {
  InformationAsset,
  InformationAssetInsert,
  InformationAssetUpdate,
  InformationAssetForRisk,
  RiskAssetWithDetails,
  InformationAssetCreatePayload
} from '@/lib/db/repositories/interfaces/IInformationAssetRepository'

// Legacy type aliases for backward compatibility
export type RiskAssetLink = Database['public']['Tables']['risk_assets']['Row']

type InformationAssetDb = ReturnType<typeof getDb>
type InformationAssetReadDb = Pick<InformationAssetDb, 'select'>

export class InformationAssetMutationError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'InformationAssetMutationError'
  }
}

export function isInformationAssetMutationError(
  error: unknown
): error is InformationAssetMutationError {
  return error instanceof InformationAssetMutationError
}

export type InformationAssetMutationContext = {
  organizationId: string
  actorUserId: string
}

export type InformationAssetImportTracking = {
  jobId: string
  lineNumber: number
  rawData: string
}

export class InformationAssetService {
  private repositoryPromise: Promise<IInformationAssetRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null

  constructor(private readonly injectedDb?: InformationAssetDb) {}

  private get db(): InformationAssetDb {
    return this.injectedDb ?? getDb()
  }

  private async fetchAssetsApi<T>(params: Record<string, string | undefined>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchAssetsApi must only be called from the browser')
    }

    const url = new URL('/api/information-assets', window.location.origin)
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

  private async mutateAssetsApi<T>(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('mutateAssetsApi must only be called from the browser')
    }

    const response = await fetch('/api/information-assets', {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error ?? `API error ${response.status}`)
    }

    return response.json()
  }

  private async getRepository(): Promise<IInformationAssetRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getInformationAssetRepository()
    }
    return this.repositoryPromise
  }

  private async getAuditLog(): Promise<IAuditLogRepository> {
    if (!this.auditLogPromise) {
      this.auditLogPromise = getAuditLogRepository()
    }
    return this.auditLogPromise
  }

  private async logAudit(params: {
    organizationId: string | null
    action: string
    resourceType: string
    resourceId: string
    changes?: Record<string, unknown> | null
  }): Promise<void> {
    try {
      const auditLog = await this.getAuditLog()

      await auditLog.log({
        organizationId: params.organizationId ?? '',
        userId: null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        changes: params.changes as Json
      })
    } catch (err) {
      console.error('Audit logging failed:', err)
    }
  }

  /**
   * Get all assets for an organization
   */
  async getAssets(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchAssetsApi<Database['public']['Tables']['information_assets']['Row'][]>({
        action: 'assets',
        organizationId,
      })
    }

    const repo = await this.getRepository()
    return repo.getAssets(organizationId)
  }

  /**
   * Get assets with owner details for risk views
   */
  async getAssetsForRisk(organizationId: string) {
    if (typeof window !== 'undefined') {
      return this.fetchAssetsApi<InformationAssetForRisk[]>({
        action: 'assetsForRisk',
        organizationId,
      })
    }

    const repo = await this.getRepository()
    return repo.getAssetsForRisk(organizationId)
  }

  private assertMutationContext(context: InformationAssetMutationContext): void {
    if (!context.organizationId.trim() || !context.actorUserId.trim()) {
      throw new InformationAssetMutationError(400, 'organizationId and actorUserId are required')
    }
  }

  private async assertActiveOwner(
    db: InformationAssetReadDb,
    organizationId: string,
    ownerId: string | null | undefined
  ): Promise<void> {
    if (!ownerId) return

    const [owner] = await db
      .select({
        id: userProfiles.id,
        role: userMemberships.role,
      })
      .from(userProfiles)
      .innerJoin(userMemberships, and(
        eq(userMemberships.userId, userProfiles.id),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .where(and(
        eq(userProfiles.id, ownerId),
        eq(userProfiles.isActive, true)
      ))
      .limit(1)

    if (!owner || owner.role === 'super_admin') {
      throw new InformationAssetMutationError(404, 'Information asset owner not found')
    }
  }

  private mapTransactionalRow(row: typeof informationAssets.$inferSelect) {
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

  /**
   * Server-side fail-closed mutation. The asset row and its audit event commit
   * together, and owner identity is resolved from an active membership in the
   * same organization.
   */
  async createAssetForActor(
    context: InformationAssetMutationContext,
    asset: Omit<Database['public']['Tables']['information_assets']['Insert'], 'id' | 'created_at' | 'updated_at'>,
    importTracking?: InformationAssetImportTracking
  ) {
    this.assertMutationContext(context)
    if (asset.organization_id !== context.organizationId) {
      throw new InformationAssetMutationError(404, 'Information asset organization not found')
    }

    return this.db.transaction(async tx => {
      await this.assertActiveOwner(tx, context.organizationId, asset.owner_id)
      const now = new Date().toISOString()
      const [created] = await tx
        .insert(informationAssets)
        .values({
          id: crypto.randomUUID(),
          organizationId: context.organizationId,
          name: asset.name,
          assetType: asset.asset_type ?? 'data',
          classification: asset.classification ?? 'internal',
          criticality: asset.criticality ?? 'medium',
          ownerId: asset.owner_id ?? null,
          location: asset.location ?? null,
          status: asset.status ?? 'in_use',
          description: asset.description ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (!created) {
        throw new InformationAssetMutationError(409, 'Information asset create conflict')
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        userId: context.actorUserId,
        action: 'asset.created',
        resourceType: 'information_asset',
        resourceId: created.id,
        changes: JSON.stringify({ name: created.name }),
        scope: 'tenant',
        createdAt: now,
      })

      if (importTracking) {
        await tx.insert(informationAssetImportRows).values({
          id: crypto.randomUUID(),
          jobId: importTracking.jobId,
          lineNumber: importTracking.lineNumber,
          rawData: importTracking.rawData,
          status: 'imported',
          assetId: created.id,
          createdAt: now,
          updatedAt: now,
        })
      }

      return this.mapTransactionalRow(created)
    })
  }

  async updateAssetForActor(
    context: InformationAssetMutationContext,
    id: string,
    updates: Database['public']['Tables']['information_assets']['Update'],
    importTracking?: InformationAssetImportTracking
  ) {
    this.assertMutationContext(context)

    return this.db.transaction(async tx => {
      const [existing] = await tx
        .select()
        .from(informationAssets)
        .where(and(
          eq(informationAssets.id, id),
          eq(informationAssets.organizationId, context.organizationId)
        ))
        .limit(1)
      if (!existing) {
        throw new InformationAssetMutationError(404, 'Information asset not found')
      }

      if (updates.owner_id !== undefined) {
        await this.assertActiveOwner(
          tx,
          context.organizationId,
          updates.owner_id
        )
      }

      const now = new Date().toISOString()
      const setPayload: Partial<typeof informationAssets.$inferInsert> = { updatedAt: now }
      if (updates.name !== undefined) setPayload.name = updates.name
      if (updates.asset_type !== undefined) setPayload.assetType = updates.asset_type
      if (updates.classification !== undefined) setPayload.classification = updates.classification
      if (updates.criticality !== undefined) setPayload.criticality = updates.criticality
      if (updates.owner_id !== undefined) setPayload.ownerId = updates.owner_id
      if (updates.location !== undefined) setPayload.location = updates.location
      if (updates.status !== undefined) setPayload.status = updates.status
      if (updates.description !== undefined) setPayload.description = updates.description

      const [updated] = await tx
        .update(informationAssets)
        .set(setPayload)
        .where(and(
          eq(informationAssets.id, id),
          eq(informationAssets.organizationId, context.organizationId)
        ))
        .returning()
      if (!updated) {
        throw new InformationAssetMutationError(409, 'Information asset update conflict')
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        userId: context.actorUserId,
        action: 'asset.updated',
        resourceType: 'information_asset',
        resourceId: id,
        changes: JSON.stringify(updates),
        scope: 'tenant',
        createdAt: now,
      })
      if (importTracking) {
        await tx.insert(informationAssetImportRows).values({
          id: crypto.randomUUID(),
          jobId: importTracking.jobId,
          lineNumber: importTracking.lineNumber,
          rawData: importTracking.rawData,
          status: 'imported',
          assetId: updated.id,
          createdAt: now,
          updatedAt: now,
        })
      }
      return this.mapTransactionalRow(updated)
    })
  }

  async deleteAssetForActor(
    context: InformationAssetMutationContext,
    id: string
  ): Promise<void> {
    this.assertMutationContext(context)

    await this.db.transaction(async tx => {
      const [existing] = await tx
        .select({ id: informationAssets.id, name: informationAssets.name })
        .from(informationAssets)
        .where(and(
          eq(informationAssets.id, id),
          eq(informationAssets.organizationId, context.organizationId)
        ))
        .limit(1)
      if (!existing) {
        throw new InformationAssetMutationError(404, 'Information asset not found')
      }

      await tx
        .update(informationAssetImportRows)
        .set({ assetId: null })
        .where(eq(informationAssetImportRows.assetId, id))
      const deleted = await tx
        .delete(informationAssets)
        .where(and(
          eq(informationAssets.id, id),
          eq(informationAssets.organizationId, context.organizationId)
        ))
        .returning({ id: informationAssets.id })
      if (deleted.length !== 1) {
        throw new InformationAssetMutationError(409, 'Information asset delete conflict')
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        userId: context.actorUserId,
        action: 'asset.deleted',
        resourceType: 'information_asset',
        resourceId: id,
        changes: JSON.stringify({ name: existing.name }),
        scope: 'tenant',
        createdAt: new Date().toISOString(),
      })
    })
  }

  /**
   * Create a new asset
   */
  async createAsset(
    asset: Omit<Database['public']['Tables']['information_assets']['Insert'], 'id' | 'created_at' | 'updated_at'>
  ) {
    if (typeof window !== 'undefined') {
      return this.mutateAssetsApi<Database['public']['Tables']['information_assets']['Row']>('POST', { asset })
    }

    const repo = await this.getRepository()
    const created = await repo.createAsset(asset)

    await this.logAudit({
      organizationId: created.organization_id,
      action: 'asset.created',
      resourceType: 'information_asset',
      resourceId: created.id,
      changes: { name: created.name }
    })

    return created
  }

  /**
   * Update an existing asset
   */
  async updateAsset(
    id: string,
    updates: Database['public']['Tables']['information_assets']['Update']
  ) {
    if (typeof window !== 'undefined') {
      return this.mutateAssetsApi<Database['public']['Tables']['information_assets']['Row']>('PATCH', {
        id,
        asset: updates,
      })
    }

    const repo = await this.getRepository()
    const updated = await repo.updateAsset(id, updates)

    await this.logAudit({
      organizationId: updated.organization_id,
      action: 'asset.updated',
      resourceType: 'information_asset',
      resourceId: id,
      changes: updates as Record<string, unknown>
    })

    return updated
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.mutateAssetsApi<{ ok: boolean }>('DELETE', { id })
      return
    }

    const repo = await this.getRepository()

    // Get the asset first to log the organization_id
    const asset = await repo.findById(id)
    if (!asset) {
      throw new Error('情報資産の取得に失敗しました')
    }

    await repo.deleteAsset(id)

    await this.logAudit({
      organizationId: asset.organization_id,
      action: 'asset.deleted',
      resourceType: 'information_asset',
      resourceId: id,
      changes: null
    })
  }

  /**
   * Get assets linked to a specific risk
   */
  async getRiskAssets(riskId: string) {
    const repo = await this.getRepository()
    return repo.getRiskAssets(riskId)
  }
}
