/**
 * Treatment Suggestion Prompt Builder
 *
 * Builds structured prompts for AI-assisted risk treatment suggestions
 * based on risk information and locale.
 *
 * @module lib/ai/prompts/treatmentSuggestion
 */

/**
 * Context information for a risk requiring treatment suggestions.
 */
export interface RiskContext {
  /**
   * The name of the risk to treat.
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
 * Japanese prompt template for treatment suggestion.
 */
function buildJapanesePrompt(risk: RiskContext): string {
  const lines: string[] = []

  lines.push('## タスク: リスク対策の提案')
  lines.push('')
  lines.push('ISMS（ISO 27001）に基づいて、以下のリスクに対する効果的な対策・管理策を提案してください。')
  lines.push('ISO 27001 Annex A の管理策を参照し、適切な対応策を推奨してください。')
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
  lines.push('### リスク対応オプション')
  lines.push('以下の対応オプションを検討してください：')
  lines.push('- **軽減（低減）**: 管理策を実装してリスクを低減')
  lines.push('- **移転**: 保険や外部委託でリスクを移転')
  lines.push('- **回避**: リスク要因となる活動を停止')
  lines.push('- **受容**: リスクを認識した上で受け入れ')
  lines.push('')
  lines.push('### 出力形式')
  lines.push('以下のJSON形式で対策を提案してください。優先順位を付けて推奨してください：')
  lines.push('```json')
  lines.push('{')
  lines.push('  "treatments": [')
  lines.push('    {')
  lines.push('      "priority": 1,')
  lines.push('      "type": "mitigate | transfer | avoid | accept",')
  lines.push('      "name": "対策名",')
  lines.push('      "description": "対策の詳細説明",')
  lines.push('      "annexAReference": "A.x.x (該当する場合)",')
  lines.push('      "implementationSteps": ["ステップ1", "ステップ2"],')
  lines.push('      "estimatedEffort": "low | medium | high",')
  lines.push('      "estimatedCost": "low | medium | high",')
  lines.push('      "expectedRiskReduction": "リスク低減の見込み"')
  lines.push('    }')
  lines.push('  ],')
  lines.push('  "recommendation": "総合的な推奨事項"')
  lines.push('}')
  lines.push('```')

  return lines.join('\n')
}

/**
 * English prompt template for treatment suggestion.
 */
function buildEnglishPrompt(risk: RiskContext): string {
  const lines: string[] = []

  lines.push('## Task: Risk Treatment Suggestion')
  lines.push('')
  lines.push('Based on ISMS (ISO 27001), suggest effective controls and countermeasures for the following risk.')
  lines.push('Reference ISO 27001 Annex A controls and recommend appropriate treatment options.')
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
  lines.push('### Treatment Options')
  lines.push('Consider the following treatment options:')
  lines.push('- **Mitigate/Reduce**: Implement controls to reduce the risk')
  lines.push('- **Transfer**: Transfer risk through insurance or outsourcing')
  lines.push('- **Avoid**: Stop activities that cause the risk')
  lines.push('- **Accept**: Accept the risk with awareness')
  lines.push('')
  lines.push('### Output Format')
  lines.push('Provide treatment suggestions in the following JSON structure. Rank by priority:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "treatments": [')
  lines.push('    {')
  lines.push('      "priority": 1,')
  lines.push('      "type": "mitigate | transfer | avoid | accept",')
  lines.push('      "name": "Treatment name",')
  lines.push('      "description": "Detailed description of the treatment",')
  lines.push('      "annexAReference": "A.x.x (if applicable)",')
  lines.push('      "implementationSteps": ["Step 1", "Step 2"],')
  lines.push('      "estimatedEffort": "low | medium | high",')
  lines.push('      "estimatedCost": "low | medium | high",')
  lines.push('      "expectedRiskReduction": "Expected risk reduction"')
  lines.push('    }')
  lines.push('  ],')
  lines.push('  "recommendation": "Overall recommendation"')
  lines.push('}')
  lines.push('```')

  return lines.join('\n')
}

/**
 * Builds a structured prompt for AI-assisted risk treatment suggestions.
 *
 * @param risk - The risk context containing risk information
 * @param locale - The locale for the prompt ('ja' or 'en')
 * @returns A formatted prompt string for treatment suggestions
 *
 * @example
 * ```typescript
 * const prompt = buildTreatmentSuggestionPrompt(
 *   {
 *     riskName: 'Data Breach',
 *     riskCategory: 'confidentiality',
 *     currentImpact: 4,
 *     currentLikelihood: 3,
 *     existingControls: ['Firewall']
 *   },
 *   'en'
 * )
 * ```
 */
export function buildTreatmentSuggestionPrompt(
  risk: RiskContext,
  locale: PromptLocale
): string {
  if (locale === 'ja') {
    return buildJapanesePrompt(risk)
  }
  return buildEnglishPrompt(risk)
}
