#!/usr/bin/env node
const { spawnSync } = require('node:child_process')

function run(cmd, args, env = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  if (res.status !== 0) process.exit(res.status || 1)
}

function main() {
  const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3007'
  const matrixJson = process.env.QA_RISKS_MATRIX_JSON
  const reporter = 'line'
  console.log(`[qa-risks-matrix] BASE=${base}`)
  run('npx', ['playwright', 'test', 'tests/e2e/risks-matrix.spec.ts', '--reporter', reporter], {
    PLAYWRIGHT_SKIP_WEB_SERVER: '1',
    PLAYWRIGHT_TEST_BASE_URL: base,
    E2E_MODE: '1',
    NEXT_PUBLIC_E2E_MODE: '1'
  })

  // Playwright CLIでは reporter=json=<path> を指定しにくいため、成功時にプレースホルダを作成して後続処理の参照先を確保する。
  if (matrixJson) {
    const fs = require('fs')
    fs.writeFileSync(matrixJson, JSON.stringify({
      note: 'matrix qa passed via Playwright',
      generated_at: new Date().toISOString(),
      scenarios: [
        'legend_and_color_distribution',
        'responsive_375_768_1920',
        'cell_drilldown_with_risks',
        'empty_cell_drilldown_as_zero_result',
        'matrix_filter_export_propagation',
        'same_cell_click_clears_filter'
      ]
    }, null, 2))
    console.log(`📄 Matrix JSONプレースホルダを作成: ${matrixJson}`)
  }
}

main()
