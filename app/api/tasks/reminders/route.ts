import { NextRequest, NextResponse } from 'next/server'
import { deliverNotification } from '@/lib/server/notificationDelivery'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { processTaskReminders } from '@/lib/server/auth/taskAccess'
import { getDb } from '@/lib/db/drizzle/client'

type ServiceRoleGuard = Awaited<ReturnType<typeof requireServiceRole>>['guard']

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let guardResult: ServiceRoleGuard | undefined
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined
  try {
    const { guard, error } = await requireServiceRole(request, {
      mode: 'system-job',
      allowedRoles: ['system_operator'],
      actionName: 'tasks.reminders'
    })

    if (error) {
      return error
    }

    guardResult = guard
    if (!guard) {
      return new Response('Service role guard unavailable', { status: 500 })
    }
    const { json, logEvent } = guard
    jsonResponse = json

    const result = await processTaskReminders({
      db: getDb(),
      actorUserId: guard.userId,
      deliver: deliverNotification,
    })

    if (result.eligibleTasks > 0) {
      await logEvent('success', {
        processedTasks: result.processedTasks,
        remindersSent: result.remindersSent,
        skipped: result.skipped.length
      }, { format: 'tasks.reminders' })
    }

    return json({ ok: true, ...result })
  } catch (error) {
    console.error('[Task Reminders] failed to process request', error)
    await guardResult?.logEvent('error', {
      error: error instanceof Error ? error.message : 'unknown'
    })
    const responder =
      jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder({ error: 'Failed to process task reminders' }, { status: 500 })
  }
}
