#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://${HOST}:${PORT}`;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function main() {
  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `initial-w02-document-approval-run-${timestamp()}.json`);

  console.log('\n=== W-02 文書作成・承認 QA ===');
  const playwrightArgs = [
    'playwright',
    'test',
    'tests/e2e/initial-w02-document-approval.spec.ts',
    '--project=chromium',
    '--reporter=line',
    ...process.argv.slice(2),
  ];

  const sqliteDbPath = process.env.SQLITE_DB_PATH || require('path').join(process.cwd(), 'local.db');

  const result = spawnSync('npx', playwrightArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      QA_SERVER_HOST: HOST,
      QA_SERVER_PORT: String(PORT),
      PLAYWRIGHT_TEST_BASE_URL: baseUrl,
      PLAYWRIGHT_SKIP_WEB_SERVER: '1',
      E2E_MODE: '1',
      NEXT_PUBLIC_E2E_MODE: '1',
      SQLITE_DB_PATH: sqliteDbPath,
      INITIAL_W02_DOCUMENT_APPROVAL_RESULT_PATH: outputPath,
    },
  });

  let evidence = {};
  if (fs.existsSync(outputPath)) {
    try {
      evidence = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (error) {
      evidence = { evidenceReadError: error instanceof Error ? error.message : String(error) };
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    playwright: {
      status: result.status,
      signal: result.signal,
      error: result.error?.message,
      command: ['npx', ...playwrightArgs].join(' '),
    },
    ...evidence,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  if (result.status !== 0) {
    console.error(`\n❌ W-02 文書作成・承認 QA が失敗しました。結果: ${outputPath}`);
    process.exit(result.status || 1);
  }

  console.log(`\n✅ W-02 文書作成・承認 QA が成功しました。結果: ${outputPath}`);
}

main();
