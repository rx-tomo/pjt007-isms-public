import { getDb } from '@/lib/db/drizzle/client'
import { incidents, incidentLinks, approvalRequests, userProfiles } from '@/lib/db/drizzle/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { ApprovalService, type ApprovalRequestStatus } from '@/lib/services/approval'
import { NotificationService } from '@/lib/services/notification'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'draft' | 'in_progress' | 'resolved' | 'closed'
export type IncidentApprovalStatus = ApprovalRequestStatus | 'none'
export type IncidentLinkType = 'task' | 'risk' | 'asset'

export interface IncidentLink {
  id: string
  incident_id: string
  link_type: IncidentLinkType
  link_id: string
  created_at: string
}

export interface IncidentRecord {
  id: string
  organization_id: string
  title: string
  description: string | null
  occurred_at: string
  severity: IncidentSeverity
  status: IncidentStatus
  reporter_id: string | null
  created_at: string
  updated_at: string
  approval_status?: IncidentApprovalStatus
  approval_due_at?: string | null
  approval_approver_id?: string | null
  approval_request_id?: string | null
}

/** Map Drizzle incident row to service interface */
function mapIncidentRow(row: typeof incidents.$inferSelect): IncidentRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    title: row.title,
    description: row.description ?? null,
    occurred_at: row.occurredAt,
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    reporter_id: row.reporterId ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapIncidentLinkRow(row: typeof incidentLinks.$inferSelect): IncidentLink {
  return {
    id: row.id,
    incident_id: row.incidentId,
    link_type: row.linkType as IncidentLinkType,
    link_id: row.linkId,
    created_at: row.createdAt,
  }
}

export class IncidentService {
  private approvalService: ApprovalService

  constructor() {
    this.approvalService = new ApprovalService()
  }

