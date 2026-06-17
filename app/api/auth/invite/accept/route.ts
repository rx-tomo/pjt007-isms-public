import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships, organizationInvitations, auditLogs } from '@/lib/db/drizzle/schema'
import { authUsers } from '@/lib/db/drizzle/schema/auth'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
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

    if (!token) {
      return NextResponse.json(
        { error: 'token is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const db = getDb()

    const [invitation] = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation already accepted', code: 'ALREADY_ACCEPTED' },
        { status: 409 }
      )
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Invitation expired', code: 'EXPIRED' },
        { status: 410 }
      )
    }

    // Resolve user email and full_name from Better Auth user table
    let resolvedEmail: string | undefined = user.email
    let fullName: string | undefined

    const [authUser] = await db
      .select({ name: authUsers.name })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .limit(1)
    fullName = authUser?.name?.trim() || undefined

    if (!resolvedEmail || resolvedEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email mismatch', code: 'EMAIL_MISMATCH' },
        { status: 409 }
      )
    }

    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required', code: 'FULL_NAME_REQUIRED' },
        { status: 400 }
      )
    }

    const [existingProfileById] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (existingProfileById) {
      return NextResponse.json(
        { error: 'Profile already exists', code: 'PROFILE_EXISTS' },
        { status: 409 }
      )
    }

    const [existingProfileByEmail] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(and(
        eq(userProfiles.organizationId, invitation.organizationId),
        eq(userProfiles.email, invitation.email)
      ))
      .limit(1)

    if (existingProfileByEmail) {
      return NextResponse.json(
        { error: 'Profile already exists', code: 'PROFILE_EXISTS' },
        { status: 409 }
      )
    }

    // Language preference: from Accept-Language header as fallback
    const languagePreference = request.headers.get('accept-language')?.startsWith('ja') ? 'ja' : 'en'
    const nowIso = new Date().toISOString()

    try {
      await db.insert(userProfiles).values({
        id: userId,
        organizationId: invitation.organizationId,
        email: invitation.email,
        fullName: fullName,
        role: invitation.role,
        isActive: true,
        languagePreference: languagePreference === 'en' ? 'en' : 'ja',
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    } catch (profileError) {
      console.error('Failed to create profile for invitation', profileError)
      return NextResponse.json(
        { error: 'Failed to create profile', code: 'PROFILE_CREATE_FAILED' },
        { status: 500 }
      )
    }

    try {
      await db.insert(userMemberships).values({
        id: crypto.randomUUID(),
        userId: userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    } catch (membershipError) {
      console.error('Failed to create membership for invitation', membershipError)
      await db.delete(userProfiles).where(eq(userProfiles.id, userId))
      return NextResponse.json(
        { error: 'Failed to create membership', code: 'MEMBERSHIP_CREATE_FAILED' },
        { status: 500 }
      )
    }

    // Note: transfer_project_assignments RPC was legacy RPC-specific.
    // This is a no-op in Drizzle mode as Better Auth doesn't use this pattern.

    await db
      .update(organizationInvitations)
      .set({ acceptedAt: nowIso })
      .where(eq(organizationInvitations.id, invitation.id))

    try {
      const origin = request.nextUrl.origin
      await fetch(`${origin}/api/billing/ensure-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: invitation.organizationId }),
        cache: 'no-store',
      })
    } catch (billingError) {
      console.error('Failed to ensure billing plan after invitation acceptance', billingError)
    }

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId: invitation.organizationId,
      userId: userId,
      action: 'invitation.accepted',
      resourceType: 'organization_invitation',
      resourceId: invitation.id,
      changes: JSON.stringify({ accepted_by: userId }),
      createdAt: nowIso,
    })

    return NextResponse.json({
      success: true,
      organizationId: invitation.organizationId,
    })
  } catch (error) {
    console.error('Failed to accept invitation', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
