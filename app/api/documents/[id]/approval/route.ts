import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
  type TenantAction,
} from '@/lib/server/auth/actionPolicy'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { DocumentApprovalMutationService } from '@/lib/server/documents/documentApprovalMutationService'
import { DocumentTenantMutationService } from '@/lib/server/documents/documentTenantMutationService'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'

type Params = { id: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(body: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(body).every(key => allowed.includes(key))
}

async function resolveDocumentAuthorization(
  userId: string,
  documentId: string,
  action: TenantAction
) {
  const documentService = new DocumentTenantMutationService()
  const organizationId = await documentService.getOrganizationId(documentId)
  if (!organizationId) return { ok: false as const, status: 404 as const }
  // 存在秘匿（設計 §4.4）: スコープ外リソースへの決裁は、権限判定より先に404で返す。
  // 「見えない対象」に403を返すと対象の存在が漏れるため、可視性検査を前段に置く。
  // 可視性を確認したあとの認可判定は authorizeTenantAction に集約したままにする。
  const tenantContext = await resolveTenantAuthorizationContext(
    getDb(),
    userId,
    organizationId
  )
  if (!tenantContext.ok) return { ok: false as const, status: 404 as const }
  const visibleDocument = await documentService.getDocument(
    tenantContext.context,
    documentId
  )
  if (!visibleDocument) return { ok: false as const, status: 404 as const }
  const authorization = await authorizeTenantAction(
    getDb(),
    userId,
    organizationId,
    action
  )
  if (!authorization.ok) {
    return {
      ok: false as const,
      status: tenantActionDenialStatus(authorization),
    }
  }
  return { ok: true as const, context: authorization.context }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { id: documentId } = await context.params
  if (!documentId) {
    return applyCookies(NextResponse.json({ error: 'Invalid request' }, { status: 400 }))
  }
  const body = await request.json().catch(() => null)
  if (!isRecord(body) || typeof body.action !== 'string') {
    return applyCookies(NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 }))
  }
  if (!['request', 'approve', 'reject'].includes(body.action)) {
    return applyCookies(NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 }))
  }
  const requiredAction: TenantAction = body.action === 'request'
    ? 'documents.update'
    : 'approvals.decide'
  const service = new DocumentApprovalMutationService()
  const audit = {
    userId: user.id,
    userAgent: request.headers.get('user-agent'),
  }

  try {
    const authorization = await resolveDocumentAuthorization(
      user.id,
      documentId,
      requiredAction
    )
    if (!authorization.ok) {
      return applyCookies(NextResponse.json(
        { error: authorization.status === 403 ? 'Forbidden' : 'Not found' },
        { status: authorization.status }
      ))
    }

    if (body.action === 'request') {
      if (!hasOnlyKeys(body, ['action', 'approverId'])) {
        return applyCookies(NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 }))
      }
      const result = await service.requestApproval(
        authorization.context,
        documentId,
        {
          approverId: body.approverId,
        },
        audit
      )
      return applyCookies(NextResponse.json({
        ok: true,
        data: { status: result.document.status, currentApproverId: result.currentApproverId },
      }))
    }

    if (body.action === 'approve') {
      if (
        !hasOnlyKeys(body, ['action', 'expectedRequestId', 'comment'])
        || typeof body.expectedRequestId !== 'string'
        || !body.expectedRequestId.trim()
      ) {
        return applyCookies(NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 }))
      }
      const result = await service.approve(
        authorization.context,
        documentId,
        { comment: body.comment },
        audit,
        body.expectedRequestId
      )
      return applyCookies(NextResponse.json({
        ok: true,
        data: { status: result.document.status, currentApproverId: result.currentApproverId },
      }))
    }

    if (body.action === 'reject') {
      if (
        !hasOnlyKeys(body, ['action', 'expectedRequestId', 'reason'])
        || typeof body.expectedRequestId !== 'string'
        || !body.expectedRequestId.trim()
      ) {
        return applyCookies(NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 }))
      }
      const result = await service.reject(
        authorization.context,
        documentId,
        { reason: body.reason },
        audit,
        body.expectedRequestId
      )
      return applyCookies(NextResponse.json({
        ok: true,
        data: { status: result.document.status, currentApproverId: result.currentApproverId },
      }))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 }))
  } catch (error) {
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Document approval API failed')
    return applyCookies(NextResponse.json(
      { error: 'Failed to process document approval' },
      { status: 500 }
    ))
  }
}
