/**
 * AI Risk Analysis API Endpoint
 *
 * POST /api/ai/risks/analyze
 *
 * Performs AI-powered risk analysis including:
 * - Risk/threat identification from assets
 * - Risk level evaluation (impact/likelihood)
 * - Treatment suggestions with Annex A references
 *
 * @module app/api/ai/risks/analyze/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/auth/requireServiceRole'
import { getAIRiskAssessmentService, getAIUsageLogRepository, getConfigStore } from '@/lib/container'
import { buildScopeSnapshot } from '@/lib/ai/operations/inputScope'
import type { AssetContext } from '@/lib/ai/prompts/riskIdentification'
import type { RiskContext } from '@/lib/ai/prompts/riskAssessment'

export const runtime = 'nodejs'

/**
 * Request body types
 */
interface AssetContextInput {
  assetName: string
  assetType: string
  description?: string
  department?: string
}

interface RiskContextInput {
  riskName: string
  riskCategory: string
  description?: string
  assetName?: string
  currentImpact?: number
  currentLikelihood?: number
  existingControls?: string[]
}

interface AnalyzeRequestBody {
  type: 'identify' | 'evaluate' | 'suggest_treatments'
  context: AssetContextInput | RiskContextInput
  riskId?: string
  options?: {
    useCache?: boolean
    saveSuggestion?: boolean
  }
}

/**
 * Valid analysis types
 */
const VALID_TYPES = ['identify', 'evaluate', 'suggest_treatments'] as const
type AnalysisType = (typeof VALID_TYPES)[number]

/**
 * Allowed roles for AI risk analysis
 */
const ALLOWED_ROLES = ['org_admin', 'system_operator', 'auditor']

/**
 * Validate request body structure
 */
function validateRequestBody(
  body: unknown
): { valid: true; data: AnalyzeRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' }
  }

  const data = body as Record<string, unknown>

  // Validate type field
  if (!data.type) {
    return { valid: false, error: 'type is required' }
  }

  if (!VALID_TYPES.includes(data.type as AnalysisType)) {
    return {
      valid: false,
      error: `Invalid type: must be one of ${VALID_TYPES.join(', ')}`
    }
  }

  // Validate context field
  if (!data.context || typeof data.context !== 'object') {
    return { valid: false, error: 'context is required' }
  }

  const context = data.context as Record<string, unknown>
  const type = data.type as AnalysisType

  // Validate context based on type
  if (type === 'identify') {
    if (!context.assetName || typeof context.assetName !== 'string') {
      return { valid: false, error: 'context.assetName is required for identify type' }
    }
    if (!context.assetType || typeof context.assetType !== 'string') {
      return { valid: false, error: 'context.assetType is required for identify type' }
    }
  } else {
    // evaluate or suggest_treatments
    if (!context.riskName || typeof context.riskName !== 'string') {
      return { valid: false, error: `context.riskName is required for ${type} type` }
    }
    if (!context.riskCategory || typeof context.riskCategory !== 'string') {
      return { valid: false, error: `context.riskCategory is required for ${type} type` }
    }
  }

  return { valid: true, data: body as AnalyzeRequestBody }
}

/**
 * POST /api/ai/risks/analyze
 *
 * Performs AI analysis on risk/asset context.
 *
 * Request body:
 * ```typescript
 * {
 *   type: 'identify' | 'evaluate' | 'suggest_treatments'
 *   context: AssetContext | RiskContext
 *   riskId?: string  // for existing risks
 *   options?: {
 *     useCache?: boolean
 *     saveSuggestion?: boolean
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication with requireServiceRole
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ALLOWED_ROLES,
      actionName: 'ai.risks.analyze'
    })

    if (error) {
      return error
    }

    const { profile, userId, json, logEvent } = guard

    // 2. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const validation = validateRequestBody(body)
    if (!validation.valid) {
      return json({ error: validation.error }, { status: 400 })
    }

    const { type, context, options } = validation.data
    const feature = type === 'identify' ? 'identify' : type === 'evaluate' ? 'evaluate' : 'suggest_treatments'

    // 3. Get organization from profile
    const organizationId = profile.organization_id
    const locale = profile.language_preference || 'ja'
    const aiConfig = await (await getConfigStore()).get(organizationId)
    if (!aiConfig.enabled || !aiConfig.allowedFeatures.includes(feature)) {
      await logEvent('ai_assist.run.blocked', {
        type,
        feature,
        reason: 'feature_disabled',
        enabled: aiConfig.enabled,
        allowedFeatures: aiConfig.allowedFeatures,
      })
      return json({ error: 'AI feature is disabled' }, { status: 403 })
    }
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const usageStats = await (await getAIUsageLogRepository()).getStatistics(organizationId, monthStart, now)
    if (usageStats.totalTokens >= aiConfig.monthlyTokenLimit) {
      await logEvent('ai_assist.run.blocked', {
        type,
        feature,
        reason: 'monthly_token_limit_exceeded',
        totalTokens: usageStats.totalTokens,
        monthlyTokenLimit: aiConfig.monthlyTokenLimit,
      })
      return json({ error: 'AI monthly token limit exceeded' }, { status: 429 })
    }
    const allowExternalApi = aiConfig.allowExternalApi ?? false
    const inputScope = buildScopeSnapshot(feature, {
      allowExternalApi,
      allowPersonalData: aiConfig.allowPersonalData ?? false,
      allowAttachmentBody: aiConfig.allowAttachmentBody ?? false,
    })

    // 4. Build service context
    const serviceContext = {
      organizationId,
      userId,
      locale: locale as 'ja' | 'en',
      useCache: options?.useCache ?? true,
      saveSuggestion: options?.saveSuggestion ?? true,
      allowExternalApi,
    }

    // 5. Get AIRiskAssessmentService from container
    const aiService = await getAIRiskAssessmentService()

    // 6. Call appropriate service method based on type
    let result: unknown

    switch (type) {
      case 'identify': {
        const assetContext = context as AssetContext
        result = await aiService.suggestThreatsAndVulnerabilities(
          assetContext,
          serviceContext
        )
        break
      }

      case 'evaluate': {
        const riskContext = context as RiskContext
        result = await aiService.estimateRiskLevels(riskContext, serviceContext)
        break
      }

      case 'suggest_treatments': {
        const riskContext = context as RiskContext
        result = await aiService.suggestTreatments(riskContext, serviceContext)
        break
      }
    }

    // 7. Log usage
    await logEvent('ai_assist.run.created', {
      type,
      inputScope,
      providerMode: allowExternalApi ? 'external' : 'mock',
      humanReviewRequired: true,
    })

    // 8. Return response
    return json({ ok: true, data: result, inputScope, humanReviewRequired: true })
  } catch (err) {
    console.error('[AI Analysis] Error:', err)

    // Handle specific error types
    if (err instanceof Error && err.name === 'AIServiceError') {
      return NextResponse.json(
        { error: 'AI analysis failed', details: err.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    )
  }
}
