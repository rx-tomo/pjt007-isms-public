import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
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

async function resolveDocumentAuthorization(userId: string, documentId: string) {
  const documentService = new DocumentTenantMutationService()
  const organizationId = await documentService.getOrganizationId(documentId)
  if (!organizationId) return null
  const authorization = await resolveTenantAuthorizationContext(
    getDb(),
    userId,
    organizationId
  )
  return authorization.ok ? authorization.context : null
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
  const authorization = await resolveDocumentAuthorization(user.id, documentId)
  if (!authorization) {
    return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
  }

  const body = await request.json().catch(() => null)
  if (!isRecord(body) || typeof body.action !== 'string') {
    return applyCookies(NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 }))
  }

  const service = new DocumentApprovalMutationService()
  const audit = {
    userId: user.id,
    userAgent: request.headers.get('user-agent'),
  }

  try {
    if (body.action === 'request') {
      if (!hasOnlyKeys(body, ['action', 'approverId'])) {
        return applyCookies(NextResponse.json({ error: 'Invalid approval payload' }, { status: 400 }))
      }
      const result = await service.requestApproval(
        authorization,
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
        authorization,
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
        authorization,
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
