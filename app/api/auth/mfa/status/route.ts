import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/better-auth'
import { getDb } from '@/lib/db/drizzle/client'
import { twoFactor } from '@/lib/db/drizzle/schema/auth-two-factor'

/**
 * MFA status endpoint.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ enabled: false }, { status: 401 })
  }

  const db = getDb()
  const rows = await db
    .select({ id: twoFactor.id })
    .from(twoFactor)
    .where(eq(twoFactor.userId, session.user.id))
    .limit(1)

  const enabled = rows.length > 0
  return NextResponse.json({ enabled, requiresMfa: enabled })
}
