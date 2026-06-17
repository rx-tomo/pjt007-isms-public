'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import AISettingsPanel from '@/components/ai/AISettingsPanel'
import AIModelSettingsPanel from '@/components/ai/AIModelSettingsPanel'
import type { AISettingsPanelProps } from '@/components/ai/AISettingsPanel'
import type { AIModelConfig } from '@/components/ai/AIModelSettingsPanel'

/**
 * Mapping from component-level data-testids to E2E-expected data-testids.
 *
 * The AISettingsPanel component uses shorter testids internally,
 * but E2E tests expect prefixed versions. This wrapper adds the
 * expected testids by wrapping or remapping DOM attributes after render.
 */
export const SETTINGS_TESTID_MAP: Record<string, string> = {
  'feature-identify': 'ai-feature-identify',
  'feature-evaluate': 'ai-feature-evaluate',
  'feature-suggest-treatments': 'ai-feature-suggest-treatments',
  'monthly-token-limit': 'ai-monthly-token-limit',
  'alert-thresholds': 'ai-alert-thresholds',
}

export interface AISettingsPageWrapperProps extends AISettingsPanelProps {}

/**
 * AISettingsPageWrapper
 *
 * Wraps AISettingsPanel and AIModelSettingsPanel, remapping data-testid
 * attributes to match E2E test expectations. Also adds the
 * `ai-provider-info` wrapper around the provider display section.
 */
export default function AISettingsPageWrapper(props: AISettingsPageWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Remap testids from component values to E2E-expected values
    Object.entries(SETTINGS_TESTID_MAP).forEach(([componentId, e2eId]) => {
      const el = containerRef.current?.querySelector(`[data-testid="${componentId}"]`)
      if (el) {
        el.setAttribute('data-testid', e2eId)
      }
    })

    // Add ai-provider-info testid to provider name display
    const providerNameEl = containerRef.current.querySelector('[data-testid="provider-name"]')
    if (providerNameEl && providerNameEl.parentElement) {
      providerNameEl.parentElement.setAttribute('data-testid', 'ai-provider-info')
    }
  })

  const handleModelConfigChange = useCallback(async (config: AIModelConfig) => {
    // Save model config via API endpoint instead of direct DB access
    // (This is a client component, so we cannot use Drizzle directly)
    const response = await fetch(`/api/organizations/${props.organizationId}/ai-config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelProvider: config.provider,
        modelName: config.model,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to save model config')
    }
  }, [props.organizationId])

  return (
    <div ref={containerRef} className="space-y-6">
      <AISettingsPanel {...props} />
      <AIModelSettingsPanel
        organizationId={props.organizationId}
        onModelConfigChange={handleModelConfigChange}
      />
    </div>
  )
}
