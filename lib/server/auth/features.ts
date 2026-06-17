const parseList = (value?: string | null) => {
  if (!value) return []
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

const parseNormalizedList = (value?: string | null) =>
  parseList(value).map(entry => entry.toLowerCase())

export interface AuthFeatures {
  mfaRequiredRoles: string[]
  ssoProviders: string[]
  dummyOtp: string | null
  otpTtlMinutes: number
}

export const getAuthFeatures = (): AuthFeatures => {
  const mfaRequiredRoles = parseNormalizedList(process.env.AUTH_MFA_REQUIRED_ROLES)
  const ssoProviders = parseList(
    process.env.NEXT_PUBLIC_AUTH_SSO_PROVIDERS || process.env.AUTH_SSO_PROVIDERS
  )
  const dummyOtp = process.env.AUTH_MFA_DUMMY_CODE?.trim() || null
  const otpTtlMinutes = Number(process.env.AUTH_MFA_CODE_TTL_MINUTES) || 5

  return {
    mfaRequiredRoles,
    ssoProviders,
    dummyOtp,
    otpTtlMinutes,
  }
}

export const requiresMfaForRole = (role?: string | null) => {
  if (!role) return false
  const normalizedRole = role.toLowerCase()
  const { mfaRequiredRoles } = getAuthFeatures()

  return mfaRequiredRoles.includes(normalizedRole) || mfaRequiredRoles.includes('all')
}
