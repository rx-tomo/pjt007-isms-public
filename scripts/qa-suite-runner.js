#!/usr/bin/env node
/**
 * QAスイートランナー
 *
 * 複数の qa:* スクリプトを、各実行前にシードリセットを挟んで順次実行する。
 * 個々のQAスクリプトはシードを破壊的に更新するため、連続実行時の相互汚染
 * （GAP-001）を防ぐ目的でリセットを標準とする。
 *
 * 使い方:
 *   node scripts/qa-suite-runner.js --suite surveillance
 *   node scripts/qa-suite-runner.js --suite initial
 *   node scripts/qa-suite-runner.js --suite all
 *   node scripts/qa-suite-runner.js qa:surveillance-first-step qa:surveillance-follow-up-update
 *
 * オプション:
 *   --no-reset         シードリセットを挟まない（高速・汚染許容の確認用）
 *   --restart-server   スイート開始前にdevサーバーを再起動する（GAP-015対策）。
 *                      QA連続実行でnext-serverのメモリが肥大化し応答劣化するため、
 *                      連続実行時はこのオプションの利用を推奨。
 *   --no-warmup        スイート開始前の主要ルートウォームアップを省略する。
 *                      devモードはルート初訪問時にオンデマンドコンパイルが走り、
 *                      先頭テストがタイムアウトし得るため（GAP-017）、既定で実行する。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const QA_SERVER_PORT = Number(process.env.QA_SERVER_PORT || 3007);

// devモードのオンデマンドコンパイルを先に済ませる対象（GAP-017）
const WARMUP_ROUTES = [
  '/ja',
  '/ja/auth/login',
  '/ja/home',
  '/ja/documents',
  '/ja/risks',
  '/ja/tasks',
  '/ja/incidents',
  '/ja/audits',
  '/ja/management-reviews',
  '/ja/education',
  '/ja/settings/assets',
  '/ja/settings/users',
  '/ja/settings/controls',
];

const SUITES = {
  surveillance: [
    'qa:surveillance-first-step',
    'qa:surveillance-document-revision',
    'qa:surveillance-risk-reassessment',
    'qa:surveillance-education-update',
    'qa:surveillance-corrective-action-update',
    'qa:surveillance-follow-up-update',
    'qa:surveillance-overdue-reminder',
    'qa:surveillance-management-review-input',
    'qa:surveillance-management-decision',
    'qa:surveillance-residual-risk-acceptance',
    'qa:surveillance-audit-plan-approval',
    'qa:surveillance-audit-report-approval',
    'qa:surveillance-submission-bundle',
    'qa:surveillance-evidence-gap',
    'qa:surveillance-home-task-cycle',
  ],
  initial: [
    'qa:initial-w02-journey',
    'qa:initial-user-lifecycle',
    'qa:initial-w02-assets-crud',
    'qa:initial-w02-document-approval',
    'qa:initial-w02-document-rejection',
    'qa:initial-w02-risk-update',
    'qa:initial-w02-risk-create',
    'qa:initial-w02-control-link-update',
    'qa:initial-w02-soa-readiness',
    'qa:initial-w02-submission-bundle',
    'qa:initial-w02-task-progress-update',
    'qa:initial-w02-risk-residual-rejection',
  ],
};
SUITES.all = [...SUITES.initial, ...SUITES.surveillance];

function parseArgs(argv) {
  const args = { reset: true, restartServer: false, warmup: true, scripts: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--suite') {
      const name = argv[i + 1];
      i += 1;
      if (!name || !SUITES[name]) {
        console.error(`不明なスイート: ${name ?? '(未指定)'}（指定可能: ${Object.keys(SUITES).join(', ')}）`);
        process.exit(2);
      }
      args.scripts.push(...SUITES[name]);
    } else if (arg === '--no-reset') {
      args.reset = false;
    } else if (arg === '--restart-server') {
      args.restartServer = true;
    } else if (arg === '--no-warmup') {
      args.warmup = false;
    } else if (arg.startsWith('qa:')) {
      args.scripts.push(arg);
    } else {
      console.error(`不明な引数: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  return result.status === 0;
}

function resetSeed() {
  return run('npm', ['run', 'seed:practical-verification', '--', '--reset', '--scenario', 'all']);
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function findServerPids(port) {
  const result = spawnSync('lsof', ['-ti', `:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  return (result.stdout || '').trim().split('\n').filter(Boolean).map(Number);
}

function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const probe = `fetch('http://127.0.0.1:${port}/ja').then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))`;
  while (Date.now() < deadline) {
    const result = spawnSync(process.execPath, ['-e', probe]);
    if (result.status === 0) return true;
    sleepSync(1000);
  }
  return false;
}

function restartServer(port) {
  const pids = findServerPids(port);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // 既に終了している場合は無視
    }
  }
  if (pids.length > 0) {
    console.log(`devサーバー (PID ${pids.join(', ')}) を停止しました。再起動します...`);
    sleepSync(3000);
  } else {
    console.log(`ポート ${port} にサーバーが見つからないため、新規に起動します...`);
  }

  const logDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(path.join(logDir, 'qa-dev-server.log'), 'a');
  const child = spawn('npm', ['run', 'dev'], { detached: true, stdio: ['ignore', logFd, logFd] });
  child.unref();

  if (!waitForServer(port, 120_000)) {
    console.error('devサーバーの起動を確認できませんでした（120秒タイムアウト）。');
    return false;
  }
  console.log(`devサーバーの起動を確認しました（http://127.0.0.1:${port}）。`);
  return true;
}

function warmupRoutes(port) {
  console.log(`主要ルートをウォームアップしています（${WARMUP_ROUTES.length}件）...`);
  const script = `
    const routes = ${JSON.stringify(WARMUP_ROUTES)};
    (async () => {
      for (const route of routes) {
        try {
          // x-qa-warmup: 未認証リダイレクト（GAP-020）を素通しし、保護ページ本体をコンパイルさせる
          const res = await fetch('http://127.0.0.1:${port}' + route, { redirect: 'manual', headers: { 'x-qa-warmup': '1' } });
          process.stdout.write(route + ' ' + res.status + '\\n');
        } catch (error) {
          process.stdout.write(route + ' failed: ' + error.message + '\\n');
        }
      }
    })();
  `;
  spawnSync(process.execPath, ['-e', script], { stdio: 'inherit', timeout: 300_000 });
}

function main() {
  const { reset, restartServer: shouldRestartServer, warmup, scripts } = parseArgs(process.argv.slice(2));
  if (scripts.length === 0) {
    console.error('実行対象がありません。--suite <name> または qa:スクリプト名を指定してください。');
    process.exit(2);
  }

  if (shouldRestartServer && !restartServer(QA_SERVER_PORT)) {
    process.exit(2);
  }
  if (warmup) {
    warmupRoutes(QA_SERVER_PORT);
  }

  const results = [];
  for (const script of scripts) {
    console.log(`\n========== ${script} ==========`);
    if (reset && !resetSeed()) {
      results.push({ script, status: 'seed_reset_failed' });
      continue;
    }
    const ok = run('npm', ['run', script]);
    results.push({ script, status: ok ? 'pass' : 'fail' });
  }

  const failed = results.filter((entry) => entry.status !== 'pass');
  console.log('\n=== QAスイート結果 ===');
  for (const entry of results) {
    const mark = entry.status === 'pass' ? '✅' : '❌';
    console.log(`${mark} ${entry.script} (${entry.status})`);
  }

  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `qa-suite-run-${stamp}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), reset, results }, null, 2)}\n`);
  console.log(`\n結果ファイル: ${outputPath}`);

  process.exit(failed.length === 0 ? 0 : 1);
}

main();
