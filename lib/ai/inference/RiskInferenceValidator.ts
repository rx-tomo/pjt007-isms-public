/**
 * RiskInferenceValidator
 *
 * Validates AI-generated risk estimates for reasonableness and consistency.
 * Ensures that AI risk assessments meet quality standards and logical coherence.
 *
 * Validation Rules:
 * 1. Score range check (1-5 for impact/likelihood)
 * 2. Logical consistency between threats, estimates, and treatments
 * 3. Rationale quality (not empty, sufficient length, relevant keywords)
 * 4. Treatment-risk alignment
 * 5. Anomaly detection for outlier estimates
 *
 * @module lib/ai/inference/RiskInferenceValidator
 */

import type { RiskContext } from '../cache/CacheInvalidationStrategy'

/**
 * Threat and vulnerability suggestion (from aiRiskAssessment service)
 */
export interface ThreatVulnerabilitySuggestion {
  threats: Array<{
    name: string
    description: string
    likelihood: number
  }>
  vulnerabilities: Array<{
    name: string
    description: string
    severity: number
  }>
}

/**
 * Risk level estimate (from aiRiskAssessment service)
 */
export interface RiskLevelEstimate {
  impact: number
  likelihood: number
  rationale: string
}

/**
 * Treatment suggestion (from aiRiskAssessment service)
 */
export interface TreatmentSuggestion {
  treatments: Array<{
    type: 'accept' | 'mitigate' | 'transfer' | 'avoid'
    description: string
    controlIds?: string[]
  }>
}

/**
 * Validation issue with bilingual messages
 */
export interface ValidationIssue {
  /** Error code for programmatic handling */
  code: string
  /** English message */
  message: string
  /** Japanese message */
  messageJa: string
  /** Severity level: warning = should review, error = invalid */
  severity: 'warning' | 'error'
  /** Field that triggered the issue (optional) */
  field?: string
}

/**
 * Result of validating a risk estimate
 */
export interface ValidationResult {
  /** Whether the estimate is valid (no errors) */
  isValid: boolean
  /** List of validation issues found */
  issues: ValidationIssue[]
  /** Recommendations for improving the estimate */
  recommendations: string[]
  /** Overall confidence in the estimate (0.0-1.0) */
  confidence: number
}

/**
 * Result of checking consistency between threats, estimates, and treatments
 */
export interface ConsistencyReport {
  /** Whether all data is logically consistent */
  isConsistent: boolean
  /** List of inconsistencies found */
  inconsistencies: ValidationIssue[]
  /** Overall confidence score (0.0-1.0) */
  overallConfidence: number
}

/**
 * Interface for risk inference validation
 */
export interface IRiskInferenceValidator {
  /**
   * Validate a risk level estimate against context
   */
  validateRiskEstimate(
    estimate: RiskLevelEstimate,
    context: RiskContext
  ): ValidationResult

  /**
   * Check consistency between threats, estimate, and treatments
   */
  checkConsistency(
    threats: ThreatVulnerabilitySuggestion,
    estimate: RiskLevelEstimate,
    treatments: TreatmentSuggestion
  ): ConsistencyReport

  /**
   * Validate that a score is within acceptable range (1-5)
   */
  validateScoreRange(score: number, fieldName: string): ValidationIssue | null

  /**
   * Detect anomalies in an estimate based on context
   */
  detectAnomalies(
    estimate: RiskLevelEstimate,
    context: RiskContext
  ): ValidationIssue[]
}

/**
 * Keywords that indicate risk-specific rationale
 */
const RISK_KEYWORDS = [
  // English keywords
  'risk', 'impact', 'threat', 'vulnerability', 'security',
  'confidentiality', 'integrity', 'availability', 'breach',
  'attack', 'exposure', 'sensitive', 'critical', 'damage',
  'loss', 'unauthorized', 'compliance', 'regulatory', 'control',
  'likelihood', 'probability', 'severity', 'mitigation',
  // Japanese keywords
  'リスク', '影響', '脅威', '脆弱性', 'セキュリティ',
  '機密性', '完全性', '可用性', '侵害', '攻撃',
  '露出', '機密', '重大', '損害', '損失',
  '不正', 'コンプライアンス', '規制', '管理', '対策',
  '可能性', '確率', '深刻度', '緩和'
]

