import { NextRequest, NextResponse } from 'next/server'
import { EmailService, buildInvitationEmailSubject, type EmailSendResult } from '@/lib/services/email'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs } from '@/lib/db/drizzle/schema'
import { createPendingEmailLog, finalizeEmailLog } from '@/lib/server/emailLogs'

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const {
      email,
      token,
      invitationId,
      organizationId,
      organizationName,
      invitedById,
      invitedByName,
      locale,
      expiresAt
    } = await request.json()

    if (!email || !token || !invitationId || !organizationId || !invitedById) {
      return applyCookies(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
    }

    // email_logs.user_id is NOT NULL and references user_profiles, but the
    // invitee has no profile yet. We deliberately record the inviter
    // (invitedById) as user_id and keep the recipient address in to_email
    // (no schema change / migration).
    const emailLogId = await createPendingEmailLog({
      userId: invitedById,
      toEmail: email,
      subject: buildInvitationEmailSubject(locale, organizationName ?? null),
    })

    const emailService = new EmailService()
    let sendResult: EmailSendResult
    try {
      sendResult = await emailService.sendInvitationEmail({
        to: email,
        token,
        organizationId,
        organizationName,
        invitedById,
        invitedByName,
        locale,
        expiresAt
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

    try {
      const db = getDb()
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: invitedById,
        action: 'email.sent',
        resourceType: 'organization_invitation',
        resourceId: invitationId,
        changes: JSON.stringify({ email, template: 'invitation' }),
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to persist invitation email audit log', error)
    }

    return applyCookies(NextResponse.json({ success: true }))
  } catch (error: any) {
    console.error('Invitation email send error', error)
    return applyCookies(NextResponse.json({ error: error?.message || 'Failed to send invitation email' }, { status: 500 }))
  }
}
