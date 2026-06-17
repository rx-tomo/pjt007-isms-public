'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  formatNumber,
  formatPercentage,
  formatLatency,
  formatCost,
  getCacheRateColor,
  getErrorRateColor,
  calculateTypeBreakdown,
  normalizeDailyData,
  PERIOD_OPTIONS,
  TYPE_COLORS,
  type AIUsagePeriod,
  type AIUsageDashboardData,
  type NormalizedDailyData,
  type TypeBreakdownResult,
  type BadgeColor
} from '@/lib/ai/dashboard/usage-utils'

// ============================================================
// Props Interface
// ============================================================

export interface AIUsageDashboardProps {
  organizationId: string
  autoRefreshInterval?: number // ms, 0 to disable
}

const BUDGET_LIMIT_USD = 50

// ============================================================
// Type Label Mapping
// ============================================================

const TYPE_LABEL_KEYS: Record<string, string> = {
  risk_identification: 'riskIdentification',
  risk_assessment: 'riskAssessment',
  treatment_suggestion: 'treatmentSuggestion'
}

// ============================================================
// Component
// ============================================================

export default function AIUsageDashboard({
  organizationId,
  autoRefreshInterval = 0
}: AIUsageDashboardProps) {
  const t = useTranslations('ai.usage')

  const [period, setPeriod] = useState<AIUsagePeriod>('7d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AIUsageDashboardData | null>(null)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/ai/usage?organizationId=${organizationId}&period=${period}`
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(t('error'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, period, t])

  // Initial fetch and period change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval <= 0) return

    const intervalId = setInterval(fetchData, autoRefreshInterval)
    return () => clearInterval(intervalId)
  }, [autoRefreshInterval, fetchData])

  // Derived data
  const normalizedDaily = data ? normalizeDailyData(data.daily) : []
  const typeBreakdown = data ? calculateTypeBreakdown(data.byType) : []

  // ============================================================
  // Render: Loading State
  // ============================================================
  if (loading && !data) {
    return (
      <Card variant="bordered" padding="lg">
        <div
          className="flex items-center justify-center py-12"
          data-testid="usage-loading"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('loading')}
          </span>
        </div>
      </Card>
    )
  }

  // ============================================================
  // Render: Error State
  // ============================================================
  if (error && !data) {
    return (
      <Card variant="bordered" padding="lg">
        <div
          className="flex flex-col items-center justify-center py-12"
          data-testid="usage-error"
        >
          <div className="text-red-500 text-lg mb-2">!</div>
          <span className="text-sm" style={{ color: 'var(--color-error-700)' }}>
            {error}
          </span>
        </div>
      </Card>
    )
  }

  // ============================================================
  // Render: Empty State
  // ============================================================
  if (!data || (data.summary.totalRequests === 0 && data.daily.length === 0)) {
    return (
      <Card variant="bordered" padding="lg">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center py-12"
            data-testid="usage-empty"
          >
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('noData')}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ============================================================
  // Render: Main Dashboard
  // ============================================================
  return (
    <div className="space-y-6" data-testid="usage-dashboard">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h2>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPeriod(option.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
              }`}
              data-testid={`period-${option.value}`}
            >
              {t(option.labelKey.replace('ai.usage.', '') as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard
          label={t('totalTokens')}
          value={formatNumber(data.summary.totalTokens)}
          unit={t('tokens')}
        />
        <SummaryCard
          label={t('totalRequests')}
          value={formatNumber(data.summary.totalRequests)}
          unit={t('requests')}
        />
        <SummaryCard
          label={t('cacheHitRate')}
          value={formatPercentage(data.summary.cacheHitRate)}
          badgeColor={getCacheRateColor(data.summary.cacheHitRate)}
        />
        <SummaryCard
          label={t('errorRate')}
          value={formatPercentage(data.summary.errorRate)}
          badgeColor={getErrorRateColor(data.summary.errorRate)}
        />
        <SummaryCard
          label={t('avgLatency')}
          value={formatLatency(data.summary.avgLatency)}
          unit={t('ms')}
        />
        <SummaryCard
          label={t('totalCost')}
          value={formatCost(data.summary.totalCost)}
          unit="USD"
        />
      </div>

      <BudgetProgressSection
        used={data.summary.totalCost}
        budget={BUDGET_LIMIT_USD}
        t={t}
      />

      {/* Daily Chart */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <CardTitle as="h3">{t('daily')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyChart data={normalizedDaily} />
        </CardContent>
      </Card>

      {/* Type Breakdown */}
      <Card variant="bordered" padding="md">
        <CardHeader>
          <CardTitle as="h3">{t('byType')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TypeBreakdownChart breakdown={typeBreakdown} t={t} />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

interface SummaryCardProps {
  label: string
  value: string
  unit?: string
  badgeColor?: BadgeColor
}

function SummaryCard({ label, value, unit, badgeColor }: SummaryCardProps) {
  return (
    <Card variant="bordered" padding="sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          {badgeColor ? (
            <Badge variant={badgeColor} size="sm">
              {value}
            </Badge>
          ) : (
            <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
              {value}
            </span>
          )}
          {unit && !badgeColor && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {unit}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

interface BudgetProgressSectionProps {
  used: number
  budget: number
  t: (key: string, values?: Record<string, string | number>) => string
}

function BudgetProgressSection({ used, budget, t }: BudgetProgressSectionProps) {
  const usageRate = budget <= 0 ? 0 : Math.max(0, Math.min(1, used / budget))
  const percentage = Math.round(usageRate * 100)

  const budgetColor = percentage < 60 ? '#16A34A' : percentage < 80 ? '#EAB308' : '#DC2626'

  return (
    <Card variant="bordered" padding="md" data-testid="budget-progress">
      <CardHeader>
        <CardTitle as="h3">{t('budgetProgress')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm" style={{ color: 'var(--foreground)' }}>
            <span>{t('budgetUsed', { used: formatCost(used), budget: formatCost(budget) })}</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: budgetColor }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DailyChartProps {
  data: NormalizedDailyData[]
}

function DailyChart({ data }: DailyChartProps) {
  if (data.length === 0) return null

  return (
    <div className="flex items-end gap-1 h-40" data-testid="daily-chart">
      {data.map((day) => (
        <div
          key={day.date}
          className="flex-1 flex flex-col items-center gap-1"
        >
          <div
            className="w-full rounded-t-sm transition-all duration-200 hover:opacity-80"
            style={{
              height: `${Math.max(day.normalizedHeight, 2)}%`,
              backgroundColor: '#3B82F6',
              minHeight: '2px'
            }}
            title={`${day.date}: ${formatNumber(day.tokens)} tokens, ${day.requests} requests`}
          />
          {data.length <= 14 && (
            <span
              className="text-xs rotate-[-45deg] origin-top-left whitespace-nowrap"
              style={{ color: 'var(--muted-foreground)', fontSize: '0.6rem' }}
            >
              {day.date.slice(5)} {/* MM-DD */}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

interface TypeBreakdownChartProps {
  breakdown: TypeBreakdownResult[]
  t: (key: string) => string
}

function TypeBreakdownChart({ breakdown, t }: TypeBreakdownChartProps) {
  if (breakdown.length === 0) return null

  return (
    <div className="space-y-4" data-testid="type-breakdown">
      {/* Horizontal bar segments */}
      <div className="flex h-4 rounded-full overflow-hidden">
        {breakdown.map((item) => (
          <div
            key={item.type}
            style={{
              width: `${Math.max(item.percentage, 1)}%`,
              backgroundColor: TYPE_COLORS[item.type]
            }}
            title={`${t(TYPE_LABEL_KEYS[item.type] as any)}: ${item.percentage}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {breakdown.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[item.type] }}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>
              {t(TYPE_LABEL_KEYS[item.type] as any)}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