/**
 * High-risk keywords that suggest critical scenarios
 */
const HIGH_RISK_KEYWORDS = [
  'critical', 'severe', 'catastrophic', 'complete', 'total',
  'financial', 'payment', 'credential', 'personal', 'pii',
  'production', 'customer', 'infrastructure',
  '重大', '深刻', '壊滅的', '完全', '全面',
  '金融', '支払い', '認証', '個人', '本番',
  '顧客', 'インフラ'
]

/**
 * Low-risk keywords that suggest minimal impact scenarios
 */
const LOW_RISK_KEYWORDS = [
  'public', 'marketing', 'static', 'demo', 'test',
  'non-sensitive', 'temporary', 'minor',
  '公開', 'マーケティング', '静的', 'デモ', 'テスト',
  '非機密', '一時的', '軽微'
]

/**
 * Risk Inference Validator Implementation
 *
 * Validates AI-generated risk estimates for:
 * - Score ranges (1-5)
 * - Rationale quality
 * - Logical consistency
 * - Anomaly detection
 */
export class RiskInferenceValidator implements IRiskInferenceValidator {
  /**
   * Minimum rationale length to avoid "short rationale" warning
   */
  private readonly minRationaleLength = 20

  /**
   * Confidence penalty per issue found
   */
  private readonly confidencePenalty = {
    error: 0.3,
    warning: 0.1
  }

  /**
   * Validate a score is within the acceptable range (1-5)
   */
  validateScoreRange(score: number, fieldName: string): ValidationIssue | null {
    // Check if score is an integer (allow small floating point tolerance)
    const isInteger = Number.isInteger(score)

    if (!isInteger) {
      // Non-integer scores get a warning
      return {
        code: 'SCORE_NOT_INTEGER',
        message: `Score ${score} for ${fieldName} should be an integer between 1 and 5`,
        messageJa: `${fieldName}のスコア${score}は1から5の整数である必要があります`,
        severity: 'warning',
        field: fieldName
      }
    }

    // Check range
    if (score < 1 || score > 5) {
      return {
        code: 'SCORE_OUT_OF_RANGE',
        message: `Score ${score} for ${fieldName} is out of valid range (1-5)`,
        messageJa: `${fieldName}のスコア${score}は有効範囲外です（1-5）`,
        severity: 'error',
        field: fieldName
      }
    }

    return null
  }

  /**
   * Validate a risk level estimate
   */
  validateRiskEstimate(
    estimate: RiskLevelEstimate,
    context: RiskContext
  ): ValidationResult {
    const issues: ValidationIssue[] = []
    const recommendations: string[] = []
    let baseConfidence = 1.0

    // 1. Validate score ranges
    const impactIssue = this.validateScoreRange(estimate.impact, 'impact')
    if (impactIssue) {
      issues.push(impactIssue)
    }

    const likelihoodIssue = this.validateScoreRange(estimate.likelihood, 'likelihood')
    if (likelihoodIssue) {
      issues.push(likelihoodIssue)
    }

    // 2. Check rationale quality
    const rationaleIssues = this.validateRationale(estimate.rationale)
    issues.push(...rationaleIssues)

    // 3. Generate recommendations based on issues
    if (rationaleIssues.some(i => i.code === 'EMPTY_RATIONALE')) {
      recommendations.push('Provide a detailed rationale explaining the risk assessment')
      recommendations.push('Include specific factors that influenced the impact and likelihood scores')
    }

    if (rationaleIssues.some(i => i.code === 'SHORT_RATIONALE')) {
      recommendations.push('Expand the rationale to include more context about the risk')
    }

    if (rationaleIssues.some(i => i.code === 'GENERIC_RATIONALE')) {
      recommendations.push('Include risk-specific terminology (e.g., impact, threat, vulnerability)')
    }

    // 4. Calculate confidence
    for (const issue of issues) {
      baseConfidence -= this.confidencePenalty[issue.severity]
    }

    // Ensure confidence stays between 0 and 1
    const confidence = Math.max(0, Math.min(1, baseConfidence))

    // 5. Determine validity (valid if no errors)
    const isValid = !issues.some(i => i.severity === 'error')

    return {
      isValid,
      issues,
      recommendations,
      confidence
    }
  }

