/**
 * AI Settings API Endpoint
 *
 * GET /api/ai/settings - Retrieve AI feature configuration for the organization
 * POST /api/ai/settings - Update AI feature configuration
 *
 * Authentication: Requires org_admin role.
 *
 * Format Conversion:
 * - Internal format (ConfigStore): allowedFeatures as array, thresholds 0-1
 * - UI format (response): features as booleans, thresholds 1-100
 *
 * @module app/api/ai/settings/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/auth/requireServiceRole'
import { getConfigStore, getAIProviderMode } from '@/lib/container'
import type { AIFeatureConfig, AIFeatureType } from '@/lib/ai/config/FeatureToggle'
import type {
  AISettingsPanelConfig,
  AIFeatureToggles
} from '@/lib/ai/interfaces/AIFeatureConfig'

export const runtime = 'nodejs'

// ============================================================
// Constants
// ============================================================

/**
 * Only org_admin can manage AI settings
 */
const ALLOWED_ROLES = ['org_admin']

/**
 * Default max requests per minute when saving config
 */
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 10

// ============================================================
// Types for POST request body
// ============================================================

interface SettingsPostBody {
  enabled: boolean
  features: AIFeatureToggles
  allowExternalApi?: boolean
  allowPersonalData?: boolean
  allowAttachmentBody?: boolean
  monthlyTokenLimit: number
  alertThresholds: number[]
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate the POST request body for settings update.
 *
 * Rules:
 * - enabled: must be boolean
 * - features: must have identify, evaluate, suggest_treatments as booleans
 * - monthlyTokenLimit: positive integer >= 1000
 * - alertThresholds: array of 1-5 numbers, each between 1-100
 */
function validateSettingsBody(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' }
  }

  const b = body as Record<string, unknown>

  // Validate enabled
  if (typeof b.enabled !== 'boolean') {
    return { valid: false, error: 'enabled must be a boolean' }
  }

  // Validate features
  if (!b.features || typeof b.features !== 'object' || Array.isArray(b.features)) {
    return { valid: false, error: 'features is required and must be an object' }
  }
  const features = b.features as Record<string, unknown>
  if (typeof features.identify !== 'boolean') {
    return { valid: false, error: 'features.identify must be a boolean' }
  }
  if (typeof features.evaluate !== 'boolean') {
    return { valid: false, error: 'features.evaluate must be a boolean' }
  }
  if (typeof features.suggest_treatments !== 'boolean') {
    return { valid: false, error: 'features.suggest_treatments must be a boolean' }
  }
  if (b.allowExternalApi != null && typeof b.allowExternalApi !== 'boolean') {
    return { valid: false, error: 'allowExternalApi must be a boolean' }
  }
  if (b.allowPersonalData != null && typeof b.allowPersonalData !== 'boolean') {
    return { valid: false, error: 'allowPersonalData must be a boolean' }
  }
  if (b.allowAttachmentBody != null && typeof b.allowAttachmentBody !== 'boolean') {
    return { valid: false, error: 'allowAttachmentBody must be a boolean' }
  }

  // Validate monthlyTokenLimit
  if (typeof b.monthlyTokenLimit !== 'number' || !Number.isInteger(b.monthlyTokenLimit)) {
    return { valid: false, error: 'monthlyTokenLimit must be a positive integer' }
  }
  if (b.monthlyTokenLimit < 1000) {
    return { valid: false, error: 'monthlyTokenLimit must be at least 1000' }
  }

  // Validate alertThresholds
  if (!Array.isArray(b.alertThresholds)) {
    return { valid: false, error: 'alertThresholds must be an array' }
  }
  if (b.alertThresholds.length < 1 || b.alertThresholds.length > 5) {
    return { valid: false, error: 'alertThresholds must have 1 to 5 elements' }
  }
  for (const threshold of b.alertThresholds) {
    if (typeof threshold !== 'number') {
      return { valid: false, error: 'alertThresholds values must be numbers' }
    }
    if (threshold < 1 || threshold > 100) {
      return { valid: false, error: 'alertThresholds values must be between 1 and 100' }
    }
  }

  return { valid: true }
}

// ============================================================
// Format Conversion
// ============================================================

/**
 * Convert internal ConfigStore format to UI format.
 *
 * - allowedFeatures array -> features booleans
 * - alertThresholds from 0-1 range to 1-100 range
 * - Add providerName from environment
 */
function toUIConfig(internal: AIFeatureConfig, providerName: string): AISettingsPanelConfig {
  return {
    enabled: internal.enabled,
    features: {
      identify: internal.allowedFeatures.includes('identify'),
      evaluate: internal.allowedFeatures.includes('evaluate'),
      suggest_treatments: internal.allowedFeatures.includes('suggest_treatments'),
    },
    monthlyTokenLimit: internal.monthlyTokenLimit,
    alertThresholds: internal.alertThresholds.map(t => Math.round(t * 100)),
    allowExternalApi: internal.allowExternalApi ?? false,
    allowPersonalData: internal.allowPersonalData ?? false,
    allowAttachmentBody: internal.allowAttachmentBody ?? false,
    providerName,
  }
}

