import { getDocumentRepository } from '@/lib/container'
import type {
  DocumentLifecycleAuditContext,
  IDocumentRepository,
} from '@/lib/db/repositories/interfaces/IDocumentRepository'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { DocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'

export class DocumentApprovalMutationService {
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

  private auditFor(
    authorization: TenantAuthorizationContext,
    audit: DocumentLifecycleAuditContext
  ): DocumentLifecycleAuditContext {
    return { ...audit, userId: authorization.userId }
  }

  async requestApproval(
    authorization: TenantAuthorizationContext,
    documentId: string,
    value: unknown,
    audit: DocumentLifecycleAuditContext
  ) {
    const payload = this.normalizeRequestPayload(value)
    return (await this.getRepository()).requestApprovalForTenant(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      payload,
      this.auditFor(authorization, audit)
    )
  }

  async approve(
    authorization: TenantAuthorizationContext,
    documentId: string,
    value: unknown,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ) {
    const comment = this.normalizeOptionalText(value, 'comment')
    const requestId = this.normalizeId(expectedRequestId)
    return (await this.getRepository()).approveForAssignedApprover(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      comment,
      this.auditFor(authorization, audit),
      requestId
    )
  }

  async reject(
    authorization: TenantAuthorizationContext,
    documentId: string,
    value: unknown,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ) {
    const reason = this.normalizeRequiredText(value, 'reason')
    const requestId = this.normalizeId(expectedRequestId)
    return (await this.getRepository()).rejectForAssignedApprover(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      reason,
      this.auditFor(authorization, audit),
      requestId
    )
  }

  async revert(
    authorization: TenantAuthorizationContext,
    documentId: string,
    value: unknown,
    audit: DocumentLifecycleAuditContext,
    expectedRequestId: string
  ) {
    if (!['org_admin', 'system_operator'].includes(authorization.role)) {
      throw new DocumentTenantInvariantError(403, 'Document approval revert is forbidden')
    }
    const reason = this.normalizeRequiredText(
      value,
      'reason',
      'Revert reason is required'
    )
    return (await this.getRepository()).revertTerminalApprovalForTenant(
      documentId,
      authorization.organizationId,
      authorization.departmentAccess,
      reason,
      this.auditFor(authorization, audit),
      expectedRequestId
    )
  }

  private normalizeRequestPayload(value: unknown) {
    const body = this.requireExactObject(value, ['approverId'])
    return {
      approverId: this.normalizeId(body.approverId),
    }
  }

  private normalizeOptionalText(value: unknown, field: string): string | null {
    const body = this.requireExactObject(value, [field])
    const raw = body[field]
    if (raw === undefined || raw === null || raw === '') return null
    if (typeof raw !== 'string') {
      throw new DocumentTenantInvariantError(400, 'Invalid approval payload')
    }
    const text = raw.trim()
    if (text.length > 2_000) {
      throw new DocumentTenantInvariantError(400, 'Invalid approval payload')
    }
    return text || null
  }

  private normalizeRequiredText(
    value: unknown,
    field: string,
    requiredMessage = 'Rejection reason is required'
  ): string {
    const text = this.normalizeOptionalText(value, field)
    if (!text) {
      throw new DocumentTenantInvariantError(400, requiredMessage)
    }
    return text
  }

  private normalizeId(value: unknown): string {
    if (typeof value !== 'string') {
      throw new DocumentTenantInvariantError(400, 'Invalid approval payload')
    }
    const id = value.trim()
    if (!id || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id)) {
      throw new DocumentTenantInvariantError(400, 'Invalid approval payload')
    }
    return id
  }

  private requireExactObject(
    value: unknown,
    allowedKeys: string[]
  ): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new DocumentTenantInvariantError(400, 'Invalid approval payload')
    }
    const body = value as Record<string, unknown>
    if (Object.keys(body).some(key => !allowedKeys.includes(key))) {
      throw new DocumentTenantInvariantError(400, 'Invalid approval payload')
    }
    return body
  }
}