  private async enrichWithApprovalState(records: IncidentRecord[]): Promise<IncidentRecord[]> {
    if (records.length === 0) return records

    const organizationId = records[0]?.organization_id
    if (!organizationId) return records

    const incidentIds = records.map(record => record.id)
    const db = getDb()

    try {
      const data = await db
        .select({
          id: approvalRequests.id,
          resourceId: approvalRequests.resourceId,
          status: approvalRequests.status,
          dueAt: approvalRequests.dueAt,
          approverId: approvalRequests.approverId,
          requestedAt: approvalRequests.requestedAt,
        })
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.organizationId, organizationId),
            eq(approvalRequests.resourceType, 'incident'),
            inArray(approvalRequests.resourceId, incidentIds)
          )
        )
        .orderBy(desc(approvalRequests.requestedAt))

      const latestByIncidentId = new Map<string, {
        id: string
        status: IncidentApprovalStatus
        due_at: string | null
        approver_id: string | null
      }>()

      data.forEach((row) => {
        if (!row.resourceId || latestByIncidentId.has(row.resourceId)) return
        latestByIncidentId.set(row.resourceId, {
          id: row.id,
          status: row.status as IncidentApprovalStatus,
          due_at: row.dueAt ?? null,
          approver_id: row.approverId ?? null
        })
      })

      return records.map(record => {
        const approval = latestByIncidentId.get(record.id)
        if (!approval) {
          return {
            ...record,
            approval_status: 'none' as const,
            approval_due_at: null,
            approval_approver_id: null,
            approval_request_id: null
          }
        }
        return {
          ...record,
          approval_status: approval.status,
          approval_due_at: approval.due_at,
          approval_approver_id: approval.approver_id,
          approval_request_id: approval.id
        }
      })
    } catch (error) {
      console.error('Failed to load incident approval states', error)
      return records
    }
  }

  private async resolveIncidentApproverId(input: {
    organizationId: string
    departmentManagerId?: string | null
  }): Promise<string | null> {
    try {
      const userIds = await this.approvalService.resolveEscalationUserIds({
        organizationId: input.organizationId,
        resourceType: 'incident',
        departmentManagerId: input.departmentManagerId ?? null
      })
      return userIds[0] ?? null
    } catch (error) {
      console.error('Failed to resolve incident approver from escalation rules', error)
      return null
    }
  }

  private async notifyIncidentApproval(input: {
    organizationId: string
    incidentId: string
    title: string
    approverId: string
    requesterId?: string | null
  }): Promise<void> {
    await NotificationService.createNotification({
      organization_id: input.organizationId,
      user_id: input.approverId,
      title: 'インシデント承認依頼',
      message: `インシデント「${input.title}」の承認が必要です。`,
      type: 'system',
      priority: 'high',
      link: `/incidents/${input.incidentId}`,
      metadata: {
        incident_id: input.incidentId,
        requester_id: input.requesterId ?? null
      }
    })

    const db = getDb()
    const orgAdmins = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.organizationId, input.organizationId),
          eq(userProfiles.role, 'org_admin'),
          eq(userProfiles.isActive, true)
        )
      )

    const ccTargets = orgAdmins
      .map((admin) => admin.id)
      .filter((id): id is string => Boolean(id))
      .filter((id) => id !== input.approverId)

    await Promise.all(
      ccTargets.map((userId: string) =>
        NotificationService.createNotification({
          organization_id: input.organizationId,
          user_id: userId,
          title: 'インシデント承認申請（CC）',
          message: `インシデント「${input.title}」の承認申請が送信されました。`,
          type: 'system',
          priority: 'medium',
          link: `/incidents/${input.incidentId}`,
          metadata: {
            incident_id: input.incidentId,
            approver_id: input.approverId
          }
        })
      )
    )
  }

  private async getIncidentByIdRaw(id: string): Promise<IncidentRecord> {
    const db = getDb()
    const rows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1)

    if (!rows[0]) {
      throw new Error(`Incident not found: ${id}`)
    }

    return mapIncidentRow(rows[0])
  }

  async list(organizationId: string) {
    const db = getDb()
    const rows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.organizationId, organizationId))
      .orderBy(desc(incidents.occurredAt))

    return this.enrichWithApprovalState(rows.map(mapIncidentRow))
  }

  async getById(id: string) {
    const record = await this.getIncidentByIdRaw(id)
    const [withApproval] = await this.enrichWithApprovalState([record])
    return withApproval
  }

  async create(input: {
    organization_id: string
    title: string
    description?: string
    occurred_at: string
    severity: IncidentSeverity
    status?: IncidentStatus
    reporter_id?: string | null
    approver_id?: string | null
    department_manager_id?: string | null
  }) {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(incidents)
      .values({
        id,
        organizationId: input.organization_id,
        title: input.title,
        description: input.description ?? null,
        occurredAt: input.occurred_at,
        severity: input.severity,
        status: input.status ?? 'draft',
        reporterId: input.reporter_id ?? null,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create incident')
    }

    const incident = mapIncidentRow(rows[0])

    const approverId =
      input.approver_id ??
      await this.resolveIncidentApproverId({
        organizationId: incident.organization_id,
        departmentManagerId: input.department_manager_id ?? null
      })

    if (approverId) {
      await this.approvalService.createRequest({
        organization_id: incident.organization_id,
        resource_type: 'incident',
        resource_id: incident.id,
        requested_by: input.reporter_id ?? null,
        approver_id: approverId
      })

      await this.notifyIncidentApproval({
        organizationId: incident.organization_id,
        incidentId: incident.id,
        title: incident.title,
        approverId,
        requesterId: input.reporter_id ?? null
      })
    }

    const [withApproval] = await this.enrichWithApprovalState([incident])
    return withApproval
  }

  async updateStatus(id: string, status: IncidentStatus): Promise<IncidentRecord> {
    const db = getDb()
    const rows = await db
      .update(incidents)
      .set({ status })
      .where(eq(incidents.id, id))
      .returning()

    if (!rows[0]) {
      throw new Error(`Incident not found: ${id}`)
    }

    const [withApproval] = await this.enrichWithApprovalState([mapIncidentRow(rows[0])])
    return withApproval
  }

  async approveIncident(input: {
    incidentId: string
    actorId: string
    comment?: string
  }): Promise<void> {
    const incident = await this.getIncidentByIdRaw(input.incidentId)

    const requests = await this.approvalService.listRequests(incident.organization_id, {
      status: 'pending',
      resourceType: 'incident',
      approverId: input.actorId
    })
    const targetRequest = requests.find(request => request.resource_id === input.incidentId)
    if (!targetRequest) {
      throw new Error('承認対象のインシデントが見つかりません')
    }

    await this.approvalService.approveRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      comment: input.comment
    })

    if (incident.status === 'draft') {
      await this.updateStatus(input.incidentId, 'in_progress')
    }
  }

  async rejectIncident(input: {
    incidentId: string
    actorId: string
    reason: string
  }): Promise<void> {
    const incident = await this.getIncidentByIdRaw(input.incidentId)

    const requests = await this.approvalService.listRequests(incident.organization_id, {
      status: 'pending',
      resourceType: 'incident',
      approverId: input.actorId
    })
    const targetRequest = requests.find(request => request.resource_id === input.incidentId)
    if (!targetRequest) {
      throw new Error('却下対象のインシデントが見つかりません')
    }

    await this.approvalService.rejectRequest({
      requestId: targetRequest.id,
      actorId: input.actorId,
      reason: input.reason
    })

    if (incident.status !== 'draft') {
      await this.updateStatus(input.incidentId, 'draft')
    }
  }

  // ============================================
  // Incident Links CRUD
  // ============================================

  /**
   * Get all links for a given incident.
   */
  async getIncidentLinks(incidentId: string): Promise<IncidentLink[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(incidentLinks)
      .where(eq(incidentLinks.incidentId, incidentId))
      .orderBy(incidentLinks.createdAt)

    return rows.map(mapIncidentLinkRow)
  }

  /**
   * Create a link between an incident and a target resource (task, risk, or asset).
   */
  async createIncidentLink(
    incidentId: string,
    linkType: IncidentLinkType,
    targetId: string
  ): Promise<IncidentLink> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(incidentLinks)
      .values({
        id,
        incidentId,
        linkType,
        linkId: targetId,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create incident link')
    }

    const link = mapIncidentLinkRow(rows[0])

    // リンク追加通知を送信
    try {
      await this.notifyIncidentLinkChange({
        incidentId,
        linkType,
        linkId: targetId,
        action: 'added'
      })
    } catch (notifyError) {
      console.error('Failed to send incident link creation notification', notifyError)
    }

    return link
  }

  /**
   * Delete a link by its ID.
   */
  async deleteIncidentLink(linkId: string): Promise<void> {
    const db = getDb()

    // 削除前にリンク情報を取得（通知用）
    const linkRows = await db
      .select()
      .from(incidentLinks)
      .where(eq(incidentLinks.id, linkId))
      .limit(1)

    const linkRecord = linkRows[0] ? mapIncidentLinkRow(linkRows[0]) : null

    // 削除実行
    await db
      .delete(incidentLinks)
      .where(eq(incidentLinks.id, linkId))

    // リンク削除通知を送信
    if (linkRecord) {
      try {
        await this.notifyIncidentLinkChange({
          incidentId: linkRecord.incident_id,
          linkType: linkRecord.link_type as IncidentLinkType,
          linkId: linkRecord.link_id,
          action: 'removed'
        })
      } catch (notifyError) {
        console.error('Failed to send incident link deletion notification', notifyError)
      }
    }
  }

  // ============================================
  // Link change notification
  // ============================================

  private static linkTypeLabel(linkType: IncidentLinkType): string {
    switch (linkType) {
      case 'task':
        return 'タスク'
      case 'risk':
        return 'リスク'
      case 'asset':
        return '資産'
      default:
        return linkType
    }
  }

  private async notifyIncidentLinkChange(input: {
    incidentId: string
    linkType: IncidentLinkType
    linkId: string
    action: 'added' | 'removed'
  }): Promise<void> {
    const incident = await this.getIncidentByIdRaw(input.incidentId)
    const label = IncidentService.linkTypeLabel(input.linkType)

    const isAdded = input.action === 'added'
    const title = isAdded ? 'インシデントリンク追加' : 'インシデントリンク削除'
    const message = isAdded
      ? `インシデント「${incident.title}」に${label}がリンクされました。`
      : `インシデント「${incident.title}」から${label}のリンクが削除されました。`
    const priority = isAdded ? 'medium' : 'low'

    // 通知対象: reporter_id（nullでない場合）
    const targetUserIds = new Set<string>()
    if (incident.reporter_id) {
      targetUserIds.add(incident.reporter_id)
    }

    if (targetUserIds.size === 0) {
      return
    }

    await Promise.all(
      Array.from(targetUserIds).map(userId =>
        NotificationService.createNotification({
          organization_id: incident.organization_id,
          user_id: userId,
          title,
          message,
          type: 'system',
          priority: priority as 'medium' | 'low',
          link: `/incidents/${input.incidentId}`,
          metadata: {
            incident_id: input.incidentId,
            link_type: input.linkType,
            link_id: input.linkId,
            action: input.action
          }
        })
      )
    )
  }
}
