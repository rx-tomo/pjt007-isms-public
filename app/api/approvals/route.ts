import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { ApprovalService, type ApprovalRequestStatus } from '@/lib/services/approval'
import { enrichApprovalQueueItems } from '@/lib/server/approvalQueueContext'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { DocumentApprovalMutationService } from '@/lib/server/documents/documentApprovalMutationService'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'
import {
  isNonDocumentApprovalMutationError,
  NonDocumentApprovalMutationService,
} from '@/lib/server/approvals/nonDocumentApprovalMutationService'

const APPROVAL_VIEWER_ROLES = new Set(['approver', 'org_admin', 'system_operator'])
const REVERT_ROLES = new Set(['org_admin', 'system_operator'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: string | null): ApprovalRequestStatus | undefined {
  if (!value) return undefined
  if (['pending', 'approved', 'rejected', 'expired'].includes(value)) {
    return value as ApprovalRequestStatus
  }
  return undefined
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

function approvalNotFound() {
  return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')
  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const authorization = await resolveTenantAuthorizationContext(db, user.id, organizationId)
  if (!authorization.ok || !APPROVAL_VIEWER_ROLES.has(authorization.context.role)) {
    return applyCookies(forbidden())
  }

  const service = new ApprovalService()
  const status = parseStatus(searchParams.get('status'))
  const requests = await service.listRequests(organizationId, {
    status,
    approverId: authorization.context.role === 'approver' ? user.id : undefined,
  })

  return applyCookies(NextResponse.json(await enrichApprovalQueueItems(
    requests,
    authorization.context
  )))
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null)
    if (!isRecord(body) || typeof body.action !== 'string' || typeof body.requestId !== 'string') {
      return applyCookies(NextResponse.json({ error: 'Invalid approval action payload' }, { status: 400 }))
    }

    const approvalService = new ApprovalService()
    const requestRow = await approvalService.getRequestById(body.requestId)
    if (!requestRow) {
      return applyCookies(NextResponse.json({ error: 'Approval request not found' }, { status: 404 }))
    }

    const db = getDb()
    const authorization = await resolveTenantAuthorizationContext(
      db,
      user.id,
      requestRow.organization_id
    )
    if (
      !authorization.ok
      || !APPROVAL_VIEWER_ROLES.has(authorization.context.role)
      || (
        authorization.context.role === 'approver'
        && requestRow.approver_id !== user.id
      )
    ) {
      return applyCookies(approvalNotFound())
    }

    const nonDocumentService = new NonDocumentApprovalMutationService()

    const action = body.action
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const comment = typeof body.comment === 'string' ? body.comment.trim() : undefined

    if (action === 'approve') {
      if (requestRow.resource_type === 'document') {
        await new DocumentApprovalMutationService().approve(
          authorization.context,
          requestRow.resource_id,
          { comment },
          { userId: user.id, userAgent: request.headers.get('user-agent') },
          requestRow.id
        )
      } else {
        await nonDocumentService.approve(authorization.context, requestRow.id, comment)
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'reject') {
      if (!reason) {
        return applyCookies(NextResponse.json({ error: 'Missing rejection reason' }, { status: 400 }))
      }

      if (requestRow.resource_type === 'document') {
        await new DocumentApprovalMutationService().reject(
          authorization.context,
          requestRow.resource_id,
          { reason },
          { userId: user.id, userAgent: request.headers.get('user-agent') },
          requestRow.id
        )
      } else {
        await nonDocumentService.reject(authorization.context, requestRow.id, reason)
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (action === 'revert') {
      if (!REVERT_ROLES.has(authorization.context.role)) {
        return applyCookies(forbidden())
      }
      if (!reason) {
        return applyCookies(NextResponse.json({ error: 'Missing revert reason' }, { status: 400 }))
      }

      if (requestRow.resource_type === 'document') {
        await new DocumentApprovalMutationService().revert(
          authorization.context,
          requestRow.resource_id,
          { reason },
          { userId: user.id, userAgent: request.headers.get('user-agent') },
          requestRow.id
        )
      } else {
        await nonDocumentService.revert(authorization.context, requestRow.id, reason)
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 }))
  } catch (error) {
    if (isDocumentTenantInvariantError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    if (isNonDocumentApprovalMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Approvals API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update approval request' }, { status: 500 }))
  }
}
