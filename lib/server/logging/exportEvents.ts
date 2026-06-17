import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'

type ExportEventStatus = 'success' | 'denied' | 'error'

interface LogExportEventParams {
  userId: string
  organizationId: string
  documentId: string | null
  format: string
  status: ExportEventStatus
  context?: Record<string, unknown>
}

export const logExportEvent = async ({
  userId,
  organizationId,
  documentId,
  format,
  status,
  context,
}: LogExportEventParams) => {
  const db = getDb()

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      action: `export.${format}`,
      resourceType: 'export',
      resourceId: documentId,
      changes: JSON.stringify({ format, status, ...context }),
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log export event', error)
  }
}
