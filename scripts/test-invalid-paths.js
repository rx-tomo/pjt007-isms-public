#!/usr/bin/env node

/**
 * 無効なパス・よくある間違いパスのテストスクリプト
 * 404エラーが期待される不正なパスをテスト
 */

const http = require('http');

const PORT = 3007;

// 404が期待される不正なパス
const invalidPaths = [
  '/ja/signup',           // 正しくは /ja/auth/signup
  '/ja/login',            // 正しくは /ja/auth/login
  '/en/signup',           // 正しくは /en/auth/signup  
  '/en/login',            // 正しくは /en/auth/login
  '/ja/register',         // 存在しないパス
  '/ja/signin',           // 存在しないパス
  '/ja/document',         // 正しくは /ja/documents (複数形)
  '/ja/risk',             // 正しくは /ja/risks (複数形)
  '/ja/task',             // 正しくは /ja/tasks (複数形)
  '/profile',             // 正しくは /ja/settings/profile
  '/settings',            // 正しくは /ja/settings/profile
  '/home',           // 正しくは /ja/home
  '/ja/setting',          // 正しくは /ja/settings (複数形)
];

// テスト結果
const results = {
  correctResponse: [],  // 正しく404またはリダイレクト(307/308)を返したパス
  unexpected200: [],    // 予期しない200レスポンス
  errors: []            // その他のエラー
};

function testPath(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      const result = {
        path,
        status: res.statusCode,
        location: res.headers.location
      };

      // 404は常に正常。307/308はリダイレクト先が auth または locale-prefixed パスの場合のみ正常動作
      const loc = res.headers.location || '';
      const isAuthRedirect = loc.includes('/auth/') || loc.includes('/auth');
      const isLocaleRedirect = /^\/(ja|en|zh)\//.test(loc);
      if (
        res.statusCode === 404 ||
        ((res.statusCode === 307 || res.statusCode === 308) && (isAuthRedirect || isLocaleRedirect))
      ) {
        results.correctResponse.push(result);
      } else {
        results.unexpected200.push(result);
      }
      resolve();
    });

    req.on('error', (err) => {
      results.errors.push({ path, error: err.message });
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      results.errors.push({ path, error: 'Request timeout' });
      resolve();
    });

    req.end();
  });
}

async function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}`, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('========================================');
  console.log('🚫 無効パステスト開始');
  console.log('========================================\\n');

  // サーバー確認
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ エラー: 開発サーバーが起動していません');
    console.error(`   ポート${PORT}でサーバーを起動してください: npm run dev`);
    process.exit(1);
  }

  console.log(`✅ 開発サーバーがポート${PORT}で稼働中\\n`);
  console.log('📝 無効パステスト実行中...\\n');

  // 各パスをテスト
  for (const path of invalidPaths) {
    process.stdout.write(`Testing ${path}... `);
    await testPath(path);

    const result = [...results.correctResponse, ...results.unexpected200, ...results.errors]
      .find(r => r.path === path);

    if (results.correctResponse.find(r => r.path === path)) {
      console.log(`✅ ${result.status} (404/307/308 正常)`);
    } else if (results.unexpected200.find(r => r.path === path)) {
      console.log(`⚠️  ${result.status} (予期しないレスポンス)`);
      if (result.location) {
        console.log(`   └─ Redirects to: ${result.location}`);
      }
    } else {
      console.log(`❌ ERROR`);
      const error = results.errors.find(r => r.path === path);
      if (error) {
        console.log(`   └─ ${error.error}`);
      }
    }
  }

  // 結果サマリー
  console.log('\\n========================================');
  console.log('📊 テスト結果サマリー');
  console.log('========================================\\n');

  console.log(`✅ 正しく404/リダイレクトを返したパス: ${results.correctResponse.length}/${invalidPaths.length}`);
  console.log(`⚠️  予期しないレスポンス: ${results.unexpected200.length}/${invalidPaths.length}`);
  console.log(`❌ エラー: ${results.errors.length}/${invalidPaths.length}`);

  // 予期しないレスポンスの詳細
  if (results.unexpected200.length > 0) {
    console.log('\\n⚠️  予期しないレスポンスの詳細:');
    results.unexpected200.forEach(({ path, status, location }) => {
      console.log(`   ${path} → ${status}${location ? ` (→ ${location})` : ''}`);
    });
    console.log('\\n💡 これらのパスは404を返すべきですが、実際には200やリダイレクトが発生しています。');
    console.log('   ルーティング設定を確認してください。');
  }

  // エラーの詳細
  if (results.errors.length > 0) {
    console.log('\\n❌ エラーが発生したパス:');
    results.errors.forEach(({ path, error }) => {
      console.log(`   - ${path}: ${error}`);
    });
  }

  // 全体の成否
  console.log('\\n========================================');
  if (results.unexpected200.length === 0 && results.errors.length === 0) {
    console.log('✅ すべての無効パスが正しく404/リダイレクトを返しています！');
    process.exit(0);
  } else {
    console.log('⚠️  一部のパスで予期しない動作が発生しています');
    console.log('\\n📖 詳細は docs/qa-guidelines.md を参照してください');
    process.exit(1);
  }
}

// テスト実行
runTests().catch(console.error);