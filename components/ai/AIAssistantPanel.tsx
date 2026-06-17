'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

/**
 * Threat identified by AI analysis
 */
export interface Threat {
  id: string
  persistenceId?: string
  name: string
  description: string
  likelihood: number // 1-5 scale
}

/**
 * Vulnerability identified by AI analysis
 */
export interface Vulnerability {
  id: string
  persistenceId?: string
  name: string
  description: string
  severity: number // 1-5 scale
}

/**
 * Treatment suggestion from AI analysis
 */
export interface TreatmentSuggestion {
  id: string
  persistenceId?: string
  type: 'accept' | 'mitigate' | 'transfer' | 'avoid'
  description: string
  controlIds?: string[]
}

/**
 * AI Suggestions response structure
 */
export interface AISuggestions {
  threats: Threat[]
  vulnerabilities: Vulnerability[]
  treatments: TreatmentSuggestion[]
}

/**
 * Asset context for AI analysis
 */
export interface AssetContext {
  assetName: string
  assetType: string
  description?: string
  department?: string
}

/**
 * Props for AIAssistantPanel component
 */
export interface AIAssistantPanelProps {
  assetContext: AssetContext
  riskId?: string // for existing risks
  organizationId: string
  onSuggestionAccepted?: (
    suggestion: Threat | Vulnerability | TreatmentSuggestion,
    type: 'threat' | 'vulnerability' | 'treatment'
  ) => void
  onSuggestionRejected?: (
    suggestion: Threat | Vulnerability | TreatmentSuggestion,
    type: 'threat' | 'vulnerability' | 'treatment'
  ) => void
  /** Optional custom analyze function for testing or different API endpoints */
  onAnalyze?: (context: AssetContext, organizationId: string, riskId?: string) => Promise<AISuggestions>
}

/**
 * Scale badge component for displaying likelihood/severity values
 */
