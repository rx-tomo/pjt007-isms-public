type E2EEnvironment = Record<string, string | undefined>

export function isTrustedE2EServerEnvironment(
  environment: E2EEnvironment = process.env
): boolean {
  if (environment.E2E_MODE !== '1') return false
  if (environment.NODE_ENV !== 'production') return true

  return environment.CI === 'true' && environment.E2E_CI_SERVER === '1'
}
