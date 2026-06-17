import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { organizationInvitations, userProfiles } from '@/lib/db/drizzle/schema'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required', code: 'TOKEN_REQUIRED' },
      { status: 400 }
    )
  }

  try {
    const db = getDb()

    const invitationRows = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1)

    const invitation = invitationRows[0]
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

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Invitation expired', code: 'EXPIRED' },
        { status: 410 }
      )
    }

    const orgRows = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, invitation.organizationId))
      .limit(1)

    const organization = orgRows[0]
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found', code: 'ORGANIZATION_NOT_FOUND' },
        { status: 500 }
      )
    }

    const inviterRows = invitation.invitedBy
      ? await db
          .select({ fullName: userProfiles.fullName })
          .from(userProfiles)
          .where(eq(userProfiles.id, invitation.invitedBy))
          .limit(1)
      : []

    const inviterProfile = inviterRows[0] ?? null

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationId: organization.id,
        organizationName: organization.name,
        invitedByName: inviterProfile?.fullName ?? null,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    })
  } catch (error) {
    console.error('Failed to fetch invitation', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
