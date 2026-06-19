#!/usr/bin/env node
/**
 * UC-06 タスク運用 CLI QA
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
    name: 'タスク管理ページ検証',
    file: 'test-tasks.js'
  },
  {
    name: 'タスクE2Eリグレッション (Playwright)',
    command: ['npx', 'playwright', 'test', 'tests/e2e/tasks.spec.ts', '--reporter=line'],
    extraEnv: {
      PLAYWRIGHT_SKIP_WEB_SERVER: '1'
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

function runScript({ name, file, command, extraEnv = {} }) {
  console.log(`\n=== ${name} を実行します ===`);

  let result;
  if (file) {
    const scriptPath = path.join(__dirname, file);
    result = spawnSync('node', [scriptPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        QA_SERVER_HOST: HOST,
        QA_SERVER_PORT: String(PORT),
        ...extraEnv
      }
    });
  } else if (command) {
    const [cmd, ...args] = command;
    result = spawnSync(cmd, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        QA_SERVER_HOST: HOST,
        QA_SERVER_PORT: String(PORT),
        PLAYWRIGHT_TEST_BASE_URL: `http://${HOST}:${PORT}`,
        E2E_MODE: '1',
        NEXT_PUBLIC_E2E_MODE: '1',
        ...extraEnv
      }
    });
  } else {
    throw new Error('file または command のどちらかを指定してください');
  }

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
  console.log('🚦 UC-06 タスク運用 CLI QA を開始します');
  console.log(`対象サーバー: http://${HOST}:${PORT}`);

  const seeded = runDemoSeed('tasks');
  if (!seeded) {
    process.exit(1);
  }

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

  console.log('\n🎉 UC-06 タスク運用 CLI QA がすべて成功しました');
}

main().catch(error => {
  console.error('❌ 想定外のエラーが発生しました:', error);
  process.exit(1);
});
