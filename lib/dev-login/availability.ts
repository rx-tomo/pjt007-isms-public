export function isDevApiAvailable() {
  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  return process.env.E2E_MODE === '1' && process.env.NEXT_PUBLIC_E2E_MODE === '1'
}
