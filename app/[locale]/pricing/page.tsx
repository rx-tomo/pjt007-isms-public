'use client'

import { useState, useEffect, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StripeService, getStripe } from '@/lib/services/stripe'
import { UserService } from '@/lib/services/user'
import type { PricingPlan } from '@/lib/services/stripe'
import { DEFAULT_PRICING_PLANS } from '@/lib/stripe/defaultPricingPlans'

export default function PricingPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('pricing')
  const router = useRouter()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const isStripeConfigured = /^pk_(test|live)_/i.test(publishableKey.trim())
  // サーバー側のmock判定（STRIPE_TEST_MODE=mock / シークレット未設定）をバナー表示に使う
  const [stripeMockMode, setStripeMockMode] = useState(false)

  useEffect(() => {
    loadData()
    fetch('/api/stripe/config-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => setStripeMockMode(Boolean(status?.mockMode)))
      .catch(() => {})
  }, [])

  const loadData = async () => {
    try {
      const stripeService = new StripeService()
      const userService = new UserService()

      try {
        const plansData = await stripeService.getPricingPlans()
        setPlans(plansData.length > 0 ? plansData : [...DEFAULT_PRICING_PLANS])
      } catch (error) {
        console.warn('Falling back to default pricing plans:', error)
        setPlans([...DEFAULT_PRICING_PLANS])
      }

      // Check authentication and current subscription
      const profile = await userService.getUserProfile()
      if (profile) {
        setIsAuthenticated(true)

        if (profile.organization_id) {
          try {
            const subscription = await stripeService.getCurrentSubscription(profile.organization_id)
            setCurrentSubscription(subscription)
          } catch (error) {
            console.warn('Failed to load current subscription:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setPlans([...DEFAULT_PRICING_PLANS])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPlan = async (planId: string) => {
    if (!isAuthenticated) {
      // Redirect to signup with selected plan
      router.push(`/${locale}/auth/signup?plan=${planId}`)
      return
    }

    setSelectedPlan(planId)
    setProcessing(true)

    try {
      const stripeService = new StripeService()
      const userService = new UserService()

      const profile = await userService.getUserProfile()
      if (!profile) throw new Error('User not authenticated')
      if (!profile.organization_id) throw new Error('Organization not found')

      // Create checkout session
      const { sessionId } = await stripeService.createCheckoutSession(
        profile.organization_id,
        planId,
        `${window.location.origin}/${locale}/home?success=true`,
        `${window.location.origin}/${locale}/pricing?canceled=true`
      )

      if (!isStripeConfigured || sessionId.startsWith('cs_test_mock_')) {
        // mockモード: モックチェックアウト画面へ遷移し、購読作成まで通す（GAP-021）
        const plan = plans.find((p) => p.id === planId)
        const query = new URLSearchParams({
          organizationId: profile.organization_id,
          planId,
          locale,
          planName: plan?.name ?? planId,
          amount: String(plan?.price_monthly ?? ''),
        })
        router.push(`/mock/checkout?${query.toString()}`)
        return
      }

      const stripe = await getStripe()
      if (!stripe) {
        alert('Stripe.js の読み込みに失敗しました。公開鍵の設定を確認してください。')
        return
      }

      const { error } = await stripe.redirectToCheckout({ sessionId })

      if (error) {
        console.error('Stripe redirect error:', error)
        alert(error.message)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('決済の開始に失敗しました。もう一度お試しください。')
    } finally {
      setProcessing(false)
    }
  }

  const handleManageSubscription = async () => {
    setProcessing(true)

    try {
      const stripeService = new StripeService()
      const userService = new UserService()

      const profile = await userService.getUserProfile()
      if (!profile) throw new Error('User not authenticated')
      if (!profile.organization_id) throw new Error('Organization not found')

      // Create billing portal session（mockモードでは /mock/portal が返る）
      const { url } = await stripeService.createPortalSession(
        `${window.location.origin}/${locale}/home`,
        locale,
        profile.organization_id
      )

      window.location.href = url
    } catch (error) {
      console.error('Error creating portal session:', error)
      alert('カスタマーポータルへのアクセスに失敗しました。')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app py-12">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-12 bg-surface-elevated rounded w-1/3 mx-auto mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-96 bg-surface-elevated rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <header className="bg-surface shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <Link href={`/${locale}`} className="text-2xl font-bold text-text-primary">
              Riscala AI for ISMS
            </Link>
            <nav className="flex items-center gap-6">
              {isAuthenticated ? (
                <Link href={`/${locale}/home`} className="text-text-secondary hover:text-text-primary">
                  ダッシュボード
                </Link>
              ) : (
                <>
                  <Link href={`/${locale}/auth/login`} className="text-text-secondary hover:text-text-primary">
                    ログイン
                  </Link>
                  <Link href={`/${locale}/auth/signup`} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    無料で始める
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-text-primary mb-4">{t('title')}</h1>
            <p className="text-xl text-text-secondary">{t('subtitle')}</p>
          </div>

          {/* Test Mode Banner (GAP-022) */}
          {(stripeMockMode || !isStripeConfigured) && (
            <div className="mb-8 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 text-center">
              {t('testModeNotice')}
            </div>
          )}

          {/* Current Subscription Banner */}
          {currentSubscription && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-blue-900">
                    現在のプラン: <span className="font-semibold">{currentSubscription.pricing_plan?.name}</span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    ステータス: {t(`status.${currentSubscription.status}`)}
                  </p>
                </div>
                <button
                  onClick={handleManageSubscription}
                  disabled={processing}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? '処理中...' : 'プランを管理'}
                </button>
              </div>
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {plans.map((plan) => {
              const isCurrentPlan = currentSubscription?.pricing_plan_id === plan.id
              const isTrialPlan = plan.name === 'トライアル'

              return (
                <div
                  key={plan.id}
                  className={`bg-surface rounded-lg shadow-lg overflow-hidden ${
                    plan.name === 'スタンダードプラン' ? 'ring-2 ring-blue-600' : ''
                  }`}
                >
                  {plan.name === 'スタンダードプラン' && (
                    <div className="bg-blue-600 text-white text-center py-2 text-sm font-medium">
                      おすすめ
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-text-primary mb-2">{plan.name}</h3>
                    <p className="text-sm text-text-secondary mb-4">{plan.description}</p>

                    <div className="mb-6">
                      {isTrialPlan ? (
                        <div>
                          <span className="text-3xl font-bold text-text-primary">14日間</span>
                          <span className="text-text-secondary ml-1">無料</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-3xl font-bold text-text-primary">
                            ¥{plan.price_monthly.toLocaleString()}
                          </span>
                          <span className="text-text-secondary ml-1">/月</span>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-text-secondary">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-2 px-4 bg-surface-elevated text-text-muted rounded-md cursor-not-allowed"
                      >
                        現在のプラン
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={processing && selectedPlan === plan.id}
                        className={`w-full py-2 px-4 rounded-md transition-colors ${
                          plan.name === 'スタンダードプラン'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-surface-elevated text-text-primary hover:bg-surface-hover'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {processing && selectedPlan === plan.id
                          ? '処理中...'
                          : isTrialPlan
                          ? '無料で始める'
                          : 'このプランを選択'
                        }
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Additional Info */}
          <div className="mt-16 text-center">
            <p className="text-text-secondary mb-8">
              すべてのプランに含まれるもの: SSL証明書、99.9%稼働率保証、24時間365日監視
            </p>

            <div className="bg-surface-elevated rounded-lg p-8 max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold text-text-primary mb-4">よくある質問</h3>
              <div className="space-y-4 text-left">
                <div>
                  <h4 className="font-medium text-text-primary">支払い方法は？</h4>
                  <p className="text-sm text-text-secondary mt-1">
                    クレジットカード（Visa、Mastercard、American Express）でのお支払いに対応しています。
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">いつでもキャンセルできますか？</h4>
                  <p className="text-sm text-text-secondary mt-1">
                    はい、いつでもキャンセル可能です。次回請求日までサービスをご利用いただけます。
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">プランの変更は可能ですか？</h4>
                  <p className="text-sm text-text-secondary mt-1">
                    はい、いつでもアップグレード・ダウングレードが可能です。日割り計算で調整されます。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
