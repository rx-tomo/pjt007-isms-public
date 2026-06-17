/**
 * Mock Auth Provider
 *
 * This is a placeholder for Phase 3 implementation.
 * Will provide mock authentication for local development with SQLite.
 *
 * Features to implement:
 * - In-memory session storage
 * - Pre-defined test users from lib/dev-login/scenarios.ts
 * - Automatic session refresh simulation
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

export class MockAuthProvider implements IAuthProvider {
  private currentUser: AuthUser | null = null
  private currentSession: AuthSession | null = null
  private listeners: Set<(event: AuthChangeEvent, session: AuthSession | null) => void> = new Set()

  constructor() {
    // Will be implemented in Phase 3 with pre-defined test scenarios
  }

  private notImplemented(): never {
    throw new Error('Mock auth provider not yet implemented. Use AUTH_MODE=betterauth or wait for mock auth support.')
  }

  getUser(): Promise<AuthUser | null> {
    return this.notImplemented()
  }

  getSession(): Promise<AuthSession | null> {
    return this.notImplemented()
  }

  signUp(_options: SignUpOptions): Promise<AuthResult> {
    return this.notImplemented()
  }

  signIn(_options: SignInOptions): Promise<AuthResult> {
    return this.notImplemented()
  }

  signOut(): Promise<{ error?: AuthError | null }> {
    return this.notImplemented()
  }

  resetPassword(_options: ResetPasswordOptions): Promise<{ error?: AuthError | null }> {
    return this.notImplemented()
  }

  updatePassword(_newPassword: string): Promise<AuthResult> {
    return this.notImplemented()
  }

  updateUser(_attributes: {
    email?: string
    password?: string
    data?: Record<string, unknown>
  }): Promise<AuthResult> {
    return this.notImplemented()
  }

  refreshSession(): Promise<AuthResult> {
    return this.notImplemented()
  }

  verifyOtp(_params: {
    email?: string
    phone?: string
    token: string
    type: 'signup' | 'recovery' | 'email' | 'sms'
  }): Promise<AuthResult> {
    return this.notImplemented()
  }

  exchangeCodeForSession(_code: string): Promise<AuthResult> {
    return this.notImplemented()
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: AuthSession | null) => void): {
    unsubscribe: () => void
  } {
    this.listeners.add(callback)
    return {
      unsubscribe: () => this.listeners.delete(callback)
    }
  }

  // Mock-specific helpers (to be used in Phase 3)
  protected emitEvent(event: AuthChangeEvent): void {
    this.listeners.forEach(listener => {
      listener(event, this.currentSession)
    })
  }

  protected setMockUser(user: AuthUser | null): void {
    this.currentUser = user
  }

  protected setMockSession(session: AuthSession | null): void {
    this.currentSession = session
  }
}