  /**
   * Validate rationale quality
   */
  private validateRationale(rationale: string): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const trimmedRationale = rationale?.trim() || ''

    // Check for empty rationale
    if (trimmedRationale.length === 0) {
      issues.push({
        code: 'EMPTY_RATIONALE',
        message: 'Risk rationale is empty. Provide justification for the assessment.',
        messageJa: 'リスク根拠が空です。評価の正当性を説明してください。',
        severity: 'warning'
      })
      return issues // No need to check further
    }

    // Check for short rationale
    if (trimmedRationale.length < this.minRationaleLength) {
      issues.push({
        code: 'SHORT_RATIONALE',
        message: `Rationale is too short (${trimmedRationale.length} chars). Provide more detailed justification.`,
        messageJa: `根拠が短すぎます（${trimmedRationale.length}文字）。より詳細な説明を提供してください。`,
        severity: 'warning'
      })
    }

    // Check for generic rationale (no risk-specific keywords)
    const lowerRationale = trimmedRationale.toLowerCase()
    const hasRiskKeyword = RISK_KEYWORDS.some(keyword =>
      lowerRationale.includes(keyword.toLowerCase())
    )

    if (!hasRiskKeyword) {
      issues.push({
        code: 'GENERIC_RATIONALE',
        message: 'Rationale lacks risk-specific terminology. Include security/risk context.',
        messageJa: '根拠にリスク固有の用語がありません。セキュリティ/リスクの文脈を含めてください。',
        severity: 'warning'
      })
    }

