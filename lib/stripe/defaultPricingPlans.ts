export const DEFAULT_PRICING_PLANS = [
  {
    id: 'trial',
    name: 'トライアル',
    description: '14日間、主要機能を試せる評価用プラン',
    price_monthly: 0,
    stripe_price_id: undefined,
    features: {
      features: ['主要機能の評価', '文書・リスク・タスク管理', '初期設定サポート']
    },
    max_users: 5,
    max_storage_gb: 1,
    is_active: true,
    display_order: 0,
    created_at: '',
    updated_at: ''
  },
  {
    id: 'starter',
    name: 'スタータープラン',
    description: '小規模チームのISMS運用を始めるためのプラン',
    price_monthly: 9800,
    stripe_price_id: undefined,
    features: {
      features: ['最大10ユーザー', '基本ワークフロー', '証跡管理']
    },
    max_users: 10,
    max_storage_gb: 5,
    is_active: true,
    display_order: 1,
    created_at: '',
    updated_at: ''
  },
  {
    id: 'standard',
    name: 'スタンダードプラン',
    description: '認証取得を見据えたチーム向けの標準プラン',
    price_monthly: 29800,
    stripe_price_id: undefined,
    features: {
      features: ['最大50ユーザー', '監査・承認ワークフロー', 'エクスポートと管理レポート']
    },
    max_users: 50,
    max_storage_gb: 20,
    is_active: true,
    display_order: 2,
    created_at: '',
    updated_at: ''
  },
  {
    id: 'enterprise',
    name: 'エンタープライズプラン',
    description: '複数組織や高度な統制に対応するプラン',
    price_monthly: 98000,
    stripe_price_id: undefined,
    features: {
      features: ['ユーザー数相談', '高度な監査証跡', '専任サポート']
    },
    max_users: -1,
    max_storage_gb: 100,
    is_active: true,
    display_order: 3,
    created_at: '',
    updated_at: ''
  }
]

export function findDefaultPricingPlan(planId: string) {
  return DEFAULT_PRICING_PLANS.find(plan => plan.id === planId) ?? null
}