/**
 * Convert UI format to internal ConfigStore format.
 *
 * - features booleans -> allowedFeatures array
 * - alertThresholds from 1-100 range to 0-1 range
 * - maxRequestsPerMinute defaults to 10
 */
function toInternalConfig(ui: SettingsPostBody): AIFeatureConfig {
  const allowedFeatures: AIFeatureType[] = []
  if (ui.features.identify) allowedFeatures.push('identify')
  if (ui.features.evaluate) allowedFeatures.push('evaluate')
  if (ui.features.suggest_treatments) allowedFeatures.push('suggest_treatments')

  return {
    enabled: ui.enabled,
    allowedFeatures,
    allowExternalApi: ui.allowExternalApi ?? false,
    allowPersonalData: ui.allowPersonalData ?? false,
    allowAttachmentBody: ui.allowAttachmentBody ?? false,
    monthlyTokenLimit: ui.monthlyTokenLimit,
    alertThresholds: ui.alertThresholds.map(t => t / 100),
    maxRequestsPerMinute: DEFAULT_MAX_REQUESTS_PER_MINUTE,
  }
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/ai/settings
 *
 * Retrieves the current AI feature configuration for the authenticated
 * user's organization. Returns the config in UI-friendly format.
 *
 * Response:
 * - 200: { ok: true, data: UIAIFeatureConfig }
 * - 401: { error: string } (unauthenticated)
 * - 403: { error: string } (insufficient role)
 * - 500: { error: string } (server error)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication with requireServiceRole
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ALLOWED_ROLES,
      actionName: 'ai.settings.read'
    })

    if (error) {
      return error
    }

    const { profile, json, logEvent } = guard
    const organizationId = profile.organization_id

    // 2. Get config from ConfigStore
    const store = await getConfigStore()
    const config = await store.get(organizationId)

    // 3. Get provider name from environment
    const providerName = getAIProviderMode()

    // 4. Convert to UI format
    const uiConfig = toUIConfig(config, providerName)

    // 5. Log access
    await logEvent('settings_read', { organizationId })

    // 6. Return
    return json({ ok: true, data: uiConfig })
  } catch (err) {
    console.error('[AI Settings GET] Error:', err)

    return NextResponse.json(
      { error: 'Failed to retrieve AI settings' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/ai/settings
 *
 * Updates the AI feature configuration for the authenticated user's organization.
 * Validates the request body and converts UI format to internal format for storage.
 *
 * Request Body:
 * - enabled: boolean
 * - features: { identify, evaluate, suggest_treatments } (all booleans)
 * - monthlyTokenLimit: positive integer >= 1000
 * - alertThresholds: array of 1-5 numbers (1-100)
 *
 * Response:
 * - 200: { ok: true, data: UIAIFeatureConfig }
 * - 400: { error: string } (validation error)
 * - 401: { error: string } (unauthenticated)
 * - 403: { error: string } (insufficient role)
 * - 500: { error: string } (server error)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication with requireServiceRole
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ALLOWED_ROLES,
      actionName: 'ai.settings.update'
    })

    if (error) {
      return error
    }

    const { profile, json, logEvent } = guard
    const organizationId = profile.organization_id

    // 2. Parse request body
    let requestBody: unknown
    try {
      requestBody = await request.json()
    } catch {
      return json({ error: 'Request body is required' }, { status: 400 })
    }

    // 3. Validate
    const validation = validateSettingsBody(requestBody)
    if (!validation.valid) {
      return json({ error: validation.error }, { status: 400 })
    }

    const body = requestBody as SettingsPostBody

    // 4. Convert to internal format
    const internalConfig = toInternalConfig(body)

    // 5. Save to ConfigStore
    const store = await getConfigStore()
    await store.set(organizationId, internalConfig)

    // 6. Get provider name from environment
    const providerName = getAIProviderMode()

    // 7. Read back saved config and return in UI format
    const savedConfig = await store.get(organizationId)
    const uiConfig = toUIConfig(savedConfig, providerName)

    // 8. Log the update
    await logEvent('settings_updated', {
      organizationId,
      enabled: body.enabled,
      features: body.features,
      dataHandling: {
        allowExternalApi: body.allowExternalApi ?? false,
        allowPersonalData: body.allowPersonalData ?? false,
        allowAttachmentBody: body.allowAttachmentBody ?? false,
      },
      monthlyTokenLimit: body.monthlyTokenLimit,
    })

    return json({ ok: true, data: uiConfig })
  } catch (err) {
    console.error('[AI Settings POST] Error:', err)

    return NextResponse.json(
      { error: 'Failed to update AI settings' },
      { status: 500 }
    )
  }
}
