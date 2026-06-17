'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { AISettingsPanelConfig } from '@/lib/ai/interfaces/AIFeatureConfig'
import {
  createDefaultAIFeatureConfig,
  validateAIFeatureConfig,
  formatUsageDisplay,
  isFeatureEnabled,
  validateTokenLimit,
  createFormStateFromConfig,
  hasConfigChanged,
  type AISettingsFormState
} from '@/lib/ai/settings/aiSettingsLogic'

/**
 * Props for AISettingsPanel component
 */
export interface AISettingsPanelProps {
  organizationId: string
  initialConfig?: AISettingsPanelConfig
  onConfigChange?: (config: AISettingsPanelConfig) => void
}

/**
 * AI Settings Panel Component
 *
 * Provides UI for configuring AI features within the organization settings.
 * Features:
 * 1. AI Global Toggle (ON/OFF)
 * 2. Feature-level toggles (identify, evaluate, suggest_treatments)
 * 3. Monthly token limit input
 * 4. Alert thresholds display
 * 5. Provider display
 * 6. Current usage summary
 * 7. Save/Cancel buttons with feedback
 */
export default function AISettingsPanel({
  organizationId,
  initialConfig,
  onConfigChange
}: AISettingsPanelProps) {
  const t = useTranslations('ai.settings')

  const [formState, setFormState] = useState<AISettingsFormState>(() =>
    createFormStateFromConfig(initialConfig)
  )
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset form when initialConfig changes
  useEffect(() => {
    setFormState(createFormStateFromConfig(initialConfig))
  }, [initialConfig])

  const currentConfig = initialConfig || createDefaultAIFeatureConfig()
  const isDirty = hasConfigChanged(initialConfig, formState)

  const handleSave = useCallback(async () => {
    setSuccessMessage(null)
    setErrorMessage(null)

    // Build config from form state
    const newConfig: AISettingsPanelConfig = {
      enabled: formState.enabled,
      features: {
        identify: formState.identifyEnabled,
        evaluate: formState.evaluateEnabled,
        suggest_treatments: formState.suggestTreatmentsEnabled
      },
      allowExternalApi: formState.allowExternalApi ?? false,
      allowPersonalData: formState.allowPersonalData ?? false,
      allowAttachmentBody: formState.allowAttachmentBody ?? false,
      monthlyTokenLimit: formState.monthlyTokenLimit,
      alertThresholds: formState.alertThresholds,
      currentUsage: currentConfig.currentUsage,
      providerName: currentConfig.providerName
    }

    // Validate
    const validation = validateAIFeatureConfig(newConfig)
    if (!validation.valid) {
      setErrorMessage(validation.errors.join(', '))
      return
    }

    setSaving(true)
    try {
      if (onConfigChange) {
        await onConfigChange(newConfig)
      }
      setSuccessMessage(t('saved'))
    } catch {
      setErrorMessage(t('saveError'))
    } finally {
      setSaving(false)
    }
  }, [formState, currentConfig, onConfigChange, t])

  const handleCancel = useCallback(() => {
    setFormState(createFormStateFromConfig(initialConfig))
    setSuccessMessage(null)
    setErrorMessage(null)
  }, [initialConfig])

  const handleTokenLimitChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue)) {
      setFormState(prev => ({ ...prev, monthlyTokenLimit: numValue }))
    }
  }, [])

  const tokensUsed = currentConfig.currentUsage?.tokensUsed ?? 0
  const usageDisplay = formatUsageDisplay(tokensUsed, formState.monthlyTokenLimit)
  const providerName = currentConfig.providerName ?? '-'

  return (
    <Card variant="bordered" data-testid="ai-settings-panel">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Success / Error messages */}
        {successMessage && (
          <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded mb-4" data-testid="ai-settings-success">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded mb-4" data-testid="ai-settings-error">
            {errorMessage}
          </div>
        )}

        {/* Global AI Toggle */}
        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <label htmlFor="ai-global-toggle" className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {t('enableAI')}
            </label>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('enableAIDescription')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="ai-global-toggle"
              type="checkbox"
              checked={formState.enabled}
              onChange={(e) => setFormState(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
              data-testid="ai-global-toggle"
            />
            <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {/* Feature Toggles Section */}
        <div className="py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
            {t('features')}
          </h4>
          <div className="space-y-3">
            {/* Risk Identification */}
            <label className={`flex items-center gap-3 ${!formState.enabled ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={formState.identifyEnabled}
                disabled={!formState.enabled}
                onChange={(e) => setFormState(prev => ({ ...prev, identifyEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                data-testid="feature-identify"
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('identify')}</span>
            </label>

            {/* Risk Evaluation */}
            <label className={`flex items-center gap-3 ${!formState.enabled ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={formState.evaluateEnabled}
                disabled={!formState.enabled}
                onChange={(e) => setFormState(prev => ({ ...prev, evaluateEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                data-testid="feature-evaluate"
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('evaluate')}</span>
            </label>

            {/* Treatment Suggestions */}
            <label className={`flex items-center gap-3 ${!formState.enabled ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={formState.suggestTreatmentsEnabled}
                disabled={!formState.enabled}
                onChange={(e) => setFormState(prev => ({ ...prev, suggestTreatmentsEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                data-testid="feature-suggest-treatments"
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('suggestTreatments')}</span>
            </label>
          </div>
        </div>

        {/* Data Handling Section */}
        <div className="py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
            {t('dataHandling')}
          </h4>
          <div className="space-y-3">
            {[
              ['allowExternalApi', 'allowExternalApi', 'allowExternalApiDescription'],
              ['allowPersonalData', 'allowPersonalData', 'allowPersonalDataDescription'],
              ['allowAttachmentBody', 'allowAttachmentBody', 'allowAttachmentBodyDescription'],
            ].map(([stateKey, labelKey, descriptionKey]) => (
              <label key={stateKey} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(formState[stateKey as keyof typeof formState])}
                  onChange={(e) => setFormState(prev => ({ ...prev, [stateKey]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  data-testid={`ai-${stateKey}`}
                />
                <span>
                  <span className="block text-sm" style={{ color: 'var(--foreground)' }}>{t(labelKey)}</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {t(descriptionKey)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Usage Limits Section */}
        <div className="py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
            {t('usageLimits')}
          </h4>
          <div className="space-y-3">
            <div>
              <label htmlFor="monthly-token-limit" className="block text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                {t('monthlyLimit')}
              </label>
              <input
                id="monthly-token-limit"
                type="number"
                min="1"
                step="1000"
                value={formState.monthlyTokenLimit}
                onChange={(e) => handleTokenLimitChange(e.target.value)}
                className="w-full max-w-xs rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="monthly-token-limit"
              />
              {!validateTokenLimit(formState.monthlyTokenLimit) && (
                <p className="text-xs text-red-600 mt-1" data-testid="token-limit-error">
                  {t('monthlyLimit')} must be a positive integer
                </p>
              )}
            </div>
            <div>
              <span className="block text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                {t('alertThresholds')}
              </span>
              <div className="flex gap-2" data-testid="alert-thresholds">
                {formState.alertThresholds.map((threshold, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                  >
                    {threshold}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Current Usage Section */}
        <div className="py-4">
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
            {t('currentUsage')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--muted-foreground)' }}>{t('currentUsage')}</span>
              <span style={{ color: 'var(--foreground)' }} data-testid="usage-display">
                {usageDisplay}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--muted-foreground)' }}>{t('provider')}</span>
              <span style={{ color: 'var(--foreground)' }} data-testid="provider-name">
                {providerName}
              </span>
            </div>
            {/* Usage progress bar */}
            <div className="w-full bg-surface-elevated rounded-full h-2 mt-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (tokensUsed / formState.monthlyTokenLimit) * 100)}%`,
                  backgroundColor: tokensUsed / formState.monthlyTokenLimit > 0.9
                    ? 'var(--destructive, #ef4444)'
                    : tokensUsed / formState.monthlyTokenLimit > 0.7
                      ? '#f59e0b'
                      : 'var(--primary)'
                }}
                data-testid="usage-progress-bar"
              />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={!isDirty || saving}
          data-testid="ai-settings-cancel"
        >
          {t('cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || saving}
          isLoading={saving}
          data-testid="ai-settings-save"
        >
          {t('save')}
        </Button>
      </CardFooter>
    </Card>
  )
}
