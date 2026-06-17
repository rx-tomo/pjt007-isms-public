'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

// Stripe mockモードの顧客ポータル画面。
// GAP-022: locale クエリで ja/en/zh の文言切替（[locale] 外のため inline 辞書）。

const SUPPORTED_LOCALES = ['ja', 'en', 'zh'] as const
type MockLocale = (typeof SUPPORTED_LOCALES)[number]

const COPY: Record<MockLocale, {
  title: string
  notice: string
  upgrade: string
  cancelAtPeriodEnd: string
  back: string
  changed: string
  cancelSet: string
  changeFailed: string
  cancelFailed: string
  missingOrg: string
}> = {
  ja: {
    title: '請求ポータル（テストモード）',
    notice: 'Stripe テストモードのモックポータルです。実際の請求は発生しません。',
    upgrade: 'Pro（上位プラン）に変更',
    cancelAtPeriodEnd: '当月末でキャンセル',
    back: 'アプリに戻る',
    changed: 'プランを変更しました',
    cancelSet: '当月末キャンセルを設定しました',
    changeFailed: 'エラー: プラン変更に失敗しました',
    cancelFailed: 'エラー: キャンセル設定に失敗しました',
    missingOrg: 'organizationId が指定されていません',
  },
  en: {
    title: 'Billing Portal (Test Mode)',
    notice: 'This is a mock billing portal in Stripe test mode. No actual charge will occur.',
    upgrade: 'Upgrade to Pro',
    cancelAtPeriodEnd: 'Cancel at period end',
    back: 'Back to app',
    changed: 'Plan changed',
    cancelSet: 'Cancellation at period end scheduled',
    changeFailed: 'Error: failed to change plan',
    cancelFailed: 'Error: failed to schedule cancellation',
    missingOrg: 'organizationId is missing',
  },
  zh: {
    title: '账单门户（测试模式）',
    notice: '这是 Stripe 测试模式的模拟账单门户，不会产生实际扣款。',
    upgrade: '升级到 Pro（高级套餐）',
    cancelAtPeriodEnd: '本期末取消',
    back: '返回应用',
    changed: '套餐已变更',
    cancelSet: '已设置本期末取消',
    changeFailed: '错误：套餐变更失败',
    cancelFailed: '错误：取消设置失败',
    missingOrg: '缺少 organizationId',
  },
}

function resolveLocale(value: string | null): MockLocale {
  return SUPPORTED_LOCALES.includes(value as MockLocale) ? (value as MockLocale) : 'ja'
}

function MockPortalContent() {
  const router = useRouter()
  const search = useSearchParams()
  const organizationId = search.get('organizationId') || ''
  const locale = resolveLocale(search.get('locale'))
  const t = COPY[locale]
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const returnToApp = () => {
    router.push(`/${locale}/settings/subscription`)
  }

  const changeToHigherPlan = async () => {
    if (!organizationId) {
      setMsg(t.missingOrg)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/mock/portal/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, mode: 'upgrade' })
      })
      if (!res.ok) throw new Error('failed to change plan')
      setMsg(t.changed)
      returnToApp()
    } catch (e) {
      setMsg(t.changeFailed)
    } finally {
      setBusy(false)
    }
  }

  const cancelAtPeriodEnd = async () => {
    if (!organizationId) {
      setMsg(t.missingOrg)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/mock/cancel-at-period-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId })
      })
      if (!res.ok) throw new Error('failed to set cancel')
      setMsg(t.cancelSet)
      returnToApp()
    } catch (e) {
      setMsg(t.cancelFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">{t.title}</h1>
      <p className="text-sm rounded bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 mb-6">
        {t.notice}
      </p>
      <div className="space-y-4">
        <button
          onClick={changeToHigherPlan}
          disabled={busy}
          className="w-full py-2 px-4 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t.upgrade}
        </button>
        <button
          onClick={cancelAtPeriodEnd}
          disabled={busy}
          className="w-full py-2 px-4 rounded bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
        >
          {t.cancelAtPeriodEnd}
        </button>
        <button
          onClick={returnToApp}
          className="w-full py-2 px-4 rounded border border-gray-300"
        >
          {t.back}
        </button>
      </div>
      {msg && <p className="mt-4 text-sm text-gray-700">{msg}</p>}
    </div>
  )
}

export default function MockPortalPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto p-8 text-sm text-gray-500">Loading...</div>}>
      <MockPortalContent />
    </Suspense>
  )
}
