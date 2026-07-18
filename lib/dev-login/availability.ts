import { isTrustedE2EServerEnvironment } from '@/lib/testing/e2eEnvironment'

export function isDevApiAvailable() {
  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  if (process.env.DEMO_PUBLIC_LOGIN_ENABLED === 'true' && process.env.DEMO_RESET_ENABLED === 'true') {
    return true
  }

  return isTrustedE2EServerEnvironment() && process.env.NEXT_PUBLIC_E2E_MODE === '1'
}
