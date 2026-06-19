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
const logPrefix = process.env.QA_UC05_LOG_PREFIX || 'uc05-org-admin'
const logPath = path.join(LOGS_DIR, `${logPrefix}-${timestamp}.log`)
const summaryFileName = `risks-demo-summary-${timestamp}.json`

const steps = [
  {
    title: 'Demo Seed + CLI/Playwright リスクQA',
    args: ['run', 'qa:risks'],
    description:
      'Demo seed, CLI smoke, Playwright demo-data検証、マトリクスDOM検証をまとめて実行',
    extraEnv: {
      QA_RISKS_SUMMARY_FILE: summaryFileName
    }
  },
  {
    title: 'Excel/PDF エクスポート QA',
    args: ['run', 'qa:risks:export'],
    description: 'フィルタ条件と Content-Type を検証する API チェック'
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
  console.log('🚦 UC-05 Org Admin QA を開始します')
  console.log(`ログファイル: ${path.relative(ROOT_DIR, logPath)}`)
  appendLog(`# UC-05 Org Admin QA Run\n`)
  appendLog(`started_at: ${new Date().toISOString()}\n`)
  appendLog(`log_path: ${logPath}\n`)

  for (const step of steps) {
    await runStep(step)
  }

  const artifacts = [
    {
      label: 'Playwright demo data JSON',
      file: path.join('test-results', 'risks-demo-data.json')
    },
    {
      label: 'リスクマトリクス DOM JSON',
      file: path.join('test-results', 'risks-demo-matrix.json')
    },
    {
      label: 'DB/UI summary JSON',
      file: path.join('test-results', summaryFileName)
    }
  ]

  appendLog('\n## Artifacts\n')
  artifacts.forEach(artifact => {
    appendLog(`- ${artifact.label}: ${artifact.file}\n`)
  })
  appendLog('- Export API logs: see above command output\n')
  appendLog(`completed_at: ${new Date().toISOString()}\n`)

  console.log('🎉 UC-05 Org Admin QA が成功しました')
  console.log(`ログ: ${logPath}`)
}

main().catch(error => {
  console.error('❌ UC-05 Org Admin QA でエラーが発生しました:', error)
  console.error(`ログファイルを確認してください: ${logPath}`)
  process.exit(1)
})
