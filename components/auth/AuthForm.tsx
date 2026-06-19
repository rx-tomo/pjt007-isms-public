'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { authClient } from '@/lib/auth/auth-client'
import { isSameOriginPath } from '@/lib/auth/redirect-utils'

type AuthMode = 'login' | 'signup'

interface AuthFormProps {
  mode: AuthMode
  locale: string
}

export default function AuthForm({ mode, locale }: AuthFormProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  // GAP-020 / F-1: 未認証リダイレクト元への復帰先。オープンリダイレクト防止のため
  // isSameOriginPath で同一オリジンのパスのみ許可する（不正値は /home へフォールバック）
  const redirectParam = searchParams.get('redirect')
  const postLoginPath =
    redirectParam && typeof window !== 'undefined' && isSameOriginPath(redirectParam, window.location.origin)
      ? redirectParam
      : `/${locale}/home`
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAwaitingMfa, setIsAwaitingMfa] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const emailVerificationSetting = (process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION || '').toLowerCase()
  const emailVerificationRequired = ['true', '1', 'yes', 'on'].includes(emailVerificationSetting)
  const ssoProviders = (process.env.NEXT_PUBLIC_AUTH_SSO_PROVIDERS || '')
    .split(',')
    .map(provider => provider.trim())
    .filter(Boolean)

  // フォームデータ
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    organizationName: '',
    agreeToTerms: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (mode === 'login' && isAwaitingMfa) {
        // Verify TOTP code via Better Auth client
        const verifyResult = await authClient.twoFactor.verifyTotp({
          code: mfaCode,
        })

        if (verifyResult.error) {
          throw new Error(verifyResult.error.message || t('errors.mfaVerificationFailed'))
        }

        router.push(postLoginPath)
        return
      }

      if (mode === 'signup') {
        // サインアップ処理
        if (formData.password !== formData.confirmPassword) {
          throw new Error(t('errors.passwordMismatch'))
        }

        if (!formData.agreeToTerms) {
          throw new Error(t('errors.mustAgreeToTerms'))
        }

        // 1. 認証プロバイダーでユーザー作成
        let authUserId: string | undefined
        let hasSession = false
        let emailConfirmedAt: string | null | undefined = undefined

        const result = await authClient.signUp.email({
          email: formData.email,
          password: formData.password,
          name: formData.fullName,
        })
        if (result.error) throw new Error(result.error.message || t('errors.signupFailed'))
        authUserId = result.data?.user?.id
        hasSession = !!result.data?.token
        emailConfirmedAt = result.data?.user?.emailVerified ? 'verified' : null

        // 2. 組織とユーザープロファイルの作成（サーバーサイドで処理）
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: authUserId,
            email: formData.email,
            fullName: formData.fullName,
            organizationName: formData.organizationName,
            language: locale
          }),
        })

        const signupResult = await response.json()

        if (!response.ok) {
          throw new Error(signupResult.error || t('errors.signupFailed'))
        }

        const verificationPending =
          emailVerificationRequired ||
          (!hasSession && !emailConfirmedAt)

        if (verificationPending) {
          const encodedEmail = encodeURIComponent(formData.email)
          router.push(`/${locale}/auth/verify-email?email=${encodedEmail}`)
        } else {
          router.push(`/${locale}/home?onboarding=success`)
        }
      } else {
        // ログイン処理
        setIsAwaitingMfa(false)
        setMfaCode('')

        const loginResult = await authClient.signIn.email({
          email: formData.email,
          password: formData.password,
        })
        if (loginResult.error) {
          const message = (loginResult.error.message || '').toLowerCase()
          if (message.includes('email not verified') || message.includes('email_not_verified')) {
            setError(t('errors.emailNotConfirmed'))
            return
          }
          throw new Error(loginResult.error.message || t('errors.unknownError'))
        }

        // Check if user has MFA enabled
        try {
          const statusResponse = await fetch('/api/auth/mfa/status')
          if (statusResponse.ok) {
            const statusPayload = await statusResponse.json()
            if (statusPayload?.requiresMfa) {
              setIsAwaitingMfa(true)
              return
            }
          }
        } catch (statusError) {
          console.warn('Failed to fetch MFA status', statusError)
        }

        // ダッシュボード（またはリダイレクト元）へ
        router.push(postLoginPath)
      }
    } catch (err: any) {
      setError(err.message || t('errors.unknownError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-text-primary">
          {mode === 'login' ? t('login.title') : t('signup.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary">
          {mode === 'login' ? (
            <>
              {t('login.noAccount')}{' '}
              <Link
                href={`/${locale}/auth/signup`}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('login.signupLink')}
              </Link>
            </>
          ) : (
            <>
              {t('signup.hasAccount')}{' '}
              <Link
                href={`/${locale}/auth/login`}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('signup.loginLink')}
              </Link>
            </>
          )}
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-red-50 p-4" data-testid="auth-error">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {mode === 'login' && ssoProviders.length > 0 && (
          <div className="rounded-md border border-border bg-surface p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary mb-2">{t('login.ssoComingSoon')}</p>
            <div className="flex flex-col gap-2">
              {ssoProviders.map(provider => (
                <button
                  key={provider}
                  type="button"
                  disabled
                  className="flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary opacity-70"
                >
                  {t('login.ssoButton', { provider })}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">{t('login.ssoHelp')}</p>
          </div>
        )}

        {mode === 'login' && isAwaitingMfa && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p className="font-semibold">{t('mfa.header')}</p>
            <p className="mt-1 text-xs text-indigo-800">{t('mfa.description')}</p>
            <label htmlFor="mfaCode" className="mt-3 block text-xs font-medium uppercase tracking-wide">
              {t('mfa.codeLabel')}
            </label>
            <input
              id="mfaCode"
              name="mfaCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="mt-1 w-full rounded-md border border-indigo-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={mfaCode}
              onChange={event => setMfaCode(event.target.value)}
            />
          </div>
        )}

        <div className="rounded-md shadow-sm -space-y-px">
          {mode === 'signup' && (
            <>
              <div>
                <label htmlFor="fullName" className="sr-only">
                  {t('signup.fullName')}
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-border placeholder:text-text-muted text-text-primary rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder={t('signup.fullName')}
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="organizationName" className="sr-only">
                  {t('signup.organizationName')}
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-border placeholder:text-text-muted text-text-primary focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder={t('signup.organizationName')}
                  value={formData.organizationName}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="sr-only">
              {t('common.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-border placeholder:text-text-muted text-text-primary ${
                mode === 'login' ? 'rounded-t-md' : ''
              } focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
              placeholder={t('common.email')}
              value={formData.email}
              onChange={handleInputChange}
              disabled={isAwaitingMfa}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              {t('common.password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-border placeholder:text-text-muted text-text-primary ${
                mode === 'login' ? 'rounded-b-md' : ''
              } focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
              placeholder={t('common.password')}
              value={formData.password}
              onChange={handleInputChange}
              disabled={isAwaitingMfa}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                {t('signup.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-border placeholder:text-text-muted text-text-primary rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder={t('signup.confirmPassword')}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={isAwaitingMfa}
              />
            </div>
          )}
        </div>

        {mode === 'login' && (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                href={`/${locale}/auth/forgot-password`}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('login.forgotPassword')}
              </Link>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div className="flex items-center">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-border rounded"
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
            />
            <label htmlFor="agreeToTerms" className="ml-2 block text-sm text-text-primary">
              {t('signup.agreeToTerms')}{' '}
              <Link
                href={`/${locale}/terms`}
                className="text-indigo-600 hover:text-indigo-500"
                target="_blank"
              >
                {t('signup.termsLink')}
              </Link>
            </label>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isLoading || (mode === 'login' && isAwaitingMfa && mfaCode.trim().length === 0)}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : mode === 'login' ? (
              isAwaitingMfa ? t('mfa.submit') : t('login.submit')
            ) : (
              t('signup.submit')
            )}
          </button>
        </div>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
          <Link
            href={`/${locale}/dev-login`}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-600"
          >
            {t('common.devLogin')}
          </Link>
        </div>
      </form>
    </div>
  )
}
