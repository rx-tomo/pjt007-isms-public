import { NextResponse } from 'next/server'
import { setForceWebhook500Count } from '@/lib/testing/toggles'

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not allowed in production' }, { status: 403 })
  }
  try {
    let count = 1
    const url = new URL(request.url)
    const q = url.searchParams.get('count')
    if (q) count = Math.max(0, parseInt(q, 10) || 0)
    else {
      const body = await request.json().catch(() => ({})) as any
      if (typeof body?.count === 'number') count = Math.max(0, body.count|0)
    }
    setForceWebhook500Count(count)
    return NextResponse.json({ ok: true, count })
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
}
