import { NextResponse } from 'next/server'
import type { Client } from '@libsql/client'
import { getDb } from '@/lib/db/drizzle/client'
import { getUser } from '@/lib/server/auth/getUser'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { isDemoSurfaceAvailable } from '@/lib/demo/contract'
import { isAllowedDemoRequest } from '@/lib/demo/csrf'
import { assertPublicDemoRuntimeReady } from '@/lib/server/demo/publicDemoRuntimeGate'
import { auditDemoOrganizationId, insertAuditCorrectiveDemo } from '@/scripts/audit-corrective-demo-fixture.mjs'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isDemoSurfaceAvailable()) return new Response(null, { status: 404 })
  if (!isAllowedDemoRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const authorization = await resolveTenantAuthorizationContext(db, user.id, auditDemoOrganizationId)
  if (!authorization.ok || authorization.context.role !== 'org_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const generation = await assertPublicDemoRuntimeReady()
    const transaction = await (db as typeof db & { $client: Client }).$client.transaction('write')
    try {
      if (generation !== null) {
        const marker = await transaction.execute("select database_id, status, generation from demo_fixture_state where id = 'public-demo'")
        const row = marker.rows[0]
        if (!row || row.database_id !== process.env.PUBLIC_DEMO_EXPECTED_DATABASE_ID ||
            !['idle', 'failed'].includes(String(row.status)) || Number(row.generation) !== generation) throw new Error('Demo is resetting')
      }
      const result = await insertAuditCorrectiveDemo(transaction)
      await transaction.commit()
      return NextResponse.json({ ok: true, ...result })
    } catch {
      await transaction.rollback()
      return NextResponse.json({ error: 'Scenario temporarily unavailable' }, { status: 409 })
    } finally {
      transaction.close()
    }
  } catch {
    return NextResponse.json({ error: 'Scenario temporarily unavailable' }, { status: 503 })
  }
}
