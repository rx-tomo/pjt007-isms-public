import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@libsql/client'
import { applyDatabaseInvariants } from './database-invariant-application.mjs'

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const schemaDirectory = path.join(repoRoot, 'lib/db/drizzle/schema')
const manifestPath = path.join(repoRoot, 'docs/02-project/database-source-manifest.json')
const sidecarSuffixes = ['', '-wal', '-shm', '-journal']
const outputLimit = 64 * 1024
const childTimeoutMs = 120_000

class ProvisioningFailure extends Error {
  constructor(code, exitCode, internalReason = code) {
    super(code)
    this.code = code
    this.exitCode = exitCode
    this.internalReason = internalReason
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeSql(sql) {
  const normalized = String(sql).replace(/\s+/g, ' ').trim()
  return normalized.endsWith(';') ? normalized : `${normalized};`
}

async function pathExists(filePath) {
  try {
    await lstat(filePath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function assertTargetAbsent(targetPath) {
  for (const suffix of sidecarSuffixes) {
    if (await pathExists(`${targetPath}${suffix}`)) {
      throw new ProvisioningFailure('DBP_TARGET_EXISTS', 66)
    }
  }
}

async function assertPublishTargetAbsent(targetPath) {
  try {
    await assertTargetAbsent(targetPath)
  } catch (error) {
    if (error instanceof ProvisioningFailure && error.code === 'DBP_TARGET_EXISTS') {
      throw new ProvisioningFailure('DBP_PUBLISH_CONFLICT', 74)
    }
    throw error
  }
}

function parseArguments(argv) {
  if (argv.length !== 4 || argv[0] !== '--root' || argv[2] !== '--name') {
    throw new ProvisioningFailure('DBP_INVALID_ARGUMENT', 64)
  }
  const [root, name] = [argv[1], argv[3]]
  if (!root || !path.isAbsolute(root) || root.includes('\0')) {
    throw new ProvisioningFailure('DBP_INVALID_ARGUMENT', 64)
  }
  if (path.normalize(root) !== root) {
    throw new ProvisioningFailure('DBP_INVALID_ARGUMENT', 64)
  }
  if (!name
    || name.includes('\0')
    || name.includes('/')
    || name.includes('\\')
    || name === '.'
    || name === '..'
    || name === '.db'
    || !name.endsWith('.db')) {
    throw new ProvisioningFailure('DBP_INVALID_ARGUMENT', 64)
  }
  return { root, name }
}

async function validateRoot(root) {
  try {
    const [resolvedRoot, rootStat] = await Promise.all([realpath(root), lstat(root)])
    if (resolvedRoot !== root || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new ProvisioningFailure('DBP_UNSAFE_ROOT', 65)
    }
  } catch (error) {
    if (error instanceof ProvisioningFailure) throw error
    throw new ProvisioningFailure('DBP_UNSAFE_ROOT', 65)
  }
}

export async function createDrizzleInvocation(stageDatabasePath, stageDirectory) {
  const [nodePath, drizzlePath] = await Promise.all([
    realpath(process.execPath),
    realpath(path.join(repoRoot, 'node_modules/drizzle-kit/bin.cjs')),
  ])
  return {
    executable: nodePath,
    args: [
      drizzlePath,
      'push',
      '--dialect',
      'sqlite',
      '--schema',
      schemaDirectory,
      '--url',
      pathToFileURL(stageDatabasePath).href,
      '--force',
    ],
    options: {
      cwd: stageDirectory,
      env: {},
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  }
}

async function runDrizzlePush(stageDatabasePath, stageDirectory) {
  const invocation = await createDrizzleInvocation(stageDatabasePath, stageDirectory)

  await new Promise((resolve, reject) => {
    const child = spawn(invocation.executable, invocation.args, invocation.options)
    let outputBytes = 0
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) child.kill('SIGKILL')
    }, childTimeoutMs)

    const consume = chunk => {
      outputBytes += chunk.length
      if (outputBytes > outputLimit && !settled) child.kill('SIGKILL')
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', consume)
    child.once('error', () => {
      settled = true
      clearTimeout(timer)
      reject(new ProvisioningFailure('DBP_SCHEMA_FAILED', 70))
    })
    child.once('close', code => {
      settled = true
      clearTimeout(timer)
      if (code === 0 && outputBytes <= outputLimit) resolve()
      else reject(new ProvisioningFailure('DBP_SCHEMA_FAILED', 70))
    })
  })
}

export async function verifyDatabase(stageDatabasePath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const client = createClient({ url: pathToFileURL(stageDatabasePath).href })

  try {
    const integrity = await client.execute('PRAGMA integrity_check')
    if (String(integrity.rows[0]?.integrity_check ?? '') !== 'ok') {
      throw new ProvisioningFailure('DBP_VERIFY_FAILED', 72, 'integrity')
    }

    const tables = await client.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    const actualTableNames = tables.rows
      .map(row => String(row.name))
      .sort((left, right) => left.localeCompare(right))
    if (JSON.stringify(actualTableNames) !== JSON.stringify(manifest.schemaTableNames)) {
      throw new ProvisioningFailure('DBP_VERIFY_FAILED', 72, 'tables')
    }

    const triggers = await client.execute(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'trigger'
      ORDER BY name
    `)
    const actualTriggers = triggers.rows
      .map(row => ({
        name: String(row.name),
        sha256: sha256(normalizeSql(row.sql)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
    const expectedTriggers = manifest.invariantTriggers.map(trigger => ({
      name: trigger.name,
      sha256: trigger.sha256,
    }))
    if (JSON.stringify(actualTriggers) !== JSON.stringify(expectedTriggers)) {
      throw new ProvisioningFailure('DBP_VERIFY_FAILED', 72, 'triggers')
    }

    await client.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    await client.execute('PRAGMA journal_mode=DELETE')
  } finally {
    client.close()
  }
}

async function fsyncPath(filePath) {
  const handle = await open(filePath, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function assertStageSidecarsAbsent(stageDatabasePath) {
  for (const suffix of sidecarSuffixes.slice(1)) {
    if (await pathExists(`${stageDatabasePath}${suffix}`)) {
      throw new ProvisioningFailure('DBP_VERIFY_FAILED', 72, 'sidecars')
    }
  }
}

const defaultDependencies = {
  applyInvariants: applyDatabaseInvariants,
  cleanupStage: stageDirectory => rm(stageDirectory, { recursive: true }),
  runSchema: runDrizzlePush,
  verify: verifyDatabase,
}

export async function provisionLocalDatabase(argv, dependencyOverrides = {}) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides }
  const { root, name } = parseArguments(argv)
  await validateRoot(root)
  const targetPath = path.join(root, name)
  await assertTargetAbsent(targetPath)

  let stageDirectory
  let published = false
  try {
    stageDirectory = await mkdtemp(path.join(root, '.pjt007-db-stage-'))
    await chmod(stageDirectory, 0o700)
    const stageDatabasePath = path.join(stageDirectory, 'database.db')

    try {
      await dependencies.runSchema(stageDatabasePath, stageDirectory)
    } catch (error) {
      if (error instanceof ProvisioningFailure) throw error
      throw new ProvisioningFailure('DBP_SCHEMA_FAILED', 70)
    }

    try {
      await dependencies.applyInvariants(pathToFileURL(stageDatabasePath).href)
    } catch {
      throw new ProvisioningFailure('DBP_INVARIANT_FAILED', 71)
    }

    try {
      await dependencies.verify(stageDatabasePath)
    } catch (error) {
      if (error instanceof ProvisioningFailure) throw error
      throw new ProvisioningFailure('DBP_VERIFY_FAILED', 72)
    }
    await assertStageSidecarsAbsent(stageDatabasePath)
    await chmod(stageDatabasePath, 0o600)
    await fsyncPath(stageDatabasePath)
    await assertPublishTargetAbsent(targetPath)

    try {
      await link(stageDatabasePath, targetPath)
      published = true
    } catch (error) {
      if (error?.code === 'EEXIST') {
        throw new ProvisioningFailure('DBP_PUBLISH_CONFLICT', 74)
      }
      throw new ProvisioningFailure('DBP_PREPUBLISH_FAILED', 80)
    }

    await fsyncPath(root)
    try {
      await dependencies.cleanupStage(stageDirectory)
      stageDirectory = undefined
      await fsyncPath(root)
    } catch {
      throw new ProvisioningFailure('DBP_PUBLISHED_CLEANUP_REQUIRED', 75)
    }

    return { status: 'ok', code: 'DBP_OK', exitCode: 0 }
  } catch (error) {
    if (published && !(error instanceof ProvisioningFailure
      && error.code === 'DBP_PUBLISHED_CLEANUP_REQUIRED')) {
      error = new ProvisioningFailure('DBP_PUBLISHED_CLEANUP_REQUIRED', 75)
    }
    if (!published && stageDirectory) {
      try {
        await rm(stageDirectory, { recursive: true })
        stageDirectory = undefined
      } catch {
        // Preserve the original fixed failure code. The target remains absent.
      }
    }
    if (error instanceof ProvisioningFailure) {
      const status = error.code === 'DBP_TARGET_EXISTS' || error.code.startsWith('DBP_INVALID')
        || error.code === 'DBP_UNSAFE_ROOT'
        ? 'rejected'
        : error.code === 'DBP_PUBLISHED_CLEANUP_REQUIRED'
          ? 'partial'
          : 'failed'
      return {
        status,
        code: error.code,
        exitCode: error.exitCode,
        internalReason: error.internalReason,
      }
    }
    return {
      status: 'failed',
      code: 'DBP_PREPUBLISH_FAILED',
      exitCode: 80,
      internalReason: 'unexpected',
    }
  }
}

function failureResult(error) {
  if (error instanceof ProvisioningFailure) {
    const status = error.code === 'DBP_TARGET_EXISTS' || error.code.startsWith('DBP_INVALID')
      || error.code === 'DBP_UNSAFE_ROOT'
      ? 'rejected'
      : error.code === 'DBP_PUBLISHED_CLEANUP_REQUIRED'
        ? 'partial'
        : 'failed'
    return {
      status,
      code: error.code,
      exitCode: error.exitCode,
      internalReason: error.internalReason,
    }
  }
  return {
    status: 'failed',
    code: 'DBP_PREPUBLISH_FAILED',
    exitCode: 80,
    internalReason: 'unexpected',
  }
}

export function publicResultLine(result) {
  return `${JSON.stringify({ status: result.status, code: result.code })}\n`
}

async function main() {
  let result
  try {
    result = await provisionLocalDatabase(process.argv.slice(2))
  } catch (error) {
    result = failureResult(error)
  }
  process.stdout.write(publicResultLine(result))
  process.exitCode = result.exitCode
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
