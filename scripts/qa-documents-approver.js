#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

/**
 * UC-04 Approver QA runner
 * - Wraps Playwright doc-approver spec.
 * - Emits JSON summary into test-results/doc-approver-<timestamp>.json.
 * - Emits human-readable log docs/05-quality/uc/UC-04-documents/logs/<prefix>-<timestamp>.log.
 *   Customize prefix via QA_DOC_APPROVER_LOG_PREFIX. Override BASE via QA_BASE_URL.
 */

const ROOT_DIR = path.join(__dirname, '..')
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results')
const LOGS_DIR = path.join(ROOT_DIR, 'docs', '05-quality', 'uc', 'UC-04-documents', 'logs')

fs.mkdirSync(RESULTS_DIR, { recursive: true })
fs.mkdirSync(LOGS_DIR, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z')
const logPrefix = process.env.QA_DOC_APPROVER_LOG_PREFIX || 'approver'
const summaryFile = `doc-approver-${timestamp}.json`
const summaryPath = path.join(RESULTS_DIR, summaryFile)
const logPath = path.join(LOGS_DIR, `${logPrefix}-${timestamp}.log`)
const playwrightJsonPath = path.join(ROOT_DIR, 'playwright-report', 'test-results.json')

const baseUrl = process.env.QA_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3007'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function appendLog(message = '') {
  fs.appendFileSync(logPath, message)
}

function logLine(line = '') {
  appendLog(line.endsWith('\n') ? line : `${line}\n`)
}

async function main() {
  console.log(`[qa-documents-approver] BASE=${baseUrl}`)
  console.log(`[qa-documents-approver] summary -> ${path.relative(ROOT_DIR, summaryPath)}`)
  console.log(`[qa-documents-approver] log -> ${path.relative(ROOT_DIR, logPath)}`)

  logLine('# UC-04 Approver QA Run')
  logLine(`started_at: ${new Date().toISOString()}`)
  logLine(`base_url: ${baseUrl}`)
  logLine(`summary_file: ${path.relative(ROOT_DIR, summaryPath)}`)

  const args = [
    'playwright',
    'test',
    'tests/e2e/doc-approver.spec.ts',
    '--reporter',
    'line',
    '--reporter',
    'json'
  ]

  logLine(`command: ${npxCmd} ${args.join(' ')}`)

  await new Promise((resolve, reject) => {
    const child = spawn(npxCmd, args, {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        E2E_MODE: '1',
        NEXT_PUBLIC_E2E_MODE: '1',
        PLAYWRIGHT_TEST_BASE_URL: baseUrl,
        PLAYWRIGHT_JSON_OUTPUT_NAME: path.join('playwright-report', 'test-results.json')
      },
      stdio: ['inherit', 'pipe', 'pipe']
    })

    child.stdout.on('data', chunk => {
      process.stdout.write(chunk)
      appendLog(chunk)
    })

    child.stderr.on('data', chunk => {
      process.stderr.write(chunk)
      appendLog(chunk)
    })

    child.on('error', error => {
      logLine(`error: ${error.message}`)
      reject(error)
    })

    child.on('close', code => {
      let copied = false
      const reporterExists = fs.existsSync(playwrightJsonPath)
      logLine(`playwright_report_exists: ${reporterExists}`)
      if (reporterExists) {
        try {
          fs.copyFileSync(playwrightJsonPath, summaryPath)
          copied = true
        } catch (error) {
          logLine(`copy_error: ${error.message}`)
        }
      }

      logLine(`completed_at: ${new Date().toISOString()}`)
      logLine(`exit_code: ${code}`)
      logLine('artifacts:')
      if (copied) {
        logLine(`  - summary_json: ${path.relative(ROOT_DIR, summaryPath)}`)
      } else {
        logLine('  - summary_json: (missing; see playwright-report/test-results.json)')
      }
      logLine(`  - log_file: ${path.relative(ROOT_DIR, logPath)}`)
      if (code !== 0) {
        logLine('status: failed')
        reject(new Error(`qa-documents-approver failed with exit code ${code}`))
        return
      }
      logLine('status: passed')
      resolve()
    })
  })
}

main().catch(error => {
  console.error('❌ qa-documents-approver encountered an error:', error.message)
  console.error(`ログを確認してください: ${path.relative(ROOT_DIR, logPath)}`)
  process.exit(1)
})
