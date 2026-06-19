#!/usr/bin/env node

/**
 * すべてのページが404エラーにならないことを確認するテストスクリプト
 */

const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3006);
const BASE_URL = `http://${HOST}:${PORT}`;

// テスト対象のページ一覧
const testPages = [
  // 多言語対応ルート
  '/ja',
  '/en',
  '/ja/auth/login',
  '/en/auth/login',
  '/ja/auth/signup',
  '/en/auth/signup',
  '/ja/auth/verify-email',
  '/en/auth/verify-email',
  '/ja/home',
  '/en/home',
  '/ja/documents',
  '/en/documents',
  '/ja/documents/new',
  '/en/documents/new',
  '/ja/documents/templates',
  '/en/documents/templates',
  '/ja/risks',
  '/en/risks',
  '/ja/risks/new',
  '/en/risks/new',
  '/ja/tasks',
  '/en/tasks',
  '/ja/tasks/new',
  '/en/tasks/new',
  '/ja/audit',
  '/en/audit',
  '/ja/audit/reports',
  '/en/audit/reports',
  '/ja/audit/plans/new',
  '/en/audit/plans/new',
  '/ja/pricing',
  '/en/pricing',
  '/ja/settings/profile',
  '/en/settings/profile',
  '/ja/settings/organization',
  '/en/settings/organization',
  '/ja/settings/users',
  '/en/settings/users',
  '/ja/settings/subscription',
  '/en/settings/subscription',
  '/ja/dev-login',
  '/en/dev-login'
];

// テスト結果を格納
const results = {
  passed: [],
  failed: [],
  errors: []
};

// HTTPリクエストを送信する関数
function testPage(path, attempt = 1) {
  return new Promise((resolve) => {
    let settled = false;
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'GET',
      timeout: Number(process.env.QA_PAGE_TIMEOUT_MS || 15000)
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;
        const result = {
          path,
          status: res.statusCode,
          headers: res.headers
        };

        // エラー内容を確認
        if (res.statusCode === 500 && data.includes('IntlError')) {
          result.error = 'IntlError detected';
          result.errorDetail = data.match(/IntlError: [^<]+/)?.[0] || 'Unknown IntlError';
        }

        if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 307) {
          results.passed.push(result);
        } else {
          results.failed.push(result);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (attempt < 2) {
        setTimeout(() => {
          testPage(path, attempt + 1).then(resolve);
        }, 500);
        return;
      }
      results.errors.push({ path, error: err.message });
      resolve();
    });

    req.on('timeout', () => {
      if (settled) return;
      settled = true;
      req.destroy();
      if (attempt < 2) {
        setTimeout(() => {
          testPage(path, attempt + 1).then(resolve);
        }, 500);
        return;
      }
      results.errors.push({ path, error: 'Request timeout' });
      resolve();
    });

    req.end();
  });
}

// サーバーが起動しているか確認
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(BASE_URL, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });
  });
}

// メインテスト関数
async function runTests() {
  console.log('========================================');
  console.log('📋 ページアクセステスト開始');
  console.log('========================================\n');

  // サーバー確認
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ エラー: 開発サーバーが起動していません');
    console.error(`   サーバーを http://${HOST}:${PORT} で起動してください (例: npm run dev)`);
    process.exit(1);
  }

  console.log(`✅ 開発サーバーが http://${HOST}:${PORT} で稼働中\n`);

  // 各ページをテスト
  console.log('📝 テスト実行中...\n');

  for (const page of testPages) {
    process.stdout.write(`Testing ${page}... `);
    await testPage(page);

    const lastResult = [...results.passed, ...results.failed, ...results.errors]
      .find(r => r.path === page);

    if (results.passed.find(r => r.path === page)) {
      console.log(`✅ OK (${lastResult.status})`);
    } else if (results.failed.find(r => r.path === page)) {
      console.log(`❌ FAILED (${lastResult.status})`);
      if (lastResult.error) {
        console.log(`   └─ ${lastResult.errorDetail || lastResult.error}`);
      }
    } else {
      console.log(`⚠️  ERROR`);
      const error = results.errors.find(r => r.path === page);
      if (error) {
        console.log(`   └─ ${error.error}`);
      }
    }
  }

  // 結果サマリー
  console.log('\n========================================');
  console.log('📊 テスト結果サマリー');
  console.log('========================================\n');

  console.log(`✅ 成功: ${results.passed.length}/${testPages.length}`);
  console.log(`❌ 失敗: ${results.failed.length}/${testPages.length}`);
  console.log(`⚠️  エラー: ${results.errors.length}/${testPages.length}`);

  // 失敗の詳細
  if (results.failed.length > 0) {
    console.log('\n❌ 失敗したページ:');
    results.failed.forEach(({ path, status, error, errorDetail }) => {
      console.log(`   - ${path} (Status: ${status})`);
      if (error) {
        console.log(`     └─ ${errorDetail || error}`);
      }
    });
  }

  // エラーの詳細
  if (results.errors.length > 0) {
    console.log('\n⚠️  エラーが発生したページ:');
    results.errors.forEach(({ path, error }) => {
      console.log(`   - ${path}: ${error}`);
    });
  }

  // 全体の成否
  console.log('\n========================================');
  if (results.failed.length === 0 && results.errors.length === 0) {
    console.log('✅ すべてのテストが成功しました！');
    process.exit(0);
  } else {
    console.log('❌ 一部のテストが失敗しました');
    console.log('\n💡 ヒント:');
    console.log('   - IntlErrorが発生している場合は、翻訳ファイルのキー構造を確認してください');
    console.log('   - 404エラーの場合は、ルーティング設定を確認してください');
    console.log('   - タイムアウトの場合は、サーバーの応答速度を確認してください');
    process.exit(1);
  }
}

// テスト実行
runTests().catch(console.error);
