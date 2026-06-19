#!/usr/bin/env node
/**
 * QA runner for the Super Admin shared operator scenario.
 */

const http = require('http')
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)
const RETRY_LIMIT = Number(process.env.QA_SERVER_RETRY_LIMIT || 20)
const RETRY_INTERVAL = Number(process.env.QA_SERVER_RETRY_INTERVAL_MS || 1000)
const BASE_URL = `http://${HOST}:${PORT}`
const RESULTS_DIR = path.join(__dirname, '..', 'test-results')
const REPORT_PATH = path.join(RESULTS_DIR, 'super-admin-shared-operator.json')

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
  }
}

function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0

    const tryConnect = () => {
      const req = http.request(
        {
          hostname: HOST,
          port: PORT,
          path: '/',
          method: 'HEAD',
          timeout: 1000
        },
        () => resolve(true)
      )

      req.on('error', () => {
        attempts += 1
        if (attempts >= RETRY_LIMIT) {
          resolve(false)
          return
        }
        setTimeout(tryConnect, RETRY_INTERVAL)
      })

      req.on('timeout', () => {
        req.destroy()
        attempts += 1
        if (attempts >= RETRY_LIMIT) {
          resolve(false)
          return
        }
        setTimeout(tryConnect, RETRY_INTERVAL)
      })

      req.end()
    }

    tryConnect()
  })
}

function runPlaywright() {
  ensureResultsDir()
  console.log(`\n=== Super Admin shared operator E2E を実行します (${BASE_URL}) ===`)

  const result = spawnSync('npx', [
    'playwright',
    'test',
    'tests/e2e/super-admin-shared-operator.spec.ts',
    '--reporter',
    'line',
    '--reporter',
    'json'
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: path.join('playwright-report', 'test-results.json'),
      PLAYWRIGHT_SKIP_WEB_SERVER: '1',
      PLAYWRIGHT_TEST_BASE_URL: BASE_URL,
      E2E_MODE: '1',
      NEXT_PUBLIC_E2E_MODE: '1'
    }
  })

  if (result.error) {
    console.error(`\n❌ Playwright 実行中にエラーが発生しました: ${result.error.message}`)
    return false
  }

  if (result.status !== 0) {
    console.error(`\n❌ Playwright が失敗しました (exit code: ${result.status})`)
    return false
  }

  console.log('✅ Super Admin shared operator シナリオが成功しました')
  return summarizeReport()
}

function summarizeReport() {
  const playwrightJson = path.join(process.cwd(), 'playwright-report', 'test-results.json')

  if (fs.existsSync(playwrightJson)) {
    ensureResultsDir()
    fs.copyFileSync(playwrightJson, REPORT_PATH)
  }

  if (!fs.existsSync(REPORT_PATH)) {
    console.error('❌ Playwright レポートが見つかりません。ファイル生成に失敗しています。')
    return false
  }

  try {
    const raw = fs.readFileSync(REPORT_PATH, 'utf-8')
    const data = JSON.parse(raw)
    const status = data?.stats?.status || data?.status || 'unknown'
    const expected = data?.stats?.expected ?? data?.stats?.ok ?? data?.stats?.tests ?? 'n/a'
    console.log(`📊 Playwright 結果: status=${status} / cases=${expected}`)
  } catch (error) {
    console.warn(`⚠️ レポート解析に失敗しました: ${error.message}`)
  }

  console.log(`🗂 Evidence: ${REPORT_PATH}`)
  return true
}

async function main() {
  console.log('🚦 Super Admin 共有オペレーター QA を開始します')
  console.log(`対象サーバー: ${BASE_URL}`)

  const ready = await waitForServer()
  if (!ready) {
    console.error(`\n❌ サーバー ${BASE_URL} に接続できません。Next.js 開発サーバーを起動して再実行してください。`)
    process.exit(1)
  }

  const success = runPlaywright()
  if (!success) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ 想定外のエラーが発生しました:', error)
  process.exit(1)
})
