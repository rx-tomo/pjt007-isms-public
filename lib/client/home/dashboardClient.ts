import type { HomeDashboard, HomeOrganization, IsmsPhase } from '@/lib/client/home/dashboardContract'

export async function getHomeDashboard(): Promise<HomeDashboard | null> {
  const response = await fetch('/api/home/dashboard', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 401 || response.status === 404) return null
  if (!response.ok) throw new Error(`Home dashboard request failed: ${response.status}`)
  const payload = await response.json() as { data?: HomeDashboard }
  return payload.data ?? null
}

/** Explicit phase mutation; it is intentionally separate from the initial read. */
export async function updateHomePhase(
  organizationId: string,
  phase: IsmsPhase,
): Promise<HomeOrganization> {
  const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ action: 'updateIsmsPhase', phase, source: 'wizard' }),
  })
  if (!response.ok) throw new Error(`Home phase update failed: ${response.status}`)
  const payload = await response.json() as { data?: HomeOrganization; organization?: HomeOrganization }
  return payload.data ?? payload.organization ?? ({} as HomeOrganization)
}
