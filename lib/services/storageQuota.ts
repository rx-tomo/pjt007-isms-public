import { getDb } from '@/lib/db/drizzle/client'
import { sql } from 'drizzle-orm'
import { formatFileSize } from '@/lib/utils/formatters'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const MAX_ORG_STORAGE_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

export class StorageQuotaService {
  async getOrganizationUsage(organizationId: string): Promise<number> {
    if (typeof window !== 'undefined') {
      const url = new URL('/api/documents', window.location.origin)
      url.searchParams.set('action', 'storageUsage')
      url.searchParams.set('organizationId', organizationId)

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? `API error ${response.status}`)
      }

      const payload = await response.json() as { totalBytes?: number }
      return payload.totalBytes ?? 0
    }

    const db = getDb()

    try {
      const result = await db.all<{ total_bytes: number }>(
        sql`SELECT COALESCE(SUM(file_size), 0) AS total_bytes FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE organization_id = ${organizationId})`
      )

      const totalBytes = result[0]?.total_bytes ?? 0
      return typeof totalBytes === 'number' ? totalBytes : 0
    } catch (error) {
      console.error('Failed to retrieve organization storage usage:', error)
      throw new Error('ストレージ使用量の取得に失敗しました。しばらくしてから再度お試しください。')
    }
  }

  async ensureUploadAllowed(organizationId: string, file: File): Promise<void> {
    if (!organizationId) {
      throw new Error('組織情報を確認できませんでした。再度ログインしてください。')
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`アップロードできるファイルサイズは ${formatFileSize(MAX_FILE_SIZE_BYTES)} までです。`)
    }

    const currentUsage = await this.getOrganizationUsage(organizationId)
    if (currentUsage + file.size > MAX_ORG_STORAGE_BYTES) {
      throw new Error(
        `組織のストレージ残容量が不足しています（上限 ${formatFileSize(MAX_ORG_STORAGE_BYTES)}）。不要なファイルを整理してから再度お試しください。`
      )
    }
  }
}

export const STORAGE_MAX_FILE_SIZE = MAX_FILE_SIZE_BYTES
export const STORAGE_MAX_ORG_USAGE = MAX_ORG_STORAGE_BYTES
