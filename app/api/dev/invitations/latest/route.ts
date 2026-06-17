import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { organizationInvitations } from '@/lib/db/drizzle/schema'
import { eq, desc, and } from 'drizzle-orm'
import { isDevApiAvailable } from '@/lib/dev-login/availability'

export async function GET(request: NextRequest) {
  if (!isDevApiAvailable()) {
    return NextResponse.json({ error: 'Dev invitation helper is not available in production.' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')
  const invitationId = searchParams.get('invitationId')
  const organizationId = searchParams.get('organizationId')

  if (!email && !invitationId) {
    return NextResponse.json({ error: 'email or invitationId is required' }, { status: 400 })
  }

  const db = getDb()

  try {
    const conditions = []

    if (invitationId) {
      conditions.push(eq(organizationInvitations.id, invitationId))
    } else if (email) {
      conditions.push(eq(organizationInvitations.email, email.toLowerCase()))
    }

    if (organizationId) {
      conditions.push(eq(organizationInvitations.organizationId, organizationId))
    }

    const rows = await db
      .select()
      .from(organizationInvitations)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(organizationInvitations.createdAt))
      .limit(1)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    const row = rows[0]
    return NextResponse.json({
      invitation: {
        id: row.id,
        organization_id: row.organizationId,
        email: row.email,
        role: row.role,
        token: row.token,
        expires_at: row.expiresAt,
        accepted_at: row.acceptedAt,
        created_at: row.createdAt,
      }
    })
  } catch (error) {
    console.error('[DevInvitations] unexpected error', error)
    return NextResponse.json({ error: 'Unexpected error loading invitation' }, { status: 500 })
  }
}
