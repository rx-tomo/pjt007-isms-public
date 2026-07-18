interface PlaywrightServerIdentity {
  app?: unknown
  nonce?: unknown
}

export function assertPlaywrightServerIdentity(
  identity: PlaywrightServerIdentity,
  expectedNonce: string | undefined
): void {
  if (!expectedNonce) {
    throw new Error('PLAYWRIGHT_RUN_NONCE is required for Playwright server identity checks')
  }
  if (identity.app !== 'riscala-isms') {
    throw new Error('E2E server identity does not match Riscala ISMS')
  }
  if (identity.nonce !== expectedNonce) {
    throw new Error('E2E server nonce does not match this Playwright run')
  }
}
