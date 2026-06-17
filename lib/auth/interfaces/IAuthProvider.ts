/**
 * Auth Provider Interface
 *
 * Abstracts authentication operations to allow switching between
 * Better Auth (production) and Mock Auth (development with SQLite).
 */

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string
  email: string
  emailConfirmedAt?: string | null
  phone?: string | null
  createdAt?: string
  updatedAt?: string
  lastSignInAt?: string | null
  appMetadata?: Record<string, unknown>
  userMetadata?: Record<string, unknown>
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: AuthUser | null
  session: AuthSession | null
  error?: AuthError | null
}

/**
 * Auth session information
 */
export interface AuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  expiresIn?: number
  tokenType?: string
}

/**
 * Auth error type
 */
export interface AuthError {
  message: string
  status?: number
  code?: string
}

/**
 * Sign up options
 */
export interface SignUpOptions {
  email: string
  password: string
  options?: {
    emailRedirectTo?: string
    data?: Record<string, unknown>
  }
}

/**
 * Sign in options
 */
export interface SignInOptions {
  email: string
  password: string
}

/**
 * Password reset options
 */
export interface ResetPasswordOptions {
  email: string
  redirectTo?: string
}

/**
 * Auth Provider Interface
 */
export interface IAuthProvider {
  /**
   * Get the current authenticated user
   */
  getUser(): Promise<AuthUser | null>

  /**
   * Get the current session
   */
  getSession(): Promise<AuthSession | null>

  /**
   * Sign up a new user
   */
  signUp(options: SignUpOptions): Promise<AuthResult>

  /**
   * Sign in with email and password
   */
  signIn(options: SignInOptions): Promise<AuthResult>

  /**
   * Sign out the current user
   */
  signOut(): Promise<{ error?: AuthError | null }>

  /**
   * Send a password reset email
   */
  resetPassword(options: ResetPasswordOptions): Promise<{ error?: AuthError | null }>

  /**
   * Update user password
   */
  updatePassword(newPassword: string): Promise<AuthResult>

  /**
   * Update user metadata
   */
  updateUser(attributes: {
    email?: string
    password?: string
    data?: Record<string, unknown>
  }): Promise<AuthResult>

  /**
   * Refresh the current session
   */
  refreshSession(): Promise<AuthResult>

  /**
   * Verify OTP (for email confirmation, phone verification)
   */
  verifyOtp(params: {
    email?: string
    phone?: string
    token: string
    type: 'signup' | 'recovery' | 'email' | 'sms'
  }): Promise<AuthResult>

  /**
   * Exchange code for session (OAuth callback)
   */
  exchangeCodeForSession(code: string): Promise<AuthResult>

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: AuthSession | null) => void): {
    unsubscribe: () => void
  }
}

/**
 * Auth state change events
 */
export type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'
