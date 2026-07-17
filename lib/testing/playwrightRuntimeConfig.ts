import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const DEFAULT_ORIGIN = 'http://127.0.0.1:3007'
const DEFAULT_TEST_FILE_SIZE_BYTES = 1024 * 1024
const MAX_TASK_ATTACHMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024
const MAX_TASK_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

type RuntimeEnvironment = Record<string, string | undefined>

export interface PlaywrightRuntimeConfig {
  origin: string
  hostname: '127.0.0.1'
  port: number
  useExternalWebServer: boolean
  reuseExistingServer: boolean
  runNonce: string | null
  taskAttachmentMaxFileSize: string
  taskImportMaxFileSize: string
}

function parseBinaryFlag(name: string, value: string | undefined): boolean {
  if (value === undefined || value === '0') return false
  if (value === '1') return true
  throw new Error(`${name} must be 0 or 1`)
}

function parseBoundedInteger(
  name: string,
  value: string | undefined,
  defaultValue: number,
  maximum: number
): string {
  if (value === undefined) return String(defaultValue)
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive base-10 integer`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(`${name} must be at most ${maximum}`)
  }
  return String(parsed)
}

function parseLoopbackOrigin(value: string | undefined) {
  const raw = value ?? DEFAULT_ORIGIN
  const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{3,4})\/?$/.exec(raw)
  if (!match) {
    throw new Error(
      'PLAYWRIGHT_TEST_BASE_URL must use http://127.0.0.1:<port> without credentials, path, query, or fragment'
    )
  }

  const port = Number(match[1])
  if (String(port) !== match[1] || port < 1024 || port > 65535) {
    throw new Error('PLAYWRIGHT_TEST_BASE_URL port must be a canonical integer from 1024 to 65535')
  }

  return {
    origin: `http://127.0.0.1:${port}`,
    port,
  }
}

export function resolvePlaywrightRuntimeConfig(
  environment: RuntimeEnvironment = process.env,
  createNonce: () => string = randomUUID
): PlaywrightRuntimeConfig {
  const { origin, port } = parseLoopbackOrigin(environment.PLAYWRIGHT_TEST_BASE_URL)
  const legacyExternalServer = parseBinaryFlag(
    'PLAYWRIGHT_SKIP_WEB_SERVER',
    environment.PLAYWRIGHT_SKIP_WEB_SERVER
  )
  const externalServer = parseBinaryFlag(
    'PLAYWRIGHT_EXTERNAL_WEB_SERVER',
    environment.PLAYWRIGHT_EXTERNAL_WEB_SERVER
  )
  const reuseRequested = parseBinaryFlag(
    'PLAYWRIGHT_REUSE_WEB_SERVER',
    environment.PLAYWRIGHT_REUSE_WEB_SERVER
  )

  if (environment.CI && legacyExternalServer) {
    throw new Error(
      'CI must use PLAYWRIGHT_EXTERNAL_WEB_SERVER=1 instead of PLAYWRIGHT_SKIP_WEB_SERVER'
    )
  }
  const useExternalWebServer = externalServer || legacyExternalServer
  if (useExternalWebServer && reuseRequested) {
    throw new Error('PLAYWRIGHT_REUSE_WEB_SERVER cannot be combined with an external web server')
  }

  const configuredNonce = environment.PLAYWRIGHT_RUN_NONCE
  if (configuredNonce !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/.test(configuredNonce)) {
    throw new Error('PLAYWRIGHT_RUN_NONCE must contain 16 to 128 safe characters')
  }
  const reusesExistingServer = !environment.CI && !useExternalWebServer && reuseRequested
  if ((useExternalWebServer || reusesExistingServer) && !configuredNonce) {
    throw new Error('External or reused web server requires PLAYWRIGHT_RUN_NONCE')
  }

  return {
    origin,
    hostname: '127.0.0.1',
    port,
    useExternalWebServer,
    reuseExistingServer: reusesExistingServer,
    runNonce: configuredNonce ?? createNonce(),
    taskAttachmentMaxFileSize: parseBoundedInteger(
      'TASK_ATTACHMENT_MAX_FILE_SIZE_BYTES',
      environment.TASK_ATTACHMENT_MAX_FILE_SIZE_BYTES,
      DEFAULT_TEST_FILE_SIZE_BYTES,
      MAX_TASK_ATTACHMENT_FILE_SIZE_BYTES
    ),
    taskImportMaxFileSize: parseBoundedInteger(
      'TASK_IMPORT_MAX_FILE_SIZE_BYTES',
      environment.TASK_IMPORT_MAX_FILE_SIZE_BYTES,
      DEFAULT_TEST_FILE_SIZE_BYTES,
      MAX_TASK_IMPORT_FILE_SIZE_BYTES
    ),
  }
}

export function resolvePlaywrightOutputDir(
  value: string | undefined,
  projectRoot = process.cwd()
): string {
  const requested = value ?? 'test-results/playwright'
  if (isAbsolute(requested)) {
    throw new Error('PLAYWRIGHT_OUTPUT_DIR must be relative to the repository')
  }

  const testResultsRoot = resolve(projectRoot, 'test-results')
  const outputDir = resolve(projectRoot, requested)
  const pathFromTestResults = relative(testResultsRoot, outputDir)
  if (
    pathFromTestResults === ''
    || pathFromTestResults === '..'
    || pathFromTestResults.startsWith(`..${sep}`)
    || isAbsolute(pathFromTestResults)
  ) {
    throw new Error('PLAYWRIGHT_OUTPUT_DIR must be inside test-results/')
  }

  let currentPath = resolve(projectRoot)
  for (const component of relative(currentPath, outputDir).split(sep)) {
    currentPath = resolve(currentPath, component)
    if (existsSync(currentPath) && lstatSync(currentPath).isSymbolicLink()) {
      throw new Error('PLAYWRIGHT_OUTPUT_DIR must not traverse symbolic links')
    }
  }
  return outputDir
}

export function buildPlaywrightWebServerCommand(config: PlaywrightRuntimeConfig): string {
  return [
    './node_modules/.bin/next dev --webpack',
    `--hostname ${config.hostname}`,
    `--port ${config.port}`,
  ].join(' ')
}

export function buildPlaywrightWebServerEnvironment(
  config: PlaywrightRuntimeConfig
): Record<string, string> {
  return {
    BETTER_AUTH_URL: config.origin,
    NEXT_PUBLIC_APP_URL: config.origin,
    E2E_MODE: '1',
    PLAYWRIGHT_RUN_NONCE: config.runNonce ?? '',
    TASK_ATTACHMENT_MAX_FILE_SIZE_BYTES: config.taskAttachmentMaxFileSize,
    TASK_IMPORT_MAX_FILE_SIZE_BYTES: config.taskImportMaxFileSize,
  }
}
