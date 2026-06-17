/**
 * Better Auth implementation of IAuthProvider
 *
 * Uses Better Auth's server-side API for authentication operations.
 * Session management is cookie-based; headers are resolved from next/headers.
 *
 * For testing, pass a mock authApi and headersProvider via constructor.
 */

import type {
  IAuthProvider,
  AuthUser,
  AuthResult,
  AuthSession,
  AuthError,
  SignUpOptions,
  SignInOptions,
  ResetPasswordOptions,
  AuthChangeEvent
} from '../interfaces/IAuthProvider'

/**
 * Minimal interface for Better Auth's server-side API methods used by this provider.
 */
export interface BetterAuthApi {
  getSession(opts: { headers: Headers; query?: { disableCookieCache?: boolean } }): Promise<{
    user: BetterAuthUserData
    session: BetterAuthSessionData
  } | null>
  signUpEmail(opts: { body: { name: string; email: string; password: string } }): Promise<{
    token: string | null
    user: BetterAuthUserData
  }>
  signInEmail(opts: { body: { email: string; password: string } }): Promise<{
    redirect: boolean
    token: string
    user: BetterAuthUserData
  }>
  signOut(opts: { headers: Headers }): Promise<unknown>
  requestPasswordReset(opts: { body: { email: string; redirectTo?: string } }): Promise<{
    status: boolean
    message: string
  }>
  changePassword(opts: { body: { newPassword: string; currentPassword: string }; headers: Headers }): Promise<{
    token: string | null
    user: BetterAuthUserData
  }>
  updateUser(opts: { body: Record<string, unknown>; headers: Headers }): Promise<{ status: boolean }>
  changeEmail(opts: { body: { newEmail: string }; headers: Headers }): Promise<{ status: boolean }>
}

export interface BetterAuthUserData {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BetterAuthSessionData {
  id: string
  token: string
  expiresAt: Date
  userId: string
}

export class BetterAuthProvider implements IAuthProvider {
  private authApi: BetterAuthApi
  private headersProvider: () => Promise<Headers>
  private listeners: Set<(event: AuthChangeEvent, session: AuthSession | null) => void> = new Set()

  constructor(
    authApiOverride?: BetterAuthApi,
    headersProviderOverride?: () => Promise<Headers>
  ) {
    if (authApiOverride) {
      this.authApi = authApiOverride
    } else {
      // Lazy-load to avoid circular dependency at import time
      this.authApi = null as unknown as BetterAuthApi
      this.initDefaultApi()
    }

    this.headersProvider = headersProviderOverride || (async () => {
      try {
        const { headers: nextHeaders } = await import('next/headers')
        const h = await nextHeaders()
        return new Headers(h as unknown as HeadersInit)
      } catch {
        return new Headers()
      }
    })
  }

  private initDefaultApi(): void {
    // Deferred initialization to avoid top-level import issues
    import('@/lib/auth/better-auth').then(({ auth }) => {
      this.authApi = auth.api as unknown as BetterAuthApi
    })
  }

  private async getApi(): Promise<BetterAuthApi> {
    if (this.authApi) return this.authApi
    const { auth } = await import('@/lib/auth/better-auth')
    this.authApi = auth.api as unknown as BetterAuthApi
    return this.authApi
  }

  private mapBetterAuthUser(user: BetterAuthUserData): AuthUser {
    return {
      id: user.id,
      email: user.email,
      emailConfirmedAt: user.emailVerified ? user.createdAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      userMetadata: {
        name: user.name,
        image: user.image,
      },
    }
  }

