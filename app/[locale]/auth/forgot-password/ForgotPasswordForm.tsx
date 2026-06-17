'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface ForgotPasswordFormProps {
  locale: string
}

export default function ForgotPasswordForm({ locale }: ForgotPasswordFormProps) {
  const t = useTranslations('auth')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { authClient } = await import('@/lib/auth/auth-client')
      const forgetPassword = (authClient as any).forgetPassword as (opts: { email: string; redirectTo: string }) => Promise<{ error?: { message?: string } }>
      const result = await forgetPassword({
        email,
        redirectTo: `${window.location.origin}/${locale}/auth/reset-password`,
      })
      if (result.error) {
        throw new Error(result.error.message || t('forgotPassword.errors.sendFailed'))
      }
      setIsSent(true)
    } catch (err: any) {
      setError(err.message || t('forgotPassword.errors.sendFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-text-primary">
            {t('forgotPassword.sentTitle')}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t('forgotPassword.sentDescription')}
          </p>
        </div>
        <div className="text-center">
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-text-primary">
          {t('forgotPassword.title')}
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          {t('forgotPassword.description')}
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
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
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-border placeholder-text-muted text-text-primary focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder={t('common.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              t('forgotPassword.submit')
            )}
          </button>
        </div>

        <div className="text-center">
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </form>
    </div>
  )
}
