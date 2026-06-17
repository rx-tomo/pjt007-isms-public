import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'

export type ServiceRoleEventStatus = 'success' | 'denied' | 'error'

export interface LogServiceRoleEventParams {
  organizationId: string
  actionName: string
  status: ServiceRoleEventStatus
  userId?: string | null
  context?: Record<string, unknown>
  format?: string
  documentId?: string | null
}

export const logServiceRoleEvent = async ({
  organizationId,
  actionName,
  status,
  userId,
  context,
  documentId
}: LogServiceRoleEventParams) => {
  const db = getDb()

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: userId ?? null,
      action: actionName,
      resourceType: 'service_role',
      resourceId: documentId ?? null,
      changes: context ? JSON.stringify({ ...context, status }) : JSON.stringify({ status }),
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ServiceRoleEvents] failed to write audit log', error)
  }
}
