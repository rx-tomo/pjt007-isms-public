#!/usr/bin/env node
/**
 * UC-03 ホームダッシュボード／統計カードの CLI QA
 * - ホームページの多言語表示確認
 * - 主要ページの 404/500 チェック
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
    name: 'ホームダッシュボード i18n チェック',
    file: 'test-dashboard.js'
  },
  {
    name: '主要ページ 404/500 チェック',
    file: 'test-all-pages.js',
    extraEnv: {
      QA_SERVER_PORT: String(PORT)
    }
  },
  {
    name: 'ホームダッシュボード フェールセーフ検証 (Playwright)',
    command: ['npx', 'playwright', 'test', 'tests/e2e/home-failsafe.spec.ts', '--reporter=line'],
    extraEnv: {
      PLAYWRIGHT_SKIP_WEB_SERVER: '1'
    }
  },
  {
    name: 'ホームサイドバー折りたたみ QA (Playwright)',
    command: ['npx', 'playwright', 'test', 'tests/e2e/home-sidebar-behavior.spec.ts', '--reporter=line'],
    extraEnv: {
      PLAYWRIGHT_SKIP_WEB_SERVER: '1'
    }
  },
  {
    name: 'ホーム活動ログ QA',
    command: ['node', path.join(__dirname, 'qa-home-activity-feed.js')],
    extraEnv: {
      QA_SERVER_HOST: HOST,
      QA_SERVER_PORT: String(PORT)
    }
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
        BASE_URL: `http://${HOST}:${PORT}`,
        E2E_MODE: '1',
        NEXT_PUBLIC_E2E_MODE: '1',
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
  console.log('🚦 UC-03 ホームダッシュボード CLI QA を開始します');
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

  console.log('\n🎉 UC-03 ホームダッシュボード CLI QA がすべて成功しました');
}

main().catch(error => {
  console.error('❌ 想定外のエラーが発生しました:', error);
  process.exit(1);
});
