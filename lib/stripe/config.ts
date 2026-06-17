const PRICE_ENV_MAP: Array<{ envKey: string; matchers: RegExp[] }> = [
  {
    envKey: 'STRIPE_PRICE_TRIAL',
    matchers: [/trial/i, /トライアル/]
  },
  {
    envKey: 'STRIPE_PRICE_STARTER',
    matchers: [/starter/i, /スタータ/]
  },
  {
    envKey: 'STRIPE_PRICE_STANDARD',
    matchers: [/standard/i, /スタンダード/]
  },
  {
    envKey: 'STRIPE_PRICE_ENTERPRISE',
    matchers: [/enterprise/i, /エンタープライズ/]
  }
]

const PLACEHOLDER_TOKENS = ['...', 'xxx', 'your_', 'sample']

const PLACEHOLDER_REGEXPS = [
  /^price_(test|live)?$/i,
  /^price_(test|live)?[_-]?(placeholder|dummy)$/i
]

function isPlaceholder(value: string): boolean {
  if (!value) return true
  const lower = value.toLowerCase()
  if (PLACEHOLDER_TOKENS.some(token => lower.includes(token))) {
    return true
  }
  return PLACEHOLDER_REGEXPS.some(pattern => pattern.test(lower))
}

export interface StripePriceFromEnv {
  priceId: string
  envKey: string
}

const STRIPE_TEST_MODE = (process.env.STRIPE_TEST_MODE || '').toLowerCase()

export function resolveStripePriceIdFromEnv(planName: string): StripePriceFromEnv | null {
  if (!planName) return null

  for (const entry of PRICE_ENV_MAP) {
    const matched = entry.matchers.some(pattern => pattern.test(planName))
    if (!matched) continue

    const rawValue = process.env[entry.envKey]
    if (!rawValue) continue

    const priceId = rawValue.trim()
    if (priceId === '' || isPlaceholder(priceId)) {
      continue
    }

    return { priceId, envKey: entry.envKey }
  }

  return null
}

export function hasStripeSecret(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return false
  const trimmed = secret.trim()
  if (trimmed === '') return false
  return !isPlaceholder(trimmed)
}

export function isStripeMockMode(): boolean {
  if (STRIPE_TEST_MODE === 'mock') return true
  // 非本番では実キー未設定をmockモードとして扱い、実キーなしで
  // チェックアウト〜ポータルの全フローを通せるようにする（GAP-021）
  return process.env.NODE_ENV !== 'production' && !hasStripeSecret()
}
