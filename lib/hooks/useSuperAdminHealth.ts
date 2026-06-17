'use client'

export type SuperAdminHealthAlert = {
  type: 'failure' | 'standby'
  queueLength?: number
  failoverState?: 'primary' | 'standby'
  lastDeployAt?: string | null
  details?: string
}

/**
 * Stub hook — legacy Edge Function health endpoint has been removed.
 * Returns null for both health and alert.
 */
export function useSuperAdminHealth() {
  return { health: null, alert: null as SuperAdminHealthAlert | null }
}
