import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, normalize, relative, sep } from 'node:path'

type Environment = Record<string, string | undefined>

const GUARDED_E2E_SPECS = new Set([
  'tests/e2e/initial-w02-risk-residual-rejection.spec.ts',
  'tests/e2e/rbac-ui-capability-projection.spec.ts',
  'tests/e2e/surveillance-residual-risk-acceptance.spec.ts',
  'tests/e2e/tenant-risk-department-boundary.spec.ts',
])
const GUARDED_E2E_BASENAMES = new Set([...GUARDED_E2E_SPECS].map((spec) => basename(spec)))
const RELATIVE_E2E_SPEC = /^tests\/e2e\/(?:[^/]+\/)*[^/]+\.spec\.ts$/
const SAFE_E2E_COMMAND_BASENAMES = new Set([
  'node',
  'nodejs',
  'playwright',
  'npm',
  'npx',
  'npm-cli.js',
  'npx-cli.js',
  'cli.js',
])

interface E2EIsolationOptions {
  environment?: Environment
  repositoryRoot?: string
  temporaryRoot?: string
}

export interface VerifiedE2EIsolationTargets {
  sqliteDbPath: string
  localStorageRoot: string
}

/**
 * Returns only argv structure that is safe to include in a CI guard failure log.
 * Selector values, absolute paths, and raw flags or flag values are intentionally omitted.
 */
export function sanitizeE2EIsolationGuardArgv(argv: readonly string[] = process.argv): string[] {
  return argv.flatMap((argument) => {
    if (argument.startsWith('-')) return ['[flag]']

    const withoutLocation = argument.replace(/:\d+(?::\d+)?$/, '')
    const normalizedArgument = normalize(withoutLocation)
    if (RELATIVE_E2E_SPEC.test(normalizedArgument)) return [normalizedArgument]

    const commandBasename = basename(argument)
    return SAFE_E2E_COMMAND_BASENAMES.has(commandBasename) ? [commandBasename] : []
  })
}

export function requiresE2EIsolationGuard(argv: readonly string[] = process.argv): boolean {
  const testCommandIndex = argv.indexOf('test')
  if (testCommandIndex === -1) return false

  const selectors = argv.slice(testCommandIndex + 1).filter((argument) => !argument.startsWith('-'))
  if (selectors.length === 0) return true

  return selectors.some((argument) => {
    const withoutLocation = argument.replace(/:\d+(?::\d+)?$/, '')
    const normalizedArgument = normalize(withoutLocation)
    if (GUARDED_E2E_BASENAMES.has(basename(normalizedArgument))) return true
    if (normalizedArgument === 'tests/e2e' || normalizedArgument.endsWith(`${sep}tests${sep}e2e`)) return true
    return !normalizedArgument.startsWith(`tests${sep}e2e${sep}`)
      || !normalizedArgument.endsWith('.spec.ts')
  })
}

export function assertFocusedE2EManagedServer(environment: Environment = process.env): void {
  for (const name of [
    'PLAYWRIGHT_EXTERNAL_WEB_SERVER',
    'PLAYWRIGHT_REUSE_WEB_SERVER',
    'PLAYWRIGHT_SKIP_WEB_SERVER',
  ]) {
    if (environment[name] === '1') {
      throw new Error(`focused E2E run requires a newly managed web server; ${name}=1 is not allowed`)
    }
  }
}

export function buildFocusedE2EWebServerEnvironment(
  targets: VerifiedE2EIsolationTargets
): Record<'SQLITE_DB_PATH' | 'LOCAL_STORAGE_ROOT' | 'TURSO_DATABASE_URL' | 'TURSO_AUTH_TOKEN' | 'DATABASE_URL', string> {
  return {
    SQLITE_DB_PATH: targets.sqliteDbPath,
    LOCAL_STORAGE_ROOT: targets.localStorageRoot,
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    DATABASE_URL: '',
  }
}

function isWithin(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate)
  return pathFromParent !== ''
    && pathFromParent !== '..'
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent)
}

function directTemporaryRoot(temporaryRoot: string, candidate: string): string | null {
  const relativePath = relative(temporaryRoot, candidate)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return null
  }
  return join(temporaryRoot, relativePath.split(sep)[0])
}

