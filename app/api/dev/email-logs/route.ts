import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { emailLogs } from '@/lib/db/drizzle/schema'
import { and, desc, eq } from 'drizzle-orm'
import { isDevApiAvailable } from '@/lib/dev-login/availability'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * Dev/E2E helper: returns the most recent email_logs rows as JSON.
 * Guarded like /api/dev/invitations/latest — never available in production.
 */
export async function GET(request: NextRequest) {
  if (!isDevApiAvailable()) {
    return NextResponse.json(
      { error: 'Dev email log helper is not available in production.' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const limitParam = Number(searchParams.get('limit'))
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT
  const toEmail = searchParams.get('toEmail')
  const status = searchParams.get('status')

  const db = getDb()

  try {
    const conditions = []
    if (toEmail) {
      conditions.push(eq(emailLogs.toEmail, toEmail))
    }
    if (status) {
      conditions.push(eq(emailLogs.status, status))
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0]

    const rows = whereClause
      ? await db
          .select()
          .from(emailLogs)
          .where(whereClause)
          .orderBy(desc(emailLogs.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(emailLogs)
          .orderBy(desc(emailLogs.createdAt))
          .limit(limit)

    return NextResponse.json({
      emailLogs: rows.map(row => ({
        id: row.id,
        notification_id: row.notificationId,
        user_id: row.userId,
        to_email: row.toEmail,
        subject: row.subject,
        status: row.status,
        error_message: row.errorMessage,
        sent_at: row.sentAt,
        created_at: row.createdAt,
      })),
    })
  } catch (error) {
    console.error('[DevEmailLogs] unexpected error', error)
    return NextResponse.json(
      { error: 'Unexpected error loading email logs' },
      { status: 500 }
    )
  }
}
