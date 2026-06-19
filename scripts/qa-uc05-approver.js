#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ROOT_DIR = path.join(__dirname, '..')
const LOGS_DIR = path.join(ROOT_DIR, 'docs', '05-quality', 'uc', 'UC-05-risks', 'logs')
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

fs.mkdirSync(LOGS_DIR, { recursive: true })
fs.mkdirSync(RESULTS_DIR, { recursive: true })

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
const logPrefix = process.env.QA_UC05_APPROVER_LOG_PREFIX || 'uc05-approver'
const logPath = path.join(LOGS_DIR, `${logPrefix}-${timestamp}.log`)
const summaryFileName = `risks-demo-summary-${timestamp}.json`

const steps = [
  {
    title: 'Approver 視点リスク QA (CLI + Playwright)',
    args: ['run', 'qa:risks'],
    description:
      'デモシード投入後に Dev Login approver ロールでリスク一覧・関連タブ・マトリクス DOM を検証',
    extraEnv: {
      QA_RISK_VIEW_ROLE: 'approver',
      QA_UC05_APPROVER_MODE: '1',
      QA_RISKS_SUMMARY_FILE: summaryFileName
    }
  },
  {
    title: 'Approver 組織向けリスク Export QA',
    args: ['run', 'qa:risks:export'],
    description: 'Approver テナント (org_id=2222...) を対象に Excel / PDF エクスポート API を検証'
  }
]

function appendLog(chunk) {
  fs.appendFileSync(logPath, chunk)
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    appendLog(`\n## ${step.title}\n`)
    appendLog(`command: npm ${step.args.join(' ')}\n`)
    appendLog(`${step.description}\n\n`)

    const child = spawn(npmCmd, step.args, {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        ...(step.extraEnv || {})
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
  console.log('🚦 UC-05 Approver QA を開始します')
  console.log(`ログファイル: ${path.relative(ROOT_DIR, logPath)}`)
  appendLog(`# UC-05 Approver QA Run\n`)
  appendLog(`started_at: ${new Date().toISOString()}\n`)
  appendLog(`log_path: ${logPath}\n`)

  for (const step of steps) {
    await runStep(step)
  }

  const artifacts = [
    { label: 'リスクデモデータ Playwright JSON', file: path.join('test-results', 'risks-demo-data.json') },
    { label: 'リスクマトリクス DOM JSON', file: path.join('test-results', 'risks-demo-matrix.json') },
    { label: 'DB/UI summary JSON', file: path.join('test-results', summaryFileName) },
    { label: 'リスクエクスポート Excel', file: path.join('test-results', 'risks-export.xlsx') }
  ]

  appendLog('\n## Artifacts\n')
  artifacts.forEach(artifact => {
    appendLog(`- ${artifact.label}: ${artifact.file}\n`)
  })
  appendLog(`completed_at: ${new Date().toISOString()}\n`)

  console.log('🎉 UC-05 Approver QA が成功しました')
  console.log(`ログ: ${logPath}`)
}

main().catch(error => {
  console.error('❌ UC-05 Approver QA でエラーが発生しました:', error)
  console.error(`ログファイルを確認してください: ${logPath}`)
  process.exit(1)
})
