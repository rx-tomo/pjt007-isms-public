#!/usr/bin/env node
/*
  QA Metrics Runner (#58)
  - 安定な qa:* のみ実行（許可リスト or 環境変数で上書き）
  - 既存サーバー再利用（PLAYWRIGHT_SKIP_WEB_SERVER=1）
  - 失敗も集計し、docs/02-project/12_uc-checklist.md に時刻付きで追記
  - 併走対策として簡易ロックを導入（docs/.qa-metrics.lock）
*/

const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function run(cmd, env = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })
    return true
  } catch (e) {
    return false
  }
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
  const allQa = Object.keys(pkg.scripts || {}).filter(name => name.startsWith('qa:'))
  const selfNames = new Set(['qa:all'])

  // 許可リスト（デフォルト）
  const defaultList = [
    'qa:webhook:abnormal',
    'qa:documents:approver',
    'qa:risks:matrix',
    'qa:notifications:settings',
    'qa:rbac:matrix',
    'qa:matrix'
  ]
  const allowList = (process.env.ALLOW_QA_LIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const targets = (allowList.length > 0 ? allowList : defaultList)
    .filter(name => allQa.includes(name))
    .filter(name => !selfNames.has(name))

  if (targets.length === 0) {
    console.error('No qa targets resolved. Check package.json or ALLOW_QA_LIST.')
    process.exit(1)
  }

  const base = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.QA_BASE_URL || 'http://127.0.0.1:3007'
  const commonEnv = {
    PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    PLAYWRIGHT_TEST_BASE_URL: base,
    E2E_MODE: '1',
    NEXT_PUBLIC_E2E_MODE: '1'
  }

  const results = []
  for (const s of targets) {
    const started = Date.now()
    const ok = run(`npm run ${s}`, commonEnv)
    const ended = Date.now()
    results.push({ name: s, ok, ms: ended - started })
  }

  const ts = new Date().toISOString()
  const lines = []
  lines.push(`## Automated QA Summary (${ts})`)
  lines.push('')
  lines.push('| Script | Result | Duration |')
  lines.push('|--------|--------|----------|')
  for (const r of results) {
    const dur = `${Math.round(r.ms/10)/100}s`
    lines.push(`| ${r.name} | ${r.ok ? 'success' : 'fail'} | ${dur} |`)
  }

  const docPath = path.join('docs', '02-project', '12_uc-checklist.md')
  const lockPath = path.join('docs', '.qa-metrics.lock')
  const acquireLock = () => {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      try {
        const fd = fs.openSync(lockPath, 'wx')
        fs.writeFileSync(fd, String(process.pid))
        fs.closeSync(fd)
        return true
      } catch {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
      }
    }
    return false
  }
  const releaseLock = () => { try { fs.unlinkSync(lockPath) } catch {} }

  if (!acquireLock()) {
    console.warn('Could not acquire QA metrics lock, appending without lock.')
  }

  try {
    let content = ''
    try { content = fs.readFileSync(docPath, 'utf8') } catch {}
    const begin = '<!-- QA_SUMMARY:BEGIN -->'
    const end = '<!-- QA_SUMMARY:END -->'
    if (content.includes(begin) && content.includes(end)) {
      const before = content.split(begin)[0]
      const after = content.split(end)[1]
      const injected = `${begin}\n${lines.join('\n')}\n${end}`
      content = before + injected + after
    } else {
      content += '\n' + lines.join('\n') + '\n'
    }
    fs.writeFileSync(docPath, content, 'utf8')
  } finally {
    releaseLock()
  }

  // exit non-zero if any failed, so CI can catch
  const anyFail = results.some(r => !r.ok)
  // Optional Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      const payload = {
        text: `QA Summary ${anyFail ? ':x:' : ':white_check_mark:'} (base=${base})`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*Automated QA Summary* (${ts})` } },
          { type: 'section', text: { type: 'mrkdwn', text: lines.slice(2).join('\n') } }
        ]
      }
      spawnSync('bash', ['-lc', `curl -s -X POST -H 'Content-type: application/json' --data '${JSON.stringify(payload)}' "$SLACK_WEBHOOK_URL"`], { stdio: 'inherit', env: process.env })
    } catch {}
  }
  process.exit(anyFail ? 2 : 0)
}

main()
