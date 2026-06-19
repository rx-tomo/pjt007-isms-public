import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships, organizationInvitations, auditLogs } from '@/lib/db/drizzle/schema'
import { organizations } from '@/lib/db/drizzle/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { EmailService, buildInvitationEmailSubject, type EmailSendResult } from '@/lib/services/email'
import { createPendingEmailLog, finalizeEmailLog } from '@/lib/server/emailLogs'

const ADMIN_ROLES = ['org_admin', 'system_operator', 'super_admin']

function isPublicDemoMode() {
  return process.env.DEMO_PUBLIC_LOGIN_ENABLED === 'true' && process.env.DEMO_RESET_ENABLED === 'true'
}

export async function POST(request: NextRequest) {
  if (isPublicDemoMode()) {
    return NextResponse.json({ error: 'Public demo invitations are disabled.' }, { status: 403 })
  }

  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const db = getDb()
  const [profile] = await db
    .select({
      organizationId: userProfiles.organizationId,
      fullName: userProfiles.fullName,
      email: userProfiles.email,
      role: userProfiles.role,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return applyCookies(NextResponse.json({ error: 'Organization not found' }, { status: 400 }))
  }

  if (!profile.role || !ADMIN_ROLES.includes(profile.role)) {
    return applyCookies(NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }))
  }

  let payload: {
    invitationId?: string
    organizationId?: string
    email?: string
    role?: string
    locale?: string
  }
  try {
    payload = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
  }

  if (payload.email) {
    const organizationId = payload.organizationId || profile.organizationId
    const normalizedEmail = payload.email.trim().toLowerCase()
    const role = (payload.role || 'user').toLowerCase()
    const allowedRoles = ['org_admin', 'auditor', 'approver', 'user', 'system_operator']

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return applyCookies(NextResponse.json({ error: 'Invalid email' }, { status: 400 }))
    }

    if (!allowedRoles.includes(role)) {
      return applyCookies(NextResponse.json({ error: 'Invalid role' }, { status: 400 }))
    }

    if (role === 'system_operator' && profile.role !== 'system_operator') {
      return applyCookies(NextResponse.json({ error: 'Only system_operator can invite system_operator' }, { status: 403 }))
    }

    const [membership] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, user.id),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1)

    if (profile.organizationId !== organizationId && !membership) {
      return applyCookies(NextResponse.json({ error: 'Forbidden: organization access required' }, { status: 403 }))
    }

    const token = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    const expiresAtDate = new Date()
    expiresAtDate.setDate(expiresAtDate.getDate() + 7)
    const expiresAt = expiresAtDate.toISOString()

    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    try {
      const [invitation] = await db
        .insert(organizationInvitations)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          email: normalizedEmail,
          role,
          invitedBy: user.id,
          token,
          expiresAt,
          createdAt: nowIso,
        })
        .returning()

      // email_logs.user_id is NOT NULL and references user_profiles, but the
      // invitee has no profile yet at this point. We deliberately record the
      // inviter (user.id) as user_id and keep the actual recipient address in
      // to_email (no schema change / migration).
      const emailLogId = await createPendingEmailLog({
        userId: user.id,
        toEmail: normalizedEmail,
        subject: buildInvitationEmailSubject(payload.locale, org?.name ?? null),
      })

      let sendResult: EmailSendResult
      try {
        sendResult = await new EmailService().sendInvitationEmail({
          to: normalizedEmail,
          token,
          organizationId,
          organizationName: org?.name ?? null,
          invitedById: user.id,
          invitedByName: profile.fullName || profile.email,
          locale: payload.locale,
          expiresAt,
        })
      } catch (sendError) {
        await finalizeEmailLog(emailLogId, {
          status: 'failed',
          errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
        })
        throw sendError
      }

      if (sendResult?.delivered === false) {
        await finalizeEmailLog(emailLogId, {
          status: 'skipped',
          errorMessage: sendResult.reason,
        })
      } else {
        await finalizeEmailLog(emailLogId, { status: 'sent' })
      }

      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        action: 'user.invited',
        resourceType: 'organization_invitation',
        resourceId: invitation.id,
        changes: JSON.stringify({ email: normalizedEmail, role }),
        createdAt: nowIso,
      })

      return applyCookies(NextResponse.json({
        id: invitation.id,
        organization_id: invitation.organizationId,
        email: invitation.email,
        role: invitation.role,
        invited_by: invitation.invitedBy,
        token: invitation.token,
        expires_at: invitation.expiresAt,
        accepted_at: invitation.acceptedAt,
        created_at: invitation.createdAt,
      }, { status: 201 }))
    } catch (createError) {
      console.error('[Invitations] create failed', createError)
      return applyCookies(NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 }))
    }
  }

  if (!payload.invitationId) {
    return applyCookies(NextResponse.json({ error: 'Invitation ID required' }, { status: 400 }))
  }

  // Fetch the invitation (must belong to the same org and not yet accepted)
  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(and(
      eq(organizationInvitations.id, payload.invitationId),
      eq(organizationInvitations.organizationId, profile.organizationId)
    ))
    .limit(1)

  if (!invitation) {
    return applyCookies(NextResponse.json({ error: 'Invitation not found' }, { status: 404 }))
  }

  if (invitation.acceptedAt) {
    return applyCookies(NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 }))
  }

  // Check expiry - if expired, extend it by 7 days and update the record
  const now = new Date()
  let expiresAt = invitation.expiresAt
  if (expiresAt && new Date(expiresAt) < now) {
    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + 7)
    expiresAt = newExpiry.toISOString()

    await db
      .update(organizationInvitations)
      .set({ expiresAt })
      .where(eq(organizationInvitations.id, invitation.id))
  }

  // Fetch organization name for the email
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, profile.organizationId))
    .limit(1)

  // Re-send the invitation email via the notifications API
  try {
    const origin = request.headers.get('origin') || request.headers.get('x-forwarded-host') || ''
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`

    const notifResponse = await fetch(`${baseUrl}/api/notifications/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: invitation.email,
        token: invitation.token,
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        organizationName: org?.name ?? null,
        invitedById: user.id,
        invitedByName: profile.fullName || profile.email,
        locale: request.headers.get('accept-language')?.startsWith('ja') ? 'ja' : 'en',
        expiresAt
      })
    })

    if (!notifResponse.ok) {
      const body = await notifResponse.json().catch(() => ({}))
      throw new Error(body?.error || 'Failed to send invitation email')
    }
  } catch (emailError) {
    console.error('[Invitations] resend: email send failed', emailError)
    return applyCookies(
      NextResponse.json({ error: 'Failed to resend invitation email' }, { status: 500 })
    )
  }

  return applyCookies(NextResponse.json({ success: true, expiresAt }, { status: 200 }))
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const db = getDb()
  const [profile] = await db
    .select({ organizationId: userProfiles.organizationId, role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return applyCookies(NextResponse.json({ invitations: [] }, { status: 200 }))
  }

  if (!profile.role || !ADMIN_ROLES.includes(profile.role)) {
    return applyCookies(NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }))
  }

  const data = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      invited_by: organizationInvitations.invitedBy,
      created_at: organizationInvitations.createdAt,
      expires_at: organizationInvitations.expiresAt,
    })
    .from(organizationInvitations)
    .where(and(
      eq(organizationInvitations.organizationId, profile.organizationId),
      isNull(organizationInvitations.acceptedAt)
    ))
    .orderBy(desc(organizationInvitations.createdAt))
    .limit(50)

  return applyCookies(NextResponse.json({ invitations: data }, { status: 200 }))
}

export async function DELETE(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const db = getDb()
  const [profile] = await db
    .select({ organizationId: userProfiles.organizationId, role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return applyCookies(NextResponse.json({ error: 'Organization not found' }, { status: 400 }))
  }

  if (!profile.role || !ADMIN_ROLES.includes(profile.role)) {
    return applyCookies(NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }))
  }

  let payload: { id?: string }
  try {
    payload = await request.json()
  } catch {
    return applyCookies(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
  }

  if (!payload.id) {
    return applyCookies(NextResponse.json({ error: 'Invitation ID required' }, { status: 400 }))
  }

  try {
    await db
      .delete(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, profile.organizationId),
        eq(organizationInvitations.id, payload.id)
      ))
  } catch (err) {
    console.error('[Invitations] delete failed', err)
    return applyCookies(NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 }))
  }

  return applyCookies(NextResponse.json({ success: true }, { status: 200 }))
}
