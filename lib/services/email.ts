const RESEND_ENDPOINT = process.env.RESEND_API_URL || 'https://api.resend.com/emails'

export interface InvitationEmailPayload {
  to: string
  token: string
  organizationId: string
  organizationName?: string | null
  invitedById: string
  invitedByName?: string | null
  locale?: string
  expiresAt?: string
}

export interface NotificationEmailPayload {
  to: string
  subject: string
  message: string
  actionUrl?: string
  locale?: 'ja' | 'en'
  recipientName?: string | null
}

interface ResendErrorResponse {
  name?: string
  message?: string
  statusCode?: number
}

/**
 * Outcome of an email send attempt.
 * - `{ delivered: true }` — the provider accepted the email.
 * - `{ delivered: false, skipped: true, reason }` — delivery was intentionally
 *   skipped (e.g. RESEND_API_KEY not configured in local/dev environments).
 * Provider errors are thrown, not returned.
 */
export type EmailSendResult =
  | { delivered: true }
  | { delivered: false; skipped: true; reason: 'missing_api_key' }

/**
 * Builds the invitation email subject. Exported so callers that record
 * email_logs rows can persist the same subject the email is sent with.
 */
export function buildInvitationEmailSubject(
  locale?: string | null,
  organizationName?: string | null
): string {
  const resolvedLocale = locale || 'ja'
  const orgName = organizationName || 'your organisation'
  return resolvedLocale === 'ja'
    ? `【Riscala AI for ISMS】${orgName} への招待が届きました`
    : `You've been invited to ${orgName} on Riscala AI for ISMS`
}

export class EmailService {
  private apiKey = process.env.RESEND_API_KEY
  private fromAddress = process.env.INVITE_EMAIL_FROM || 'Riscala AI for ISMS <no-reply@riscala-isms.test>'
  private appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007'

  async sendInvitationEmail(payload: InvitationEmailPayload): Promise<EmailSendResult> {
    if (!this.apiKey) {
      console.warn(
        '[EmailService] RESEND_API_KEY is not configured. Skipping external email delivery and logging payload for local/testing use.'
      )
      console.info('[EmailService] Invitation payload:', {
        to: payload.to,
        token: payload.token,
        organizationId: payload.organizationId,
        locale: payload.locale ?? 'ja',
        expiresAt: payload.expiresAt ?? null
      })
      return { delivered: false, skipped: true, reason: 'missing_api_key' }
    }

    const locale = payload.locale || 'ja'
    const inviteUrl = `${this.appUrl.replace(/\/$/, '')}/${locale}/auth/invite?token=${payload.token}`
    const orgName = payload.organizationName || 'your organisation'
    const inviterName = payload.invitedByName || 'Riscala AI for ISMS Team'
    const subject = buildInvitationEmailSubject(payload.locale, payload.organizationName)

    const expiresText = payload.expiresAt
      ? new Date(payload.expiresAt).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        })
      : null

    const html = `<!DOCTYPE html>
<html lang="${locale}">
  <body style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color: #111827;">
    <h1 style="font-size: 20px;">${locale === 'ja' ? 'Riscala AI for ISMS への招待' : 'Invitation to Riscala AI for ISMS'}</h1>
    <p>${
      locale === 'ja'
        ? `${inviterName} さんが ${orgName} のワークスペースにあなたを招待しています。下のボタンからアカウント登録を完了してください。`
        : `${inviterName} invited you to join the ${orgName} workspace on Riscala AI for ISMS. Click the button below to accept your invitation.`
    }</p>
    <p style="margin: 24px 0;">
      <a href="${inviteUrl}" style="display: inline-block; padding: 12px 20px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px;">
        ${locale === 'ja' ? '招待を受け取る' : 'Accept invitation'}
      </a>
    </p>
    <p>${
      locale === 'ja'
        ? '上記ボタンが利用できない場合は次の URL をブラウザにコピーしてください:'
        : 'If the button above does not work, copy and paste this URL into your browser:'
    }</p>
    <p style="word-break: break-all;">${inviteUrl}</p>
    ${
      expiresText
        ? `<p style="font-size: 14px; color: #6b7280;">${
            locale === 'ja'
              ? `このリンクの有効期限: ${expiresText} UTC`
              : `This link expires on ${expiresText} UTC`
          }</p>`
        : ''
    }
    <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="font-size: 12px; color: #6b7280;">${
      locale === 'ja'
        ? 'このメールに心当たりがない場合は破棄してください。'
        : 'If you did not expect this email you can safely ignore it.'
    }</p>
  </body>
</html>`

    const text =
      locale === 'ja'
        ? `${inviterName} さんが ${orgName} のワークスペースに招待しています。以下のURLから参加できます: ${inviteUrl}`
        : `${inviterName} invited you to join the ${orgName} workspace on Riscala AI for ISMS. Use this link to accept: ${inviteUrl}`

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [payload.to],
        subject,
        html,
        text
      })
    })

    if (!response.ok) {
      let message = `Failed to send invitation email (status ${response.status})`
      try {
        const errorBody = (await response.json()) as ResendErrorResponse
        if (errorBody?.message) {
          message = `${message}: ${errorBody.message}`
        }
      } catch {
        // ignore JSON parse errors and use default message
      }
      throw new Error(message)
    }

    return { delivered: true }
  }

  async sendNotificationEmail(payload: NotificationEmailPayload): Promise<EmailSendResult> {
    if (!this.apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not configured. Skipping notification email delivery.')
      console.info('[EmailService] Notification payload:', {
        to: payload.to,
        subject: payload.subject,
        actionUrl: payload.actionUrl ?? null
      })
      return { delivered: false, skipped: true, reason: 'missing_api_key' }
    }

    const locale: 'ja' | 'en' = payload.locale === 'en' ? 'en' : 'ja'
    const recipient = payload.recipientName || ''
    const greeting = locale === 'ja' ? `${recipient || 'ご担当者様'}

${payload.message}` : `${recipient || 'Hello'},

${payload.message}`
    const actionHtml = payload.actionUrl
      ? `<p style="margin: 24px 0;">` +
        `<a href="${payload.actionUrl}" style="display: inline-block; padding: 12px 20px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px;">${
          locale === 'ja' ? '詳細を見る' : 'View details'
        }</a>` +
        `</p>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="${locale}">
  <body style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color: #111827;">
    <h1 style="font-size: 20px;">${payload.subject}</h1>
    <p style="white-space: pre-line;">${greeting}</p>
    ${actionHtml}
    <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="font-size: 12px; color: #6b7280;">${
      locale === 'ja'
        ? 'このメールに心当たりがない場合は破棄してください。'
        : 'If you did not expect this email you can safely ignore it.'
    }</p>
  </body>
</html>`

    const textMessage = `${payload.subject}\n\n${payload.message}${
      payload.actionUrl ? `\n\n${locale === 'ja' ? '詳細:' : 'Details:'} ${payload.actionUrl}` : ''
    }`

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html,
        text: textMessage
      })
    })

    if (!response.ok) {
      let message = `Failed to send notification email (status ${response.status})`
      try {
        const errorBody = (await response.json()) as ResendErrorResponse
        if (errorBody?.message) {
          message = `${message}: ${errorBody.message}`
        }
      } catch {
        // ignore
      }
      throw new Error(message)
    }

    return { delivered: true }
  }
}
