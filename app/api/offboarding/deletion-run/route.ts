import { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  organizations,
  organizationDeletionRequests,
  organizationDeletionRuns,
} from '@/lib/db/drizzle/schema'
import { requireServiceRole } from '@/lib/server/auth/secureClient'

export const runtime = 'nodejs'

const RUN_RESULTS = ['success', 'partial_failure', 'failed'] as const
type RunResult = (typeof RUN_RESULTS)[number]

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    organizationId?: string
    deletionRequestId?: string | null
    result?: RunResult
    scope?: Record<string, unknown>
    errorSummary?: string | null
    customerEvidence?: Record<string, unknown>
  }

  const organizationId = body.organizationId?.trim()
  if (!organizationId) {
    return Response.json({ error: 'organizationId is required' }, { status: 400 })
  }
  if (!RUN_RESULTS.includes(body.result as RunResult)) {
    return Response.json({ error: `result must be one of ${RUN_RESULTS.join(', ')}` }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['system_operator'],
    organizationId,
    actionName: 'offboarding.deletion_run.record',
    logContext: { organizationId },
  })
  if (!guard) return error ?? Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const now = new Date().toISOString()
  const runId = crypto.randomUUID()
  const result = body.result as RunResult
  const requestId = body.deletionRequestId?.trim() || null
  const scope = body.scope ?? {
    organizationData: true,
    retrievableEvidenceFiles: true,
    externalFilesExcluded: true,
  }
  const customerEvidence = body.customerEvidence ?? {
    result,
    recordedAt: now,
    note: 'Deletion evidence recorded. External systems and unretrievable files remain outside this application boundary.',
  }

  if (requestId) {
    const [requestRow] = await db
      .select({ id: organizationDeletionRequests.id })
      .from(organizationDeletionRequests)
      .where(and(
        eq(organizationDeletionRequests.id, requestId),
        eq(organizationDeletionRequests.organizationId, organizationId)
      ))
      .limit(1)

    if (!requestRow) {
      return guard.json({ error: 'Deletion request not found for organization' }, { status: 404 })
    }
  }

  await db.insert(organizationDeletionRuns).values({
    id: runId,
    organizationId,
    deletionRequestId: requestId,
    scope: JSON.stringify(scope),
    startedAt: now,
    completedAt: now,
    result,
    errorSummary: body.errorSummary?.slice(0, 2000) ?? null,
    customerEvidence: JSON.stringify(customerEvidence),
    createdAt: now,
  })

  if (requestId) {
    await db.update(organizationDeletionRequests)
      .set({
        status: result === 'success' ? 'completed' : 'failed',
        updatedAt: now,
      })
      .where(and(
        eq(organizationDeletionRequests.id, requestId),
        eq(organizationDeletionRequests.organizationId, organizationId)
      ))
  }

  await db.update(organizations)
    .set({
      deletionStatus: result === 'success' ? 'deleted' : 'failed',
      updatedAt: now,
    })
    .where(eq(organizations.id, organizationId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId,
    userId: guard.userId,
    action: 'offboarding.deletion_run.recorded',
    resourceType: 'organization_deletion_run',
    resourceId: runId,
    changes: JSON.stringify({
      deletion_request_id: requestId,
      result,
      scope,
      customer_evidence: customerEvidence,
    }),
    scope: 'tenant',
    createdAt: now,
  })

  return guard.json({
    data: {
      runId,
      result,
      completedAt: now,
      customerEvidence,
    },
  }, { status: 201 })
}
