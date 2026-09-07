import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const databaseSuffixes = ['', '-wal', '-shm', '-journal']

const scenarios = {
  initialResidualRejection: {
    label: 'W-02 残留リスク受容差戻・再申請 QA',
    port: 3107,
    resultPrefix: 'initial-w02-risk-residual-rejection-run',
    resultEnvironmentName: 'INITIAL_W02_RISK_RESIDUAL_REJECTION_RESULT_PATH',
    spec: 'tests/e2e/initial-w02-risk-residual-rejection.spec.ts',
  },
  surveillanceResidualAcceptance: {
    label: 'Surveillance 残留リスク受容 QA',
    port: 3108,
    resultPrefix: 'surveillance-residual-risk-acceptance-run',
    resultEnvironmentName: 'SURVEILLANCE_RESIDUAL_RISK_ACCEPTANCE_RESULT_PATH',
    spec: 'tests/e2e/surveillance-residual-risk-acceptance.spec.ts',
  },
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

export function snapshotRepositoryDatabase() {
  return Object.fromEntries(databaseSuffixes.map((suffix) => {
    const filePath = path.join(repoRoot, `local.db${suffix}`)
    return [
      `local.db${suffix}`,
      existsSync(filePath)
        ? { exists: true, sha256: hashFile(filePath) }
        : { exists: false, sha256: null },
    ]
  }))
}

export function repositoryDatabaseIsUnchanged(before, after) {
  return JSON.stringify(before) === JSON.stringify(after)
}

export function buildIsolatedPracticalEnvironment(isolationRoot, baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    SQLITE_DB_PATH: path.join(isolationRoot, 'e2e.db'),
    LOCAL_STORAGE_ROOT: path.join(isolationRoot, 'storage'),
    SEED_OUTPUT_DIR: path.join(isolationRoot, 'test-results'),
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    DATABASE_URL: '',
  }
}

export function removeIsolationRoot(isolationRoot) {
  rmSync(isolationRoot, { recursive: true, force: true })
  return !existsSync(isolationRoot)
}

function run(command, args, environment) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  })
}

function writeResult(outputPath, payload) {
  let scenarioEvidence = {}
  if (existsSync(outputPath)) {
    try {
      scenarioEvidence = JSON.parse(readFileSync(outputPath, 'utf8'))
    } catch (error) {
      scenarioEvidence = {
        evidenceReadError: error instanceof Error ? error.message : String(error),
      }
    }
  }
  writeFileSync(outputPath, `${JSON.stringify({
    ...scenarioEvidence,
    orchestration: payload,
  }, null, 2)}\n`)
}

export async function runIsolatedPracticalE2E(scenarioName, extraPlaywrightArgs = []) {
  const scenario = scenarios[scenarioName]
  if (!scenario) {
    throw new Error(`unsupported isolated practical E2E scenario: ${scenarioName}`)
  }

  const outputDir = path.join(repoRoot, 'test-results')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${scenario.resultPrefix}-${timestamp()}.json`)
  const databaseBefore = snapshotRepositoryDatabase()
  const isolationRoot = realpathSync(mkdtempSync(path.join(realpathSync(tmpdir()), 'pjt007-practical-e2e-')))
  const storageRoot = path.join(isolationRoot, 'storage')
  mkdirSync(storageRoot)

  let provision = null
  let seed = null
  let playwright = null
  let port = null
  let unexpectedError = null

  try {
    const isolatedEnvironment = buildIsolatedPracticalEnvironment(isolationRoot)

    provision = run(process.execPath, [
      'scripts/provision-local-database.mjs',
      '--root',
      isolationRoot,
      '--name',
      'e2e.db',
    ], isolatedEnvironment)
    if (provision.status !== 0) return finalize()

    seed = run(process.execPath, [
      'scripts/seed-practical-verification.mjs',
      '--reset',
      '--scenario',
      'all',
    ], isolatedEnvironment)
    if (seed.status !== 0) return finalize()

    port = scenario.port
    const origin = `http://127.0.0.1:${port}`
    const playwrightEnvironment = {
      ...isolatedEnvironment,
      QA_SERVER_HOST: '127.0.0.1',
      QA_SERVER_PORT: String(port),
      PLAYWRIGHT_TEST_BASE_URL: origin,
      PLAYWRIGHT_EXTERNAL_WEB_SERVER: '0',
      PLAYWRIGHT_REUSE_WEB_SERVER: '0',
      PLAYWRIGHT_SKIP_WEB_SERVER: '0',
      E2E_MODE: '1',
      NEXT_PUBLIC_E2E_MODE: '1',
      [scenario.resultEnvironmentName]: outputPath,
    }
    playwright = run('npx', [
      'playwright',
      'test',
      scenario.spec,
      '--project=chromium',
      '--reporter=line',
      ...extraPlaywrightArgs,
    ], playwrightEnvironment)
  } catch (error) {
    unexpectedError = error instanceof Error ? error.message : String(error)
  } finally {
    removeIsolationRoot(isolationRoot)
  }

  return finalize()

  function finalize() {
    if (existsSync(isolationRoot)) {
      removeIsolationRoot(isolationRoot)
    }
    const databaseAfter = snapshotRepositoryDatabase()
    const databaseUnchanged = repositoryDatabaseIsUnchanged(databaseBefore, databaseAfter)
    const status = (
      provision?.status === 0
      && seed?.status === 0
      && playwright?.status === 0
      && databaseUnchanged
      && !unexpectedError
    ) ? 0 : 1

    writeResult(outputPath, {
      generatedAt: new Date().toISOString(),
      scenario: scenarioName,
      label: scenario.label,
      isolation: {
        rootRemoved: !existsSync(isolationRoot),
        repositoryDatabaseUnchanged: databaseUnchanged,
        before: databaseBefore,
        after: databaseAfter,
      },
      provision: {
        status: provision?.status ?? null,
        signal: provision?.signal ?? null,
      },
      seed: {
        status: seed?.status ?? null,
        signal: seed?.signal ?? null,
      },
      playwright: {
        status: playwright?.status ?? null,
        signal: playwright?.signal ?? null,
        spec: scenario.spec,
        origin: port ? `http://127.0.0.1:${port}` : null,
      },
      unexpectedError,
    })

    console.log(`\n${status === 0 ? '✅' : '❌'} ${scenario.label}`)
    console.log(`結果: ${outputPath}`)
    return { status, outputPath }
  }
}
