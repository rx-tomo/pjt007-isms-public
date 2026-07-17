import { getDocumentRepository } from '@/lib/container'
import type {
  DocumentFileVersionPayload,
  DocumentLifecycleAuditContext,
  IDocumentRepository,
} from '@/lib/db/repositories/interfaces/IDocumentRepository'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import {
  assertDocumentFolderBelongsToOrganization,
  DocumentTenantInvariantError,
  normalizeDocumentCreateInput,
  normalizeDocumentUpdateInput,
} from '@/lib/services/documentTenantInvariant'
import { isDocumentStoragePath } from '@/lib/storage/documentFilePolicy'

export class DocumentTenantMutationService {
  private repositoryPromise: Promise<IDocumentRepository> | null

  constructor(repository?: IDocumentRepository) {
    this.repositoryPromise = repository ? Promise.resolve(repository) : null
  }

  private async getRepository(): Promise<IDocumentRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getDocumentRepository()
    }
    return this.repositoryPromise
  }

  private normalizeAuditActor(
    authorization: TenantAuthorizationContext,
    audit: DocumentLifecycleAuditContext
  ): DocumentLifecycleAuditContext {
    return { ...audit, userId: authorization.userId }
  }

  async getOrganizationId(documentId: string): Promise<string | null> {
    const repository = await this.getRepository()
    return repository.findOrganizationIdByDocumentId(documentId)
  }

  async getDocument(
    authorization: TenantAuthorizationContext,
    documentId: string
  ) {
    const repository = await this.getRepository()
    return repository.findByIdForDepartmentAccess(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess
    )
  }

  async getVersions(
    authorization: TenantAuthorizationContext,
    documentId: string
  ) {
    if (!await this.getDocument(authorization, documentId)) return []
    const repository = await this.getRepository()
    return repository.getVersionsForTenant(
      documentId,
      authorization.organizationId
    )
  }

  async getVersion(
    authorization: TenantAuthorizationContext,
    documentId: string,
    versionId: string
  ) {
    if (!await this.getDocument(authorization, documentId)) return null
    const repository = await this.getRepository()
    return repository.getVersionForTenant(
      documentId,
      versionId,
      authorization.organizationId
    )
  }

  async createDocument(
    authorization: TenantAuthorizationContext,
    value: unknown,
    audit: DocumentLifecycleAuditContext
  ) {
    const input = normalizeDocumentCreateInput(
      value,
      authorization.organizationId,
      authorization.userId
    )
    const repository = await this.getRepository()
    return repository.createWithTenantInvariant(
      input,
      tx => assertDocumentFolderBelongsToOrganization(
        tx,
        authorization.organizationId,
        input.folder_id
      ),
      this.normalizeAuditActor(authorization, audit)
    )
  }

  async updateDocument(
    authorization: TenantAuthorizationContext,
    documentId: string,
    value: unknown,
    audit: DocumentLifecycleAuditContext
  ) {
    const updates = normalizeDocumentUpdateInput(value)
    const repository = await this.getRepository()
    if (Object.keys(updates).length === 0) {
      return this.getDocument(authorization, documentId)
    }
    updates.updated_by = authorization.userId
    return repository.updateWithTenantInvariant(
      documentId,
      authorization.organizationId,
      updates,
      authorization.departmentAccess,
      tx => assertDocumentFolderBelongsToOrganization(
        tx,
        authorization.organizationId,
        updates.folder_id
      ),
      this.normalizeAuditActor(authorization, audit)
    )
  }

  async deleteDocumentWithStorage(
    authorization: TenantAuthorizationContext,
    documentId: string,
    operationKey: string,
    audit: DocumentLifecycleAuditContext
  ) {
    const normalizedOperationKey = this.normalizeOperationKey(operationKey)
    const repository = await this.getRepository()
    return repository.deleteDocumentWithStorageForTenant(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      normalizedOperationKey,
      this.normalizeAuditActor(authorization, audit)
    )
  }

  async deleteDocumentVersionWithStorage(
    authorization: TenantAuthorizationContext,
    documentId: string,
    versionId: string,
    operationKey: string,
    audit: DocumentLifecycleAuditContext
  ) {
    const normalizedVersionId = versionId.trim()
    if (!normalizedVersionId || normalizedVersionId.length > 128) {
      throw new DocumentTenantInvariantError(400, 'Invalid document version')
    }
    const repository = await this.getRepository()
    return repository.deleteDocumentVersionWithStorageForTenant(
      documentId,
      normalizedVersionId,
      authorization.organizationId,
      authorization.departmentAccess,
      this.normalizeOperationKey(operationKey),
      this.normalizeAuditActor(authorization, audit)
    )
  }

  async prepareFileUpload(
    authorization: TenantAuthorizationContext,
    documentId: string,
    payload: {
      operationKey: string
      filePath: string
      requestFingerprint: string
      mode: 'normal' | 'revision'
    },
    audit: DocumentLifecycleAuditContext
  ) {
    if (!isDocumentStoragePath(
      payload.filePath,
      authorization.organizationId,
      documentId
    )) {
      throw new DocumentTenantInvariantError(400, 'Invalid document file path')
    }
    if (!/^[a-f0-9]{64}$/.test(payload.requestFingerprint)) {
      throw new DocumentTenantInvariantError(400, 'Invalid document upload fingerprint')
    }
    const repository = await this.getRepository()
    return repository.prepareFileUploadOperationForTenant(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      {
        operationKey: this.normalizeOperationKey(payload.operationKey),
        filePath: payload.filePath,
        requestFingerprint: payload.requestFingerprint,
        mode: payload.mode,
      },
      this.normalizeAuditActor(authorization, audit)
    )
  }

  async completeFileUpload(
    authorization: TenantAuthorizationContext,
    operationId: string,
    documentId: string,
    payload: DocumentFileVersionPayload,
    audit: DocumentLifecycleAuditContext
  ) {
    const normalizedPayload = this.normalizeFileVersionPayload(payload)
    if (!isDocumentStoragePath(
      normalizedPayload.filePath,
      authorization.organizationId,
      documentId
    )) {
      throw new DocumentTenantInvariantError(400, 'Invalid document file path')
    }
    const repository = await this.getRepository()
    return repository.completeFileUploadOperationForTenant(
      operationId,
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      normalizedPayload,
      this.normalizeAuditActor(authorization, audit)
    )
  }

  async markStorageCleanupOutcome(
    authorization: TenantAuthorizationContext,
    operationId: string,
    leaseToken: string,
    outcome: { success: boolean; errorMessage?: string | null }
  ): Promise<boolean> {
    const repository = await this.getRepository()
    return repository.markStorageOperationCleanupOutcome(
      operationId,
      authorization.organizationId,
      leaseToken,
      outcome
    )
  }

  async claimStorageCleanupOperation(
    authorization: TenantAuthorizationContext,
    operationId: string,
    stalePendingBefore: string,
    audit: DocumentLifecycleAuditContext
  ) {
    const repository = await this.getRepository()
    return repository.claimStorageOperationForCleanup(
      operationId,
      authorization.organizationId,
      this.normalizeAuditActor(authorization, audit),
      stalePendingBefore
    )
  }

  async claimStorageCleanupOperations(
    authorization: TenantAuthorizationContext,
    stalePendingBefore: string,
    limit: number,
    audit: DocumentLifecycleAuditContext
  ) {
    const repository = await this.getRepository()
    return repository.claimStorageOperationsForCleanup(
      authorization.organizationId,
      this.normalizeAuditActor(authorization, audit),
      stalePendingBefore,
      limit
    )
  }

  private normalizeOperationKey(value: string): string {
    const operationKey = value.trim()
    if (
      operationKey.length < 8
      || operationKey.length > 128
      || !/^[A-Za-z0-9._:-]+$/.test(operationKey)
    ) {
      throw new DocumentTenantInvariantError(400, 'Invalid idempotency key')
    }
    return operationKey
  }

  private normalizeFileVersionPayload(
    payload: DocumentFileVersionPayload
  ): DocumentFileVersionPayload {
    const fileName = payload.fileName.trim()
    const mimeType = payload.mimeType.trim()
    const title = payload.title.trim()
    const description = payload.description?.trim() || null
    const changes = payload.changes?.trim() || null
    if (
      !fileName
      || fileName.length > 255
      || !mimeType
      || mimeType.length > 100
      || !title
      || title.length > 200
      || (description?.length ?? 0) > 10_000
      || (changes?.length ?? 0) > 2_000
      || !Number.isSafeInteger(payload.fileSize)
      || payload.fileSize <= 0
      || (payload.mode !== undefined && payload.mode !== 'normal' && payload.mode !== 'revision')
    ) {
      throw new DocumentTenantInvariantError(400, 'Invalid document file metadata')
    }
    return {
      ...payload,
      fileName,
      mimeType,
      title,
      description,
      changes,
    }
  }
}
