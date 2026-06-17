/**
 * AI Usage Dashboard Utilities
 *
 * Pure utility functions and types for the AI Usage Dashboard component.
 * These handle data formatting, color determination, and normalization
 * for rendering usage statistics.
 */

// ============================================================
// Types
// ============================================================

export type AIUsagePeriod = '7d' | '30d' | '90d'

export interface AIUsageSummary {
  totalTokens: number
  totalRequests: number
  cacheHitRate: number
  errorRate: number
  avgLatency: number
  totalCost: number
}

export interface AIUsageDailyData {
  date: string
  tokens: number
  requests: number
}

export interface AIUsageByType {
  type: 'risk_identification' | 'risk_assessment' | 'treatment_suggestion'
  tokens: number
  requests: number
}

export interface AIUsageDashboardData {
  summary: AIUsageSummary
  daily: AIUsageDailyData[]
  byType: AIUsageByType[]
}

export interface NormalizedDailyData extends AIUsageDailyData {
  normalizedHeight: number
}

export interface TypeBreakdownResult {
  type: AIUsageByType['type']
  tokens: number
  requests: number
  percentage: number
}

// ============================================================
// Constants
// ============================================================

export type BadgeColor = 'success' | 'warning' | 'danger'

export const PERIOD_OPTIONS: Array<{ value: AIUsagePeriod; labelKey: string }> = [
  { value: '7d', labelKey: 'ai.usage.period7d' },
  { value: '30d', labelKey: 'ai.usage.period30d' },
  { value: '90d', labelKey: 'ai.usage.period90d' }
]

export const TYPE_COLORS: Record<AIUsageByType['type'], string> = {
  risk_identification: '#3B82F6',   // blue
  risk_assessment: '#10B981',       // green
  treatment_suggestion: '#8B5CF6'   // purple
}

// ============================================================
// Formatting Functions
// ============================================================

/**
 * Format a number with K/M suffix for large values.
 */
export function formatNumber(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(1)}M`
  }
  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(1)}K`
  }
  return `${sign}${absValue}`
}

/**
 * Format a ratio (0-1) as a percentage string with one decimal place.
 * Clamps values to 0-100% range.
 */
export function formatPercentage(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  return `${(clamped * 100).toFixed(1)}%`
}

/**
 * Format latency in ms or seconds.
 */
export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${Math.round(ms)}ms`
}

/**
 * Format a USD amount with 2 decimal places.
 */
export function formatCost(value: number): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return formatter.format(value)
}

// ============================================================
// Color Determination
// ============================================================

/**
 * Determine Badge color for cache hit rate.
 * - > 50%: success (green)
 * - 20-50%: warning (yellow)
 * - < 20%: danger (red)
 */
export function getCacheRateColor(rate: number): BadgeColor {
  if (rate > 0.50) return 'success'
  if (rate >= 0.20) return 'warning'
  return 'danger'
}

/**
 * Determine Badge color for error rate.
 * - < 5%: success (green)
 * - 5-10%: warning (yellow)
 * - > 10%: danger (red)
 */
export function getErrorRateColor(rate: number): BadgeColor {
  if (rate < 0.05) return 'success'
  if (rate <= 0.10) return 'warning'
  return 'danger'
}

// ============================================================
// Data Processing
// ============================================================

/**
 * Calculate percentage breakdown by type based on token usage.
 */
export function calculateTypeBreakdown(data: AIUsageByType[]): TypeBreakdownResult[] {
  if (data.length === 0) return []

  const totalTokens = data.reduce((sum, item) => sum + item.tokens, 0)

  return data.map(item => ({
    type: item.type,
    tokens: item.tokens,
    requests: item.requests,
    percentage: totalTokens === 0 ? 0 : Number(((item.tokens / totalTokens) * 100).toFixed(1))
  }))
}

/**
 * Normalize daily data tokens to a 0-100 scale for bar chart rendering.
 */
export function normalizeDailyData(data: AIUsageDailyData[]): NormalizedDailyData[] {
  if (data.length === 0) return []

  const maxTokens = Math.max(...data.map(d => d.tokens))

  return data.map(item => ({
    ...item,
    normalizedHeight: maxTokens === 0 ? 0 : Math.round((item.tokens / maxTokens) * 100)
  }))
}

/**
 * Calculate summary statistics from daily data and rates.
 */
export function calculateSummary(
  dailyData: AIUsageDailyData[],
  cacheHitRate: number,
  errorRate: number,
  avgLatency: number,
  totalCost: number = 0
): AIUsageSummary {
  const totalTokens = dailyData.reduce((sum, d) => sum + d.tokens, 0)
  const totalRequests = dailyData.reduce((sum, d) => sum + d.requests, 0)

  return {
    totalTokens,
    totalRequests,
    cacheHitRate,
    errorRate,
    avgLatency,
    totalCost
  }
}
