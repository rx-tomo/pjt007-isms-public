import { createHash, randomInt } from 'crypto'
import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'

export type MfaAuditAction =
  | 'auth.mfa.sent'
  | 'auth.mfa.verified'
  | 'auth.mfa.verify_failed'
  | 'auth.mfa.bypass'

export interface LogMfaEventOptions {
  organizationId: string
  userId: string
  action: MfaAuditAction
  changes?: Record<string, unknown>
  request?: NextRequest
}

export async function logMfaEvent({
  organizationId,
  userId,
  action,
  changes,
  request,
}: LogMfaEventOptions) {
  const db = getDb()
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      action,
      resourceType: 'auth_mfa',
      resourceId: userId,
      changes: JSON.stringify({
        ...changes,
        ip_address: request?.headers.get('x-forwarded-for') ?? null,
        user_agent: request?.headers.get('user-agent') ?? null,
      }),
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[MFA] audit log error', error)
  }
}

export function hashMfaCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export function generateMfaCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}
