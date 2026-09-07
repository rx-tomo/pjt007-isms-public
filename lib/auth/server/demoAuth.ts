import 'server-only'

import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { publicDemoOrigin } from '@/lib/demo/contract'
import { demoLoginPlugin } from '@/lib/server/demo/demoLoginPlugin'
import { sharedAuthOptions } from './sharedOptions'

const sharedOptions = sharedAuthOptions()
const productionOrigin = publicDemoOrigin()

export const demoAuth = betterAuth({
  ...sharedOptions,
  ...(productionOrigin ? {
    trustedOrigins: [productionOrigin],
    session: {
      ...sharedOptions.session,
      cookieCache: { enabled: false, maxAge: 5 * 60 },
    },
  } : {}),
  basePath: '/api/demo-auth',
  plugins: [demoLoginPlugin(), nextCookies()],
})
