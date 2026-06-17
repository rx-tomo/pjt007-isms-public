'use client'

import React, { useEffect, useRef } from 'react'
import AIUsageDashboard from '@/components/ai/AIUsageDashboard'
import type { AIUsageDashboardProps } from '@/components/ai/AIUsageDashboard'

/**
 * Mapping from component-level data-testids to E2E-expected data-testids.
 *
 * The AIUsageDashboard component uses shorter testids internally,
 * but E2E tests expect prefixed versions with `ai-usage-` prefix.
 */
export const USAGE_TESTID_MAP: Record<string, string> = {
  'period-7d': 'ai-usage-period-7d',
  'period-30d': 'ai-usage-period-30d',
  'period-90d': 'ai-usage-period-90d',
  'daily-chart': 'ai-usage-daily-chart',
  'type-breakdown': 'ai-usage-type-breakdown',
  'total-tokens': 'ai-usage-total-tokens',
  'total-requests': 'ai-usage-total-requests',
  'cache-rate': 'ai-usage-cache-rate',
  'error-rate': 'ai-usage-error-rate',
}

export interface AIUsageDashboardPageWrapperProps extends AIUsageDashboardProps {}

/**
 * AIUsageDashboardPageWrapper
 *
 * Wraps AIUsageDashboard and remaps data-testid attributes to match
 * E2E test expectations. Adds `ai-usage-` prefixed testids for
 * summary cards, period buttons, charts, and breakdown sections.
 */
export default function AIUsageDashboardPageWrapper(props: AIUsageDashboardPageWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Remap testids from component values to E2E-expected values
    Object.entries(USAGE_TESTID_MAP).forEach(([componentId, e2eId]) => {
      const el = containerRef.current?.querySelector(`[data-testid="${componentId}"]`)
      if (el) {
        el.setAttribute('data-testid', e2eId)
      }
    })

    // Add summary card testids based on label content
    // The SummaryCard components render labels, so we find them by content
    const summaryCards = containerRef.current.querySelectorAll('[class*="grid"] > div')
    summaryCards.forEach((card) => {
      const labelEl = card.querySelector('span')
      if (!labelEl) return
      const labelText = labelEl.textContent?.toLowerCase() || ''

      if (labelText.includes('token') || labelText.includes('トークン')) {
        card.setAttribute('data-testid', 'ai-usage-total-tokens')
      } else if (labelText.includes('request') || labelText.includes('リクエスト')) {
        card.setAttribute('data-testid', 'ai-usage-total-requests')
      } else if (labelText.includes('cache') || labelText.includes('キャッシュ')) {
        card.setAttribute('data-testid', 'ai-usage-cache-rate')
      } else if (labelText.includes('error') || labelText.includes('エラー')) {
        card.setAttribute('data-testid', 'ai-usage-error-rate')
      }
    })
  })

  return (
    <div ref={containerRef}>
      <AIUsageDashboard {...props} />
    </div>
  )
}
