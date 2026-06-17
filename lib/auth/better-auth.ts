/**
 * Better Auth Configuration
 *
 * Central auth configuration using Better Auth with Drizzle + SQLite.
 * This is the authentication provider for the current app.
 *
 * Environment Variables:
 * - BETTER_AUTH_SECRET: Encryption key (min 32 chars)
 * - BETTER_AUTH_URL: Application base URL
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { nextCookies } from 'better-auth/next-js'
import { getDb } from '@/lib/db/drizzle/client'
import { twoFactor as twoFactorTable } from '@/lib/db/drizzle/schema/auth-two-factor'
import {
  authUsers as user,
  authSessions as session,
  authAccounts as account,
  authVerifications as verification,
} from '@/lib/db/drizzle/schema/auth'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007',

  database: drizzleAdapter(getDb(), {
    provider: 'sqlite',
    schema: { user, session, account, verification, twoFactor: twoFactorTable },
  }),

  basePath: '/api/auth',

  // Playwright/QA は IPv4 固定（http://127.0.0.1:3007）でアクセスするため、
  // 非本番ではループバック origin を信頼しないと sign-up/sign-in が INVALID_ORIGIN(403) になる
  trustedOrigins: process.env.NODE_ENV === 'production'
    ? []
    : ['http://127.0.0.1:3007', 'http://localhost:3007'],

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min cache
    },
  },

  plugins: [
    twoFactor(),
    nextCookies(), // must be last plugin
  ],
})

export type BetterAuthSession = typeof auth.$Infer.Session
