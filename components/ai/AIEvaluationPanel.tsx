'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

/**
 * AI Evaluation Result from the risk assessment service
 */
export interface AIEvaluationResult {
  impact: number
  likelihood: number
  rationale: string
  confidence?: number
}

/**
 * Risk context information for AI evaluation
 */
export interface RiskContext {
  riskName: string
  riskCategory: string
  description?: string
  assetName?: string
  currentImpact?: number
  currentLikelihood?: number
  existingControls?: string[]
}

/**
 * Props for AIEvaluationPanel component
 */
export interface AIEvaluationPanelProps {
  riskContext: RiskContext
  riskId?: string
  organizationId: string
  onEvaluationAccepted?: (evaluation: { impact: number; likelihood: number }) => void
}

/**
 * Get the Badge variant color based on score
 * @param score - Risk score (1-5)
 * @returns Badge variant: 'success' for low (1-2), 'warning' for medium (3), 'danger' for high (4-5)
 */
export function getRiskLevelColor(score: number): 'success' | 'warning' | 'danger' {
  if (score <= 2) return 'success'
  if (score === 3) return 'warning'
  return 'danger'
}

/**
 * Get the risk level label based on score
 * @param score - Risk score (1-5)
 * @returns Label: 'low', 'medium', or 'high'
 */
export function getRiskLevelLabel(score: number): 'low' | 'medium' | 'high' {
  if (score <= 2) return 'low'
  if (score === 3) return 'medium'
  return 'high'
}

/**
 * Calculate the position in the risk matrix based on impact and likelihood
 * @param impact - Impact score (1-5)
 * @param likelihood - Likelihood score (1-5)
 * @returns Object with row, col, and risk level
 */
export function calculateRiskMatrixPosition(
  impact: number,
  likelihood: number
): { row: number; col: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  const riskScore = impact * likelihood
  let level: 'low' | 'medium' | 'high' | 'critical'

  if (riskScore <= 4) level = 'low'
  else if (riskScore <= 9) level = 'medium'
  else if (riskScore <= 15) level = 'high'
  else level = 'critical'

  return {
    row: 5 - likelihood,
    col: impact - 1,
    level
  }
}

/**
 * Mini Risk Matrix Visualization Component
 */
