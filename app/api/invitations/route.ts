import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, organizationInvitations } from '@/lib/db/drizzle/schema'
import { organizations } from '@/lib/db/drizzle/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { EmailService, buildInvitationEmailSubject, type EmailSendResult } from '@/lib/services/email'
import { createPendingEmailLog, finalizeEmailLog } from '@/lib/server/emailLogs'
import { createInvitationWithAudit } from '@/lib/services/tenantAuditedMutations'

function isPublicDemoMode() {
  return process.env.DEMO_PUBLIC_LOGIN_ENABLED === 'true' && process.env.DEMO_RESET_ENABLED === 'true'
}

function serializeInvitationResponse(invitation: {
  id: string
  organizationId: string
  email: string
  role: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string | null
}) {
  return {
    id: invitation.id,
    organization_id: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    invited_by: invitation.invitedBy,
    expires_at: invitation.expiresAt,
    accepted_at: invitation.acceptedAt,
    created_at: invitation.createdAt,
  }
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
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return applyCookies(NextResponse.json({ error: 'Organization not found' }, { status: 400 }))
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
    const authorization = await authorizeTenantAction(
      db,
      user.id,
      organizationId,
      'members.manage'
    )
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }))
    }

    const normalizedEmail = payload.email.trim().toLowerCase()
    const role = (payload.role || 'user').toLowerCase()
    const allowedRoles = ['org_admin', 'auditor', 'approver', 'user', 'system_operator']

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return applyCookies(NextResponse.json({ error: 'Invalid email' }, { status: 400 }))
    }

    if (!allowedRoles.includes(role)) {
      return applyCookies(NextResponse.json({ error: 'Invalid role' }, { status: 400 }))
    }

    if (role === 'system_operator' && authorization.context.role !== 'system_operator') {
      return applyCookies(NextResponse.json({ error: 'Only system_operator can invite system_operator' }, { status: 403 }))
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
      const invitation = await createInvitationWithAudit(db, {
        organizationId,
        actorUserId: user.id,
        email: normalizedEmail,
        role,
        token,
        expiresAt,
        createdAt: nowIso,
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      })

      // External delivery and its delivery log intentionally happen only after
      // the invitation + mandatory audit transaction has committed.
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

      return applyCookies(
        NextResponse.json(serializeInvitationResponse(invitation), { status: 201 })
      )
    } catch (createError) {
      console.error('[Invitations] create failed', createError)
      return applyCookies(NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 }))
    }
  }

  if (!payload.invitationId) {
    return applyCookies(NextResponse.json({ error: 'Invitation ID required' }, { status: 400 }))
  }

  const authorization = await authorizeTenantAction(
    db,
    user.id,
    profile.organizationId,
    'members.manage'
  )
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }))
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

  // Send directly through the mail service. Request-controlled host headers
  // must never be used to construct a server-side callback URL.
  try {
    const locale = request.headers.get('accept-language')?.startsWith('ja') ? 'ja' : 'en'
    const emailLogId = await createPendingEmailLog({
      userId: user.id,
      toEmail: invitation.email,
      subject: buildInvitationEmailSubject(locale, org?.name ?? null),
    })

    let sendResult: EmailSendResult
    try {
      sendResult = await new EmailService().sendInvitationEmail({
        to: invitation.email,
        token: invitation.token,
        organizationId: invitation.organizationId,
        organizationName: org?.name ?? null,
        invitedById: user.id,
        invitedByName: profile.fullName || profile.email,
        locale,
        expiresAt,
      })
    } catch (sendError) {
      await finalizeEmailLog(emailLogId, {
        status: 'failed',
        errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
      })
      throw sendError
    }

    if (sendResult.delivered === false) {
      await finalizeEmailLog(emailLogId, {
        status: 'skipped',
        errorMessage: sendResult.reason,
      })
    } else {
      await finalizeEmailLog(emailLogId, { status: 'sent' })
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
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return applyCookies(NextResponse.json({ invitations: [] }, { status: 200 }))
  }

  const authorization = await authorizeTenantAction(
    db,
    user.id,
    profile.organizationId,
    'members.manage'
  )
  if (!authorization.ok) {
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
    .select({ organizationId: userProfiles.organizationId })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile?.organizationId) {
    return applyCookies(NextResponse.json({ error: 'Organization not found' }, { status: 400 }))
  }

  const authorization = await authorizeTenantAction(
    db,
    user.id,
    profile.organizationId,
    'members.manage'
  )
  if (!authorization.ok) {
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
