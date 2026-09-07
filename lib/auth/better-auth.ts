import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { nextCookies } from 'better-auth/next-js'
import { sharedAuthOptions } from './server/sharedOptions'

const shared = sharedAuthOptions()
export const auth = betterAuth({
  ...shared,
  basePath: '/api/auth',
  plugins: [twoFactor(), nextCookies()],
})

export type BetterAuthSession = typeof auth.$Infer.Session
