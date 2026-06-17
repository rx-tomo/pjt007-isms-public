import { getDb } from '@/lib/db/drizzle/client'
import { approvalRequests, approvalEvents } from '@/lib/db/drizzle/schema'
import { eq, and, lt, desc, asc, sql } from 'drizzle-orm'
import { NotificationService } from '@/lib/services/notification'

export type ApprovalResourceType =
  | 'document'
  | 'audit_plan'
  | 'audit_report'
  | 'nonconformity_closure'
  | 'followup_record'
  | 'incident'
  | 'iso_control_soa'
  | 'soa_version'
  | 'risk_residual_acceptance'

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface ApprovalRequest {
  id: string
  organization_id: string
  resource_type: ApprovalResourceType
  resource_id: string
  status: ApprovalRequestStatus
  requested_by: string | null
  requested_at: string
  approver_id: string | null
  approved_at: string | null
  rejection_reason: string | null
  due_at: string | null
  notified_at: string | null
  escalation_notified_at: string | null
  step_number: number | null
  reverted_at: string | null
  revert_reason: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalEvent {
  id: string
  approval_request_id: string
  event_type: 'requested' | 'approved' | 'rejected' | 'expired' | 'reminded' | 'escalated' | 'reverted'
  actor_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

function toApprovalRequest(row: typeof approvalRequests.$inferSelect): ApprovalRequest {
  return {
    id: row.id,
    organization_id: row.organizationId,
    resource_type: row.resourceType as ApprovalResourceType,
    resource_id: row.resourceId,
    status: row.status as ApprovalRequestStatus,
    requested_by: row.requestedBy ?? null,
    requested_at: row.requestedAt,
    approver_id: row.approverId ?? null,
    approved_at: row.approvedAt ?? null,
    rejection_reason: row.rejectionReason ?? null,
    due_at: row.dueAt ?? null,
    notified_at: row.notifiedAt ?? null,
    escalation_notified_at: row.escalationNotifiedAt ?? null,
    step_number: row.stepNumber ?? null,
    reverted_at: row.revertedAt ?? null,
    revert_reason: row.revertReason ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  }
}

function toApprovalEvent(row: typeof approvalEvents.$inferSelect): ApprovalEvent {
  let payload: Record<string, unknown> = {}
  if (row.payload) {
    try {
      payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    } catch { /* ignore */ }
  }
  return {
    id: row.id,
    approval_request_id: row.approvalRequestId,
    event_type: row.eventType as ApprovalEvent['event_type'],
    actor_id: row.actorId ?? null,
    payload,
    created_at: row.createdAt
  }
}

export class ApprovalService {
  private getDb() {
    return getDb()
  }

  async listRequests(
    organizationId: string,
    options?: {
      status?: ApprovalRequestStatus
      approverId?: string
      resourceType?: ApprovalResourceType
    }
  ): Promise<ApprovalRequest[]> {
    const db = this.getDb()
    const conditions = [eq(approvalRequests.organizationId, organizationId)]

    if (options?.status) {
      conditions.push(eq(approvalRequests.status, options.status))
    }
    if (options?.approverId) {
      conditions.push(eq(approvalRequests.approverId, options.approverId))
    }
    if (options?.resourceType) {
      conditions.push(eq(approvalRequests.resourceType, options.resourceType))
    }

    const rows = await db
      .select()
      .from(approvalRequests)
      .where(and(...conditions))
      .orderBy(desc(approvalRequests.requestedAt))

    return rows.map(toApprovalRequest)
  }

  async getRequestById(id: string): Promise<ApprovalRequest | null> {
    const db = this.getDb()
    const rows = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1)

    return rows[0] ? toApprovalRequest(rows[0]) : null
  }

  async createRequest(input: {
    organization_id: string
    resource_type: ApprovalResourceType
    resource_id: string
    requested_by?: string | null
    approver_id?: string | null
    due_at?: string | null
    step_number?: number | null
    status?: ApprovalRequestStatus
  }): Promise<ApprovalRequest> {
    const db = this.getDb()

    // For due_at calculation, we use a simple default of 7 days from now
    // (the old legacy RPC 'calculate_approval_due_at' is replaced with this logic)
    let dueAt = input.due_at ?? null
    if (!dueAt) {
      const defaultDue = new Date()
      defaultDue.setDate(defaultDue.getDate() + 7)
      dueAt = defaultDue.toISOString()
    }

    const requestStatus = input.status ?? 'pending'
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    await db.insert(approvalRequests).values({
      id,
      organizationId: input.organization_id,
      resourceType: input.resource_type,
      resourceId: input.resource_id,
      requestedBy: input.requested_by ?? null,
      approverId: input.approver_id ?? null,
      status: requestStatus,
      dueAt,
      stepNumber: input.step_number ?? null,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    const [inserted] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1)

    if (!inserted) {
      throw new Error('Failed to create approval request')
    }

    await this.appendEvent({
      approval_request_id: inserted.id,
      event_type: 'requested',
      actor_id: input.requested_by ?? null,
      payload: {
        approver_id: input.approver_id ?? null,
        due_at: dueAt,
        ...(input.step_number != null ? { step_number: input.step_number } : {})
      }
    })

    return toApprovalRequest(inserted)
  }

  /**
   * List approval requests for a specific resource, ordered by step_number
   */
  async listRequestsByResource(
    organizationId: string,
    resourceType: ApprovalResourceType,
    resourceId: string
  ): Promise<ApprovalRequest[]> {
    const db = this.getDb()
    const rows = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.resourceType, resourceType),
          eq(approvalRequests.resourceId, resourceId)
        )
      )
      .orderBy(asc(approvalRequests.stepNumber), asc(approvalRequests.requestedAt))

    return rows.map(toApprovalRequest)
  }

  /**
   * Reject all pending approval requests for a given resource
   */
  async rejectAllPendingForResource(
    organizationId: string,
    resourceType: ApprovalResourceType,
    resourceId: string,
    actorId: string,
    reason: string
  ): Promise<void> {
    const pendingRequests = await this.listRequests(organizationId, {
      status: 'pending',
      resourceType
    })
    const resourceRequests = pendingRequests.filter(r => r.resource_id === resourceId)
    await Promise.all(
      resourceRequests.map(request =>
        this.rejectRequest({
          requestId: request.id,
          actorId,
          reason
        })
      )
    )
  }

  async approveRequest(input: {
    requestId: string
    actorId: string
    comment?: string
  }): Promise<ApprovalRequest> {
    const db = this.getDb()
    const now = new Date().toISOString()

    await db
      .update(approvalRequests)
      .set({
        status: 'approved',
        approvedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(approvalRequests.id, input.requestId))

    const [updated] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, input.requestId))
      .limit(1)

    if (!updated) {
      throw new Error('Failed to approve request')
    }

    await this.appendEvent({
      approval_request_id: updated.id,
      event_type: 'approved',
      actor_id: input.actorId,
      payload: input.comment ? { comment: input.comment } : {}
    })

    return toApprovalRequest(updated)
  }

  async rejectRequest(input: {
    requestId: string
    actorId: string
    reason: string
  }): Promise<ApprovalRequest> {
    const db = this.getDb()
    const now = new Date().toISOString()

    await db
      .update(approvalRequests)
      .set({
        status: 'rejected',
        rejectionReason: input.reason,
        approvedAt: null,
        updatedAt: now,
      })
      .where(eq(approvalRequests.id, input.requestId))

    const [updated] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, input.requestId))
      .limit(1)

    if (!updated) {
      throw new Error('Failed to reject request')
    }

    await this.appendEvent({
      approval_request_id: updated.id,
      event_type: 'rejected',
      actor_id: input.actorId,
      payload: { reason: input.reason }
    })

    return toApprovalRequest(updated)
  }

  /**
   * Revert an approved or rejected request back to pending.
   * Only org_admin / system_operator should call this (enforced at UI).
   * Self-revert is not allowed.
   */
  async revertApprovalRequest(input: {
    requestId: string
    revertedBy: string
    reason: string
    organizationId: string
  }): Promise<ApprovalRequest> {
    const db = this.getDb()

    // 1. Fetch and validate
    const existing = await this.getRequestById(input.requestId)
    if (!existing) {
      throw new Error('承認リクエストが見つかりません')
    }
    if (existing.organization_id !== input.organizationId) {
      throw new Error('組織が一致しません')
    }
    if (existing.status !== 'approved' && existing.status !== 'rejected') {
      throw new Error('差し戻し対象は承認済みまたは却下済みのリクエストのみです')
    }

    // 2. Prevent self-revert
    if (existing.approver_id === input.revertedBy) {
      throw new Error('自分が処理した承認を差し戻すことはできません')
    }

    const now = new Date().toISOString()

    // 3. Revert to pending
    await db
      .update(approvalRequests)
      .set({
        status: 'pending',
        approvedAt: null,
        rejectionReason: null,
        revertedAt: now,
        revertReason: input.reason,
        updatedAt: now,
      })
      .where(eq(approvalRequests.id, input.requestId))

    const [updated] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, input.requestId))
      .limit(1)

    if (!updated) {
      throw new Error('差し戻しに失敗しました')
    }

    // 4. Record revert event
    await this.appendEvent({
      approval_request_id: input.requestId,
      event_type: 'reverted',
      actor_id: input.revertedBy,
      payload: {
        reason: input.reason,
        previous_status: existing.status
      }
    })

    return toApprovalRequest(updated)
  }

  async listEvents(approvalRequestId: string): Promise<ApprovalEvent[]> {
    const db = this.getDb()
    const rows = await db
      .select()
      .from(approvalEvents)
      .where(eq(approvalEvents.approvalRequestId, approvalRequestId))
      .orderBy(asc(approvalEvents.createdAt))

    return rows.map(toApprovalEvent)
  }

  async resolveEscalationUserIds(input: {
    organizationId: string
    resourceType: ApprovalResourceType
    departmentManagerId?: string | null
  }): Promise<string[]> {
    // Replace the old RPC-based escalation resolver with repository-backed lookup.
    // with a direct Drizzle query on approval_escalation_rules
    const db = this.getDb()
    const { approvalEscalationRules, userProfiles } = await import('@/lib/db/drizzle/schema')

    const rules = await db
      .select()
      .from(approvalEscalationRules)
      .where(
        and(
          eq(approvalEscalationRules.organizationId, input.organizationId),
          eq(approvalEscalationRules.resourceType, input.resourceType),
          eq(approvalEscalationRules.isActive, true)
        )
      )
      .limit(1)

    if (rules.length === 0) {
      return []
    }

    const rule = rules[0]
    const userIds: string[] = []

    // Direct user escalation
    if (rule.escalationTargetType === 'user' && rule.escalationUserId) {
      userIds.push(rule.escalationUserId)
    }

    // Department manager
    if (rule.escalationTargetType === 'department_manager' && input.departmentManagerId) {
      userIds.push(input.departmentManagerId)
    }

    // Role flag escalation (e.g., 'is_ciso', 'is_security_manager')
    if (rule.escalationTargetType === 'role_flag' && rule.escalationRoleFlag) {
      const flagColumn = rule.escalationRoleFlag
      // Query users with the specific role flag set to true
      const flaggedUsers = await db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.organizationId, input.organizationId),
            eq(userProfiles.isActive, true),
            // Use raw SQL for dynamic column name
            sql`${sql.raw(flagColumn)} = 1`
          )
        )

      for (const u of flaggedUsers) {
        userIds.push(u.id)
      }
    }

    return [...new Set(userIds)]
  }

  // ============================================
  // Escalation helpers
  // ============================================

  /**
   * Get overdue pending approval requests
   */
  async getOverdueApprovals(): Promise<ApprovalRequest[]> {
    const db = this.getDb()
    const now = new Date().toISOString()

    const rows = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.status, 'pending'),
          lt(approvalRequests.dueAt, now)
        )
      )
      .orderBy(asc(approvalRequests.dueAt))

    return rows.map(toApprovalRequest)
  }

  /**
   * Escalate an approval request (send notifications + record event).
   * Returns false if already escalated.
   */
  async escalateApproval(requestId: string): Promise<boolean> {
    const request = await this.getRequestById(requestId)
    if (!request) {
      throw new Error(`Approval request not found: ${requestId}`)
    }

    // Prevent duplicate escalation
    const events = await this.listEvents(requestId)
    const alreadyEscalated = events.some(e => e.event_type === 'escalated')
    if (alreadyEscalated) {
      return false
    }

    // Resolve escalation target users
    const escalationUserIds = await this.resolveEscalationUserIds({
      organizationId: request.organization_id,
      resourceType: request.resource_type as ApprovalResourceType,
      departmentManagerId: null
    })

    if (escalationUserIds.length === 0) {
      console.warn(`[escalation] No escalation users found for request ${requestId}`)
      return false
    }

    // Send notification to each escalation target
    const resourceLink = this.buildResourceLink(request.resource_type, request.resource_id)

    await Promise.all(
      escalationUserIds.map(userId =>
        NotificationService.createNotification({
          organization_id: request.organization_id,
          user_id: userId,
          title: '承認エスカレーション',
          message: `承認リクエスト（${request.resource_type}）が期限を超過しています。対応をお願いします。`,
          type: 'system',
          priority: 'urgent',
          link: resourceLink,
          metadata: {
            approval_request_id: request.id,
            resource_type: request.resource_type,
            resource_id: request.resource_id,
            due_at: request.due_at
          }
        })
      )
    )

    // Record escalation event
    await this.appendEvent({
      approval_request_id: requestId,
      event_type: 'escalated',
      actor_id: null,
      payload: {
        escalation_user_ids: escalationUserIds,
        due_at: request.due_at
      }
    })

    return true
  }

  private buildResourceLink(resourceType: string, resourceId: string): string {
    switch (resourceType) {
      case 'incident':
        return `/incidents/${resourceId}`
      case 'document':
        return `/documents/${resourceId}`
      case 'audit_plan':
        return `/audit/plans/${resourceId}`
      case 'audit_report':
        return `/audit/plans/${resourceId}/report`
      default:
        return `/approvals`
    }
  }

  private async appendEvent(input: {
    approval_request_id: string
    event_type: ApprovalEvent['event_type']
    actor_id?: string | null
    payload?: Record<string, unknown>
  }): Promise<void> {
    const db = this.getDb()
    await db.insert(approvalEvents).values({
      id: crypto.randomUUID(),
      approvalRequestId: input.approval_request_id,
      eventType: input.event_type,
      actorId: input.actor_id ?? null,
      payload: JSON.stringify(input.payload ?? {}),
      createdAt: new Date().toISOString(),
    })
  }
}
