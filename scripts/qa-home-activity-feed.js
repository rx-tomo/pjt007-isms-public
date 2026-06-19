#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ROOT_DIR = path.join(__dirname, '..')
const LOGS_DIR = path.join(ROOT_DIR, 'docs', '05-quality', 'uc', 'UC-03-dashboard', 'logs')
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
const logPath = path.join(LOGS_DIR, `home-activity-feed-${timestamp}.log`)
const seedSummaryPath = path.join(LOGS_DIR, `home-activity-feed-seed-${timestamp}.json`)
const playwrightSummaryPath = path.join(RESULTS_DIR, `home-activity-feed-playwright-${timestamp}.json`)
const passthroughArgs = process.argv.slice(2)

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)

fs.mkdirSync(LOGS_DIR, { recursive: true })
fs.mkdirSync(RESULTS_DIR, { recursive: true })

function appendLog(chunk) {
  fs.appendFileSync(logPath, `${chunk}`)
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    appendLog(`\n## ${step.title}\n`)
    appendLog(`command: ${step.command?.join(' ') ?? `npm ${step.args.join(' ')}`}\n`)
    appendLog(`${step.description ?? ''}\n`)

    const env = {
      ...process.env,
      ...(step.extraEnv || {}),
      QA_HOME_ACTIVITY_FEED_SUMMARY: seedSummaryPath,
      HOME_ACTIVITY_FEED_SUMMARY: seedSummaryPath
    }

    const child = step.command
      ? spawn(step.command[0], step.command.slice(1), { cwd: ROOT_DIR, env, shell: false })
      : spawn(npmCmd, step.args, { cwd: ROOT_DIR, env, shell: false })

    child.stdout.on('data', data => {
      process.stdout.write(data)
      appendLog(data)
    })

    child.stderr.on('data', data => {
      process.stderr.write(data)
      appendLog(data)
    })

    child.on('error', error => {
      appendLog(`\n❌ ${step.title} failed: ${error.message}\n`)
      reject(error)
    })

    child.on('exit', code => {
      if (code !== 0) {
        appendLog(`\n❌ ${step.title} exited with code ${code}\n`)
        reject(new Error(`${step.title} failed with code ${code}`))
        return
      }
      appendLog(`\n✅ ${step.title} completed\n`)
      resolve()
    })
  })
}

async function writePlaywrightSummary() {
  const summary = {
    command: `npx playwright test tests/e2e/home-activity-feed.spec.ts --reporter=line`,
    timestamp: new Date().toISOString(),
    baseUrl: `http://${HOST}:${PORT}`,
    seedSummary: seedSummaryPath
  }
  fs.writeFileSync(playwrightSummaryPath, JSON.stringify(summary, null, 2))
  appendLog(`Playwright summary: ${playwrightSummaryPath}\n`)
}

async function main() {
  appendLog(`# UC-03 Recent Activity feed QA\n`)
  appendLog(`started_at: ${new Date().toISOString()}\n`)
  appendLog(`seed_summary: ${seedSummaryPath}\n`)

  const steps = [
    {
      title: 'Seed Recent Activity data',
      args: ['run', 'mock:activities'],
      description: 'Insert deterministic audit logs, documents, risks, and notifications for Org Admin/Approver flows.',
      extraEnv: {
        QA_HOME_ACTIVITY_FEED_SEED_FILE: seedSummaryPath
      }
    },
    {
      title: 'Playwright home activity feed verification',
      command: [
        'npx',
        'playwright',
        'test',
        'tests/e2e/home-activity-feed.spec.ts',
        '--reporter=line',
        ...passthroughArgs
      ],
      description: 'Validate the Recent Activity feed, unread badge, notification read workflow, and detail navigation.',
      extraEnv: {
        PLAYWRIGHT_TEST_BASE_URL: `http://${HOST}:${PORT}`,
        PLAYWRIGHT_SKIP_WEB_SERVER: '1'
      }
    }
  ]

  for (const step of steps) {
    await runStep(step)
  }

  await writePlaywrightSummary()

  const artifacts = [
    { label: 'Seed summary JSON', file: path.relative(ROOT_DIR, seedSummaryPath) },
    { label: 'Playwright summary JSON', file: path.relative(ROOT_DIR, playwrightSummaryPath) }
  ]

  appendLog('\n## Artifacts\n')
  artifacts.forEach(artifact => {
    appendLog(`- ${artifact.label}: ${artifact.file}\n`)
  })
  appendLog(`completed_at: ${new Date().toISOString()}\n`)

  console.log('🎉 Home activity feed QA complete')
  console.log(`Log file: ${logPath}`)
}

main().catch(error => {
  console.error('QA home activity feed failed:', error)
  console.error(`Check the log at ${logPath}`)
  process.exit(1)
})
