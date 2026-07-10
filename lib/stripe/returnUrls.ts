const DEFAULT_PUBLIC_ORIGIN = 'https://riscala-ai.com'

function addOrigin(origins: Set<string>, value: string | undefined) {
  if (!value) return
  try {
    const normalized = value.startsWith('http') ? value : `https://${value}`
    const origin = new URL(normalized).origin
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      origins.add(origin)
    }
  } catch {
    // Ignore malformed environment values. Callers still have request origin fallback.
  }
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function shouldTrustRequestOrigin(origin: string) {
  if (process.env.NODE_ENV !== 'production') return true
  return isLocalDevelopmentOrigin(origin)
}

export function getAllowedBillingReturnOrigins(requestUrl: string) {
  const origins = new Set<string>()
  const requestOrigin = new URL(requestUrl).origin
  if (shouldTrustRequestOrigin(requestOrigin)) {
    addOrigin(origins, requestOrigin)
  }
  addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL)
  addOrigin(origins, process.env.NEXT_PUBLIC_SITE_URL)
  addOrigin(origins, process.env.VERCEL_URL)
  addOrigin(origins, DEFAULT_PUBLIC_ORIGIN)
  return origins
}

export function resolveBillingReturnUrl(
  inputUrl: string | undefined,
  requestUrl: string,
  fallbackPath: string
) {
  const baseOrigin = new URL(requestUrl).origin
  const candidate = inputUrl && inputUrl.trim() !== '' ? inputUrl.trim() : fallbackPath

  try {
    const resolved = new URL(candidate, baseOrigin)
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      return null
    }

    const allowedOrigins = getAllowedBillingReturnOrigins(requestUrl)
    if (!allowedOrigins.has(resolved.origin)) {
      return null
    }

    return resolved.toString()
  } catch {
    return null
  }
}
