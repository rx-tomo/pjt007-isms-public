import { NextResponse } from 'next/server'
import { isTrustedE2EServerEnvironment } from '@/lib/testing/e2eEnvironment'

export async function GET() {
  const nonce = process.env.PLAYWRIGHT_RUN_NONCE
  if (
    !isTrustedE2EServerEnvironment()
    || !nonce
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/.test(nonce)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      app: 'riscala-isms',
      nonce,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
