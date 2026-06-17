/**
 * AI Risk Assessment Service
 *
 * Provides AI-assisted risk assessment functionality for ISMS.
 * Integrates with AI providers, privacy filtering, caching, and persistence.
 *
 * Features:
 * - Threat and vulnerability identification
 * - Risk level estimation (impact/likelihood)
 * - Treatment suggestion with ISO 27001 Annex A references
 * - PII anonymization before AI processing
 * - Response caching for performance
 * - Usage logging for billing and analytics
 *
 * @module lib/services/aiRiskAssessment
 */

import type { IAIProvider, AICompletionRequest } from '@/lib/ai/interfaces/IAIProvider'
import type { PrivacyFilter, AnonymizationResult } from '@/lib/ai/filters/PrivacyFilter'
import type { ICacheManager } from '@/lib/ai/cache/CacheManager'
import type { IAISuggestionRepository, SuggestionType } from '@/lib/db/repositories/interfaces/IAISuggestionRepository'
import type { IAIUsageLogRepository, RequestType } from '@/lib/db/repositories/interfaces/IAIUsageLogRepository'
import { buildRiskIdentificationPrompt, type AssetContext } from '@/lib/ai/prompts/riskIdentification'
import { buildRiskAssessmentPrompt, type RiskContext } from '@/lib/ai/prompts/riskAssessment'
import { buildTreatmentSuggestionPrompt } from '@/lib/ai/prompts/treatmentSuggestion'
import { buildScopeSnapshot } from '@/lib/ai/operations/inputScope'
import { MockProvider } from '@/lib/ai/providers/MockProvider'

/**
 * Custom error class for AI service errors
 */
export class AIServiceError extends Error {
  public readonly code: string
  public readonly originalError?: Error

  constructor(message: string, code: string, originalError?: Error) {
    super(message)
    this.name = 'AIServiceError'
    this.code = code
    this.originalError = originalError
  }
}

/**
 * Service context for AI operations
 */
export interface ServiceContext {
  organizationId: string
  userId?: string
  locale: 'ja' | 'en'
  useCache?: boolean  // defaults to true
  saveSuggestion?: boolean  // defaults to true
  allowExternalApi?: boolean
}

/**
 * Threat and vulnerability suggestion response
 */
export interface ThreatVulnerabilitySuggestion {
  threats: Array<{
    name: string
    description: string
    likelihood: number  // 1-5
  }>
  vulnerabilities: Array<{
    name: string
    description: string
    severity: number  // 1-5
  }>
}

/**
 * Risk level estimation response
 */
export interface RiskLevelEstimate {
  impact: number       // 1-5
  likelihood: number   // 1-5
  rationale: string
}

/**
 * Treatment suggestion response
 */
export interface TreatmentSuggestion {
  treatments: Array<{
    type: 'accept' | 'mitigate' | 'transfer' | 'avoid'
    description: string
    controlIds?: string[]  // Annex A control IDs (e.g., "A.5.1", "A.8.2")
  }>
}

interface SuggestionPersistence {
  suggestionId?: string
}

/**
 * Internal AI response for risk assessment
 */
interface RiskAssessmentAIResponse {
  assessment: {
    impact: { score: number; rationale: string }
    likelihood: { score: number; rationale: string }
    riskLevel: string
    overallJustification: string
  }
}

/**
 * Internal AI response for treatment suggestion
 */
interface TreatmentAIResponse {
  treatments: Array<{
    priority: number
    type: 'accept' | 'mitigate' | 'transfer' | 'avoid'
    name: string
    description: string
    annexAReference?: string
    implementationSteps?: string[]
    estimatedEffort?: string
    estimatedCost?: string
    expectedRiskReduction?: string
  }>
  recommendation: string
}

/**
 * AI Risk Assessment Service
 *
 * Orchestrates AI-assisted risk assessment operations with:
 * - Privacy protection (PII anonymization)
 * - Performance optimization (caching)
 * - Persistence (suggestion storage)
 * - Usage tracking (token logging)
 */
