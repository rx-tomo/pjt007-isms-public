import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs, userProfiles, documents, risks } from '@/lib/db/drizzle/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

const ACTIVITY_SCOPE_TENANT = 'tenant'

interface ActorProfile {
  id?: string | null
  full_name?: string | null
  email?: string | null
}

export interface ActivityLogEntry {
  id: string
  organization_id: string | null
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  changes: unknown
  ip_address?: string | null
  user_agent?: string | null
  scope: string
  created_at: string | null
  actor?: ActorProfile | null
  resource_label?: string | null
}

export interface ActivityQueryOptions {
  organizationId: string
  limit?: number
  actions?: string[]
}

export class ActivityService {
  private async fetchRecentActivityApi(options: ActivityQueryOptions): Promise<ActivityLogEntry[]> {
    if (typeof window === 'undefined') {
      throw new Error('fetchRecentActivityApi must only be called from the browser')
    }

    const params = new URLSearchParams({
      organizationId: options.organizationId,
      limit: String(Math.min(Math.max(options.limit ?? 20, 1), 50)),
    })
    options.actions?.forEach(action => params.append('action', action))

    const response = await fetch(`/api/activity?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error ?? `API error ${response.status}`)
    }

    const payload = await response.json()
    return payload.data ?? []
  }

  async getRecentActivity(options: ActivityQueryOptions): Promise<ActivityLogEntry[]> {
    if (typeof window !== 'undefined') {
      return this.fetchRecentActivityApi(options)
    }

    const { organizationId, actions } = options
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
    const db = getDb()

    const conditions = [
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.scope, ACTIVITY_SCOPE_TENANT),
    ]

    if (actions && actions.length > 0) {
      conditions.push(inArray(auditLogs.action, actions))
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        organizationId: auditLogs.organizationId,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        changes: auditLogs.changes,
        scope: auditLogs.scope,
        createdAt: auditLogs.createdAt,
        actorId: userProfiles.id,
        actorFullName: userProfiles.fullName,
        actorEmail: userProfiles.email,
      })
      .from(auditLogs)
      .leftJoin(userProfiles, eq(auditLogs.userId, userProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit * 2)

    const entries: Array<Omit<ActivityLogEntry, 'resource_label'> & { actor?: ActorProfile | null }> = rows.map(row => ({
      id: row.id,
      organization_id: row.organizationId,
      user_id: row.userId ?? null,
      action: row.action,
      resource_type: row.resourceType,
      resource_id: row.resourceId ?? null,
      changes: row.changes ? JSON.parse(row.changes) : null,
      scope: row.scope,
      created_at: row.createdAt,
      actor: row.actorId
        ? { id: row.actorId, full_name: row.actorFullName ?? null, email: row.actorEmail ?? null }
        : null,
    }))

    const labelMap = await this.resolveResourceLabels(entries)

    return entries.map(row => ({
      ...row,
      actor: row.actor ?? null,
      resource_label: this.resolveLabelForRow(row, labelMap)
    }))
  }

  private async resolveResourceLabels(rows: Array<Pick<ActivityLogEntry, 'resource_type' | 'resource_id'>>) {
    const labelMap = new Map<string, string>()
    const db = getDb()

    const documentIds = new Set<string>()
    const riskIds = new Set<string>()

    for (const row of rows) {
      if (!row.resource_id) continue
      if (row.resource_type === 'document') {
        documentIds.add(row.resource_id)
      } else if (row.resource_type === 'risk') {
        riskIds.add(row.resource_id)
      }
    }

    if (documentIds.size > 0) {
      try {
        const docRows = await db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(inArray(documents.id, Array.from(documentIds)))

        docRows.forEach(doc => {
          labelMap.set(this.buildResourceKey('document', doc.id), doc.title)
        })
      } catch (error) {
        console.warn('[ActivityService] document label fetch failed', error)
      }
    }

    if (riskIds.size > 0) {
      try {
        const riskRows = await db
          .select({ id: risks.id, title: risks.title })
          .from(risks)
          .where(inArray(risks.id, Array.from(riskIds)))

        riskRows.forEach(risk => {
          labelMap.set(this.buildResourceKey('risk', risk.id), risk.title)
        })
      } catch (error) {
        console.warn('[ActivityService] risk label fetch failed', error)
      }
    }

    return labelMap
  }

  private resolveLabelForRow(
    row: Pick<ActivityLogEntry, 'resource_type' | 'resource_id' | 'changes'>,
    labelMap: Map<string, string>
  ) {
    if (row.resource_id) {
      const key = this.buildResourceKey(row.resource_type, row.resource_id)
      const label = labelMap.get(key)
      if (label) {
        return label
      }
    }

    const possibleTitle = (row.changes as Record<string, unknown> | null)?.title
    if (typeof possibleTitle === 'string' && possibleTitle.trim()) {
      return possibleTitle.trim()
    }

    return null
  }

  private buildResourceKey(type: string, id: string) {
    return `${type}:${id}`
  }
}
