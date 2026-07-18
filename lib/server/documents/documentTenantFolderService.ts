import { getDocumentRepository } from '@/lib/container'
import type {
  DocumentLifecycleAuditContext,
  IDocumentRepository,
} from '@/lib/db/repositories/interfaces/IDocumentRepository'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import {
  normalizeDocumentFolderCreateInput,
  normalizeDocumentFolderUpdateInput,
} from '@/lib/services/documentFolderInvariant'

export class DocumentTenantFolderService {
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

  private auditForActor(
    authorization: TenantAuthorizationContext,
    audit: DocumentLifecycleAuditContext
  ): DocumentLifecycleAuditContext {
    return { ...audit, userId: authorization.userId }
  }

  async createFolder(
    authorization: TenantAuthorizationContext,
    value: unknown,
    audit: DocumentLifecycleAuditContext
  ) {
    const repository = await this.getRepository()
    return repository.createFolderForTenant(
      authorization.organizationId,
      authorization.departmentAccess,
      normalizeDocumentFolderCreateInput(value),
      this.auditForActor(authorization, audit)
    )
  }

  async updateFolder(
    authorization: TenantAuthorizationContext,
    folderId: string,
    value: unknown,
    audit: DocumentLifecycleAuditContext
  ) {
    const repository = await this.getRepository()
    return repository.updateFolderForTenant(
      folderId,
      authorization.organizationId,
      authorization.departmentAccess,
      normalizeDocumentFolderUpdateInput(value),
      this.auditForActor(authorization, audit)
    )
  }

  async deleteFolder(
    authorization: TenantAuthorizationContext,
    folderId: string,
    audit: DocumentLifecycleAuditContext
  ): Promise<void> {
    const repository = await this.getRepository()
    await repository.deleteFolderForTenant(
      folderId,
      authorization.organizationId,
      authorization.departmentAccess,
      this.auditForActor(authorization, audit)
    )
  }
}
