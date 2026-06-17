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

export class InformationAssetService {
  private repositoryPromise: Promise<IInformationAssetRepository> | null = null
  private auditLogPromise: Promise<IAuditLogRepository> | null = null

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
