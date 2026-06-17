/**
 * Risk Identification Prompt Builder
 *
 * Builds structured prompts for AI-assisted risk identification
 * based on asset information and locale.
 *
 * @module lib/ai/prompts/riskIdentification
 */

/**
 * Context information for an asset to be analyzed for risks.
 */
export interface AssetContext {
  /**
   * The name of the asset to analyze.
   */
  assetName: string

  /**
   * The type/category of the asset (e.g., server, database, application).
   */
  assetType: string

  /**
   * Optional description of the asset.
   */
  description?: string

  /**
   * Optional department that owns or uses the asset.
   */
  department?: string

  /**
   * Optional owner or responsible party for the asset.
   */
  owner?: string
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
 * Japanese prompt template for risk identification.
 */
function buildJapanesePrompt(asset: AssetContext): string {
  const lines: string[] = []

  lines.push('## タスク: 情報セキュリティリスクの識別')
  lines.push('')
  lines.push('ISMS（ISO 27001）に基づいて、以下の資産に関連する潜在的なセキュリティリスクを識別してください。')
  lines.push('')
  lines.push('### 資産情報')
  lines.push(`- 資産名: ${asset.assetName}`)
  lines.push(`- 資産タイプ: ${asset.assetType}`)

  if (!isEmpty(asset.description)) {
    lines.push(`- 説明: ${asset.description}`)
  }

  if (!isEmpty(asset.department)) {
    lines.push(`- 部門: ${asset.department}`)
  }

  if (!isEmpty(asset.owner)) {
    lines.push(`- 所有者: ${asset.owner}`)
  }

  lines.push('')
  lines.push('### 識別すべきリスクの観点')
  lines.push('以下の観点から脅威と脆弱性を識別してください：')
  lines.push('- 機密性（Confidentiality）: 情報の不正アクセス、漏洩')
  lines.push('- 完全性（Integrity）: データの改ざん、破壊')
  lines.push('- 可用性（Availability）: システム停止、サービス中断')
  lines.push('')
  lines.push('### 出力形式')
  lines.push('以下のJSON形式でリスクを出力してください：')
  lines.push('```json')
  lines.push('{')
  lines.push('  "risks": [')
  lines.push('    {')
  lines.push('      "name": "リスク名",')
  lines.push('      "category": "confidentiality | integrity | availability",')
  lines.push('      "threat": "脅威の説明",')
  lines.push('      "vulnerability": "脆弱性の説明",')
  lines.push('      "potentialImpact": "潜在的な影響の説明"')
  lines.push('    }')
  lines.push('  ]')
  lines.push('}')
  lines.push('```')

  return lines.join('\n')
}

/**
 * English prompt template for risk identification.
 */
function buildEnglishPrompt(asset: AssetContext): string {
  const lines: string[] = []

  lines.push('## Task: Information Security Risk Identification')
  lines.push('')
  lines.push('Based on ISMS (ISO 27001), identify potential security risks related to the following asset.')
  lines.push('')
  lines.push('### Asset Information')
  lines.push(`- Asset Name: ${asset.assetName}`)
  lines.push(`- Asset Type: ${asset.assetType}`)

  if (!isEmpty(asset.description)) {
    lines.push(`- Description: ${asset.description}`)
  }

  if (!isEmpty(asset.department)) {
    lines.push(`- Department: ${asset.department}`)
  }

  if (!isEmpty(asset.owner)) {
    lines.push(`- Owner: ${asset.owner}`)
  }

  lines.push('')
  lines.push('### Risk Identification Perspectives')
  lines.push('Identify threats and vulnerabilities from the following CIA perspectives:')
  lines.push('- Confidentiality: Unauthorized access, data leakage')
  lines.push('- Integrity: Data tampering, corruption')
  lines.push('- Availability: System downtime, service interruption')
  lines.push('')
  lines.push('### Output Format')
  lines.push('Provide the identified risks in the following JSON structure:')
  lines.push('```json')
  lines.push('{')
  lines.push('  "risks": [')
  lines.push('    {')
  lines.push('      "name": "Risk name",')
  lines.push('      "category": "confidentiality | integrity | availability",')
  lines.push('      "threat": "Description of the threat",')
  lines.push('      "vulnerability": "Description of the vulnerability",')
  lines.push('      "potentialImpact": "Description of potential impact"')
  lines.push('    }')
  lines.push('  ]')
  lines.push('}')
  lines.push('```')

  return lines.join('\n')
}

/**
 * Builds a structured prompt for AI-assisted risk identification.
 *
 * @param asset - The asset context containing asset information
 * @param locale - The locale for the prompt ('ja' or 'en')
 * @returns A formatted prompt string for risk identification
 *
 * @example
 * ```typescript
 * const prompt = buildRiskIdentificationPrompt(
 *   {
 *     assetName: 'Customer Database',
 *     assetType: 'database',
 *     description: 'Main customer data storage',
 *     department: 'IT'
 *   },
 *   'en'
 * )
 * ```
 */
export function buildRiskIdentificationPrompt(
  asset: AssetContext,
  locale: PromptLocale
): string {
  if (locale === 'ja') {
    return buildJapanesePrompt(asset)
  }
  return buildEnglishPrompt(asset)
}
