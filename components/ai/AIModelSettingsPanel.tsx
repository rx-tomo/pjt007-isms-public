'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

/**
 * Provider/model configuration mapping
 */
const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    models: [
      { value: 'claude-opus-4-6', label: 'claude-opus-4-6' },
      { value: 'claude-sonnet-4-5-20250929', label: 'claude-sonnet-4-5-20250929' },
      { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5-20251001' },
    ],
  },
  openai: {
    label: 'OpenAI (GPT)',
    models: [
      { value: 'gpt-4o', label: 'gpt-4o' },
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    ],
  },
  mock: {
    label: 'Mock',
    models: [
      { value: 'mock-model', label: 'mock-model' },
    ],
  },
}

const PROVIDER_KEYS = Object.keys(PROVIDER_MODELS) as Array<keyof typeof PROVIDER_MODELS>

export interface AIModelConfig {
  provider: string
  model: string
}

export interface AIModelSettingsPanelProps {
  organizationId: string
  initialProvider?: string
  initialModel?: string
  onModelConfigChange?: (config: AIModelConfig) => Promise<void>
}

/**
 * AI Model Settings Panel
 *
 * Allows organization admins to select the AI provider and model.
 * The selection is persisted in the organization's ai_config JSONB column.
 */
export default function AIModelSettingsPanel({
  organizationId,
  initialProvider,
  initialModel,
  onModelConfigChange,
}: AIModelSettingsPanelProps) {
  const t = useTranslations('ai.settings')

  const [provider, setProvider] = useState<string>(initialProvider || 'anthropic')
  const [model, setModel] = useState<string>(initialModel || PROVIDER_MODELS.anthropic.models[0].value)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // When provider changes, reset model to first available model
  const handleProviderChange = useCallback((newProvider: string) => {
    setProvider(newProvider)
    const providerConfig = PROVIDER_MODELS[newProvider]
    if (providerConfig && providerConfig.models.length > 0) {
      setModel(providerConfig.models[0].value)
    }
    setSuccessMessage(null)
    setErrorMessage(null)
  }, [])

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel)
    setSuccessMessage(null)
    setErrorMessage(null)
  }, [])

  // Determine if the config has changed from initial values
  const isDirty = provider !== (initialProvider || 'anthropic') || model !== (initialModel || PROVIDER_MODELS.anthropic.models[0].value)

  const handleSave = useCallback(async () => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setSaving(true)

    try {
      if (onModelConfigChange) {
        await onModelConfigChange({ provider, model })
      }
      setSuccessMessage(t('modelSaved'))
    } catch {
      setErrorMessage(t('modelSaveError'))
    } finally {
      setSaving(false)
    }
  }, [provider, model, onModelConfigChange, t])

  const currentModels = PROVIDER_MODELS[provider]?.models || []

  return (
    <Card variant="bordered" data-testid="ai-model-settings-panel">
      <CardHeader>
        <CardTitle>{t('modelSettings')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Success / Error messages */}
        {successMessage && (
          <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded mb-4" data-testid="ai-model-success">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded mb-4" data-testid="ai-model-error">
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label htmlFor="ai-provider-select" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              {t('provider')}
            </label>
            <select
              id="ai-provider-select"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="block w-full max-w-sm rounded-md border border-border bg-surface py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              data-testid="ai-provider-select"
            >
              {PROVIDER_KEYS.map(key => (
                <option key={key} value={key}>
                  {PROVIDER_MODELS[key].label}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label htmlFor="ai-model-select" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              {t('model')}
            </label>
            <select
              id="ai-model-select"
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="block w-full max-w-sm rounded-md border border-border bg-surface py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              data-testid="ai-model-select"
            >
              {currentModels.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3" data-testid="ai-model-note">
            <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-blue-700">
              {t('modelChangeNote')}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || saving}
          isLoading={saving}
          data-testid="ai-model-save"
        >
          {t('saveModel')}
        </Button>
      </CardFooter>
    </Card>
  )
}
