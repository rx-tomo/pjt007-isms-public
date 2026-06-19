#!/usr/bin/env node
'use strict'

const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { spawn } = require('child_process')

const ROOT_DIR = path.join(__dirname, '..')
const LOGS_DIR = path.join(ROOT_DIR, 'docs', '05-quality', 'uc', 'UC-07-audit', 'logs')
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

fs.mkdirSync(LOGS_DIR, { recursive: true })
fs.mkdirSync(RESULTS_DIR, { recursive: true })

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
const logPrefix = process.env.QA_UC07_LOG_PREFIX || 'uc07-auditor'
const logPath = path.join(LOGS_DIR, `${logPrefix}-${timestamp}.log`)

const basePlaywrightEnv = {
  PLAYWRIGHT_TEST_BASE_URL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3007',
  E2E_MODE: process.env.E2E_MODE || '1',
  NEXT_PUBLIC_E2E_MODE: process.env.NEXT_PUBLIC_E2E_MODE || '1'
}

const artifactJson = name => path.join(RESULTS_DIR, `${name}-${timestamp}.json`)

let managedServer = null

const steps = [
  {
    title: '監査 CLI / PDF 検証 (npm run qa:audit-report)',
    command: npmCmd,
    args: ['run', 'qa:audit-report'],
    description:
      'Dev Login auditor シード → CLI 監査導線（PDF/Storage）を一括検証し、`test-audit` も実行',
    env: {}
  },
  {
    title: 'Playwright 監査ウォークスルー (audit-walkthrough.spec.ts)',
    command: npxCmd,
    args: ['playwright', 'test', 'tests/e2e/audit-walkthrough.spec.ts', '--project=chromium', '--reporter', 'line,json'],
    description: 'Auditor ロールでチェックリスト・証跡アップロード・不適合登録・報告書更新を自動検証',
    env: { ...basePlaywrightEnv, PLAYWRIGHT_JSON_OUTPUT_NAME: artifactJson('audit-walkthrough') }
  },
  {
    title: 'Playwright 監査ダッシュボード期間検証 (audit-progress.spec.ts)',
    command: npxCmd,
    args: ['playwright', 'test', 'tests/e2e/audit-progress.spec.ts', '--project=chromium', '--reporter', 'line,json'],
    description: '期間セレクターとフォローアップ/再指摘バッジの同期を確認し、URL パラメーターも含めて回帰テスト',
    env: { ...basePlaywrightEnv, PLAYWRIGHT_JSON_OUTPUT_NAME: artifactJson('audit-progress') }
  }
]

function appendLog(chunk) {
  fs.appendFileSync(logPath, chunk)
}

function probeUrl(url) {
  return new Promise(resolve => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'https:' ? https : http
    const request = client.request(
      parsedUrl,
      {
        method: 'GET',
        timeout: 2_000
      },
      response => {
        response.resume()
        resolve(response.statusCode >= 200 && response.statusCode < 500)
      }
    )

    request.on('timeout', () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
    request.end()
  })
}

async function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await probeUrl(url)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 1_000))
  }

  return false
}

async function ensureServer() {
  const baseUrl = basePlaywrightEnv.PLAYWRIGHT_TEST_BASE_URL
  const healthUrl = `${baseUrl}/ja`

  if (await probeUrl(healthUrl)) {
    appendLog(`server_status: existing server detected at ${healthUrl}\n`)
    console.log(`既存サーバーを使用します: ${healthUrl}`)
    return
  }

  if (process.env.QA_UC07_MANAGE_SERVER === '0') {
    throw new Error(`サーバー ${healthUrl} に接続できません。先に開発サーバーを起動してください。`)
  }

  appendLog(`server_status: starting managed dev server at ${healthUrl}\n`)
  console.log(`開発サーバーを起動します: ${healthUrl}`)

  managedServer = spawn(npmCmd, ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3007'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      BETTER_AUTH_URL: baseUrl,
      NEXT_PUBLIC_APP_URL: baseUrl,
      E2E_MODE: '1',
      NEXT_PUBLIC_E2E_MODE: '1'
    },
    shell: false,
    detached: false
  })

  managedServer.stdout.on('data', data => appendLog(`[dev-server] ${data}`))
  managedServer.stderr.on('data', data => appendLog(`[dev-server] ${data}`))
  managedServer.on('exit', code => {
    appendLog(`[dev-server] exited with code ${code}\n`)
  })

  if (!(await waitForServer(healthUrl))) {
    throw new Error(`開発サーバーの起動待ちがタイムアウトしました: ${healthUrl}`)
  }
}

function stopManagedServer() {
  if (!managedServer || managedServer.killed) {
    return
  }

  appendLog('server_status: stopping managed dev server\n')
  managedServer.kill('SIGTERM')
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    appendLog(`\n## ${step.title}\n`)
    appendLog(`command: ${step.command} ${step.args.join(' ')}\n`)
    appendLog(`${step.description}\n\n`)

    const child = spawn(step.command, step.args, {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        ...step.env
      },
      shell: false
    })

    child.stdout.on('data', data => {
      process.stdout.write(data)
      appendLog(data)
    })

    child.stderr.on('data', data => {
      process.stderr.write(data)
      appendLog(data)
    })

    child.on('error', error => {
      appendLog(`\n❌ ${step.title} 実行中にエラー: ${error.message}\n`)
      reject(error)
    })

    child.on('exit', code => {
      if (code !== 0) {
        appendLog(`\n❌ ${step.title} が失敗しました (exit code: ${code})\n`)
        reject(new Error(`${step.title} failed with code ${code}`))
        return
      }

      appendLog(`\n✅ ${step.title} が完了しました\n`)
      resolve()
    })
  })
}

async function main() {
  console.log('🚦 UC-07 Auditor QA を開始します')
  console.log(`ログファイル: ${path.relative(ROOT_DIR, logPath)}`)

  appendLog(`# UC-07 Auditor QA Run\n`)
  appendLog(`started_at: ${new Date().toISOString()}\n`)
  appendLog(`log_path: ${logPath}\n`)
  appendLog(`playwright_base_url: ${basePlaywrightEnv.PLAYWRIGHT_TEST_BASE_URL}\n`)

  try {
    await ensureServer()

    for (const step of steps) {
      await runStep(step)
    }
  } finally {
    stopManagedServer()
  }

  const artifacts = [
    { label: '監査 CLI ログ (qa-uc07-auditor)', file: path.relative(ROOT_DIR, logPath) },
    { label: 'audit-walkthrough Playwright JSON', file: path.relative(ROOT_DIR, artifactJson('audit-walkthrough')) },
    { label: 'audit-progress Playwright JSON', file: path.relative(ROOT_DIR, artifactJson('audit-progress')) }
  ]

  appendLog('\n## Artifacts\n')
  artifacts.forEach(artifact => {
    appendLog(`- ${artifact.label}: ${artifact.file}\n`)
  })
  appendLog(`completed_at: ${new Date().toISOString()}\n`)

  console.log('🎉 UC-07 Auditor QA が成功しました')
  console.log(`ログ: ${path.relative(ROOT_DIR, logPath)}`)
}

main().catch(error => {
  console.error('❌ UC-07 Auditor QA でエラーが発生しました:', error)
  console.error(`ログファイルを確認してください: ${logPath}`)
  process.exit(1)
})
