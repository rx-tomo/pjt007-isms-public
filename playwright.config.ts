import { defineConfig, devices } from '@playwright/test'
import {
  buildPlaywrightWebServerCommand,
  buildPlaywrightWebServerEnvironment,
  resolvePlaywrightOutputDir,
  resolvePlaywrightRuntimeConfig,
} from './lib/testing/playwrightRuntimeConfig'
import {
  assertE2EIsolationTargets,
  assertFocusedE2EManagedServer,
  buildFocusedE2EWebServerEnvironment,
  requiresE2EIsolationGuard,
  sanitizeE2EIsolationGuardArgv,
} from './lib/testing/e2eIsolationGuard'

const guardedE2ERun = requiresE2EIsolationGuard()
if (guardedE2ERun) {
  console.error(`[e2e-isolation-guard] argv=${JSON.stringify(sanitizeE2EIsolationGuardArgv())}`)
}
const guardedE2ETargets = guardedE2ERun ? assertE2EIsolationTargets('focused E2E run') : null
if (guardedE2ETargets) {
  assertFocusedE2EManagedServer()
}
const guardedE2EWebServerEnvironment = guardedE2ETargets
  ? buildFocusedE2EWebServerEnvironment(guardedE2ETargets)
  : {}

const runtime = resolvePlaywrightRuntimeConfig()
const shouldStartServer = !runtime.useExternalWebServer

process.env.PLAYWRIGHT_TEST_BASE_URL = runtime.origin
if (runtime.runNonce) process.env.PLAYWRIGHT_RUN_NONCE = runtime.runNonce
else delete process.env.PLAYWRIGHT_RUN_NONCE
delete process.env.PLAYWRIGHT_SKIP_WEB_SERVER

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: resolvePlaywrightOutputDir(process.env.PLAYWRIGHT_OUTPUT_DIR),
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: runtime.origin,
    headless: true,
    trace: 'retain-on-failure',
    video: 'on-first-retry'
  },
  webServer: shouldStartServer
    ? {
        command: buildPlaywrightWebServerCommand(runtime),
        env: {
          ...buildPlaywrightWebServerEnvironment(runtime),
          ...guardedE2EWebServerEnvironment,
        },
        url: `${runtime.origin}/api/e2e/identity`,
        reuseExistingServer: runtime.reuseExistingServer,
        timeout: 120_000
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium', // Playwright bundled Chromium（Chrome app 依存を避ける）
        channel: undefined
      }
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari']
      }
    },
    {
      name: 'vrt',
      testDir: './tests/vrt',
      snapshotDir: './tests/vrt/__screenshots__',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        channel: undefined
      }
    }
  ]
})
