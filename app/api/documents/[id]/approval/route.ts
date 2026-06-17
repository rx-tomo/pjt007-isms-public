import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  documents,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import { ApprovalService, type ApprovalRequest } from '@/lib/services/approval'
import { NotificationService } from '@/lib/services/notification'

type ApprovalActionPayload =
  | { action: 'request'; step1ApproverId?: string; step2ApproverId?: string }
  | { action: 'approve'; comment?: string }
  | { action: 'reject'; reason?: string }

const approvalService = new ApprovalService()

function resolveCurrentPendingApprovalRequest(
  requests: Array<Pick<ApprovalRequest, 'id' | 'step_number' | 'approver_id' | 'status'>>
) {
  return requests
    .filter((request) => request.status === 'pending')
    .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))[0] ?? null
}

async function assertOrganizationAccess(userId: string, organizationId: string) {
  const db = getDb()
  const [[profile], [membership]] = await Promise.all([
    db
      .select({ organizationId: userProfiles.organizationId })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  return profile?.organizationId === organizationId || Boolean(membership)
}

async function logDocumentApprovalEvent(input: {
  organizationId: string
  userId: string
  action: string
  documentId: string
  changes: Record<string, unknown>
}) {
  const db = getDb()
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    userId: input.userId,
    action: input.action,
    resourceType: 'document',
    resourceId: input.documentId,
    changes: JSON.stringify(input.changes),
    createdAt: new Date().toISOString(),
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { id: documentId } = await context.params
  if (!documentId) {
    return applyCookies(NextResponse.json({ error: 'Missing document id' }, { status: 400 }))
  }

  let payload: ApprovalActionPayload
  try {
    payload = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }))
  }

  const db = getDb()
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!document) {
    return applyCookies(NextResponse.json({ error: 'Document not found' }, { status: 404 }))
  }

  const hasAccess = await assertOrganizationAccess(user.id, document.organizationId)
  if (!hasAccess) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  try {
    if (payload.action === 'request') {
      const step1ApproverId = payload.step1ApproverId?.trim()
      const step2ApproverId = payload.step2ApproverId?.trim()

      if (!step1ApproverId || !step2ApproverId) {
        return applyCookies(NextResponse.json({ error: '承認者を選択してください' }, { status: 400 }))
      }

      if (document.status !== 'draft') {
        return applyCookies(NextResponse.json({ error: '下書き状態の文書のみ承認依頼できます' }, { status: 400 }))
      }

      const existingRequests = await approvalService.listRequestsByResource(
        document.organizationId,
        'document',
        documentId
      )

      if (existingRequests.some((approvalRequest) => approvalRequest.status === 'pending')) {
        return applyCookies(NextResponse.json({ error: '承認フローが既に開始されています' }, { status: 409 }))
      }

      if (existingRequests.length > 0) {
        await approvalService.rejectAllPendingForResource(
          document.organizationId,
          'document',
          documentId,
          user.id,
          'Resubmitted approval workflow'
        )
      }

      if (step1ApproverId === step2ApproverId) {
        await approvalService.createRequest({
          organization_id: document.organizationId,
          resource_type: 'document',
          resource_id: documentId,
          requested_by: user.id,
          approver_id: step1ApproverId,
          step_number: 1,
          status: 'approved',
        })
        await approvalService.createRequest({
          organization_id: document.organizationId,
          resource_type: 'document',
          resource_id: documentId,
          requested_by: user.id,
          approver_id: step2ApproverId,
          step_number: 2,
        })
      } else {
        await approvalService.createRequest({
          organization_id: document.organizationId,
          resource_type: 'document',
          resource_id: documentId,
          requested_by: user.id,
          approver_id: step1ApproverId,
          step_number: 1,
        })
        await approvalService.createRequest({
          organization_id: document.organizationId,
          resource_type: 'document',
          resource_id: documentId,
          requested_by: user.id,
          approver_id: step2ApproverId,
          step_number: 2,
        })
      }

      await db
        .update(documents)
        .set({
          status: 'in_review',
          approvedBy: null,
          approvedAt: null,
          updatedBy: user.id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(documents.id, documentId))

      await logDocumentApprovalEvent({
        organizationId: document.organizationId,
        userId: user.id,
        action: 'document.approval_requested',
        documentId,
        changes: {
          step1_approver: step1ApproverId,
          step2_approver: step2ApproverId,
          skipped_step1: step1ApproverId === step2ApproverId,
        },
      })

      const freshRequests = await approvalService.listRequestsByResource(
        document.organizationId,
        'document',
        documentId
      )
      const firstPending = resolveCurrentPendingApprovalRequest(freshRequests)
      if (firstPending?.approver_id) {
        await NotificationService.createDocumentApprovalRequest(
          document.organizationId,
          firstPending.approver_id,
          document.title,
          documentId,
          user.id
        )
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (payload.action === 'approve') {
      const requests = await approvalService.listRequestsByResource(
        document.organizationId,
        'document',
        documentId
      )
      const currentRequest = resolveCurrentPendingApprovalRequest(requests)
      if (!currentRequest || currentRequest.approver_id !== user.id) {
        return applyCookies(NextResponse.json({ error: '現在の承認ステップではありません' }, { status: 403 }))
      }

      await approvalService.approveRequest({
        requestId: currentRequest.id,
        actorId: user.id,
        comment: payload.comment?.trim() || undefined,
      })

      const refreshedRequests = await approvalService.listRequestsByResource(
        document.organizationId,
        'document',
        documentId
      )
      const pendingRequests = refreshedRequests.filter((approvalRequest) => approvalRequest.status === 'pending')

      if (pendingRequests.length === 0) {
        const nowIso = new Date().toISOString()
        await db
          .update(documents)
          .set({
            status: 'approved',
            approvedBy: user.id,
            approvedAt: nowIso,
            updatedBy: user.id,
            updatedAt: nowIso,
          })
          .where(eq(documents.id, documentId))

        await logDocumentApprovalEvent({
          organizationId: document.organizationId,
          userId: user.id,
          action: 'document.approved',
          documentId,
          changes: { approved_by: user.id },
        })
      } else {
        const nextRequest = resolveCurrentPendingApprovalRequest(refreshedRequests)
        if (nextRequest?.approver_id) {
          await NotificationService.createDocumentApprovalRequest(
            document.organizationId,
            nextRequest.approver_id,
            document.title,
            documentId,
            user.id
          )
        }
      }

      return applyCookies(NextResponse.json({ ok: true }))
    }

    if (payload.action === 'reject') {
      const requests = await approvalService.listRequestsByResource(
        document.organizationId,
        'document',
        documentId
      )
      const currentRequest = resolveCurrentPendingApprovalRequest(requests)
      if (!currentRequest || currentRequest.approver_id !== user.id) {
        return applyCookies(NextResponse.json({ error: '現在の承認ステップではありません' }, { status: 403 }))
      }

      const reason = payload.reason?.trim() || 'Rejected'
      await approvalService.rejectRequest({
        requestId: currentRequest.id,
        actorId: user.id,
        reason,
      })
      await approvalService.rejectAllPendingForResource(
        document.organizationId,
        'document',
        documentId,
        user.id,
        reason
      )

      await db
        .update(documents)
        .set({
          status: 'draft',
          approvedBy: null,
          approvedAt: null,
          updatedBy: user.id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(documents.id, documentId))

      await logDocumentApprovalEvent({
        organizationId: document.organizationId,
        userId: user.id,
        action: 'document.rejected',
        documentId,
        changes: { reason },
      })

      return applyCookies(NextResponse.json({ ok: true }))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch (error) {
    console.error('Document approval API failed', error)
    const message = error instanceof Error ? error.message : 'Failed to process document approval'
    return applyCookies(NextResponse.json({ error: message }, { status: 500 }))
  }
}