export class AIRiskAssessmentService {
  private readonly aiProvider: IAIProvider
  private readonly privacyFilter: PrivacyFilter
  private readonly cacheManager: ICacheManager
  private readonly suggestionRepository: IAISuggestionRepository
  private readonly usageLogRepository: IAIUsageLogRepository

  constructor(
    aiProvider: IAIProvider,
    privacyFilter: PrivacyFilter,
    cacheManager: ICacheManager,
    suggestionRepository: IAISuggestionRepository,
    usageLogRepository: IAIUsageLogRepository
  ) {
    this.aiProvider = aiProvider
    this.privacyFilter = privacyFilter
    this.cacheManager = cacheManager
    this.suggestionRepository = suggestionRepository
    this.usageLogRepository = usageLogRepository
  }

  /**
   * Suggest threats and vulnerabilities for an asset
   */
  async suggestThreatsAndVulnerabilities(
    assetInfo: AssetContext,
    context: ServiceContext
  ): Promise<ThreatVulnerabilitySuggestion & SuggestionPersistence> {
    const useCache = context.useCache ?? true
    const saveSuggestion = context.saveSuggestion ?? true
    const startedAt = new Date().toISOString()
    const inputScope = buildScopeSnapshot('identify', { allowExternalApi: context.allowExternalApi ?? false })

    // Check cache first
    const cacheKey = this.buildCacheKey('threats', context.organizationId, assetInfo.assetName, assetInfo.assetType)
    if (useCache && !saveSuggestion) {
      const cached = this.cacheManager.get<ThreatVulnerabilitySuggestion>(cacheKey)
      if (cached) {
        await this.logRun({
          context,
          requestType: 'risk_identification',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          errorMessage: null,
          startedAt,
          inputScope,
          targetRecords: { riskId: null, assetName: assetInfo.assetName },
          provider: this.getProviderForPolicy(context),
          cached: true,
        })
        return cached
      }
    }

    // Build prompt
    const prompt = buildRiskIdentificationPrompt(assetInfo, context.locale)

    // Anonymize PII
    const { anonymizedText } = this.privacyFilter.anonymize(prompt)

    // Call AI provider
    let result: ThreatVulnerabilitySuggestion & SuggestionPersistence
    let errorMessage: string | null = null
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

    try {
      const request: AICompletionRequest = {
        prompt: anonymizedText,
        context: {
          organizationId: context.organizationId,
          locale: context.locale,
          domain: 'risk_identification'
        }
      }

      const provider = this.getProviderForPolicy(context)
      const response = await provider.complete(request)
      usage = response.usage

      // Parse response
      result = this.parseThreatVulnerabilityResponse(response.content)

      // Cache result
      if (useCache) {
        this.cacheManager.set(cacheKey, result)
      }

      // Save suggestion
      if (saveSuggestion) {
        const usageLog = await this.logRun({
          context,
          requestType: 'risk_identification',
          usage,
          errorMessage,
          startedAt,
          inputScope,
          targetRecords: { riskId: null, assetName: assetInfo.assetName },
          provider,
          cached: false,
        })
        const threats = await Promise.all(result.threats.map(async (threat, index) => {
          const suggestion = await this.suggestionRepository.create({
            organizationId: context.organizationId,
            suggestionType: 'threat' as SuggestionType,
            inputContext: this.sanitizeRecord({ ...assetInfo, itemIndex: index } as Record<string, unknown>),
            inputScope,
            suggestionContent: this.sanitizeRecord(threat as unknown as Record<string, unknown>),
            usageLogId: usageLog.id,
          })
          return { ...threat, id: suggestion.id, persistenceId: suggestion.id }
        }))
        const vulnerabilities = await Promise.all(result.vulnerabilities.map(async (vulnerability, index) => {
          const suggestion = await this.suggestionRepository.create({
            organizationId: context.organizationId,
            suggestionType: 'vulnerability' as SuggestionType,
            inputContext: this.sanitizeRecord({ ...assetInfo, itemIndex: index } as Record<string, unknown>),
            inputScope,
            suggestionContent: this.sanitizeRecord(vulnerability as unknown as Record<string, unknown>),
            usageLogId: usageLog.id,
          })
          return { ...vulnerability, id: suggestion.id, persistenceId: suggestion.id }
        }))
        result = { ...result, threats, vulnerabilities }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log error
      await this.logRun({
        context,
        requestType: 'risk_identification',
        usage,
        errorMessage,
        startedAt,
        inputScope,
        targetRecords: { riskId: null, assetName: assetInfo.assetName },
        provider: this.getProviderForPolicy(context),
        cached: false,
      })

      throw new AIServiceError(
        `AI リスク識別に失敗しました: ${errorMessage}`,
        'AI_PROVIDER_ERROR',
        error instanceof Error ? error : undefined
      )
    }

    if (!saveSuggestion) {
      await this.logRun({
        context,
        requestType: 'risk_identification',
        usage,
        errorMessage,
        startedAt,
        inputScope,
        targetRecords: { riskId: null, assetName: assetInfo.assetName },
        provider: this.getProviderForPolicy(context),
        cached: false,
      })
    }

    return result
  }

  /**
   * Estimate risk levels for a risk
   */
  async estimateRiskLevels(
    riskInfo: RiskContext,
    context: ServiceContext
  ): Promise<RiskLevelEstimate & SuggestionPersistence> {
    const useCache = context.useCache ?? true
    const saveSuggestion = context.saveSuggestion ?? true
    const startedAt = new Date().toISOString()
    const inputScope = buildScopeSnapshot('evaluate', { allowExternalApi: context.allowExternalApi ?? false })

    // Check cache first
    const cacheKey = this.buildCacheKey('risklevel', context.organizationId, riskInfo.riskName, riskInfo.riskCategory)
    if (useCache && !saveSuggestion) {
      const cached = this.cacheManager.get<RiskLevelEstimate>(cacheKey)
      if (cached) {
        await this.logRun({
          context,
          requestType: 'risk_assessment',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          errorMessage: null,
          startedAt,
          inputScope,
          targetRecords: { riskName: riskInfo.riskName },
          provider: this.getProviderForPolicy(context),
          cached: true,
        })
        return cached
      }
    }

    // Build prompt
    const prompt = buildRiskAssessmentPrompt(riskInfo, context.locale)

    // Anonymize PII
    const { anonymizedText } = this.privacyFilter.anonymize(prompt)

    // Call AI provider
    let result: RiskLevelEstimate & SuggestionPersistence
    let errorMessage: string | null = null
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

    try {
      const request: AICompletionRequest = {
        prompt: anonymizedText,
        context: {
          organizationId: context.organizationId,
          locale: context.locale,
          domain: 'risk_assessment'
        }
      }

      const provider = this.getProviderForPolicy(context)
      const response = await provider.complete(request)
      usage = response.usage

      // Parse response
      result = this.parseRiskLevelResponse(response.content)

      // Cache result
      if (useCache) {
        this.cacheManager.set(cacheKey, result)
      }

      // Save suggestion
      if (saveSuggestion) {
        const usageLog = await this.logRun({
          context,
          requestType: 'risk_assessment',
          usage,
          errorMessage,
          startedAt,
          inputScope,
          targetRecords: { riskName: riskInfo.riskName },
          provider,
          cached: false,
        })
        const suggestion = await this.suggestionRepository.create({
          organizationId: context.organizationId,
          suggestionType: 'impact' as SuggestionType,
          inputContext: this.sanitizeRecord(riskInfo as unknown as Record<string, unknown>),
          inputScope,
          suggestionContent: this.sanitizeRecord(result as unknown as Record<string, unknown>),
          usageLogId: usageLog.id,
        })
        result = { ...result, suggestionId: suggestion.id }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log error
      await this.logRun({
        context,
        requestType: 'risk_assessment',
        usage,
        errorMessage,
        startedAt,
        inputScope,
        targetRecords: { riskName: riskInfo.riskName },
        provider: this.getProviderForPolicy(context),
        cached: false,
      })

      throw new AIServiceError(
        `AI リスク評価に失敗しました: ${errorMessage}`,
        'AI_PROVIDER_ERROR',
        error instanceof Error ? error : undefined
      )
    }

    if (!saveSuggestion) {
      await this.logRun({
        context,
        requestType: 'risk_assessment',
        usage,
        errorMessage,
        startedAt,
        inputScope,
        targetRecords: { riskName: riskInfo.riskName },
        provider: this.getProviderForPolicy(context),
        cached: false,
      })
    }

    return result
  }

  /**
   * Suggest treatments for a risk
   */
  async suggestTreatments(
    riskInfo: RiskContext,
    context: ServiceContext
  ): Promise<TreatmentSuggestion & SuggestionPersistence> {
    const useCache = context.useCache ?? true
    const saveSuggestion = context.saveSuggestion ?? true
    const startedAt = new Date().toISOString()
    const inputScope = buildScopeSnapshot('suggest_treatments', { allowExternalApi: context.allowExternalApi ?? false })

    // Check cache first
    const cacheKey = this.buildCacheKey('treatment', context.organizationId, riskInfo.riskName, riskInfo.riskCategory)
    if (useCache && !saveSuggestion) {
      const cached = this.cacheManager.get<TreatmentSuggestion>(cacheKey)
      if (cached) {
        await this.logRun({
          context,
          requestType: 'treatment_suggestion',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          errorMessage: null,
          startedAt,
          inputScope,
          targetRecords: { riskName: riskInfo.riskName },
          provider: this.getProviderForPolicy(context),
          cached: true,
        })
        return cached
      }
    }

    // Build prompt
    const prompt = buildTreatmentSuggestionPrompt(riskInfo, context.locale)

    // Anonymize PII
    const { anonymizedText } = this.privacyFilter.anonymize(prompt)

    // Call AI provider
    let result: TreatmentSuggestion & SuggestionPersistence
    let errorMessage: string | null = null
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

    try {
      const request: AICompletionRequest = {
        prompt: anonymizedText,
        context: {
          organizationId: context.organizationId,
          locale: context.locale,
          domain: 'treatment_suggestion'
        }
      }

      const provider = this.getProviderForPolicy(context)
      const response = await provider.complete(request)
      usage = response.usage

      // Parse response
      result = this.parseTreatmentResponse(response.content)

      // Cache result
      if (useCache) {
        this.cacheManager.set(cacheKey, result)
      }

      // Save suggestion
      if (saveSuggestion) {
        const usageLog = await this.logRun({
          context,
          requestType: 'treatment_suggestion',
          usage,
          errorMessage,
          startedAt,
          inputScope,
          targetRecords: { riskName: riskInfo.riskName },
          provider,
          cached: false,
        })
        const treatments = await Promise.all(result.treatments.map(async (treatment, index) => {
          const suggestion = await this.suggestionRepository.create({
            organizationId: context.organizationId,
            suggestionType: 'treatment' as SuggestionType,
            inputContext: this.sanitizeRecord({ ...riskInfo, itemIndex: index } as Record<string, unknown>),
            inputScope,
            suggestionContent: this.sanitizeRecord(treatment as unknown as Record<string, unknown>),
            usageLogId: usageLog.id,
          })
          return { ...treatment, id: suggestion.id, persistenceId: suggestion.id }
        }))
        result = { ...result, treatments }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log error
      await this.logRun({
        context,
        requestType: 'treatment_suggestion',
        usage,
        errorMessage,
        startedAt,
        inputScope,
        targetRecords: { riskName: riskInfo.riskName },
        provider: this.getProviderForPolicy(context),
        cached: false,
      })

      throw new AIServiceError(
        `AI 対策提案に失敗しました: ${errorMessage}`,
        'AI_PROVIDER_ERROR',
        error instanceof Error ? error : undefined
      )
    }

    if (!saveSuggestion) {
      await this.logRun({
        context,
        requestType: 'treatment_suggestion',
        usage,
        errorMessage,
        startedAt,
        inputScope,
        targetRecords: { riskName: riskInfo.riskName },
        provider: this.getProviderForPolicy(context),
        cached: false,
      })
    }

    return result
  }

  /**
   * Build cache key for different operation types
   */
  private buildCacheKey(type: string, orgId: string, ...parts: string[]): string {
    return `${type}:${orgId}:${parts.join(':')}`
  }

  private async logRun(input: {
    context: ServiceContext
    requestType: RequestType
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
    errorMessage: string | null
    startedAt: string
    inputScope: Record<string, unknown>
    targetRecords: Record<string, unknown>
    provider: IAIProvider
    cached: boolean
  }) {
    return this.usageLogRepository.create({
      organizationId: input.context.organizationId,
      userId: input.context.userId,
      requestType: input.requestType,
      promptTokens: input.usage.promptTokens,
      completionTokens: input.usage.completionTokens,
      totalTokens: input.usage.totalTokens,
      provider: input.provider.getProviderName(),
      providerMode: input.context.allowExternalApi ? 'external' : 'mock',
      modelLabel: input.provider.getProviderName(),
      status: input.errorMessage ? 'failed' : 'succeeded',
      inputScope: input.inputScope,
      targetRecords: input.targetRecords,
      redactionSummary: {
        promptTextStored: false,
        personalDataExcludedByDefault: true,
        attachmentBodyExcludedByDefault: true,
      },
      cached: input.cached,
      errorMessage: input.errorMessage,
      startedAt: input.startedAt,
      completedAt: new Date().toISOString(),
    })
  }

  private getProviderForPolicy(context: ServiceContext): IAIProvider {
    return context.allowExternalApi ? this.aiProvider : new MockProvider()
  }

  private sanitizeRecord(value: Record<string, unknown>, maxLength = 4000): Record<string, unknown> {
    const mask = (input: unknown): unknown => {
      if (typeof input === 'string') {
        return input
          .slice(0, maxLength)
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
          .replace(/(sk-|xox[baprs]-|gh[pousr]_|AIza)[A-Za-z0-9_\-]{12,}/g, '[redacted-secret]')
      }
      if (Array.isArray(input)) return input.slice(0, 50).map(mask)
      if (input && typeof input === 'object') {
        return Object.fromEntries(
          Object.entries(input as Record<string, unknown>)
            .slice(0, 80)
            .map(([key, item]) => [key, mask(item)])
        )
      }
      return input
    }
    return mask(value) as Record<string, unknown>
  }

  /**
   * Parse threat/vulnerability response from AI
   */
  private parseThreatVulnerabilityResponse(content: string): ThreatVulnerabilitySuggestion {
    try {
      // Extract JSON from markdown code block if present
      const jsonContent = this.extractJsonFromContent(content)
      const parsed = JSON.parse(jsonContent)

      return {
        threats: Array.isArray(parsed.threats) ? parsed.threats : [],
        vulnerabilities: Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : []
      }
    } catch (error) {
      throw new AIServiceError(
        'AI レスポンスのパースに失敗しました',
        'PARSE_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Parse risk level response from AI
   */
  private parseRiskLevelResponse(content: string): RiskLevelEstimate {
    try {
      // Extract JSON from markdown code block if present
      const jsonContent = this.extractJsonFromContent(content)
      const parsed: RiskAssessmentAIResponse = JSON.parse(jsonContent)

      return {
        impact: parsed.assessment.impact.score,
        likelihood: parsed.assessment.likelihood.score,
        rationale: parsed.assessment.overallJustification
      }
    } catch (error) {
      throw new AIServiceError(
        'AI レスポンスのパースに失敗しました',
        'PARSE_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Parse treatment response from AI
   */
  private parseTreatmentResponse(content: string): TreatmentSuggestion {
    try {
      // Extract JSON from markdown code block if present
      const jsonContent = this.extractJsonFromContent(content)
      const parsed: TreatmentAIResponse = JSON.parse(jsonContent)

      return {
        treatments: parsed.treatments.map((t) => ({
          type: t.type,
          description: t.description,
          controlIds: t.annexAReference ? [t.annexAReference] : undefined
        }))
      }
    } catch (error) {
      throw new AIServiceError(
        'AI レスポンスのパースに失敗しました',
        'PARSE_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Extract JSON from content that may contain markdown code blocks
   */
  private extractJsonFromContent(content: string): string {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return jsonMatch[1].trim()
    }

    // If no code block, assume the entire content is JSON
    return content.trim()
  }
}
