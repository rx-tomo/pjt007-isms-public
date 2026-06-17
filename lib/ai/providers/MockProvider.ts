/**
 * Mock AI Provider
 *
 * A configurable mock implementation of IAIProvider for testing purposes.
 * Supports simulating various behaviors including:
 * - Custom responses
 * - Latency simulation
 * - Failure simulation
 * - Domain-aware response generation
 *
 * @module lib/ai/providers/MockProvider
 */

import type {
  IAIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIContext
} from '../interfaces/IAIProvider'

/**
 * Configuration options for MockProvider.
 */
export interface MockProviderConfig {
  /**
   * Default response content to return.
   * If not specified, a domain-aware mock response will be generated.
   */
  defaultResponse?: string

  /**
   * When true, complete() will throw an error and isAvailable() will return false.
   */
  shouldFail?: boolean

  /**
   * Simulated latency in milliseconds before returning response.
   */
  latencyMs?: number
}

/**
 * Mock implementation of IAIProvider for testing.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const provider = new MockProvider()
 * const response = await provider.complete({ prompt: 'Test' })
 *
 * // With custom response
 * const customProvider = new MockProvider({
 *   defaultResponse: 'Custom response'
 * })
 *
 * // Simulating failure
 * const failingProvider = new MockProvider({ shouldFail: true })
 * await failingProvider.complete({ prompt: 'Test' }) // throws
 *
 * // Simulating latency
 * const slowProvider = new MockProvider({ latencyMs: 1000 })
 * ```
 */
export class MockProvider implements IAIProvider {
  private config: MockProviderConfig

  /**
   * Creates a new MockProvider instance.
   *
   * @param config - Optional configuration for mock behavior
   */
  constructor(config?: MockProviderConfig) {
    this.config = config || {}
  }

  /**
   * Simulates an AI completion request.
   *
   * @param request - The completion request
   * @returns Promise resolving to mock completion response
   * @throws Error if shouldFail is configured as true
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Simulate latency if configured
    if (this.config.latencyMs) {
      await new Promise((resolve) => setTimeout(resolve, this.config.latencyMs))
    }

    // Simulate failure if configured
    if (this.config.shouldFail) {
      throw new Error('Mock provider configured to fail')
    }

    // Generate response content
    const content =
      this.config.defaultResponse || this.generateMockResponse(request)

    return {
      content,
      usage: {
        promptTokens: request.prompt.length,
        completionTokens: 100,
        totalTokens: request.prompt.length + 100
      },
      cached: false,
      provider: 'mock'
    }
  }

  /**
   * Checks if the mock provider is available.
   *
   * @returns Promise resolving to true unless shouldFail is configured
   */
  async isAvailable(): Promise<boolean> {
    return !this.config.shouldFail
  }

  /**
   * Gets the provider name.
   *
   * @returns "mock"
   */
  getProviderName(): string {
    return 'mock'
  }

  /**
   * Generates a domain-aware mock response based on the request context.
   *
   * @param request - The completion request with optional context
   * @returns Generated mock response content
   */
  private generateMockResponse(request: AICompletionRequest): string {
    const context = request.context
    const locale = context?.locale || 'ja'
    const domain = context?.domain || 'risk_identification'

    return this.getResponseByDomainAndLocale(domain, locale)
  }

  /**
   * Returns appropriate mock response based on domain and locale.
   *
   * AIRiskAssessmentService のパーサーが期待するJSON契約
   * （threats/vulnerabilities・assessment・treatments）に準拠した
   * JSON文字列を返す。プレーンテキストはパースエラーになるため不可。
   */
  private getResponseByDomainAndLocale(
    domain: AIContext['domain'],
    locale: AIContext['locale']
  ): string {
    const lang: 'ja' | 'en' = locale === 'en' ? 'en' : 'ja'

    const texts = {
      ja: {
        threat1: { name: '不正アクセス', description: '外部からの攻撃により情報が漏洩する脅威' },
        threat2: { name: 'データ損失', description: 'バックアップ不備により重要データが消失する脅威' },
        threat3: { name: '内部不正', description: '従業員による機密情報の持ち出しの脅威' },
        vuln1: { name: '認証強度の不足', description: '多要素認証が未導入でパスワードのみの保護に依存している' },
        vuln2: { name: 'バックアップ運用の不備', description: '復旧テストが未実施でリストア可能性が未検証' },
        impactRationale: '業務停止や重大な損害につながる可能性があるため影響度は高い',
        likelihoodRationale: '年に1〜2回程度の発生が想定される',
        justification: '影響度と発生可能性の組み合わせから高リスクと評価（モック応答）',
        treatment1: { name: '多要素認証の導入', description: '管理者および全ユーザーのログインに多要素認証を導入する' },
        treatment2: { name: 'バックアップと復旧テスト', description: '定期バックアップと年次の復旧テストを実施する' },
        reduction: '不正アクセス起因の漏洩リスクを大幅に低減できる見込み',
        recommendation: '優先度1の対策から順次実施することを推奨します（モック応答）'
      },
      en: {
        threat1: { name: 'Unauthorized Access', description: 'Threat of information leakage due to external attacks' },
        threat2: { name: 'Data Loss', description: 'Threat of losing critical data due to backup failures' },
        threat3: { name: 'Insider Threat', description: 'Threat of confidential information exfiltration by employees' },
        vuln1: { name: 'Weak Authentication', description: 'MFA is not deployed; protection relies on passwords only' },
        vuln2: { name: 'Backup Process Gap', description: 'Restore tests are not performed; recoverability is unverified' },
        impactRationale: 'High impact due to potential business disruption or significant damage',
        likelihoodRationale: 'Estimated occurrence of 1-2 times per year',
        justification: 'Assessed as high risk from the combination of impact and likelihood (mock response)',
        treatment1: { name: 'Deploy Multi-Factor Authentication', description: 'Require MFA for administrator and all user logins' },
        treatment2: { name: 'Backups and Recovery Testing', description: 'Run periodic backups with annual restore testing' },
        reduction: 'Expected to significantly reduce leakage risk from unauthorized access',
        recommendation: 'Recommend implementing treatments in priority order (mock response)'
      }
    }[lang]

    const responses: Record<NonNullable<AIContext['domain']>, unknown> = {
      risk_identification: {
        threats: [
          { ...texts.threat1, likelihood: 3 },
          { ...texts.threat2, likelihood: 2 },
          { ...texts.threat3, likelihood: 2 }
        ],
        vulnerabilities: [
          { ...texts.vuln1, severity: 4 },
          { ...texts.vuln2, severity: 3 }
        ]
      },
      risk_assessment: {
        assessment: {
          impact: { score: 4, rationale: texts.impactRationale },
          likelihood: { score: 3, rationale: texts.likelihoodRationale },
          riskLevel: 'high',
          overallJustification: texts.justification
        }
      },
      treatment_suggestion: {
        treatments: [
          {
            priority: 1,
            type: 'mitigate',
            ...texts.treatment1,
            annexAReference: 'A.5.17',
            implementationSteps: [],
            estimatedEffort: 'medium',
            estimatedCost: 'low',
            expectedRiskReduction: texts.reduction
          },
          {
            priority: 2,
            type: 'mitigate',
            ...texts.treatment2,
            annexAReference: 'A.8.13',
            implementationSteps: [],
            estimatedEffort: 'medium',
            estimatedCost: 'medium',
            expectedRiskReduction: texts.reduction
          }
        ],
        recommendation: texts.recommendation
      }
    }

    return JSON.stringify(responses[domain] ?? responses.risk_identification, null, 2)
  }
}
