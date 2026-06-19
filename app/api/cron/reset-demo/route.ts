import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const execFileAsync = promisify(execFile)
const DEFAULT_DEMO_DB_NAME = 'pjt007-isms-public'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function parseSeedOutput(stdout: string) {
  const trimmed = stdout.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const jsonStart = trimmed.lastIndexOf('\n{')
    if (jsonStart >= 0) {
      return JSON.parse(trimmed.slice(jsonStart + 1))
    }
    throw new Error('Seed command did not return JSON output')
  }
}

function assertDemoDatabaseTarget() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? ''
  const expectedDbName = process.env.DEMO_RESET_DATABASE_NAME ?? DEFAULT_DEMO_DB_NAME

  if (process.env.DEMO_RESET_ENABLED !== 'true') {
    return 'DEMO_RESET_ENABLED is not true'
  }

  if (!dbUrl.startsWith('libsql://')) {
    return 'TURSO_DATABASE_URL must point to a remote libSQL/Turso database'
  }

  if (!dbUrl.includes(expectedDbName)) {
    return `TURSO_DATABASE_URL does not look like the demo database: ${expectedDbName}`
  }

  return null
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonError('Unauthorized', 401)
  }

  const targetError = assertDemoDatabaseTarget()
  if (targetError) {
    return jsonError(targetError, 409)
  }

  const seedScript = path.join(process.cwd(), 'scripts', 'seed-practical-verification.mjs')
  const outputDir = path.join('/tmp', 'pjt007-isms-public-seed')

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [seedScript, '--reset', '--scenario', 'all'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SEED_LIBSQL_CLIENT: 'web',
          SEED_OUTPUT_DIR: outputDir,
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 290_000,
      }
    )
    const payload = parseSeedOutput(stdout)

    return NextResponse.json({
      ok: true,
      resetAt: new Date().toISOString(),
      seed: payload,
      stderr: stderr.trim() || undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[reset-demo] Failed to reset demo database', error)
    return jsonError(message, 500)
  }
}
