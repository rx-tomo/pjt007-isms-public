#!/usr/bin/env node
// role × UC の簡易回帰ランナー
const { spawnSync } = require('node:child_process')

function run(name, cmd, args, env = {}) {
  console.log(`\n=== ${name} ===`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  if (res.status !== 0) {
    console.error(`✖ ${name} failed (exit ${res.status})`)
    process.exit(res.status || 1)
  }
  console.log(`✓ ${name} passed`)
}

function main() {
  const base = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.QA_BASE_URL || 'http://127.0.0.1:3007'
  const env = {
    PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    PLAYWRIGHT_TEST_BASE_URL: base,
    E2E_MODE: '1',
    NEXT_PUBLIC_E2E_MODE: '1'
  }

  run('UC-02 Webhook 異常系', 'node', ['scripts/qa-stripe-webhook-abnormal.js'], env)
  run('UC-04 Approver フロー', 'npx', ['playwright', 'test', 'tests/e2e/doc-approver.spec.ts', '--reporter=line'], env)
  run('UC-05 リスクマトリクス', 'npx', ['playwright', 'test', 'tests/e2e/risks-matrix.spec.ts', '--reporter=line'], env)
  run('UC-08 通知設定', 'npx', ['playwright', 'test', 'tests/e2e/notifications-settings.spec.ts', '--reporter=line'], env)
  run('UC-09 RBAC', 'npx', ['playwright', 'test', 'tests/e2e/rbac-matrix.spec.ts', '--reporter=line'], env)
}

main()

