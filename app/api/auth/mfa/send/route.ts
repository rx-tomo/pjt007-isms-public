import { NextResponse } from 'next/server'

/**
 * MFA send endpoint — deprecated.
 * Use Better Auth TOTP endpoints instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'gone',
      message:
        'This endpoint is deprecated. Use Better Auth TOTP endpoints: POST /api/auth/two-factor/enable to set up, POST /api/auth/two-factor/verify-totp to verify.',
    },
    { status: 410 }
  )
}
