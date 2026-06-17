import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { auditUnits } from '@/lib/db/drizzle/schema/audit'
import { risks } from '@/lib/db/drizzle/schema/risks'
import { tasks } from '@/lib/db/drizzle/schema/tasks'
import { informationAssets } from '@/lib/db/drizzle/schema/risks'
import { eq, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    organizationId,
    actionName: 'setup.counts',
    logContext: { organizationId }
  })
  if (error || !guard) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const db = getDb()

    const [auRes, riskRes, taskRes, assetRes] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(auditUnits).where(eq(auditUnits.organizationId, organizationId)),
      db.select({ count: sql<number>`count(*)` }).from(risks).where(eq(risks.organizationId, organizationId)),
      db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.organizationId, organizationId)),
      db.select({ count: sql<number>`count(*)` }).from(informationAssets).where(eq(informationAssets.organizationId, organizationId)),
    ])

    return guard.json({
      auditUnits: auRes[0]?.count ?? 0,
      risks: riskRes[0]?.count ?? 0,
      tasks: taskRes[0]?.count ?? 0,
      assets: assetRes[0]?.count ?? 0,
    })
  } catch (err) {
    console.error('[Setup/Counts] GET failed', err)
    return guard.json({ error: 'Failed to load counts' }, { status: 500 })
  }
}
