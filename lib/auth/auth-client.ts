/**
 * Better Auth Client
 *
 * Browser-side auth client for React components.
 * Provides hooks and methods for sign-in, sign-up, sign-out, session management.
 */

import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

function resolveAuthBaseURL(): string {
  // Always prefer the current browser origin to avoid localhost/127.0.0.1 mismatches.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  const envBaseURL = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (envBaseURL) {
    return envBaseURL
  }

  return 'http://localhost:3007'
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
  plugins: [twoFactorClient()],
})
