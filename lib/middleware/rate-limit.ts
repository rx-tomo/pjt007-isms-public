export const RATE_LIMIT_MAX = 100;
export const RATE_LIMIT_WINDOW_MS = 60_000;

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost', 'anonymous']);

/**
 * 非production環境のループバック由来リクエストはレート制限を適用しない。
 * ローカル開発・E2E/QAスイートの連続実行でトークンが枯渇し、
 * テストが429で不安定化するのを防ぐ（GAP-002）。本番動作は不変。
 */
export function shouldBypassRateLimit(ip: string): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return LOOPBACK_IPS.has(ip);
}

const RATE_LIMIT_STALE_AFTER_MS = 120_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 10_000;
const RATE_LIMIT_TOKENS_PER_MS = RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS;

type RateLimitBucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

function cleanupStaleBuckets(now: number): void {
  if (now - lastCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > RATE_LIMIT_STALE_AFTER_MS) {
      buckets.delete(key);
    }
  }

  lastCleanupAt = now;
}

function getClientIp(ip: string): string {
  return ip || 'anonymous';
}

export function rateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const clientIp = getClientIp(ip);
  cleanupStaleBuckets(now);

  const bucket = buckets.get(clientIp) ?? {
    tokens: RATE_LIMIT_MAX,
    lastRefill: now,
  };

  const elapsedMs = now - bucket.lastRefill;
  const refilledTokens = bucket.tokens + elapsedMs * RATE_LIMIT_TOKENS_PER_MS;
  const tokenBalance = Math.min(RATE_LIMIT_MAX, refilledTokens);

  if (tokenBalance >= 1) {
    const remaining = Math.floor(tokenBalance - 1);
    bucket.tokens = tokenBalance - 1;
    bucket.lastRefill = now;
    buckets.set(clientIp, bucket);

    return {
      allowed: true,
      remaining,
      resetAt: now,
    };
  }

  const waitMs = Math.ceil((1 - tokenBalance) / RATE_LIMIT_TOKENS_PER_MS);
  bucket.tokens = tokenBalance;
  bucket.lastRefill = now;
  buckets.set(clientIp, bucket);

  return {
    allowed: false,
    remaining: 0,
    resetAt: now + waitMs,
  };
}
