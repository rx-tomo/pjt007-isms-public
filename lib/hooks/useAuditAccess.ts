'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserService } from '@/lib/services/user'
import type { UserProfile } from '@/lib/services/user'
import type { PermissionSet } from '@/lib/services/permissions'

const AUDIT_ALLOWED_ROLES = new Set<UserProfile['role']>([
  'auditor',
  'org_admin',
  'system_operator'
])

type AuditAccessError = 'not_authenticated' | 'permission_fetch_failed' | 'access_denied' | null

interface AuditAccessState {
  isAuthorized: boolean
  isLoading: boolean
  error: AuditAccessError
  profile: UserProfile | null
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
    const userService = new UserService()

    async function verifyAccess() {
      try {
        const profile = await userService.getCurrentUser()
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

        let isAuthorized = AUDIT_ALLOWED_ROLES.has(profile.role)

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
