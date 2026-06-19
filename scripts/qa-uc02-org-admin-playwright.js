#!/usr/bin/env node
'use strict'

require('dotenv').config({ path: '.env.local' })

const { spawnSync } = require('child_process')
const path = require('path')

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`

const extraArgs = process.argv.slice(2)
const testFile = path.join('tests', 'e2e', 'billing-portal.spec.ts')

console.log('▶️  UC-02 Org Admin Playwright シナリオを実行します')
console.log(`   Base URL: ${BASE_URL}`)

const result = spawnSync('npx', ['playwright', 'test', testFile, '--reporter=line', ...extraArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_TEST_BASE_URL: BASE_URL,
    PLAYWRIGHT_SKIP_WEB_SERVER: process.env.PLAYWRIGHT_SKIP_WEB_SERVER || '1',
    E2E_MODE: process.env.E2E_MODE || '1',
    NEXT_PUBLIC_E2E_MODE: process.env.NEXT_PUBLIC_E2E_MODE || '1'
  }
})

if (result.error) {
  console.error('❌ Playwright 実行に失敗しました:', result.error)
  process.exit(1)
}

if (result.status !== 0) {
  console.error(`❌ Playwright テストが失敗しました (exit ${result.status})`)
  process.exit(result.status)
}

console.log('✅ UC-02 Org Admin Playwright シナリオが完了しました')
