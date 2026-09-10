import { NextRequest, NextResponse } from 'next/server'
import { isStripeMockMode } from '@/lib/stripe/config'
import { getDb } from '@/lib/db/drizzle/client'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'

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
  const authorization = await authorizeTenantAction(
    db,
    session.user.id,
    organizationId,
    'billing.manage'
  )
  if (!authorization.ok) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return {}
}
