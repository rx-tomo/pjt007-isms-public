import type {} from 'server-only'

import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb } from '@/lib/db/drizzle/client'
import { authUsers as user, authSessions as session, authAccounts as account, authVerifications as verification } from '@/lib/db/drizzle/schema/auth'
import { twoFactor } from '@/lib/db/drizzle/schema/auth-two-factor'

export function sharedAuthOptions() {
  return {
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007',
    database: drizzleAdapter(getDb(), { provider: 'sqlite', schema: { user, session, account, verification, twoFactor } }),
    trustedOrigins: process.env.NODE_ENV === 'production' ? [] : ['http://127.0.0.1:3007', 'http://localhost:3007'],
    emailAndPassword: { enabled: true },
    secret: process.env.BETTER_AUTH_SECRET,
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 5 * 60 } },
    advanced: { crossSubDomainCookies: { enabled: false } },
  }
}