const RiskMatrixMini: React.FC<{ impact: number; likelihood: number }> = ({
  impact,
  likelihood
}) => {
  const position = calculateRiskMatrixPosition(impact, likelihood)

  const getCellColor = (row: number, col: number): string => {
    const cellImpact = col + 1
    const cellLikelihood = 5 - row
    const score = cellImpact * cellLikelihood

    if (score <= 4) return 'var(--color-success-100)'
    if (score <= 9) return 'var(--color-warning-100)'
    if (score <= 15) return 'var(--color-error-100)'
    return 'var(--color-error-200)'
  }

  return (
    <div className="inline-block">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: 'repeat(5, 1fr)',
          width: '80px',
          height: '80px'
        }}
      >
        {Array.from({ length: 25 }).map((_, index) => {
          const row = Math.floor(index / 5)
          const col = index % 5
          const isSelected = row === position.row && col === position.col

          return (
            <div
              key={index}
              style={{
                backgroundColor: getCellColor(row, col),
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                borderRadius: '2px',
                position: 'relative'
              }}
            >
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)'
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Score Display Component with Badge
 */
const ScoreDisplay: React.FC<{
  label: string
  score: number
  currentValue?: number
  currentLabel?: string
  suggestedLabel?: string
}> = ({ label, score, currentValue, currentLabel, suggestedLabel }) => {
  const showComparison = currentValue !== undefined && currentValue !== score

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Badge variant={getRiskLevelColor(score)} size="lg">
          {score}
        </Badge>
        {showComparison && (
          <>
            <span style={{ color: 'var(--muted-foreground)' }}>&larr;</span>
            <div className="flex flex-col">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {currentLabel}
              </span>
              <Badge variant="default" size="sm">
                {currentValue}
              </Badge>
            </div>
          </>
        )}
      </div>
      {showComparison && (
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {suggestedLabel}
        </span>
      )}
    </div>
  )
}

/**
 * AIEvaluationPanel Component
 *
 * Displays AI risk evaluation results with:
 * - Impact and likelihood scores with color-coded badges
 * - Risk matrix mini-visualization
 * - Rationale explanation from AI
 * - Comparison with current values (if existing)
 * - Accept button to apply suggested values
 */
export const AIEvaluationPanel: React.FC<AIEvaluationPanelProps> = ({
  riskContext,
  riskId,
  organizationId,
  onEvaluationAccepted
}) => {
  const t = useTranslations('ai.evaluation')

  const [evaluation, setEvaluation] = useState<AIEvaluationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEvaluate = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/risks/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          riskId,
          riskContext: {
            name: riskContext.riskName,
            category: riskContext.riskCategory,
            description: riskContext.description,
            assetName: riskContext.assetName,
            existingControls: riskContext.existingControls
          }
        })
      })

      if (!response.ok) {
        throw new Error(t('error'))
      }

      const data = await response.json()

      if (data.success && data.data) {
        setEvaluation({
          impact: data.data.impact,
          likelihood: data.data.likelihood,
          rationale: data.data.rationale,
          confidence: data.data.confidence
        })
      } else {
        throw new Error(data.error || t('error'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, riskId, riskContext, t])

  const handleAccept = useCallback(() => {
    if (evaluation && onEvaluationAccepted) {
      onEvaluationAccepted({
        impact: evaluation.impact,
        likelihood: evaluation.likelihood
      })
    }
  }, [evaluation, onEvaluationAccepted])

  const hasCurrentValues =
    riskContext.currentImpact !== undefined && riskContext.currentLikelihood !== undefined

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle as="h4">{t('title')}</CardTitle>
      </CardHeader>

      <CardContent>
        {!evaluation && !isLoading && !error && (
          <div className="text-center py-4">
            <p style={{ color: 'var(--muted-foreground)' }} className="mb-4">
              {t('noEvaluation')}
            </p>
            <Button onClick={handleEvaluate} variant="primary">
              {t('evaluate')}
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <div
              className="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: 'var(--primary)' }}
            />
            <p className="mt-4" style={{ color: 'var(--muted-foreground)' }}>
              {t('evaluating')}
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p style={{ color: 'var(--color-error-600)' }} className="mb-4">
              {error}
            </p>
            <Button onClick={handleEvaluate} variant="outline">
              {t('evaluate')}
            </Button>
          </div>
        )}

        {evaluation && !isLoading && (
          <div className="space-y-6">
            {/* Scores and Matrix */}
            <div className="flex items-start gap-8">
              {/* Score Badges */}
              <div className="flex-1 space-y-4">
                <ScoreDisplay
                  label={t('impact')}
                  score={evaluation.impact}
                  currentValue={riskContext.currentImpact}
                  currentLabel={hasCurrentValues ? t('currentValue') : undefined}
                  suggestedLabel={hasCurrentValues ? t('suggestedValue') : undefined}
                />

                <ScoreDisplay
                  label={t('likelihood')}
                  score={evaluation.likelihood}
                  currentValue={riskContext.currentLikelihood}
                  currentLabel={hasCurrentValues ? t('currentValue') : undefined}
                  suggestedLabel={hasCurrentValues ? t('suggestedValue') : undefined}
                />
              </div>

              {/* Risk Matrix */}
              <div className="flex flex-col items-center">
                <span
                  className="text-sm font-medium mb-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {t('riskLevel')}
                </span>
                <RiskMatrixMini impact={evaluation.impact} likelihood={evaluation.likelihood} />
                <Badge
                  variant={
                    calculateRiskMatrixPosition(evaluation.impact, evaluation.likelihood).level ===
                    'critical'
                      ? 'danger'
                      : getRiskLevelColor(
                          Math.max(evaluation.impact, evaluation.likelihood)
                        )
                  }
                  className="mt-2"
                >
                  {t(calculateRiskMatrixPosition(evaluation.impact, evaluation.likelihood).level === 'critical'
                    ? 'high'
                    : getRiskLevelLabel(Math.max(evaluation.impact, evaluation.likelihood))
                  )}
                </Badge>
              </div>
            </div>

            {/* Rationale */}
            {evaluation.rationale && (
              <div>
                <span
                  className="text-sm font-medium block mb-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {t('rationale')}
                </span>
                <p
                  className="text-sm p-3 rounded-md"
                  style={{
                    backgroundColor: 'var(--muted)',
                    color: 'var(--foreground)'
                  }}
                >
                  {evaluation.rationale}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {evaluation && !isLoading && (
        <CardFooter>
          <Button onClick={handleEvaluate} variant="outline" size="sm">
            {t('evaluate')}
          </Button>
          <Button onClick={handleAccept} variant="primary" size="sm">
            {t('accept')}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

export default AIEvaluationPanel
