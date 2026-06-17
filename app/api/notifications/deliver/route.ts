import { NextResponse } from 'next/server'
import { deliverNotification } from '@/lib/server/notificationDelivery'

export const runtime = 'nodejs'

interface DeliverPayload {
  notificationId?: string
  emailLogId?: string
}

export async function POST(request: Request) {
  let payload: DeliverPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (!payload.notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
  }

  const result = await deliverNotification(payload.notificationId, {
    emailLogId: payload.emailLogId
  })

  if (!result.ok && result.status === 'failed') {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
