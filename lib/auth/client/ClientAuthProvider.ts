/**
 * Browser-side Better Auth implementation for IAuthProvider.
 *
 * This provider must not import server-only modules such as better-auth.ts.
 * It only talks to the browser auth client (`lib/auth/auth-client`).
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

type AuthClientLike = {
  getSession: (options?: unknown) => Promise<unknown>
  signOut?: () => Promise<unknown>
  signIn?: {
    email?: (options: { email: string; password: string }) => Promise<unknown>
  }
  signUp?: {
    email?: (options: { email: string; password: string; name: string }) => Promise<unknown>
  }
  requestPasswordReset?: (options: { email: string; redirectTo?: string }) => Promise<unknown>
  forgetPassword?: (options: { email: string; redirectTo?: string }) => Promise<unknown>
  resetPassword?: (options: { email: string; redirectTo?: string }) => Promise<unknown>
  changePassword?: (options: { currentPassword: string; newPassword: string }) => Promise<unknown>
  updateUser?: (options: Record<string, unknown>) => Promise<unknown>
  changeEmail?: (options: { newEmail: string }) => Promise<unknown>
}

type SessionPayload = {
  session: Record<string, unknown>
  user: Record<string, unknown>
}

export class ClientAuthProvider implements IAuthProvider {
  private listeners: Set<(event: AuthChangeEvent, session: AuthSession | null) => void> = new Set()

  private async getClient(): Promise<AuthClientLike> {
    const { authClient } = await import('@/lib/auth/auth-client')
    return authClient as unknown as AuthClientLike
  }

  private makeError(message: string, status?: number, code?: string): AuthError {
    return { message, status, code }
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  }

  private parseResponseError(response: unknown): AuthError | null {
    const root = this.asObject(response)
    if (!root) return null

    const errorObj = this.asObject(root.error)
    if (!errorObj) return null

    const message =
      (typeof errorObj.message === 'string' && errorObj.message) ||
      'Authentication request failed'
    const status = typeof errorObj.status === 'number' ? errorObj.status : undefined
    const code = typeof errorObj.code === 'string' ? errorObj.code : undefined
    return { message, status, code }
  }

  private extractSessionPayload(response: unknown): SessionPayload | null {
    const root = this.asObject(response)
    if (!root) return null

    const fromData = this.asObject(root.data)
    if (fromData) {
      const dataSession = this.asObject(fromData.session)
      const dataUser = this.asObject(fromData.user)
      if (dataSession && dataUser) {
        return { session: dataSession, user: dataUser }
      }
    }

    const rootSession = this.asObject(root.session)
    const rootUser = this.asObject(root.user)
    if (rootSession && rootUser) {
      return { session: rootSession, user: rootUser }
    }

    return null
  }

  private normalizeDate(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) return value
    if (value instanceof Date) return value.toISOString()
    return undefined
  }

  private mapUser(user: Record<string, unknown>): AuthUser | null {
    const id = typeof user.id === 'string' ? user.id : null
    if (!id) return null

    const createdAt = this.normalizeDate(user.createdAt)
    const updatedAt = this.normalizeDate(user.updatedAt)
    const emailVerified =
      typeof user.emailVerified === 'boolean' ? user.emailVerified : Boolean(user.emailVerified)

    return {
      id,
      email: typeof user.email === 'string' ? user.email : '',
      emailConfirmedAt: emailVerified ? (createdAt ?? updatedAt ?? new Date().toISOString()) : null,
      createdAt,
      updatedAt,
      userMetadata: {
        name: user.name,
        image: user.image,
      },
    }
  }

  private mapSession(session: Record<string, unknown>): AuthSession | null {
    const accessToken =
      (typeof session.token === 'string' && session.token) ||
      (typeof session.id === 'string' ? session.id : '')
    if (!accessToken) return null

    const expiresAt = this.normalizeDate(session.expiresAt)
    const expiresAtEpoch = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : undefined

    return {
      accessToken,
      expiresAt: Number.isFinite(expiresAtEpoch) ? expiresAtEpoch : undefined,
      tokenType: 'bearer',
    }
  }

  private async loadMappedSession(options?: unknown): Promise<{ user: AuthUser | null; session: AuthSession | null }> {
    const client = await this.getClient()
    const result = await client.getSession(options)
    const payload = this.extractSessionPayload(result)
    if (!payload) {
      return { user: null, session: null }
    }
    return {
      user: this.mapUser(payload.user),
      session: this.mapSession(payload.session),
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const result = await this.loadMappedSession()
      return result.user
    } catch (error) {
      console.error('ClientAuthProvider getUser error:', error)
      return null
    }
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const result = await this.loadMappedSession()
      return result.session
    } catch (error) {
      console.error('ClientAuthProvider getSession error:', error)
      return null
    }
  }

  async signUp(options: SignUpOptions): Promise<AuthResult> {
    try {
      const client = await this.getClient()
      const signUpEmail = client.signUp?.email
      if (!signUpEmail) {
        return {
          user: null,
          session: null,
          error: this.makeError('signUp.email is not available in client auth provider', 501, 'NOT_IMPLEMENTED'),
        }
      }

      const response = await signUpEmail({
        name: (options.options?.data?.name as string) || options.email.split('@')[0] || 'user',
        email: options.email,
        password: options.password,
      })

      const responseError = this.parseResponseError(response)
      if (responseError) {
        return { user: null, session: null, error: responseError }
      }

      const mapped = await this.loadMappedSession()
      this.emitEvent('SIGNED_IN', mapped.session)
      return { user: mapped.user, session: mapped.session, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed'
      return { user: null, session: null, error: this.makeError(message, 422) }
    }
  }

  async signIn(options: SignInOptions): Promise<AuthResult> {
    try {
      const client = await this.getClient()
      const signInEmail = client.signIn?.email
      if (!signInEmail) {
        return {
          user: null,
          session: null,
          error: this.makeError('signIn.email is not available in client auth provider', 501, 'NOT_IMPLEMENTED'),
        }
      }

      const response = await signInEmail({
        email: options.email,
        password: options.password,
      })

      const responseError = this.parseResponseError(response)
      if (responseError) {
        return { user: null, session: null, error: responseError }
      }

      const mapped = await this.loadMappedSession()
      this.emitEvent('SIGNED_IN', mapped.session)
      return { user: mapped.user, session: mapped.session, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      return { user: null, session: null, error: this.makeError(message, 401) }
    }
  }

  async signOut(): Promise<{ error?: AuthError | null }> {
    try {
      const client = await this.getClient()
      if (!client.signOut) {
        return { error: this.makeError('signOut is not available in client auth provider', 501, 'NOT_IMPLEMENTED') }
      }
      const response = await client.signOut()
      const responseError = this.parseResponseError(response)
      if (responseError) {
        return { error: responseError }
      }
      this.emitEvent('SIGNED_OUT', null)
      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      return { error: this.makeError(message) }
    }
  }

  async resetPassword(options: ResetPasswordOptions): Promise<{ error?: AuthError | null }> {
    try {
      const client = await this.getClient()
      const requestReset =
        client.requestPasswordReset ||
        client.forgetPassword ||
        client.resetPassword

      if (!requestReset) {
        return {
          error: this.makeError('Password reset request API is not available', 501, 'NOT_IMPLEMENTED')
        }
      }

      const response = await requestReset({
        email: options.email,
        redirectTo: options.redirectTo,
      })

      const responseError = this.parseResponseError(response)
      if (responseError) {
        return { error: responseError }
      }
      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset request failed'
      return { error: this.makeError(message) }
    }
  }

  async updatePassword(newPassword: string): Promise<AuthResult> {
    try {
      const client = await this.getClient()
      if (!client.changePassword) {
        return {
          user: null,
          session: null,
          error: this.makeError('changePassword is not available in client auth provider', 501, 'NOT_IMPLEMENTED'),
        }
      }

      const response = await client.changePassword({
        currentPassword: '',
        newPassword,
      })

      const responseError = this.parseResponseError(response)
      if (responseError) {
        return { user: null, session: null, error: responseError }
      }

      const mapped = await this.loadMappedSession()
      this.emitEvent('USER_UPDATED', mapped.session)
      return { user: mapped.user, session: mapped.session, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password update failed'
      return { user: null, session: null, error: this.makeError(message) }
    }
  }

  async updateUser(attributes: {
    email?: string
    password?: string
    data?: Record<string, unknown>
  }): Promise<AuthResult> {
    try {
      const client = await this.getClient()

      if (attributes.data && client.updateUser) {
        const response = await client.updateUser(attributes.data)
        const responseError = this.parseResponseError(response)
        if (responseError) {
          return { user: null, session: null, error: responseError }
        }
      }

      if (attributes.email && client.changeEmail) {
        const response = await client.changeEmail({ newEmail: attributes.email })
        const responseError = this.parseResponseError(response)
        if (responseError) {
          return { user: null, session: null, error: responseError }
        }
      }

      if (attributes.password && client.changePassword) {
        const response = await client.changePassword({
          currentPassword: '',
          newPassword: attributes.password,
        })
        const responseError = this.parseResponseError(response)
        if (responseError) {
          return { user: null, session: null, error: responseError }
        }
      }

      const mapped = await this.loadMappedSession()
      this.emitEvent('USER_UPDATED', mapped.session)
      return { user: mapped.user, session: mapped.session, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'User update failed'
      return { user: null, session: null, error: this.makeError(message) }
    }
  }

  async refreshSession(): Promise<AuthResult> {
    try {
      const mapped = await this.loadMappedSession({
        query: { disableCookieCache: true },
      })

      if (!mapped.user || !mapped.session) {
        return {
          user: null,
          session: null,
          error: this.makeError('No active session', 401),
        }
      }

      return { user: mapped.user, session: mapped.session, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session refresh failed'
      return { user: null, session: null, error: this.makeError(message) }
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
        'OTP verification is not supported in ClientAuthProvider.',
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
        'Code exchange is handled by Better Auth callback flow.',
        501,
        'NOT_IMPLEMENTED'
      ),
    }
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: AuthSession | null) => void): {
    unsubscribe: () => void
  } {
    this.listeners.add(callback)
    this.getSession()
      .then((session) => callback('INITIAL_SESSION', session))
      .catch(() => callback('INITIAL_SESSION', null))

    return {
      unsubscribe: () => this.listeners.delete(callback)
    }
  }

  private emitEvent(event: AuthChangeEvent, session: AuthSession | null): void {
    this.listeners.forEach((listener) => listener(event, session))
  }
}
