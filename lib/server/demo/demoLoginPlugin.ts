import 'server-only'

import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { isAllowedDemoRequest } from '@/lib/demo/csrf'
import { isDemoSurfaceAvailable } from '@/lib/demo/contract'
import { resolveDemoPersona } from '@/lib/server/demo/registry'
import {
  createDemoSession,
  DemoSessionCreationError,
} from '@/lib/server/demo/sessionRotation'
import {
  consumePublicDemoLoginPermit,
  PublicDemoRuntimeUnavailableError,
} from '@/lib/server/demo/publicDemoRuntimeGate'

export const DEMO_LOGIN_PATH = '/demo-login' as const

function unavailableError(): APIError {
  return APIError.from('NOT_FOUND', {
    code: 'DEMO_SURFACE_NOT_FOUND',
    message: 'Not found',
  })
}

function cookieAttributes(request: Request): Parameters<typeof setSessionCookie>[3] {
  return {
    secure: new URL(request.url).protocol === 'https:',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    domain: undefined,
  }
}

const demoLoginEndpoint = createAuthEndpoint(DEMO_LOGIN_PATH, {
  method: 'POST',
  requireHeaders: true,
  requireRequest: true,
  allowedMediaTypes: ['application/json'],
  body: z.object({
    personaId: z.string().min(1).max(128),
  }),
}, async (ctx) => {
  try {
    await consumePublicDemoLoginPermit()
  } catch (error) {
    if (error instanceof PublicDemoRuntimeUnavailableError) {
      throw APIError.from(error.reason === 'rate-limit' ? 'TOO_MANY_REQUESTS' : 'SERVICE_UNAVAILABLE', {
        code: error.reason === 'rate-limit' ? 'DEMO_RATE_LIMITED' : 'DEMO_RESET_IN_PROGRESS',
        message: 'Demo login is temporarily unavailable',
      })
    }
    throw error
  }
  const resolution = await resolveDemoPersona(ctx.body.personaId)
  if (resolution.kind === 'unknown') throw unavailableError()
  if (resolution.kind === 'fixture-conflict') {
    throw APIError.from('CONFLICT', {
      code: 'DEMO_FIXTURE_CONFLICT',
      message: 'Demo fixture is unavailable',
    })
  }

  try {
    await createDemoSession({
      user: resolution.value.user,
      pruneSessions: async (userId) => {
        const sessions = await ctx.context.internalAdapter.listSessions(userId, { onlyActiveSessions: true })
        const staleTokens = sessions
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
          .slice(0, Math.max(0, sessions.length - 4))
          .map((session) => session.token)
        if (staleTokens.length > 0) {
          await ctx.context.internalAdapter.deleteSessions(staleTokens)
        }
      },
      createSession: (userId) => ctx.context.internalAdapter.createSession(userId),
      deleteSession: (token) => ctx.context.internalAdapter.deleteSession(token),
      setSessionCookie: (value) => setSessionCookie(
        ctx,
        value,
        undefined,
        cookieAttributes(ctx.request),
      ),
    })

    return ctx.json({ ok: true })
  } catch (error) {
    if (error instanceof DemoSessionCreationError) {
      throw APIError.from('SERVICE_UNAVAILABLE', {
        code: 'DEMO_SESSION_CREATION_FAILED',
        message: 'Demo session could not be established',
      })
    }
    throw error
  }
})

export function demoLoginPlugin() {
  return {
    id: 'demo-login-boundary',
    onRequest: async (request: Request) => {
      const path = new URL(request.url).pathname
      if (path.endsWith(DEMO_LOGIN_PATH)) {
        if (!isDemoSurfaceAvailable()) {
          return { response: new Response(null, { status: 404 }) }
        }
        if (!isAllowedDemoRequest(request)) {
          return {
            response: Response.json(
              { code: 'DEMO_ORIGIN_NOT_ALLOWED', message: 'Forbidden' },
              { status: 403 },
            ),
          }
        }
      }
    },
    endpoints: {
      demoLogin: demoLoginEndpoint,
    },
  }
}
