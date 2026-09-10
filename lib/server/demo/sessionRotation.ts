export type DemoAuthUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export type DemoAuthSession = {
  id: string
  token: string
  userId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  ipAddress?: string | null
  userAgent?: string | null
}

export class DemoSessionCreationError extends Error {
  readonly reason: 'session-create' | 'cookie-set'

  constructor(reason: DemoSessionCreationError['reason']) {
    super(`Demo session creation failed during ${reason}`)
    this.name = 'DemoSessionCreationError'
    this.reason = reason
  }
}

export interface DemoSessionDependencies {
  user: DemoAuthUser
  pruneSessions: (userId: string) => Promise<void>
  createSession: (userId: string) => Promise<DemoAuthSession>
  deleteSession: (token: string) => Promise<void>
  setSessionCookie: (session: { session: DemoAuthSession; user: DemoAuthUser }) => Promise<void>
}

/**
 * Establish a demo session without rotating or revoking the caller's session.
 * The database cleanup is limited to the new session if cookie persistence
 * fails after creation.
 */
export async function createDemoSession({
  user,
  pruneSessions,
  createSession,
  deleteSession,
  setSessionCookie: writeSessionCookie,
}: DemoSessionDependencies): Promise<DemoAuthSession> {
  try {
    await pruneSessions(user.id)
  } catch {
    throw new DemoSessionCreationError('session-create')
  }

  let newSession: DemoAuthSession
  try {
    newSession = await createSession(user.id)
  } catch {
    throw new DemoSessionCreationError('session-create')
  }

  try {
    await writeSessionCookie({ session: newSession, user })
  } catch {
    await Promise.resolve()
      .then(() => deleteSession(newSession.token))
      .catch(() => undefined)
    throw new DemoSessionCreationError('cookie-set')
  }

  return newSession
}
