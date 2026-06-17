/**
 * Email log lifecycle helpers.
 *
 * Centralises creation and finalisation of email_logs rows so that every
 * outgoing email (notification fallback, invitations, billing alerts) leaves
 * an auditable record: pending -> sent / failed / skipped.
 *
 * Log bookkeeping failures are logged via console.error and swallowed —
 * email delivery must never be blocked by a logging issue.
 */

import { getDb } from '@/lib/db/drizzle/client'
import { emailLogs, type EmailLogStatus } from '@/lib/db/drizzle/schema/notifications'
import { eq } from 'drizzle-orm'

export type EmailLogOutcomeStatus = Exclude<EmailLogStatus, 'pending'>

export interface CreatePendingEmailLogInput {
  /**
   * Must reference an existing user_profiles row (NOT NULL FK).
   * For invitation emails the invitee has no profile yet, so callers record
   * the inviter's user id here and keep the invitee address in `toEmail`.
   */
  userId: string
  toEmail: string
  subject: string
  notificationId?: string | null
}

export interface EmailLogOutcome {
  status: EmailLogOutcomeStatus
  /** Failure detail or skip reason code (e.g. 'missing_api_key', 'preferences'). */
  errorMessage?: string | null
  /** Defaults to now when status is 'sent'. */
  sentAt?: string | null
}

/**
 * Inserts a pending email_logs row and returns its id, or null when the
 * insert fails (delivery should continue regardless).
 */
export async function createPendingEmailLog(
  input: CreatePendingEmailLogInput
): Promise<string | null> {
  const logId = crypto.randomUUID()
  try {
    const db = getDb()
    await db.insert(emailLogs).values({
      id: logId,
      notificationId: input.notificationId ?? null,
      userId: input.userId,
      toEmail: input.toEmail,
      subject: input.subject,
      status: 'pending',
    })
    return logId
  } catch (error) {
    console.error('[EmailLogs] failed to create pending email log', error)
    return null
  }
}

/**
 * Updates an email_logs row with the delivery outcome. No-op when
 * `emailLogId` is null/undefined (e.g. the pending insert had failed).
 */
export async function finalizeEmailLog(
  emailLogId: string | null | undefined,
  outcome: EmailLogOutcome
): Promise<void> {
  if (!emailLogId) return
  try {
    const db = getDb()
    await db
      .update(emailLogs)
      .set({
        status: outcome.status,
        errorMessage: outcome.errorMessage ?? null,
        sentAt:
          outcome.status === 'sent'
            ? outcome.sentAt ?? new Date().toISOString()
            : null,
      })
      .where(eq(emailLogs.id, emailLogId))
  } catch (error) {
    console.error('[EmailLogs] failed to finalize email log', emailLogId, error)
  }
}
