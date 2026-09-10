import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const execFileAsync = promisify(execFile)

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

function childStdout(error: unknown) {
  if (!error || typeof error !== 'object' || !('stdout' in error)) return ''
  return typeof error.stdout === 'string' ? error.stdout : ''
}

function assertDemoDatabaseTarget() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? ''
  const expectedDbUrl = process.env.PUBLIC_DEMO_EXPECTED_DATABASE_URL ?? ''

  if (process.env.DEMO_RESET_ENABLED !== 'true') {
    return false
  }

  return Boolean(dbUrl.startsWith('libsql://') && expectedDbUrl && dbUrl === expectedDbUrl)
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonError('Unauthorized', 401)
  }

  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV !== 'production') {
    return jsonError('Not available', 404)
  }

  if (!assertDemoDatabaseTarget()) {
    return jsonError('Reset target is not configured', 409)
  }

  const seedScript = path.join(process.cwd(), 'scripts', 'seed-practical-verification.mjs')

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [seedScript, '--reset', '--scenario', 'all', '--public-demo-remote-reset'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PUBLIC_DEMO_REMOTE_RESET: 'true',
          SEED_LIBSQL_CLIENT: 'web',
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 290_000,
      }
    )
    const payload = parseSeedOutput(stdout)
    if (!payload || payload.ok !== true || typeof payload.resetAt !== 'string' || typeof payload.generation !== 'number' || !payload.fixtureCounts || typeof payload.fixtureCounts !== 'object') {
      throw new Error('Invalid reset receipt')
    }

    return NextResponse.json({
      ok: true,
      resetAt: payload.resetAt,
      generation: payload.generation,
      fixtureVersion: typeof payload.fixtureVersion === 'string' ? payload.fixtureVersion : undefined,
      fixtureCounts: payload.fixtureCounts,
    })
  } catch (error) {
    try {
      const payload = parseSeedOutput(childStdout(error))
      if (payload?.conflict === true && payload?.code === 'PUBLIC_DEMO_RESET_CONFLICT') {
        return jsonError('Reset already in progress', 409)
      }
    } catch {
      // Ignore untrusted child output and return the generic failure below.
    }
    console.error('[reset-demo] Failed to reset demo database')
    return jsonError('Demo reset failed', 500)
  }
}
