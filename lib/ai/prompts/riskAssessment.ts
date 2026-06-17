/**
 * Risk Assessment Prompt Builder
 *
 * Builds structured prompts for AI-assisted risk assessment
 * based on risk information and locale.
 *
 * @module lib/ai/prompts/riskAssessment
 */

/**
 * Context information for a risk to be assessed.
 */
export interface RiskContext {
  /**
   * The name of the risk to assess.
   */
  riskName: string

  /**
   * The category of the risk (confidentiality, integrity, availability).
   */
  riskCategory: string

  /**
   * Optional description of the risk.
   */
  description?: string

  /**
   * Optional name of the related asset.
   */
  assetName?: string

  /**
   * Optional current impact score (0-5).
   */
  currentImpact?: number

  /**
   * Optional current likelihood score (0-5).
   */
  currentLikelihood?: number

  /**
   * Optional list of existing controls.
   */
  existingControls?: string[]
}

/**
 * Supported locales for prompt generation.
 */
export type PromptLocale = 'ja' | 'en'

/**
 * Checks if a string value is empty or whitespace-only.
 */
function isEmpty(value: string | undefined): boolean {
  return !value || value.trim() === ''
}

/**
 * Formats existing controls for the prompt.
 */
function formatControls(controls: string[] | undefined, locale: PromptLocale): string {
  if (!controls || controls.length === 0) {
    return locale === 'ja'
      ? '現在、管理策は実装されていません。'
      : 'No existing controls have been implemented.'
  }
  return controls.map((c) => `- ${c}`).join('\n')
}

/**
 * Japanese prompt template for risk assessment.
 */
function buildJapanesePrompt(risk: RiskContext): string {
  const lines: string[] = []

  lines.push('## タスク: 情報セキュリティリスク評価')
  lines.push('')
  lines.push('ISMS（ISO 27001）に基づいて、以下のリスクを評価し、影響度と発生可能性を分析してください。')
  lines.push('')
  lines.push('### リスク情報')
  lines.push(`- リスク名: ${risk.riskName}`)
  lines.push(`- カテゴリ: ${risk.riskCategory}`)

  if (!isEmpty(risk.description)) {
    lines.push(`- 説明: ${risk.description}`)
  }

  if (!isEmpty(risk.assetName)) {
    lines.push(`- 関連資産: ${risk.assetName}`)
  }

  if (risk.currentImpact !== undefined) {
    lines.push(`- 現在の影響度: ${risk.currentImpact} (スケール 1-5)`)
  }

  if (risk.currentLikelihood !== undefined) {
    lines.push(`- 現在の発生可能性: ${risk.currentLikelihood} (スケール 1-5)`)
  }

  lines.push('')
  lines.push('### 既存の管理策')
  lines.push(formatControls(risk.existingControls, 'ja'))
  lines.push('')
  lines.push('### 評価指針')
  lines.push('以下のスケール（1-5）を使用して評価してください：')
  lines.push('')
  lines.push('**影響度スケール：**')
  lines.push('1 = 最小限 | 2 = 軽微 | 3 = 中程度 | 4 = 重大 | 5 = 壊滅的')
  lines.push('')
  lines.push('**発生可能性スケール：**')
  lines.push('1 = まれ | 2 = 低い | 3 = 中程度 | 4 = 高い | 5 = ほぼ確実')
  lines.push('')
  lines.push('### 出力形式')
  lines.push('以下のJSON形式で評価結果を出力し、スコアの理由を説明してください：')
  lines.push('```json')
  lines.push('{')
  lines.push('  "assessment": {')
  lines.push('    "impact": {')
  lines.push('      "score": 1-5,')
  lines.push('      "rationale": "影響度スコアの根拠"')
  lines.push('    },')
  lines.push('    "likelihood": {')
  lines.push('      "score": 1-5,')
  lines.push('      "rationale": "発生可能性スコアの根拠"')
  lines.push('    },')
  lines.push('    "riskLevel": "low | medium | high | critical",')
  lines.push('    "overallJustification": "総合的な評価の説明"')
  lines.push('  }')
  lines.push('}')
  lines.push('```')

  return lines.join('\n')
}

/**
 * English prompt template for risk assessment.
 */
function buildEnglishPrompt(risk: RiskContext): string {
  const lines: string[] = []

  lines.push('## Task: Information Security Risk Assessment')
  lines.push('')
  lines.push('Based on ISMS (ISO 27001), assess the following risk and analyze its impact and likelihood.')
  lines.push('')
  lines.push('### Risk Information')
  lines.push(`- Risk Name: ${risk.riskName}`)
  lines.push(`- Category: ${risk.riskCategory}`)

  if (!isEmpty(risk.description)) {
    lines.push(`- Description: ${risk.description}`)
  }

  if (!isEmpty(risk.assetName)) {
    lines.push(`- Related Asset: ${risk.assetName}`)
  }

  if (risk.currentImpact !== undefined) {
    lines.push(`- Current Impact: ${risk.currentImpact} (scale 1-5)`)
  }

  if (risk.currentLikelihood !== undefined) {
    lines.push(`- Current Likelihood: ${risk.currentLikelihood} (scale 1-5)`)
  }

  lines.push('')
  lines.push('### Existing Controls')
  lines.push(formatControls(risk.existingControls, 'en'))
  lines.push('')
  lines.push('### Assessment Guidelines')
  lines.push('Evaluate using the following scale (1-5):')
  lines.push('')
  lines.push('**Impact Scale:**')
  lines.push('1 = Minimal | 2 = Minor | 3 = Moderate | 4 = Major | 5 = Catastrophic')
  lines.push('')
  lines.push('**Likelihood Scale:**')
  lines.push('1 = Rare | 2 = Unlikely | 3 = Possible | 4 = Likely | 5 = Almost Certain')
  lines.push('')
  lines.push('### Output Format')
  lines.push('Provide the assessment in the following JSON structure with rationale for each score:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "assessment": {')
  lines.push('    "impact": {')
  lines.push('      "score": 1-5,')
  lines.push('      "rationale": "Reason for impact score"')
  lines.push('    },')
  lines.push('    "likelihood": {')
  lines.push('      "score": 1-5,')
  lines.push('      "rationale": "Reason for likelihood score"')
  lines.push('    },')
  lines.push('    "riskLevel": "low | medium | high | critical",')
  lines.push('    "overallJustification": "Overall assessment explanation"')
  lines.push('  }')
  lines.push('}')
  lines.push('```')

  return lines.join('\n')
}

/**
 * Builds a structured prompt for AI-assisted risk assessment.
 *
 * @param risk - The risk context containing risk information
 * @param locale - The locale for the prompt ('ja' or 'en')
 * @returns A formatted prompt string for risk assessment
 *
 * @example
 * ```typescript
 * const prompt = buildRiskAssessmentPrompt(
 *   {
 *     riskName: 'Data Breach',
 *     riskCategory: 'confidentiality',
 *     currentImpact: 4,
 *     currentLikelihood: 3,
 *     existingControls: ['Firewall', 'MFA']
 *   },
 *   'en'
 * )
 * ```
 */
export function buildRiskAssessmentPrompt(
  risk: RiskContext,
  locale: PromptLocale
): string {
  if (locale === 'ja') {
    return buildJapanesePrompt(risk)
  }
  return buildEnglishPrompt(risk)
}
