#!/usr/bin/env node
const { spawnSync } = require('node:child_process')

function run(cmd, args, env = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  if (res.status !== 0) process.exit(res.status || 1)
}

function main() {
  const base = process.env.QA_BASE_URL || 'http://localhost:3007'
  console.log(`[qa-notifications-settings] BASE=${base}`)
  run('npx', [
    'playwright',
    'test',
    'tests/e2e/notifications-settings.spec.ts',
    '--project=chromium',
    '--reporter=line',
  ], {
    PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    PLAYWRIGHT_TEST_BASE_URL: base,
    E2E_MODE: '1',
    NEXT_PUBLIC_E2E_MODE: '1'
  })
}

main()