function assertRealDirectory(scope: string, path: string, label: string): string {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${scope} requires ${label} to be a pre-created real directory without symbolic links`)
  }
  return realpathSync(path)
}

function assertNoSymbolicLinkTraversal(
  scope: string,
  temporaryRoot: string,
  candidate: string,
  label: string
): void {
  const pathFromTemporaryRoot = relative(temporaryRoot, candidate)
  if (
    pathFromTemporaryRoot === ''
    || pathFromTemporaryRoot === '..'
    || pathFromTemporaryRoot.startsWith(`..${sep}`)
    || isAbsolute(pathFromTemporaryRoot)
  ) {
    throw new Error(`${scope} requires ${label} below the OS temporary directory without aliases`)
  }

  let current = temporaryRoot
  for (const component of pathFromTemporaryRoot.split(sep)) {
    current = join(current, component)
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`${scope} does not allow symbolic links or aliases in ${label}`)
    }
  }
}

export function assertE2EIsolationTargets(
  scope: string,
  options: E2EIsolationOptions = {}
): VerifiedE2EIsolationTargets {
  const environment = options.environment ?? process.env
  if (environment.TURSO_DATABASE_URL) {
    throw new Error(`${scope} does not allow TURSO_DATABASE_URL`)
  }

  const rawDbPath = environment.SQLITE_DB_PATH
  const rawStorageRoot = environment.LOCAL_STORAGE_ROOT
  if (!rawDbPath || !rawStorageRoot) {
    throw new Error(`${scope} requires explicit temporary SQLITE_DB_PATH and LOCAL_STORAGE_ROOT`)
  }
  if (!isAbsolute(rawDbPath) || !isAbsolute(rawStorageRoot)) {
    throw new Error(`${scope} requires absolute temporary SQLITE_DB_PATH and LOCAL_STORAGE_ROOT`)
  }
  if (/[%?#]/.test(rawDbPath) || /[%?#]/.test(rawStorageRoot)) {
    throw new Error(`${scope} does not allow URI-sensitive characters in SQLITE_DB_PATH or LOCAL_STORAGE_ROOT`)
  }
  if (rawDbPath !== normalize(rawDbPath) || rawStorageRoot !== normalize(rawStorageRoot)) {
    throw new Error(`${scope} does not allow non-canonical SQLITE_DB_PATH or LOCAL_STORAGE_ROOT`)
  }

  const repositoryRoot = realpathSync(options.repositoryRoot ?? process.cwd())
  const temporaryRoot = realpathSync(options.temporaryRoot ?? tmpdir())
  const dbPath = rawDbPath
  const storageRoot = rawStorageRoot
  assertNoSymbolicLinkTraversal(scope, temporaryRoot, dirname(dbPath), 'SQLITE_DB_PATH parent')
  assertNoSymbolicLinkTraversal(scope, temporaryRoot, storageRoot, 'LOCAL_STORAGE_ROOT')
  const dbParent = assertRealDirectory(scope, dirname(dbPath), 'SQLITE_DB_PATH parent')
  const canonicalDbPath = join(dbParent, basename(dbPath))
  const canonicalStorageRoot = assertRealDirectory(scope, storageRoot, 'LOCAL_STORAGE_ROOT')
  if (canonicalDbPath !== dbPath || canonicalStorageRoot !== storageRoot) {
    throw new Error(`${scope} does not allow symbolic links or aliases in SQLITE_DB_PATH or LOCAL_STORAGE_ROOT`)
  }
  const dbIsolationRoot = directTemporaryRoot(temporaryRoot, dbParent)
  const storageIsolationRoot = directTemporaryRoot(temporaryRoot, canonicalStorageRoot)

  if (!dbIsolationRoot || dbIsolationRoot !== storageIsolationRoot) {
    throw new Error(`${scope} requires database and storage below one isolated OS temporary root`)
  }
  const isolationRoot = assertRealDirectory(scope, dbIsolationRoot, 'E2E isolation root')
  if (!isWithin(isolationRoot, canonicalDbPath) || !isWithin(isolationRoot, canonicalStorageRoot)) {
    throw new Error(`${scope} requires database and storage below the isolated temporary root`)
  }
  if (isWithin(repositoryRoot, canonicalDbPath) || isWithin(repositoryRoot, canonicalStorageRoot)) {
    throw new Error(`${scope} does not allow repository local.db or .storage targets`)
  }
  if (existsSync(dbPath)) {
    const dbStat = lstatSync(dbPath)
    if (dbStat.isSymbolicLink()) {
      throw new Error(`${scope} does not allow symbolic links or aliases in SQLITE_DB_PATH`)
    }
    if (!dbStat.isFile() || dbStat.nlink !== 1) {
      throw new Error(`${scope} requires an existing SQLITE_DB_PATH to be a regular non-linked file`)
    }
  }
  return { sqliteDbPath: canonicalDbPath, localStorageRoot: canonicalStorageRoot }
}