    return issues
  }

  /**
   * Check consistency between threats, estimate, and treatments
   */
  checkConsistency(
    threats: ThreatVulnerabilitySuggestion,
    estimate: RiskLevelEstimate,
    treatments: TreatmentSuggestion
  ): ConsistencyReport {
    const inconsistencies: ValidationIssue[] = []
    let baseConfidence = 1.0

    // 1. Check high impact with no threats
    const hasThreats = threats.threats.length > 0 || threats.vulnerabilities.length > 0
    if (estimate.impact >= 4 && !hasThreats) {
      inconsistencies.push({
        code: 'HIGH_IMPACT_NO_THREATS',
        message: `High impact (${estimate.impact}) estimated but no threats identified. Review assessment.`,
        messageJa: `高い影響度（${estimate.impact}）が推定されていますが、脅威が特定されていません。評価を見直してください。`,
        severity: 'warning'
      })
    }

    // 2. Check low impact with severe threats
    const maxThreatLikelihood = Math.max(0, ...threats.threats.map(t => t.likelihood))
    const maxVulnSeverity = Math.max(0, ...threats.vulnerabilities.map(v => v.severity))
    const maxThreatSeverity = Math.max(maxThreatLikelihood, maxVulnSeverity)

    if (estimate.impact <= 2 && maxThreatSeverity >= 4) {
      inconsistencies.push({
        code: 'LOW_IMPACT_SEVERE_THREATS',
        message: `Low impact (${estimate.impact}) but severe threats identified (severity ${maxThreatSeverity}). Review assessment.`,
        messageJa: `低い影響度（${estimate.impact}）ですが、深刻な脅威が特定されています（深刻度${maxThreatSeverity}）。評価を見直してください。`,
        severity: 'warning'
      })
    }

    // 3. Check risk-treatment mismatch
    const riskLevel = (estimate.impact + estimate.likelihood) / 2
    const treatmentTypes = treatments.treatments.map(t => t.type)
    const hasOnlyAccept = treatmentTypes.length > 0 &&
                          treatmentTypes.every(t => t === 'accept')

    if (riskLevel >= 4 && hasOnlyAccept) {
      inconsistencies.push({
        code: 'RISK_TREATMENT_MISMATCH',
        message: `High risk (${riskLevel.toFixed(1)}) with only "accept" treatment. Consider mitigation options.`,
        messageJa: `高リスク（${riskLevel.toFixed(1)}）に対して「受容」のみの対応です。軽減策を検討してください。`,
        severity: 'warning'
      })
    }

    // 4. Check unusual treatment for low risk
    const hasAvoid = treatmentTypes.includes('avoid')
    if (riskLevel <= 2 && hasAvoid) {
      inconsistencies.push({
        code: 'UNUSUAL_TREATMENT_FOR_RISK',
        message: `Low risk (${riskLevel.toFixed(1)}) with "avoid" treatment is unusual. Verify if avoidance is necessary.`,
        messageJa: `低リスク（${riskLevel.toFixed(1)}）に対する「回避」対応は異例です。回避が必要か確認してください。`,
        severity: 'warning'
      })
    }

    // Calculate confidence
    for (const issue of inconsistencies) {
      baseConfidence -= this.confidencePenalty[issue.severity]
    }

    const overallConfidence = Math.max(0, Math.min(1, baseConfidence))
    const isConsistent = inconsistencies.length === 0

    return {
      isConsistent,
      inconsistencies,
      overallConfidence
    }
  }

  /**
   * Detect anomalies in an estimate based on context
   */
  detectAnomalies(
    estimate: RiskLevelEstimate,
    context: RiskContext
  ): ValidationIssue[] {
    const anomalies: ValidationIssue[] = []
    const description = `${context.riskName} ${context.description || ''}`.toLowerCase()

    // Check for extreme high estimates with low-risk context
    const hasLowRiskKeywords = LOW_RISK_KEYWORDS.some(kw =>
      description.includes(kw.toLowerCase())
    )

    if (estimate.impact >= 5 && estimate.likelihood >= 5 && hasLowRiskKeywords) {
      anomalies.push({
        code: 'EXTREME_VARIANCE',
        message: 'Maximum risk scores for a context with low-risk indicators. Review assessment.',
        messageJa: '低リスク指標を持つコンテキストに対して最大リスクスコアが設定されています。評価を見直してください。',
        severity: 'warning'
      })
    }

    // Check for extreme low estimates with high-risk context
    const hasHighRiskKeywords = HIGH_RISK_KEYWORDS.some(kw =>
      description.includes(kw.toLowerCase())
    )

    if (estimate.impact <= 1 && estimate.likelihood <= 1 && hasHighRiskKeywords) {
      anomalies.push({
        code: 'EXTREME_VARIANCE',
        message: 'Minimum risk scores for a context with high-risk indicators. Review assessment.',
        messageJa: '高リスク指標を持つコンテキストに対して最小リスクスコアが設定されています。評価を見直してください。',
        severity: 'warning'
      })
    }

    // Check for mismatch based on category
    if (context.riskCategory === 'confidentiality') {
      // Confidentiality risks involving sensitive data keywords
      const sensitiveKeywords = ['customer', 'financial', 'personal', 'pii', 'credential', '顧客', '金融', '個人', '認証']
      const hasSensitiveData = sensitiveKeywords.some(kw => description.includes(kw.toLowerCase()))

      if (hasSensitiveData && estimate.impact <= 1) {
        anomalies.push({
          code: 'EXTREME_VARIANCE',
          message: 'Very low impact for confidentiality risk with sensitive data indicators.',
          messageJa: '機密データ指標を持つ機密性リスクに対して非常に低い影響度が設定されています。',
          severity: 'warning'
        })
      }
    }

    return anomalies
  }
}
