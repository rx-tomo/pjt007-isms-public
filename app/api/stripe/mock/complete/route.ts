import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { requireMockBillingAccess } from '@/lib/server/auth/mockBillingGuard'
import {
  completeMockBilling,
  MockBillingCompletionError,
  type MockBillingCompletionInput,
} from '@/lib/server/billing/mockBillingCompletion'

type MockCompletePayload = Partial<MockBillingCompletionInput>

export async function POST(request: NextRequest) {
  const db = getDb()

  let payload: MockCompletePayload
  try {
    payload = ((await request.json()) ?? {}) as MockCompletePayload
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const organizationId = payload.organizationId
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 })
  }

  const guard = await requireMockBillingAccess(request, organizationId)
  if (guard.error) {
    return guard.error
  }

  const planId = payload.planId
  if (!planId) {
    return NextResponse.json({ error: 'planId is required.' }, { status: 400 })
  }

  try {
    const result = await completeMockBilling(db, {
      ...payload,
      organizationId,
      planId,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof MockBillingCompletionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
