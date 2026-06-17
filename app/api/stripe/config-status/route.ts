import { NextResponse } from 'next/server'
import { hasStripeSecret, isStripeMockMode } from '@/lib/stripe/config'

export const runtime = 'nodejs'

// Stripe がmock動作かどうかをUIバナー表示用に返す（GAP-022）。
// 構成有無のbooleanのみで秘匿情報は含まないため認証不要。
export async function GET() {
  return NextResponse.json({
    mockMode: isStripeMockMode() || !hasStripeSecret(),
  })
}
