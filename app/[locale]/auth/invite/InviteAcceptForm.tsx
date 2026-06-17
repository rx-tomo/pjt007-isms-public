'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type InvitationDetails = {
  email: string
  organizationId: string
  organizationName: string
  invitedByName: string | null
  role: string
  expiresAt: string
  createdAt: string
}

type ApiError = {
  error?: string
  code?: string
}

type InviteAcceptFormProps = {
  token: string | null
  locale: string
}

export default function InviteAcceptForm({ token, locale }: InviteAcceptFormProps) {
  const t = useTranslations('authInvite')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [fetchErrorCode, setFetchErrorCode] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadInvitation() {
      if (!token) {
        if (isMounted) {
          setFetchErrorCode('TOKEN_REQUIRED')
          setStatus('error')
        }
        return
      }

      setStatus('loading')
      setFetchErrorCode(null)

      try {
        const response = await fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`, {
          cache: 'no-store'
        })
        const body = (await response.json().catch(() => ({}))) as {
          invitation?: InvitationDetails
        } & ApiError

        if (!response.ok || !body.invitation) {
          if (isMounted) {
            setFetchErrorCode(body.code ?? 'UNKNOWN')
            setStatus('error')
          }
          return
        }

        if (isMounted) {
          setInvitation(body.invitation)
          setStatus('ready')
        }
      } catch (error) {
        console.error('Failed to fetch invitation', error)
        if (isMounted) {
          setFetchErrorCode('NETWORK')
          setStatus('error')
        }
      }
    }

    loadInvitation()

    return () => {
      isMounted = false
    }
  }, [token])

  const fetchErrorMessage = useMemo(() => {
    if (!fetchErrorCode) return null

    switch (fetchErrorCode) {
      case 'TOKEN_REQUIRED':
        return t('errors.missingToken')
      case 'NOT_FOUND':
        return t('errors.invalidToken')
      case 'ALREADY_ACCEPTED':
        return t('errors.alreadyAccepted')
      case 'EXPIRED':
        return t('errors.expired')
      case 'ORGANIZATION_NOT_FOUND':
      case 'SERVER_ERROR':
      case 'NETWORK':
        return t('errors.generic')
      default:
        return t('errors.generic')
    }
  }, [fetchErrorCode, t])

  const roleLabel = useMemo(() => {
    if (!invitation) return ''
    try {
      return tCommon(`roles.${invitation.role}` as any)
    } catch (error) {
      return invitation.role
    }
  }, [invitation, tCommon])

  const expiresAtText = useMemo(() => {
    if (!invitation) return ''
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(invitation.expiresAt))
    } catch (error) {
      return invitation.expiresAt
    }
  }, [invitation, locale])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!invitation || !token) {
      setFormError(t('errors.generic'))
      return
    }

    if (!fullName.trim()) {
      setFormError(t('errors.fullNameRequired'))
      return
    }

    if (password.length < 8) {
      setFormError(t('errors.passwordTooShort'))
      return
    }

    setIsSubmitting(true)

    try {
      let userId: string | undefined

      const { authClient } = await import('@/lib/auth/auth-client')
      const result = await authClient.signUp.email({
        email: invitation.email,
        password,
        name: fullName.trim(),
      })
      if (result.error) {
        const msg = (result.error.message || '').toLowerCase()
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          setFormError(t('errors.accountExists'))
        } else {
          setFormError(result.error.message || t('errors.signupFailed'))
        }
        return
      }
      userId = result.data?.user?.id

      if (!userId) {
        setFormError(t('errors.signupFailed'))
        return
      }

      const acceptResponse = await fetch('/api/auth/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId })
      })

      const acceptBody = (await acceptResponse.json().catch(() => ({}))) as {
        organizationId?: string
      } & ApiError

      if (!acceptResponse.ok || !acceptBody.organizationId) {
        switch (acceptBody.code) {
          case 'ALREADY_ACCEPTED':
            setFormError(t('errors.alreadyAccepted'))
            break
          case 'EXPIRED':
            setFormError(t('errors.expired'))
            break
          case 'PROFILE_EXISTS':
          case 'EMAIL_MISMATCH':
          case 'USER_NOT_FOUND':
            setFormError(t('errors.accountExists'))
            break
          default:
            setFormError(acceptBody.error || t('errors.acceptFailed'))
            break
        }
        return
      }

      router.push(`/${locale}/home?organizationId=${acceptBody.organizationId}&onboarding=invite`)
    } catch (error) {
      console.error('Failed to complete invitation signup', error)
      setFormError(t('errors.acceptFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="max-w-md w-full space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-elevated rounded" />
          <div className="h-4 bg-surface-elevated rounded" />
          <div className="h-4 bg-surface-elevated rounded" />
          <div className="h-10 bg-surface-elevated rounded" />
        </div>
        <p className="text-center text-sm text-text-muted">{tCommon('loading')}</p>
      </div>
    )
  }

  if (status === 'error' || !invitation) {
    return (
      <div className="max-w-md w-full space-y-6">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t('errors.title')}</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{fetchErrorMessage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-text-primary">{t('heading')}</h1>
        <p className="text-sm text-text-secondary">{t('subheading', { organization: invitation.organizationName })}</p>
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated p-4 space-y-2 text-sm text-text-secondary">
        <div className="flex justify-between">
          <span className="font-medium">{t('labels.email')}</span>
          <span>{invitation.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">{t('labels.role')}</span>
          <span>{roleLabel}</span>
        </div>
        {invitation.invitedByName && (
          <div className="flex justify-between">
            <span className="font-medium">{t('labels.invitedBy')}</span>
            <span>{invitation.invitedByName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="font-medium">{t('labels.expiresAt')}</span>
          <span>{expiresAtText}</span>
        </div>
      </div>

      {formError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          </div>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="fullName" className="block text-sm font-medium text-text-secondary">
            {t('labels.fullName')}
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            className="block w-full rounded-md border border-border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
            {t('labels.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="block w-full rounded-md border border-border px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={isSubmitting}
            required
          />
          <p className="text-xs text-text-muted">{t('passwordHint')}</p>
        </div>

        <button
          type="submit"
          className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  )
}
