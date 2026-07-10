import { NextRequest, NextResponse } from 'next/server'
import { isStripeMockMode } from '@/lib/stripe/config'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq } from 'drizzle-orm'

const ALLOWED_ROLES = new Set(['org_admin', 'system_operator', 'super_admin'])
const CROSS_ORG_ROLES = new Set(['system_operator', 'super_admin'])

export async function requireMockBillingAccess(
  request: NextRequest,
  organizationId: string
): Promise<{ error?: NextResponse }> {
  if (process.env.NODE_ENV === 'production') {
    return {
      error: NextResponse.json({ error: 'Mock billing endpoint is disabled in production.' }, { status: 403 }),
    }
  }

  if (!isStripeMockMode()) {
    return {
      error: NextResponse.json({ error: 'Enable STRIPE_TEST_MODE=mock to use this endpoint.' }, { status: 403 }),
    }
  }

  const { auth } = await import('@/lib/auth/better-auth')
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  }

  const db = getDb()
  const profiles = await db
    .select({
      role: userProfiles.role,
      organizationId: userProfiles.organizationId,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, session.user.id))
    .limit(1)

  const profile = profiles[0]
  const role = profile?.role?.toLowerCase() ?? ''
  if (!profile || !ALLOWED_ROLES.has(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if (profile.organizationId !== organizationId && !CROSS_ORG_ROLES.has(role)) {
    return { error: NextResponse.json({ error: 'Organization mismatch' }, { status: 403 }) }
  }

  return {}
}
