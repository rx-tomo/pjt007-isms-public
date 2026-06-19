#!/usr/bin/env node
/**
 * 監査レポート導線のウォークスルーを CLI で事前検証する統合スクリプト。
 * 既存の QA スクリプト（Dev Login / Audit / 全ページチェック）を組み合わせて実行し、
 * Playwright を使わなくても主要導線の退行を検出できるようにする。
 */

const http = require('http');
const { spawnSync } = require('child_process');
const path = require('path');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);
const RETRY_LIMIT = Number(process.env.QA_SERVER_RETRY_LIMIT || 20);
const RETRY_INTERVAL = Number(process.env.QA_SERVER_RETRY_INTERVAL_MS || 1000);

const scripts = [
  {
    name: 'Dev Login ヘルスチェック',
    file: 'test-dev-login.js'
  },
  {
    name: '監査導線ヘルスチェック',
    file: 'test-audit.js'
  },
  {
    name: '主要ページ 404/500 チェック',
    file: 'test-all-pages.js',
    extraEnv: {
      // test-all-pages のデフォルトは 3006 なので上書きして使う
      QA_SERVER_PORT: String(PORT)
    }
  }
];

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runDemoSeed(demoName) {
  if (process.env.QA_SKIP_DEMO_SEED) {
    console.log(`⚠️ QA_SKIP_DEMO_SEED が指定されているため ${demoName} シードをスキップします`);
    return true;
  }

  console.log(`\n📦 ${demoName} デモデータを投入します`);
  const result = spawnSync(getNpmCommand(), ['run', 'db:seed', '--', '--demo', demoName], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    console.error(`❌ デモデータ投入でエラーが発生しました: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    console.error(`❌ デモデータ投入が失敗しました (exit code: ${result.status})`);
    return false;
  }

  return true;
}

function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0;

    const tryConnect = () => {
      const req = http.request(
        {
          hostname: HOST,
          port: PORT,
          path: '/',
          method: 'HEAD',
          timeout: 1000
        },
        () => {
          resolve(true);
        }
      );

      req.on('error', () => {
        attempts += 1;
        if (attempts >= RETRY_LIMIT) {
          resolve(false);
          return;
        }
        setTimeout(tryConnect, RETRY_INTERVAL);
      });

      req.on('timeout', () => {
        req.destroy();
        attempts += 1;
        if (attempts >= RETRY_LIMIT) {
          resolve(false);
          return;
        }
        setTimeout(tryConnect, RETRY_INTERVAL);
      });

      req.end();
    };

    tryConnect();
  });
}

function runScript({ name, file, extraEnv = {} }) {
  const scriptPath = path.join(__dirname, file);

  console.log(`\n=== ${name} を実行します ===`);
  const result = spawnSync('node', [scriptPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      QA_SERVER_HOST: HOST,
      QA_SERVER_PORT: String(PORT),
      ...extraEnv
    }
  });

  if (result.error) {
    console.error(`\n❌ ${name} 実行中にエラーが発生しました: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    console.error(`\n❌ ${name} が失敗しました (exit code: ${result.status})`);
    return false;
  }

  console.log(`✅ ${name} が成功しました`);
  return true;
}

async function main() {
  console.log('🚦 監査レポート CLI ウォークスルーを開始します');
  console.log(`対象サーバー: http://${HOST}:${PORT}`);

  const seeded = runDemoSeed('audits');
  if (!seeded) {
    process.exit(1);
  }

  const ready = await waitForServer();
  if (!ready) {
    console.error(`\n❌ サーバー http://${HOST}:${PORT} に接続できません。先に開発サーバーを起動してください。`);
    process.exit(1);
  }

  for (const script of scripts) {
    const success = runScript(script);
    if (!success) {
      process.exit(1);
    }
  }

  console.log('\n🎉 監査レポート CLI ウォークスルーがすべて成功しました');
}

main().catch((error) => {
  console.error('❌ 想定外のエラーが発生しました:', error);
  process.exit(1);
});
