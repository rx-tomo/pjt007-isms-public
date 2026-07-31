import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { deliverNotification } from '@/lib/server/notificationDelivery'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { getDb } from '@/lib/db/drizzle/client'
import { notifications } from '@/lib/db/drizzle/schema/notifications'

export const runtime = 'nodejs'

interface DeliverPayload {
  notificationId?: string
  emailLogId?: string
}

export async function POST(request: NextRequest) {
  // 認証必須。middlewareはAPIに対してrate limitしかかけないため、guardが無いと
  // 未認証の呼び出し元が任意のnotificationIdでメール配信を起動でき、応答の
  // status差分が存在オラクルになる。
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  let payload: DeliverPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (!payload.notificationId || typeof payload.notificationId !== 'string') {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
  }
  if (payload.emailLogId !== undefined && typeof payload.emailLogId !== 'string') {
    return NextResponse.json({ error: 'Invalid emailLogId' }, { status: 400 })
  }

  // 別組織の通知は存在を漏らさず404。配信も起動しない。
  const owned = await getDb()
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(
      eq(notifications.id, payload.notificationId),
      eq(notifications.organizationId, caller.organizationId)
    ))
    .limit(1)

  if (!owned[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await deliverNotification(payload.notificationId, {
    emailLogId: payload.emailLogId
  })

  if (!result.ok && result.status === 'failed') {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
