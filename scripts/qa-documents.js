#!/usr/bin/env node
/**
 * UC-04 文書管理ウォーキングスケルトン CLI QA
 * - 文書関連ページの HTTP / コンテンツチェック
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
    name: '文書管理ページ検証',
    file: 'test-documents.js'
  }
];

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
      BASE_URL: `http://${HOST}:${PORT}`,
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
  console.log('🚦 UC-04 文書管理 CLI QA を開始します');
  console.log(`対象サーバー: http://${HOST}:${PORT}`);

  const ready = await waitForServer();
  if (!ready) {
    console.error(`\n❌ サーバー http://${HOST}:${PORT} に接続できません。開発サーバーを起動してから再実行してください。`);
    process.exit(1);
  }

  for (const script of scripts) {
    const success = runScript(script);
    if (!success) {
      process.exit(1);
    }
  }

  console.log('\n🎉 UC-04 文書管理 CLI QA がすべて成功しました');
}

main().catch(error => {
  console.error('❌ 想定外のエラーが発生しました:', error);
  process.exit(1);
});
