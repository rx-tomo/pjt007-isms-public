export type DemoRole = 'system_operator' | 'org_admin' | 'auditor' | 'approver' | 'user'
export type DemoPhase = 'initial' | 'surveillance'
export type DemoAvailability = 'ready' | 'unavailable'

export interface PublicDemoPersona {
  personaId: string
  role: DemoRole
  displayName: string
  labelKey: string
  descriptionKey: string
  redirectPath: string
}

export interface PublicDemoScenario {
  scenarioId: string
  title: string
  phase: DemoPhase
  plan: string
  availability: DemoAvailability
  unavailableReason?: string
  personas: PublicDemoPersona[]
}

export interface PublicDemoCatalog {
  catalogVersion: 1
  scenarios: PublicDemoScenario[]
}

function canonicalOrigin(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export function publicDemoOrigin(environment: NodeJS.ProcessEnv = process.env): string | null {
  if (environment.PUBLIC_DEMO_ENABLED !== 'true') return null
  if (environment.VERCEL_ENV !== 'production') return null
  const configured = canonicalOrigin(environment.PUBLIC_DEMO_ORIGIN)
  const application = canonicalOrigin(environment.NEXT_PUBLIC_APP_URL)
  return configured && configured === application ? configured : null
}

export function isDemoSurfaceAvailable(environment: NodeJS.ProcessEnv = process.env): boolean {
  if (environment.NODE_ENV === 'production') return publicDemoOrigin(environment) !== null
  return environment.NEXT_PHASE !== 'phase-production-build' &&
    environment.VERCEL_ENV !== 'preview' &&
    environment.NEXT_PUBLIC_VERCEL_ENV !== 'preview'
}

export function isDemoAuthPathAllowed(pathname: string, method: string): boolean {
  return method === 'POST' && pathname === '/api/demo-auth/demo-login'
}

export function isNormalAuthPathAllowed(pathname: string, method: string, publicDemo: boolean): boolean {
  if (!publicDemo) return true
  return (method === 'GET' && pathname === '/api/auth/get-session') ||
    (method === 'POST' && pathname === '/api/auth/sign-out')
}

export function isPublicDemoApiPathBlocked(pathname: string, method: string): boolean {
  return (pathname === '/api/dev' || pathname.startsWith('/api/dev/')) ||
    ((pathname === '/api/auth' || pathname.startsWith('/api/auth/')) &&
      !isNormalAuthPathAllowed(pathname, method, true))
}

function normalizedCredentialFreeLibsqlUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'libsql:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return `${url.protocol}//${url.host}${url.pathname || '/'}`
  } catch {
    return null
  }
}

export function isPublicDemoDatabaseBindingValid(
  environment: {
    TURSO_DATABASE_URL?: string
    PUBLIC_DEMO_EXPECTED_DATABASE_URL?: string
  } = process.env as {
    TURSO_DATABASE_URL?: string
    PUBLIC_DEMO_EXPECTED_DATABASE_URL?: string
  },
): boolean {
  const configured = normalizedCredentialFreeLibsqlUrl(environment.TURSO_DATABASE_URL)
  const expected = normalizedCredentialFreeLibsqlUrl(environment.PUBLIC_DEMO_EXPECTED_DATABASE_URL)
  return configured !== null && configured === expected
}

export function isPublicDemoExternalEffectBlocked(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/cron/') && pathname !== '/api/cron/reset-demo') return true
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false

  return (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/sign-out') ||
    pathname.startsWith('/api/invitations') ||
    pathname.startsWith('/api/super-admin') ||
    pathname.startsWith('/api/stripe') ||
    pathname.startsWith('/api/billing') ||
    pathname.startsWith('/api/ai') ||
    pathname.startsWith('/api/notifications/deliver') ||
    pathname.startsWith('/api/notifications/invitations') ||
    pathname.startsWith('/api/tasks/reminders') ||
    pathname.startsWith('/api/education/reminders') ||
    pathname.startsWith('/api/audit/follow-up-reminders') ||
    /^\/api\/organizations\/[^/]+\/notification-channels(?:\/|$)/.test(pathname) ||
    pathname.startsWith('/api/storage') ||
    pathname.startsWith('/api/documents/storage-cleanup') ||
    /^\/api\/documents\/[^/]+\/(?:file|versions)(?:\/|$)/.test(pathname) ||
    /^\/api\/tasks\/[^/]+\/attachments(?:\/|$)/.test(pathname)
}