  private mapBetterAuthSession(session: BetterAuthSessionData): AuthSession {
    const expiresAtMs = session.expiresAt.getTime()
    const nowMs = Date.now()
    return {
      accessToken: session.token,
      expiresAt: Math.floor(expiresAtMs / 1000),
      expiresIn: Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000)),
      tokenType: 'bearer',
    }
  }

  private makeError(message: string, status?: number, code?: string): AuthError {
    return { message, status, code }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const api = await this.getApi()
      const hdrs = await this.headersProvider()
      const result = await api.getSession({ headers: hdrs })
      if (!result) return null
      return this.mapBetterAuthUser(result.user)
    } catch (e) {
      console.error('BetterAuth getUser error:', e)
      return null
    }
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const api = await this.getApi()
      const hdrs = await this.headersProvider()
      const result = await api.getSession({ headers: hdrs })
      if (!result) return null
      return this.mapBetterAuthSession(result.session)
    } catch (e) {
      console.error('BetterAuth getSession error:', e)
      return null
    }
  }

  async signUp(options: SignUpOptions): Promise<AuthResult> {
    try {
      const api = await this.getApi()
      const result = await api.signUpEmail({
        body: {
          name: (options.options?.data?.name as string) || options.email.split('@')[0],
          email: options.email,
          password: options.password,
        },
      })

      const user = this.mapBetterAuthUser(result.user)

      return {
        user,
        session: result.token ? {
          accessToken: result.token,
          tokenType: 'bearer',
        } : null,
        error: null,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed'
      return {
        user: null,
        session: null,
        error: this.makeError(msg, 422),
      }
    }
  }

  async signIn(options: SignInOptions): Promise<AuthResult> {
    try {
      const api = await this.getApi()
      const result = await api.signInEmail({
        body: {
          email: options.email,
          password: options.password,
        },
      })

      const user = this.mapBetterAuthUser(result.user)

      return {
        user,
        session: result.token ? {
          accessToken: result.token,
          tokenType: 'bearer',
        } : null,
        error: null,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed'
      return {
        user: null,
        session: null,
        error: this.makeError(msg, 401),
      }
    }
  }

  async signOut(): Promise<{ error?: AuthError | null }> {
    try {
      const api = await this.getApi()
      const hdrs = await this.headersProvider()
      await api.signOut({ headers: hdrs })
      this.emitEvent('SIGNED_OUT')
      return { error: null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign out failed'
      return { error: this.makeError(msg) }
    }
  }

  async resetPassword(options: ResetPasswordOptions): Promise<{ error?: AuthError | null }> {
    try {
      const api = await this.getApi()
      await api.requestPasswordReset({
        body: {
          email: options.email,
          redirectTo: options.redirectTo,
        },
      })
      return { error: null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password reset request failed'
      return { error: this.makeError(msg) }
    }
  }

  async updatePassword(newPassword: string): Promise<AuthResult> {
    try {
      const api = await this.getApi()
      const hdrs = await this.headersProvider()
      const result = await api.changePassword({
        body: {
          newPassword,
          currentPassword: '',
        },
        headers: hdrs,
      })

      const user = this.mapBetterAuthUser(result.user)

      return {
        user,
        session: result.token ? {
          accessToken: result.token,
          tokenType: 'bearer',
        } : null,
        error: null,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password update failed'
      return {
        user: null,
        session: null,
        error: this.makeError(msg),
      }
    }
  }

  async updateUser(attributes: {
    email?: string
    password?: string
    data?: Record<string, unknown>
  }): Promise<AuthResult> {
    try {
      const api = await this.getApi()
      const hdrs = await this.headersProvider()

      const updateBody: Record<string, unknown> = {}
      if (attributes.data?.name) updateBody.name = attributes.data.name
      if (attributes.data?.image !== undefined) updateBody.image = attributes.data.image

      if (Object.keys(updateBody).length > 0) {
        await api.updateUser({
          body: updateBody,
          headers: hdrs,
        })
      }

      if (attributes.email) {
        await api.changeEmail({
          body: { newEmail: attributes.email },
          headers: hdrs,
        })
      }

      if (attributes.password) {
        await api.changePassword({
          body: {
            newPassword: attributes.password,
            currentPassword: '',
          },
          headers: hdrs,
        })
      }

      const sessionResult = await api.getSession({ headers: hdrs })
      if (!sessionResult) {
        return {
          user: null,
          session: null,
          error: this.makeError('Session lost after update'),
        }
      }

      this.emitEvent('USER_UPDATED')

      return {
        user: this.mapBetterAuthUser(sessionResult.user),
        session: this.mapBetterAuthSession(sessionResult.session),
        error: null,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'User update failed'
      return {
        user: null,
        session: null,
        error: this.makeError(msg),
      }
    }
  }

  async refreshSession(): Promise<AuthResult> {
    try {
      const api = await this.getApi()
      const hdrs = await this.headersProvider()
      const result = await api.getSession({
        headers: hdrs,
        query: { disableCookieCache: true },
      })

      if (!result) {
        return {
          user: null,
          session: null,
          error: this.makeError('No active session', 401),
        }
      }

      return {
        user: this.mapBetterAuthUser(result.user),
        session: this.mapBetterAuthSession(result.session),
        error: null,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Session refresh failed'
      return {
        user: null,
        session: null,
        error: this.makeError(msg),
      }
    }
  }

  async verifyOtp(_params: {
    email?: string
    phone?: string
    token: string
    type: 'signup' | 'recovery' | 'email' | 'sms'
  }): Promise<AuthResult> {
    return {
      user: null,
      session: null,
      error: this.makeError(
        'OTP verification not supported in Better Auth mode. Use email verification flow instead.',
        501,
        'NOT_IMPLEMENTED'
      ),
    }
  }

  async exchangeCodeForSession(_code: string): Promise<AuthResult> {
    return {
      user: null,
      session: null,
      error: this.makeError(
        'Code exchange is handled automatically by Better Auth OAuth flow.',
        501,
        'NOT_IMPLEMENTED'
      ),
    }
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: AuthSession | null) => void): {
    unsubscribe: () => void
  } {
    this.listeners.add(callback)
    return {
      unsubscribe: () => this.listeners.delete(callback)
    }
  }

  private emitEvent(event: AuthChangeEvent): void {
    const sessionPromise = this.getSession()
    sessionPromise.then(session => {
      this.listeners.forEach(listener => {
        listener(event, session)
      })
    }).catch(() => {
      this.listeners.forEach(listener => {
        listener(event, null)
      })
    })
  }
}
