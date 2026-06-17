'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { UserService } from '@/lib/services/user'
import { useTheme, type AppTheme } from '@/components/providers/ThemeProvider'
import { useToast } from '@/components/ui/ToastProvider'

interface ProfileData {
  id: string
  email: string
  full_name: string
  full_name_en: string | null
  department: string | null
  position: string | null
  phone: string | null
  language_preference: 'ja' | 'en'
}

export default function ProfileSettingsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.profile')
  const tSettings = useTranslations('settings')
  const router = useRouter()
  const userService = useMemo(() => new UserService(), [])
  const { pushToast } = useToast()
  const { theme, setTheme } = useTheme()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // フォームデータ
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_en: '',
    department: '',
    position: '',
    phone: '',
    language_preference: locale as 'ja' | 'en'
  })

  // パスワード変更フォーム
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const currentUser = await userService.getCurrentUser()

      if (!currentUser) {
        router.push(`/${locale}/auth/login`)
        return
      }

      setProfile(currentUser as any)
      setFormData({
        full_name: currentUser.full_name || '',
        full_name_en: currentUser.full_name_en || '',
        department: currentUser.department || '',
        position: currentUser.position || '',
        phone: currentUser.phone || '',
        language_preference: currentUser.language_preference as 'ja' | 'en' || locale as 'ja' | 'en'
      })
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(t('errors.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [locale, router, t, userService])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as AppTheme)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setIsSaving(true)
    setError(null)

    try {
      await userService.updateUserProfile(profile.id, {
        full_name: formData.full_name,
        full_name_en: formData.full_name_en || null,
        department: formData.department || null,
        position: formData.position || null,
        phone: formData.phone || null,
        language_preference: formData.language_preference
      })

      pushToast({ message: t('success.saved'), variant: 'success' })

      // 言語設定が変更された場合、ページをリロード
      if (formData.language_preference !== locale) {
        router.push(`/${formData.language_preference}/settings/profile`)
      }
    } catch (err: any) {
      setError(err.message || t('errors.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t('errors.passwordMismatch'))
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setError(t('errors.passwordTooShort'))
      return
    }

    setIsChangingPassword(true)
    setError(null)

    try {
      const { authClient } = await import('@/lib/auth/auth-client')
      const result = await authClient.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      if (result.error) throw new Error(result.error.message || t('errors.passwordChangeFailed'))

      pushToast({ message: t('success.passwordChanged'), variant: 'success' })
      setShowPasswordForm(false)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (err: any) {
      setError(err.message || t('errors.passwordChangeFailed'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-text-primary sm:text-3xl sm:truncate">
              {t('title')}
            </h2>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* プロファイル編集フォーム */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
            <div className="md:grid md:grid-cols-3 md:gap-6">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium leading-6 text-text-primary">
                  {t('sections.basic')}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {t('sections.basicDescription')}
                </p>
              </div>

              <div className="mt-5 md:mt-0 md:col-span-2">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6">
                    <label className="block text-sm font-medium text-text-secondary">
                      {t('fields.email')}
                    </label>
                    <input
                      type="email"
                      disabled
                      className="mt-1 block w-full shadow-sm sm:text-sm border-border rounded-md bg-surface-elevated"
                      value={profile?.email || ''}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="full_name" className="block text-sm font-medium text-text-secondary">
                      {t('fields.fullName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      id="full_name"
                      required
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.full_name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="full_name_en" className="block text-sm font-medium text-text-secondary">
                      {t('fields.fullNameEn')}
                    </label>
                    <input
                      type="text"
                      name="full_name_en"
                      id="full_name_en"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.full_name_en}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="department" className="block text-sm font-medium text-text-secondary">
                      {t('fields.department')}
                    </label>
                    <input
                      type="text"
                      name="department"
                      id="department"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.department}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="position" className="block text-sm font-medium text-text-secondary">
                      {t('fields.position')}
                    </label>
                    <input
                      type="text"
                      name="position"
                      id="position"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.position}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="phone" className="block text-sm font-medium text-text-secondary">
                      {t('fields.phone')}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="language_preference" className="block text-sm font-medium text-text-secondary">
                      {t('fields.language')}
                    </label>
                    <select
                      id="language_preference"
                      name="language_preference"
                      className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={formData.language_preference}
                      onChange={handleInputChange}
                    >
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSaving ? t('actions.saving') : t('actions.save')}
            </button>
          </div>
        </form>

        <div className="mt-6 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <h3 className="text-lg font-medium leading-6 text-text-primary">
                {tSettings('appearance.title')}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {tSettings('appearance.description')}
              </p>
            </div>

            <div className="mt-5 md:mt-0 md:col-span-2">
              <label htmlFor="theme-select" className="sr-only">
                {tSettings('appearance.title')}
              </label>
              <select
                id="theme-select"
                data-testid="theme-select"
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                value={theme}
                onChange={handleThemeChange}
              >
                <option value="light">{tSettings('appearance.themeLight')}</option>
                <option value="dark">{tSettings('appearance.themeDark')}</option>
                <option value="liquid-glass">{tSettings('appearance.themeLiquidGlass')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* パスワード変更セクション */}
        <div className="mt-6 bg-surface shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <h3 className="text-lg font-medium leading-6 text-text-primary">
                {t('sections.security')}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {t('sections.securityDescription')}
              </p>
            </div>

            <div className="mt-5 md:mt-0 md:col-span-2">
              {!showPasswordForm ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-border shadow-sm text-sm font-medium rounded-md text-text-primary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {t('actions.changePassword')}
                </button>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-text-secondary">
                        {t('fields.currentPassword')}
                      </label>
                      <input
                        type="password"
                        name="currentPassword"
                        id="currentPassword"
                        required
                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordInputChange}
                      />
                    </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary">
                      {t('fields.newPassword')}
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      id="newPassword"
                      required
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordInputChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary">
                      {t('fields.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      id="confirmPassword"
                      required
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordInputChange}
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {isChangingPassword ? t('actions.changing') : t('actions.change')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false)
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                      }}
                      className="inline-flex justify-center py-2 px-4 border border-border shadow-sm text-sm font-medium rounded-md text-text-primary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {t('actions.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
