import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/auth/requireServiceRole'
import { getAISuggestionRepository } from '@/lib/container'

export const runtime = 'nodejs'

const ALLOWED_ROLES = ['org_admin', 'system_operator', 'auditor']
const DECISIONS = ['accepted', 'accepted_with_edits', 'rejected'] as const
const MAX_DECISION_TEXT_LENGTH = 4000

type Decision = (typeof DECISIONS)[number]

interface DecisionBody {
  decision: Decision
  finalContent?: Record<string, unknown> | null
  reason?: string | null
}

function maskSensitiveText(value: string) {
  return value
    .slice(0, MAX_DECISION_TEXT_LENGTH)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(sk-|xox[baprs]-|gh[pousr]_|AIza)[A-Za-z0-9_\-]{12,}/g, '[redacted-secret]')
}

function sanitizeContent(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  const sanitize = (input: unknown): unknown => {
    if (typeof input === 'string') return maskSensitiveText(input)
    if (Array.isArray(input)) return input.slice(0, 50).map(sanitize)
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .slice(0, 80)
          .map(([key, item]) => [key, sanitize(item)])
      )
    }
    return input
  }
  return sanitize(value) as Record<string, unknown>
}

function validateBody(body: unknown): { ok: true; data: DecisionBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body is required' }
  const value = body as Record<string, unknown>
  if (!DECISIONS.includes(value.decision as Decision)) {
    return { ok: false, error: `decision must be one of ${DECISIONS.join(', ')}` }
  }
  if (value.finalContent != null && (typeof value.finalContent !== 'object' || Array.isArray(value.finalContent))) {
    return { ok: false, error: 'finalContent must be an object when provided' }
  }
  if (value.reason != null && typeof value.reason !== 'string') {
    return { ok: false, error: 'reason must be a string when provided' }
  }
  return { ok: true, data: value as unknown as DecisionBody }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ALLOWED_ROLES,
      actionName: 'ai.suggestions.decide',
    })

    if (error) return error

    const { profile, userId, json, logEvent } = guard
    const body = await request.json().catch(() => null)
    const validation = validateBody(body)
    if (!validation.ok) return json({ error: validation.error }, { status: 400 })

    const repository = await getAISuggestionRepository()
    const existing = await repository.findById(id)
    if (!existing || existing.organizationId !== profile.organization_id) {
      return json({ error: 'AI suggestion not found' }, { status: 404 })
    }

    const suggestion = await repository.decide({
      id,
      userId,
      status: validation.data.decision,
      finalContent: sanitizeContent(validation.data.finalContent),
      reason: validation.data.reason ? maskSensitiveText(validation.data.reason) : null,
    })

    await logEvent(`ai_assist.suggestion.${validation.data.decision}`, {
      suggestionId: id,
      usageLogId: suggestion.usageLogId,
      riskId: suggestion.riskId,
      inputScope: suggestion.inputScope,
      promptTextStored: false,
      humanReviewed: true,
    })

    return json({ ok: true, data: suggestion })
  } catch (error) {
    console.error('[AI Suggestion Decision API] Error:', error)
    return NextResponse.json({ error: 'Failed to update AI suggestion decision' }, { status: 500 })
  }
}
