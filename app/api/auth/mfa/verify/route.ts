import { NextResponse } from 'next/server'

/**
 * MFA verify endpoint — deprecated.
 * Use POST /api/auth/two-factor/verify-totp instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'gone',
      message:
        'This endpoint is deprecated. Use POST /api/auth/two-factor/verify-totp to verify MFA code.',
    },
    { status: 410 }
  )
}
