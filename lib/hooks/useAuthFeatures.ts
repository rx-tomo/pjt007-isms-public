'use client'

import { useEffect, useMemo, useState } from 'react'

type AuthFeaturesApiResponse = {
  mfaRequiredRoles: string[]
  ssoProviders: string[]
  dummyOtp: string | null
  otpTtlMinutes: number
}

export type AuthFeaturesPayload = AuthFeaturesApiResponse & {
  mfaEnabled: boolean
  ssoEnabled: boolean
}

export function useAuthFeatures() {
  const [features, setFeatures] = useState<AuthFeaturesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchFeatures() {
      try {
        const response = await fetch('/api/auth/features', { signal: controller.signal })
        if (!response.ok) {
          throw new Error('Failed to load auth configuration')
        }
        const payload: AuthFeaturesApiResponse = await response.json()
        setFeatures({
          ...payload,
          mfaEnabled: payload.mfaRequiredRoles.length > 0,
          ssoEnabled: payload.ssoProviders.length > 0,
        })
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') {
          return
        }
        console.error('[useAuthFeatures] failed to load features', err)
        setError('Failed to load authentication configuration')
      } finally {
        setLoading(false)
      }
    }

    fetchFeatures()

    return () => controller.abort()
  }, [])

  const summary = useMemo(() => {
    if (!features) return null
    return {
      roles: features.mfaRequiredRoles,
      providers: features.ssoProviders,
    }
  }, [features])

  return { features, loading, error, summary }
}
