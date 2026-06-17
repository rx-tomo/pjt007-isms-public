/**
 * AI Usage Statistics API Endpoint
 *
 * GET /api/ai/usage/stats?period=7d|30d|90d
 *
 * Returns aggregated AI usage statistics for the authenticated user's organization.
 * Includes summary metrics, daily breakdown, and breakdown by request type.
 *
 * Authentication: Requires org_admin or system_operator role.
 *
 * @module app/api/ai/usage/stats/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/auth/requireServiceRole'
import { getAIUsageLogRepository } from '@/lib/container'
import type { AIUsageLog } from '@/lib/db/repositories/interfaces/IAIUsageLogRepository'

export const runtime = 'nodejs'

// ============================================================
// Types
// ============================================================

/**
 * Valid period values for the stats query
 */
const VALID_PERIODS = ['7d', '30d', '90d'] as const
type Period = (typeof VALID_PERIODS)[number]

/**
 * Allowed roles for accessing usage statistics
 */
const ALLOWED_ROLES = ['org_admin', 'system_operator']

/**
 * Cost per token (configurable; default $0.00001 per token)
 */
const COST_PER_TOKEN = 0.00001

/**
 * Request type enum for type safety
 */
type RequestType = 'risk_identification' | 'risk_assessment' | 'treatment_suggestion'

// ============================================================
// Response interfaces
// ============================================================

interface UsageStatsSummary {
  totalTokens: number
  totalRequests: number
  cacheHitRate: number
  errorRate: number
  avgLatencyMs: number
  totalCost: number
}

interface DailyBreakdown {
  date: string
  tokens: number
  requests: number
  cached: number
  errors: number
}

interface TypeBreakdown {
  type: RequestType
  count: number
  tokens: number
  avgLatencyMs: number
}

interface PeriodInfo {
  start: string
  end: string
  days: number
}

interface UsageStatsData {
  summary: UsageStatsSummary
  daily: DailyBreakdown[]
  byType: TypeBreakdown[]
  period: PeriodInfo
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Parse period string to number of days
 */
function parsePeriodDays(period: Period): number {
  switch (period) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
  }
}

/**
 * Calculate date range from period and current time
 */
function calculateDateRange(period: Period, now: Date): { start: Date; end: Date; days: number } {
  const days = parsePeriodDays(period)
  const end = new Date(now)
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return { start, end, days }
}

/**
 * Calculate summary statistics from logs and repository statistics
 */
function calculateSummary(
  logs: AIUsageLog[],
  statistics: { totalRequests: number; totalTokens: number; cachedRequests: number; errorCount: number }
): UsageStatsSummary {
  const { totalRequests, totalTokens, cachedRequests, errorCount } = statistics

  const cacheHitRate = totalRequests > 0 ? cachedRequests / totalRequests : 0
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0

  // Calculate average latency from logs that have latency data
  const logsWithLatency = logs.filter(l => l.latencyMs !== null)
  const avgLatencyMs = logsWithLatency.length > 0
    ? logsWithLatency.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / logsWithLatency.length
    : 0

  const totalCost = totalTokens * COST_PER_TOKEN

  return {
    totalTokens,
    totalRequests,
    cacheHitRate,
    errorRate,
    avgLatencyMs,
    totalCost
  }
}

/**
 * Calculate daily breakdown from logs
 */
function calculateDailyBreakdown(logs: AIUsageLog[]): DailyBreakdown[] {
  const dailyMap = new Map<string, DailyBreakdown>()

  for (const log of logs) {
    const date = log.createdAt.split('T')[0] // YYYY-MM-DD
    const entry = dailyMap.get(date) || { date, tokens: 0, requests: 0, cached: 0, errors: 0 }
    entry.tokens += log.totalTokens
    entry.requests += 1
    if (log.cached) entry.cached += 1
    if (log.errorMessage !== null) entry.errors += 1
    dailyMap.set(date, entry)
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calculate breakdown by request type
 */
function calculateTypeBreakdown(logs: AIUsageLog[]): TypeBreakdown[] {
  const typeMap = new Map<RequestType, { count: number; tokens: number; totalLatency: number; latencyCount: number }>()

  for (const log of logs) {
    const entry = typeMap.get(log.requestType) || { count: 0, tokens: 0, totalLatency: 0, latencyCount: 0 }
    entry.count += 1
    entry.tokens += log.totalTokens
    if (log.latencyMs !== null) {
      entry.totalLatency += log.latencyMs
      entry.latencyCount += 1
    }
    typeMap.set(log.requestType, entry)
  }

  return Array.from(typeMap.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    tokens: data.tokens,
    avgLatencyMs: data.latencyCount > 0 ? Math.round(data.totalLatency / data.latencyCount) : 0
  }))
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/ai/usage/stats
 *
 * Query parameters:
 * - period: '7d' | '30d' | '90d' (default: '30d')
 *
 * Response:
 * - 200: { ok: true, data: UsageStatsData }
 * - 400: { error: string } (invalid period)
 * - 401: { error: string } (unauthenticated)
 * - 403: { error: string } (insufficient role)
 * - 500: { error: string } (server error)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication with requireServiceRole
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ALLOWED_ROLES,
      actionName: 'ai.usage.stats'
    })

    if (error) {
      return error
    }

    const { profile, json, logEvent } = guard
    const organizationId = profile.organization_id

    // 2. Parse and validate period query parameter
    const { searchParams } = new URL(request.url)
    const periodParam = searchParams.get('period') || '30d'

    if (!VALID_PERIODS.includes(periodParam as Period)) {
      return json(
        { error: `Invalid period: must be one of ${VALID_PERIODS.join(', ')}` },
        { status: 400 }
      )
    }

    const period = periodParam as Period

    // 3. Calculate date range
    const now = new Date()
    const { start, end, days } = calculateDateRange(period, now)

    // 4. Get statistics from AIUsageLogRepository
    const repository = await getAIUsageLogRepository()
    const statistics = await repository.getStatistics(organizationId, start, end)

    // 5. Get logs for daily/type breakdown
    const allLogs = await repository.findByOrganizationId(organizationId, 10000)
    const logsInRange = allLogs.filter(l => {
      const created = new Date(l.createdAt)
      return created >= start && created <= end
    })

    // 6. Calculate aggregations
    const summary = calculateSummary(logsInRange, statistics)
    const daily = calculateDailyBreakdown(logsInRange)
    const byType = calculateTypeBreakdown(logsInRange)

    // 7. Log the stats access
    await logEvent('stats_accessed', { period, days })

    // 8. Return aggregated response
    const responseData: UsageStatsData = {
      summary,
      daily,
      byType,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        days
      }
    }

    return json({ ok: true, data: responseData })
  } catch (err) {
    console.error('[AI Usage Stats] Error:', err)

    return NextResponse.json(
      { error: 'Failed to retrieve usage statistics' },
      { status: 500 }
    )
  }
}
