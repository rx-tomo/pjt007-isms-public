'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

// Stripe mockモードのチェックアウト画面（GAP-021）。
// /mock/portal と同パターン: [locale] 外・認証不要のモックUI。
// pricing ページから organizationId / planId / locale / planName / amount を受け取り、
// 「支払いを完了する」で /api/stripe/mock/complete を呼んで購読を作成する。

const SUPPORTED_LOCALES = ['ja', 'en', 'zh'] as const
type MockLocale = (typeof SUPPORTED_LOCALES)[number]

const COPY: Record<MockLocale, {
  title: string
  notice: string
  plan: string
  amount: string
  perMonth: string
  pay: string
  cancel: string
  processing: string
  done: string
  failed: string
  missingParams: string
}> = {
  ja: {
    title: 'チェックアウト（テストモード）',
    notice: 'Stripe テストモードのモック決済画面です。実際の請求は発生しません。',
    plan: 'プラン',
    amount: '金額',
    perMonth: '/月',
    pay: '支払いを完了する（モック）',
    cancel: 'キャンセルして戻る',
    processing: '処理中...',
    done: '購読を作成しました。アプリに戻ります...',
    failed: 'エラー: モック決済の完了に失敗しました',
    missingParams: 'organizationId または planId が指定されていません',
  },
  en: {
    title: 'Checkout (Test Mode)',
    notice: 'This is a mock checkout screen in Stripe test mode. No actual charge will occur.',
    plan: 'Plan',
    amount: 'Amount',
    perMonth: '/mo',
    pay: 'Complete payment (mock)',
    cancel: 'Cancel and go back',
    processing: 'Processing...',
    done: 'Subscription created. Returning to the app...',
    failed: 'Error: failed to complete mock payment',
    missingParams: 'organizationId or planId is missing',
  },
  zh: {
    title: '结账（测试模式）',
    notice: '这是 Stripe 测试模式的模拟结账页面，不会产生实际扣款。',
    plan: '套餐',
    amount: '金额',
    perMonth: '/月',
    pay: '完成支付（模拟）',
    cancel: '取消并返回',
    processing: '处理中...',
    done: '已创建订阅，正在返回应用...',
    failed: '错误：模拟支付未能完成',
    missingParams: '缺少 organizationId 或 planId',
  },
}

function resolveLocale(value: string | null): MockLocale {
  return SUPPORTED_LOCALES.includes(value as MockLocale) ? (value as MockLocale) : 'ja'
}

function MockCheckoutContent() {
  const router = useRouter()
  const search = useSearchParams()
  const organizationId = search.get('organizationId') || ''
  const planId = search.get('planId') || ''
  const planName = search.get('planName') || planId
  const amountParam = Number(search.get('amount'))
  const amount = Number.isFinite(amountParam) && amountParam >= 0 ? amountParam : null
  const locale = resolveLocale(search.get('locale'))
  const t = COPY[locale]
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const completePayment = async () => {
    if (!organizationId || !planId) {
      setMsg(t.missingParams)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/stripe/mock/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          planId,
          // プランに Stripe price が未設定でも mock では通せるようフォールバックを渡す
          priceId: `price_mock_${planId}`,
          status: 'active',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'mock complete failed')
      }
      setMsg(t.done)
      router.push(`/${locale}/settings/subscription?checkout=success`)
    } catch (error) {
      console.error('[Mock Checkout] completion failed:', error)
      setMsg(t.failed)
      setBusy(false)
    }
  }

  const cancelCheckout = () => {
    router.push(`/${locale}/pricing?canceled=true`)
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">{t.title}</h1>
      <p className="text-sm rounded bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 mb-6">
        {t.notice}
      </p>
      <dl className="mb-6 space-y-2 text-sm">
        <div className="flex justify-between border-b border-gray-200 pb-2">
          <dt className="text-gray-500">{t.plan}</dt>
          <dd className="font-medium">{planName}</dd>
        </div>
        {amount !== null && (
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <dt className="text-gray-500">{t.amount}</dt>
            <dd className="font-medium">¥{amount.toLocaleString()}{t.perMonth}</dd>
          </div>
        )}
      </dl>
      <div className="space-y-4">
        <button
          onClick={completePayment}
          disabled={busy}
          className="w-full py-2 px-4 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? t.processing : t.pay}
        </button>
        <button
          onClick={cancelCheckout}
          disabled={busy}
          className="w-full py-2 px-4 rounded border border-gray-300 disabled:opacity-50"
        >
          {t.cancel}
        </button>
      </div>
      {msg && <p className="mt-4 text-sm text-gray-700">{msg}</p>}
    </div>
  )
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto p-8 text-sm text-gray-500">Loading...</div>}>
      <MockCheckoutContent />
    </Suspense>
  )
}
