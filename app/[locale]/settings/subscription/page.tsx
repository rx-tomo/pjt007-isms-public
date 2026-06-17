'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { StripeService, type Subscription } from '@/lib/services/stripe'
import { UserService } from '@/lib/services/user'
import DataExportSection from '@/components/settings/subscription/DataExportSection'

interface SubscriptionData {
  id: string
  organization_id: string
  pricing_plan_id: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  trial_end: string | null
  pricing_plan?: {
    name: string
    name_en?: string
    price_monthly: number
    price_yearly?: number
    max_users?: number
    max_documents?: number
    features?: string[] | { features: string[] }
  }
}

interface UsageData {
  current_users: number
  current_documents: number
  storage_used_mb: number
}

async function fetchUsageData(organizationId: string): Promise<UsageData> {
  const params = new URLSearchParams({ organizationId })
  const response = await fetch(`/api/stripe/usage?${params.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error ?? `API error ${response.status}`)
  }

  const payload = await response.json()
  return payload.data
}

export default function SubscriptionPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.subscription')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const portalFlag = searchParams?.get('portal') ?? ''
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [portalMessage, setPortalMessage] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const isStripeConfigured = publishableKey.trim() !== '' && !publishableKey.includes('...')
  // サーバー側のmock判定（STRIPE_TEST_MODE=mock / シークレット未設定）をバナー表示に使う
  const [stripeMockMode, setStripeMockMode] = useState(false)

  useEffect(() => {
    fetch('/api/stripe/config-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => setStripeMockMode(Boolean(status?.mockMode)))
      .catch(() => {})
  }, [])

  const stripeService = useMemo(() => new StripeService(), [])
  const userService = useMemo(() => new UserService(), [])
  const isE2E = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_E2E_MODE === '1'

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setPortalMessage(null)
    try {
      let orgId: string | null = null
      // ユーザー権限チェック（まずは通常の手順）
      const user = await userService.getCurrentUser()
      if (user && ['org_admin', 'system_operator'].includes(user.role)) {
        orgId = user.organization_id
      } else if (isE2E) {
        // E2Eモードで未認証の場合のみ、モック購読で画面を表示
        orgId = 'e2e-org'
      } else {
        router.push(`/${locale}/home`)
        return
      }

      const targetOrgId = orgId ?? user?.organization_id ?? null

      if (!targetOrgId) {
        router.push(`/${locale}/home`)
        return
      }

      setOrganizationId(targetOrgId)

      const shouldSyncFromPortal = portalFlag !== ''

      let syncedSubscription: Subscription | null = null

      if (shouldSyncFromPortal && isStripeConfigured) {
        try {
          syncedSubscription = await stripeService.syncSubscriptionFromStripe(targetOrgId)
          setPortalMessage(t('messages.portalSynced'))
        } catch (syncError) {
          console.error('Failed to sync subscription after portal redirect:', syncError)
          setError(t('errors.portalSyncFailed'))
        } finally {
          const params = new URLSearchParams(searchParams?.toString() ?? '')
          params.delete('portal')
          const nextPath = params.toString()
            ? `/${locale}/settings/subscription?${params.toString()}`
            : `/${locale}/settings/subscription`
          router.replace(nextPath)
        }
      }

      // サブスクリプション情報を取得
      const [sub, currentUsage] = await Promise.all([
        syncedSubscription
          ? Promise.resolve(syncedSubscription)
          : stripeService.getCurrentSubscription(targetOrgId),
        fetchUsageData(targetOrgId)
      ])

      if (sub) {
        const subData: SubscriptionData = {
          id: sub.id,
          organization_id: sub.organization_id || targetOrgId,
          pricing_plan_id: sub.pricing_plan_id,
          status: sub.status,
          current_period_start: sub.current_period_start || '',
          current_period_end: sub.current_period_end || '',
          cancel_at_period_end: sub.cancel_at ? true : false,
          canceled_at: sub.canceled_at || null,
          trial_end: sub.trial_end || null,
          pricing_plan: sub.pricing_plan
        }
        setSubscription(subData)
      } else {
        setSubscription(null)
      }
      setUsage(currentUsage)
    } catch (err) {
      console.error('Error loading subscription data:', err)
      setError(t('errors.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [isE2E, isStripeConfigured, locale, portalFlag, router, searchParams, stripeService, t, userService])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleManageSubscription = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const returnUrl = `${window.location.origin}/${locale}/settings/subscription?portal=1`
      // mockモードでは /mock/portal が返るのでそのまま遷移する
      const { url } = await stripeService.createPortalSession(returnUrl, locale, organizationId ?? undefined)

      window.location.href = url
    } catch (err) {
      console.error('Error creating billing portal session:', err)
      setError(t('errors.portalFailed'))
      setIsProcessing(false)
    }
  }

  const handleUpgradePlan = () => {
    router.push(`/${locale}/pricing`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
      <div className="max-w-7xl mx-auto">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-text-primary sm:text-3xl sm:truncate">
              {t('title')}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
          </div>
        </div>

        {/* Test Mode Banner (GAP-022) */}
        {(stripeMockMode || !isStripeConfigured) && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
            {t('testModeNotice')}
          </div>
        )}

        {portalMessage && (
          <div className="rounded-md bg-green-50 p-4 mb-6">
            <p className="text-sm text-green-800">{portalMessage}</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 現在のプラン */}
        <div className="bg-surface shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-text-primary">
              {t('currentPlan.title')}
            </h3>
          </div>
          <div className="border-t border-border px-4 py-5 sm:px-6">
            {subscription && subscription.pricing_plan ? (
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-text-muted">{t('fields.planName')}</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {locale === 'ja' ? subscription.pricing_plan.name : (subscription.pricing_plan.name_en || subscription.pricing_plan.name)}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-text-muted">{t('fields.status')}</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      subscription.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : subscription.status === 'trialing'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-surface-elevated text-text-primary'
                    }`}>
                      {t(`status.${subscription.status}`)}
                    </span>
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-text-muted">{t('fields.currentPeriod')}</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {new Date(subscription.current_period_start).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')} - {new Date(subscription.current_period_end).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-text-muted">{t('fields.price')}</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    ¥{subscription.pricing_plan.price_monthly.toLocaleString()}/{t('perMonth')}
                  </dd>
                </div>
                {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-text-muted">{t('fields.trialEnd')}</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      {new Date(subscription.trial_end).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}
                    </dd>
                  </div>
                )}
                {subscription.cancel_at_period_end && (
                  <div className="sm:col-span-2">
                    <div className="rounded-md bg-yellow-50 p-4">
                      <p className="text-sm text-yellow-800">
                        {t('cancelScheduled', { date: new Date(subscription.current_period_end).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US') })}
                      </p>
                    </div>
                  </div>
                )}
              </dl>
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted">{t('noSubscription')}</p>
                <button
                  onClick={handleUpgradePlan}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {t('actions.selectPlan')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 使用状況 */}
        {usage && subscription && (
          <div className="bg-surface shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-text-primary">
                {t('usage.title')}
              </h3>
            </div>
            <div className="border-t border-border px-4 py-5 sm:px-6">
              <div className="space-y-4">
                {/* ユーザー数 */}
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-text-secondary">{t('usage.users')}</span>
                    <span className="text-text-primary">
                      {usage.current_users} / {subscription.pricing_plan?.max_users === -1 || !subscription.pricing_plan?.max_users ? '∞' : subscription.pricing_plan.max_users}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-surface-elevated rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: subscription.pricing_plan?.max_users === -1 || !subscription.pricing_plan?.max_users
                          ? '0%'
                          : `${Math.min((usage.current_users / subscription.pricing_plan.max_users) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* 文書数 */}
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-text-secondary">{t('usage.documents')}</span>
                    <span className="text-text-primary">
                      {usage.current_documents} / {subscription.pricing_plan?.max_documents === -1 || !subscription.pricing_plan?.max_documents ? '∞' : subscription.pricing_plan.max_documents}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-surface-elevated rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: subscription.pricing_plan?.max_documents === -1 || !subscription.pricing_plan?.max_documents
                          ? '0%'
                          : `${Math.min((usage.current_documents / subscription.pricing_plan.max_documents) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* ストレージ */}
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-text-secondary">{t('usage.storage')}</span>
                    <span className="text-text-primary">
                      {(usage.storage_used_mb / 1024).toFixed(2)} GB
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-surface-elevated rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: '10%' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* プラン機能 */}
        {subscription && subscription.pricing_plan && subscription.pricing_plan.features && (
          <div className="bg-surface shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-text-primary">
                {t('features.title')}
              </h3>
            </div>
            <div className="border-t border-border px-4 py-5 sm:px-6">
              <ul className="space-y-3">
                {(Array.isArray(subscription.pricing_plan.features)
                  ? subscription.pricing_plan.features
                  : (subscription.pricing_plan.features as any).features || []
                ).map((feature: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-3 text-sm text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* データ管理 */}
        {subscription && (
          <DataExportSection
            organizationId={subscription.organization_id}
            subscriptionStatus={subscription.status}
            cancelAtPeriodEnd={subscription.cancel_at_period_end}
            canceledAt={subscription.canceled_at}
            currentPeriodEnd={subscription.current_period_end}
            locale={locale}
          />
        )}

        {/* アクション */}
        <div className="flex flex-col sm:flex-row gap-4">
          {subscription ? (
            <>
              <button
                data-testid="manage-billing"
                onClick={handleManageSubscription}
                disabled={isProcessing}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isProcessing ? t('actions.processing') : t('actions.manageBilling')}
              </button>
              <button
                onClick={handleUpgradePlan}
                className="inline-flex justify-center py-2 px-4 border border-border shadow-sm text-sm font-medium rounded-md text-text-primary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {t('actions.changePlan')}
              </button>
            </>
          ) : (
            <button
              onClick={handleUpgradePlan}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('actions.selectPlan')}
            </button>
          )}
        </div>
      </div>
  )
}
