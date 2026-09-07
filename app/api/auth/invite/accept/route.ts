import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import {
  acceptInvitationForAuthenticatedUser,
  InvitationAcceptanceError,
} from '@/lib/server/auth/invitationAcceptance'

function isPublicDemoMode() {
  return process.env.DEMO_PUBLIC_LOGIN_ENABLED === 'true' && process.env.DEMO_RESET_ENABLED === 'true'
}

export async function POST(request: NextRequest) {
  if (isPublicDemoMode()) {
    return NextResponse.json(
      { error: 'Public demo invitation acceptance is disabled.', code: 'PUBLIC_DEMO_DISABLED' },
      { status: 403 }
    )
  }

  // Verify the caller is authenticated
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    ))
  }

  try {
    const body = await request.json()
    const { token } = body ?? {}
    const userId = user.id

    if (typeof token !== 'string' || !token.trim()) {
      return NextResponse.json(
        { error: 'token is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Language preference: from Accept-Language header as fallback
    const languagePreference = request.headers.get('accept-language')?.startsWith('ja') ? 'ja' : 'en'
    const result = await acceptInvitationForAuthenticatedUser(db, {
      token: token.trim(),
      userId,
      authenticatedEmail: user.email,
      languagePreference,
    })

    // Billing and other external reconciliation must run only after this commit,
    // through an authenticated direct service or durable outbox. A reconciliation
    // failure must never revoke the tenant access successfully granted above.
    return NextResponse.json({
      success: true,
      organizationId: result.organizationId,
    })
  } catch (error) {
    if (error instanceof InvitationAcceptanceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }
    console.error('Failed to accept invitation', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
