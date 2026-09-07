'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CurrentUserProfile } from '@/lib/services/user'
import type { PermissionSet } from '@/lib/services/permissions'

type AuditAccessError = 'not_authenticated' | 'permission_fetch_failed' | 'access_denied' | null

interface AuditAccessState {
  isAuthorized: boolean
  isLoading: boolean
  error: AuditAccessError
  profile: CurrentUserProfile | null
  permissions: PermissionSet | null
}

export function useAuditAccess(): AuditAccessState {
  const [state, setState] = useState<AuditAccessState>({
    isAuthorized: false,
    isLoading: true,
    error: null,
    profile: null,
    permissions: null
  })

  useEffect(() => {
    let isMounted = true

    async function verifyAccess() {
      try {
        const response = await fetch('/api/auth/profile', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })
        const payload = response.ok
          ? await response.json() as { profile?: CurrentUserProfile | null }
          : {}
        const profile = payload.profile ?? null
        if (!profile) {
          if (isMounted) {
            setState({
              isAuthorized: false,
              isLoading: false,
              error: 'not_authenticated',
              profile: null,
              permissions: null
            })
          }
          return
        }

        const isAuthorized = profile.effective_capabilities?.modules.audit.read === true

        if (!isAuthorized) {
          if (isMounted) {
            setState({
              isAuthorized: false,
              isLoading: false,
              error: 'access_denied',
              profile,
              permissions: null
            })
          }
          return
        }

        if (isMounted) {
          setState({
            isAuthorized: true,
            isLoading: false,
            error: null,
            profile,
            permissions: null
          })
        }
      } catch (error) {
        console.error('Failed to verify audit access', error)
        if (isMounted) {
          setState({
            isAuthorized: false,
            isLoading: false,
            error: 'permission_fetch_failed',
            profile: null,
            permissions: null
          })
        }
      }
    }

    verifyAccess()

    return () => {
      isMounted = false
    }
  }, [])

  return useMemo(() => state, [state])
}
