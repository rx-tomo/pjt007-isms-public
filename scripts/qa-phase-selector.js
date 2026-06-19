#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const noReset = args.includes('--no-reset');
const forwardedArgs = args.filter((arg) => arg !== '--no-reset');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://${HOST}:${PORT}`;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function run(command, commandArgs, extraEnv = {}) {
  return spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      QA_SERVER_HOST: HOST,
      QA_SERVER_PORT: String(PORT),
      PLAYWRIGHT_TEST_BASE_URL: baseUrl,
      PLAYWRIGHT_SKIP_WEB_SERVER: '1',
      E2E_MODE: '1',
      NEXT_PUBLIC_E2E_MODE: '1',
      ...extraEnv,
    },
  });
}

function main() {
  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });

  let reset = { skipped: true, status: 0 };
  if (!noReset) {
    console.log('\n=== ISMSフェーズ初期化 ===');
    const resetResult = run('node', [path.join('scripts', 'reset-isms-phase.mjs')]);
    reset = {
      skipped: false,
      status: resetResult.status,
      signal: resetResult.signal,
      error: resetResult.error?.message,
    };
    if (resetResult.status !== 0) {
      const outputPath = path.join(outputDir, `phase-selector-run-${timestamp()}.json`);
      fs.writeFileSync(outputPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        baseUrl,
        reset,
        playwright: { status: null, skipped: true },
      }, null, 2)}\n`);
      console.error(`\n❌ フェーズ初期化に失敗しました。結果: ${outputPath}`);
      process.exit(resetResult.status || 1);
    }
  }

  console.log('\n=== ISMSフェーズ選択 Playwright QA ===');
  const playwrightArgs = [
    'playwright',
    'test',
    'tests/e2e/phase-selector.spec.ts',
    '--project=chromium',
    '--reporter=line',
    ...forwardedArgs,
  ];
  const playwrightResult = run('npx', playwrightArgs);

  const outputPath = path.join(outputDir, `phase-selector-run-${timestamp()}.json`);
  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    reset,
    playwright: {
      status: playwrightResult.status,
      signal: playwrightResult.signal,
      error: playwrightResult.error?.message,
      command: ['npx', ...playwrightArgs].join(' '),
    },
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  if (playwrightResult.status !== 0) {
    console.error(`\n❌ ISMSフェーズ選択 QA が失敗しました。結果: ${outputPath}`);
    process.exit(playwrightResult.status || 1);
  }

  console.log(`\n✅ ISMSフェーズ選択 QA が成功しました。結果: ${outputPath}`);
}

main();
