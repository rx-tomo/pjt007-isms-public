import 'server-only'

import { sql } from 'drizzle-orm'
import { isPublicDemoDatabaseBindingValid, publicDemoOrigin } from '@/lib/demo/contract'
import { getDb } from '@/lib/db/drizzle/client'

export class PublicDemoRuntimeUnavailableError extends Error {
  constructor(readonly reason: 'configuration' | 'resetting' | 'rate-limit') {
    super(`Public demo runtime unavailable: ${reason}`)
    this.name = 'PublicDemoRuntimeUnavailableError'
  }
}

type RuntimeRow = { status: string; generation: number }

function expectedDatabaseId(): string {
  const value = process.env.PUBLIC_DEMO_EXPECTED_DATABASE_ID
  if (!value) throw new PublicDemoRuntimeUnavailableError('configuration')
  return value
}

export async function assertPublicDemoRuntimeReady(): Promise<number | null> {
  if (!publicDemoOrigin()) return null
  if (!isPublicDemoDatabaseBindingValid()) {
    throw new PublicDemoRuntimeUnavailableError('configuration')
  }
  try {
    const rows = await getDb().all<RuntimeRow>(sql`
      select status, generation
      from demo_fixture_state
      where id = 'public-demo' and database_id = ${expectedDatabaseId()}
      limit 1
    `)
    const row = rows[0]
    if (!row) throw new PublicDemoRuntimeUnavailableError('configuration')
    if (row.status !== 'idle') throw new PublicDemoRuntimeUnavailableError('resetting')
    return Number(row.generation)
  } catch (error) {
    if (error instanceof PublicDemoRuntimeUnavailableError) throw error
    throw new PublicDemoRuntimeUnavailableError('configuration')
  }
}

export async function consumePublicDemoLoginPermit(): Promise<void> {
  if (!publicDemoOrigin()) return
  if (!isPublicDemoDatabaseBindingValid()) {
    throw new PublicDemoRuntimeUnavailableError('configuration')
  }
  try {
    const rows = await getDb().all<{ generation: number }>(sql`
      update demo_fixture_state
      set
        login_attempt_count = case
          when login_window_started_at is null
            or login_window_started_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')
          then 1
          else login_attempt_count + 1
        end,
        login_window_started_at = case
          when login_window_started_at is null
            or login_window_started_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')
          then strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          else login_window_started_at
        end
      where id = 'public-demo'
        and database_id = ${expectedDatabaseId()}
        and status = 'idle'
        and (
          login_window_started_at is null
          or login_window_started_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')
          or login_attempt_count < 30
        )
      returning generation
    `)
    if (rows.length !== 1) throw new PublicDemoRuntimeUnavailableError('rate-limit')
  } catch (error) {
    if (error instanceof PublicDemoRuntimeUnavailableError) throw error
    throw new PublicDemoRuntimeUnavailableError('configuration')
  }
}