function ScaleBadge({
  value,
  label,
  colorClass
}: {
  value: number
  label: string
  colorClass: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      <span>{label}:</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}

/**
 * Get color class based on scale value (1-5)
 */
function getScaleColorClass(value: number): string {
  if (value <= 1) return 'bg-green-100 text-green-800'
  if (value <= 2) return 'bg-lime-100 text-lime-800'
  if (value <= 3) return 'bg-yellow-100 text-yellow-800'
  if (value <= 4) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

/**
 * Get color class for treatment type badge
 */
function getTreatmentTypeColorClass(type: TreatmentSuggestion['type']): string {
  switch (type) {
    case 'accept':
      return 'bg-blue-100 text-blue-800'
    case 'mitigate':
      return 'bg-green-100 text-green-800'
    case 'transfer':
      return 'bg-purple-100 text-purple-800'
    case 'avoid':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-surface-elevated text-text-secondary'
  }
}

/**
 * Default analyze function that calls the API
 */
async function defaultAnalyze(
  context: AssetContext,
  organizationId: string,
  riskId?: string
): Promise<AISuggestions> {
  const response = await fetch('/api/ai/risks/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'identify',
      context,
      riskId,
      options: {
        saveSuggestion: true,
      },
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || 'Analysis failed')
  }

  const payload = await response.json()
  const data = payload.data ?? {}
  return {
    threats: Array.isArray(data.threats)
      ? data.threats.map((item: Threat, index: number) => ({
          ...item,
          id: item.id ?? item.persistenceId ?? `threat-${index}`,
          persistenceId: item.persistenceId ?? item.id,
        }))
      : [],
    vulnerabilities: Array.isArray(data.vulnerabilities)
      ? data.vulnerabilities.map((item: Vulnerability, index: number) => ({
          ...item,
          id: item.id ?? item.persistenceId ?? `vulnerability-${index}`,
          persistenceId: item.persistenceId ?? item.id,
        }))
      : [],
    treatments: Array.isArray(data.treatments)
      ? data.treatments.map((item: TreatmentSuggestion, index: number) => ({
          ...item,
          id: item.id ?? item.persistenceId ?? `treatment-${index}`,
          persistenceId: item.persistenceId ?? item.id,
        }))
      : [],
  }
}

/**
 * AIAssistantPanel - A panel component that displays AI suggestions for risks
 *
 * Features:
 * - Display AI-generated threats, vulnerabilities, and treatment suggestions
 * - "Analyze" button to trigger AI analysis
 * - "Accept" / "Reject" buttons for each suggestion
 * - Loading state while AI is processing
 * - Error handling and display
 *
 * @example
 * ```tsx
 * <AIAssistantPanel
 *   assetContext={{
 *     assetName: 'Customer Database',
 *     assetType: 'database',
 *     description: 'Main customer data storage',
 *     department: 'IT'
 *   }}
 *   organizationId="org-123"
 *   onSuggestionAccepted={(suggestion, type) => console.log('Accepted:', type, suggestion)}
 *   onSuggestionRejected={(suggestion, type) => console.log('Rejected:', type, suggestion)}
 * />
 * ```
 */
export default function AIAssistantPanel({
  assetContext,
  riskId,
  organizationId,
  onSuggestionAccepted,
  onSuggestionRejected,
  onAnalyze = defaultAnalyze
}: AIAssistantPanelProps) {
  const t = useTranslations('ai.assistant')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null)
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set())
  const [editedDescriptions, setEditedDescriptions] = useState<Record<string, string>>({})

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await onAnalyze(assetContext, organizationId, riskId)
      setSuggestions(result)
      setProcessedIds(new Set()) // Reset processed items on new analysis
      setEditedDescriptions({})
    } catch (err) {
      setError((err as Error).message || t('error'))
    } finally {
      setIsLoading(false)
    }
  }, [assetContext, organizationId, riskId, onAnalyze, t])

  const handleAccept = useCallback(
    (
      suggestion: Threat | Vulnerability | TreatmentSuggestion,
      type: 'threat' | 'vulnerability' | 'treatment'
    ) => {
      const edited = editedDescriptions[suggestion.id]
      const finalSuggestion = edited && 'description' in suggestion
        ? { ...suggestion, description: edited }
        : suggestion
      if (suggestion.persistenceId) {
        void fetch(`/api/ai/suggestions/${encodeURIComponent(suggestion.persistenceId)}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: edited ? 'accepted_with_edits' : 'accepted',
            finalContent: finalSuggestion,
          }),
        })
      }
      setProcessedIds((prev) => new Set([...prev, suggestion.id]))
      onSuggestionAccepted?.(finalSuggestion, type)
    },
    [editedDescriptions, onSuggestionAccepted]
  )

  const handleReject = useCallback(
    (
      suggestion: Threat | Vulnerability | TreatmentSuggestion,
      type: 'threat' | 'vulnerability' | 'treatment'
    ) => {
      if (suggestion.persistenceId) {
        void fetch(`/api/ai/suggestions/${encodeURIComponent(suggestion.persistenceId)}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'rejected',
            finalContent: suggestion,
          }),
        })
      }
      setProcessedIds((prev) => new Set([...prev, suggestion.id]))
      onSuggestionRejected?.(suggestion, type)
    },
    [onSuggestionRejected]
  )

  const hasNoSuggestions =
    !suggestions ||
    (suggestions.threats.length === 0 &&
      suggestions.vulnerabilities.length === 0 &&
      suggestions.treatments.length === 0)

  return (
    <Card variant="bordered" className="rounded-2xl border border-border bg-surface">
      <CardHeader>
        <CardTitle as="h2">{t('title')}</CardTitle>
      </CardHeader>

      <CardContent>
        {/* Asset Context Display */}
        <div className="mb-4 p-3 bg-surface-elevated rounded-lg">
          <h3 className="text-sm font-medium text-text-secondary mb-2">{t('assetInfo')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-text-muted">{t('assetName')}:</span>{' '}
              <span className="font-medium">{assetContext.assetName}</span>
            </div>
            <div>
              <span className="text-text-muted">{t('assetType')}:</span>{' '}
              <span className="font-medium">{assetContext.assetType}</span>
            </div>
            {assetContext.description && (
              <div className="col-span-2">
                <span className="text-text-muted">{t('description')}:</span>{' '}
                <span>{assetContext.description}</span>
              </div>
            )}
            {assetContext.department && (
              <div>
                <span className="text-text-muted">{t('department')}:</span>{' '}
                <span>{assetContext.department}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <p className="font-medium">{t('inputScopeTitle')}</p>
          <p className="mt-1">{t('inputScopeDescription')}</p>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            <li>{t('scopeAssetName')}</li>
            <li>{t('scopeAssetType')}</li>
            <li>{t('scopeDescription')}</li>
            <li>{t('scopeDepartment')}</li>
          </ul>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            role="alert"
          >
            {t('error')}: {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-text-secondary">{t('analyzing')}</span>
          </div>
        )}

        {/* No Suggestions State */}
        {!isLoading && hasNoSuggestions && (
          <div className="text-center py-8 text-text-muted">{t('noSuggestions')}</div>
        )}

        {/* Suggestions Display */}
        {!isLoading && suggestions && !hasNoSuggestions && (
          <div className="space-y-6">
            {/* Threats Section */}
            {suggestions.threats.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">{t('threats')}</h3>
                <div className="space-y-3">
                  {suggestions.threats.map((threat) => (
                    <div
                      key={threat.id}
                      className={`p-4 border rounded-lg ${
                        processedIds.has(threat.id)
                          ? 'bg-surface-elevated border-border opacity-60'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-text-primary">{threat.name}</h4>
                            <ScaleBadge
                              value={threat.likelihood}
                              label={t('likelihood')}
                              colorClass={getScaleColorClass(threat.likelihood)}
                            />
                          </div>
                          <p className="text-sm text-text-secondary">{threat.description}</p>
                          {!processedIds.has(threat.id) && (
                            <textarea
                              className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm"
                              value={editedDescriptions[threat.id] ?? threat.description}
                              onChange={(e) => setEditedDescriptions(prev => ({ ...prev, [threat.id]: e.target.value }))}
                              aria-label={t('editBeforeAccept')}
                            />
                          )}
                        </div>
                        {!processedIds.has(threat.id) && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAccept(threat, 'threat')}
                            >
                              {t('accept')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(threat, 'threat')}
                            >
                              {t('reject')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vulnerabilities Section */}
            {suggestions.vulnerabilities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {t('vulnerabilities')}
                </h3>
                <div className="space-y-3">
                  {suggestions.vulnerabilities.map((vulnerability) => (
                    <div
                      key={vulnerability.id}
                      className={`p-4 border rounded-lg ${
                        processedIds.has(vulnerability.id)
                          ? 'bg-surface-elevated border-border opacity-60'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-text-primary">{vulnerability.name}</h4>
                            <ScaleBadge
                              value={vulnerability.severity}
                              label={t('severity')}
                              colorClass={getScaleColorClass(vulnerability.severity)}
                            />
                          </div>
                          <p className="text-sm text-text-secondary">{vulnerability.description}</p>
                          {!processedIds.has(vulnerability.id) && (
                            <textarea
                              className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm"
                              value={editedDescriptions[vulnerability.id] ?? vulnerability.description}
                              onChange={(e) => setEditedDescriptions(prev => ({ ...prev, [vulnerability.id]: e.target.value }))}
                              aria-label={t('editBeforeAccept')}
                            />
                          )}
                        </div>
                        {!processedIds.has(vulnerability.id) && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAccept(vulnerability, 'vulnerability')}
                            >
                              {t('accept')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(vulnerability, 'vulnerability')}
                            >
                              {t('reject')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Treatments Section */}
            {suggestions.treatments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">{t('treatments')}</h3>
                <div className="space-y-3">
                  {suggestions.treatments.map((treatment) => (
                    <div
                      key={treatment.id}
                      className={`p-4 border rounded-lg ${
                        processedIds.has(treatment.id)
                          ? 'bg-surface-elevated border-border opacity-60'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTreatmentTypeColorClass(
                                treatment.type
                              )}`}
                            >
                              {t(`treatmentTypes.${treatment.type}`)}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary mb-2">{treatment.description}</p>
                          {!processedIds.has(treatment.id) && (
                            <textarea
                              className="mb-3 w-full rounded-md border border-border px-3 py-2 text-sm"
                              value={editedDescriptions[treatment.id] ?? treatment.description}
                              onChange={(e) => setEditedDescriptions(prev => ({ ...prev, [treatment.id]: e.target.value }))}
                              aria-label={t('editBeforeAccept')}
                            />
                          )}
                          {treatment.controlIds && treatment.controlIds.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                              <span>{t('controlIds')}:</span>
                              <div className="flex gap-1">
                                {treatment.controlIds.map((controlId) => (
                                  <span
                                    key={controlId}
                                    className="px-1.5 py-0.5 bg-surface-elevated rounded font-mono"
                                  >
                                    {controlId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {!processedIds.has(treatment.id) && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAccept(treatment, 'treatment')}
                            >
                              {t('accept')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(treatment, 'treatment')}
                            >
                              {t('reject')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button variant="primary" onClick={handleAnalyze} isLoading={isLoading} disabled={isLoading}>
          {isLoading ? t('analyzing') : t('analyze')}
        </Button>
      </CardFooter>
    </Card>
  )
}
