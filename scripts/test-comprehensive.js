/**
 * 包括的なテストスクリプト
 * UI/UX評価レポートに基づいた実際の実装状況をテスト
 */

const http = require('http');
const https = require('https');

// 実際に実装されているルートと期待される動作
const implementedRoutes = [
  { 
    path: '/', 
    expectedRedirect: '/ja',
    description: 'ルートパスは日本語にリダイレクト'
  },
  { 
    path: '/ja', 
    expectedStatus: 200,
    expectedContent: ['Riscala AI for ISMS', 'ISO/IEC 27001'],
    description: '日本語ランディングページ'
  },
  { 
    path: '/en', 
    expectedStatus: 200,
    expectedContent: ['Riscala AI for ISMS', 'ISO/IEC 27001'],
    description: '英語ランディングページ'
  },
];

// 未実装だが開発計画にあるルート（404が期待される）
const plannedButNotImplementedRoutes = [
  { path: '/ja/auth/login', description: 'ログインページ（未実装）' },
  { path: '/ja/auth/signup', description: 'サインアップページ（未実装）' },
  { path: '/ja/home', description: 'ダッシュボード（未実装）' },
  { path: '/ja/documents', description: '文書管理（未実装）' },
  { path: '/ja/risks', description: 'リスクアセスメント（未実装）' },
  { path: '/ja/tasks', description: 'タスク管理（未実装）' },
  { path: '/ja/audit', description: '監査チェックリスト（未実装）' },
  { path: '/ja/dev-login', description: '開発用擬似ログイン（未実装）' },
  { path: '/en/auth/login', description: '英語ログインページ（未実装）' },
  { path: '/en/home', description: '英語ダッシュボード（未実装）' },
];

// エラーパスのテスト（404が期待される）
const errorPaths = [
  { path: '/invalid-path', description: '存在しないパス' },
  { path: '/ja/invalid', description: '存在しない日本語パス' },
  { path: '/fr', description: 'サポートされていない言語' },
];

const testRoute = (route, expectNotFound = false) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: route.path,
      method: 'GET',
      timeout: 5000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        let result = {
          path: route.path,
          description: route.description,
          status: res.statusCode,
          location: res.headers.location,
          success: false,
          message: '',
          contentChecks: []
        };

        // 404が期待される場合
        if (expectNotFound) {
          if (res.statusCode === 404) {
            result.success = true;
            result.message = `✓ 期待通り404エラー`;
          } else {
            result.message = `✗ 404が期待されましたが、ステータス: ${res.statusCode}`;
          }
        }
        // リダイレクトが期待される場合
        else if (route.expectedRedirect) {
          if (res.statusCode === 307 || res.statusCode === 308) {
            if (res.headers.location && res.headers.location.includes(route.expectedRedirect)) {
              result.success = true;
              result.message = `✓ リダイレクト成功: ${route.expectedRedirect}`;
            } else {
              result.message = `✗ 期待したリダイレクト先と異なる: ${res.headers.location}`;
            }
          } else {
            result.message = `✗ リダイレクトが期待されましたが、ステータス: ${res.statusCode}`;
          }
        }
        // 通常のステータスコードが期待される場合
        else if (route.expectedStatus) {
          if (res.statusCode === route.expectedStatus) {
            result.success = true;
            result.message = `✓ ステータスコード: ${res.statusCode}`;
            
            // コンテンツチェック
            if (route.expectedContent && route.expectedContent.length > 0) {
              result.contentChecks = route.expectedContent.map(content => {
                const found = body.includes(content);
                return {
                  content: content,
                  found: found,
                  message: found ? `✓ "${content}" が見つかりました` : `✗ "${content}" が見つかりません`
                };
              });
              
              const allContentFound = result.contentChecks.every(check => check.found);
              if (!allContentFound) {
                result.success = false;
                result.message += ' (一部のコンテンツが見つかりません)';
              }
            }
          } else {
            result.message = `✗ 期待: ${route.expectedStatus}, 実際: ${res.statusCode}`;
          }
        }

        resolve(result);
      });
    });

    req.on('error', (e) => {
      resolve({
        path: route.path,
        description: route.description,
        status: 'error',
        success: false,
        message: `✗ エラー: ${e.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        path: route.path,
        description: route.description,
        status: 'timeout',
        success: false,
        message: '✗ タイムアウト'
      });
    });

    req.end();
  });
};

const runTests = async () => {
  console.log('=================================');
  console.log('包括的テストを開始します');
  console.log('=================================\n');
  
  let totalSuccess = 0;
  let totalFail = 0;

  // 1. 実装済みルートのテスト
  console.log('【実装済みルートのテスト】');
  console.log('------------------------');
  for (const route of implementedRoutes) {
    const result = await testRoute(route);
    console.log(`\n${result.description}:`);
    console.log(`  パス: ${result.path}`);
    console.log(`  結果: ${result.message}`);
    
    if (result.contentChecks && result.contentChecks.length > 0) {
      console.log('  コンテンツチェック:');
      result.contentChecks.forEach(check => {
        console.log(`    ${check.message}`);
      });
    }
    
    if (result.success) {
      totalSuccess++;
    } else {
      totalFail++;
    }
  }

  // 2. 未実装ルートのテスト（404チェック）
  console.log('\n\n【未実装ルートの404チェック】');
  console.log('----------------------------');
  for (const route of plannedButNotImplementedRoutes) {
    const result = await testRoute(route, true);
    console.log(`${result.description}: ${result.path} - ${result.message}`);
    
    if (result.success) {
      totalSuccess++;
    } else {
      totalFail++;
    }
  }

  // 3. エラーパスのテスト
  console.log('\n\n【エラーパスのテスト】');
  console.log('--------------------');
  for (const route of errorPaths) {
    const result = await testRoute(route, true);
    console.log(`${result.description}: ${result.path} - ${result.message}`);
    
    if (result.success) {
      totalSuccess++;
    } else {
      totalFail++;
    }
  }

  // 結果サマリー
  console.log('\n\n=================================');
  console.log('テスト結果サマリー');
  console.log('=================================');
  console.log(`総テスト数: ${totalSuccess + totalFail}`);
  console.log(`成功: ${totalSuccess}`);
  console.log(`失敗: ${totalFail}`);
  console.log(`成功率: ${Math.round((totalSuccess / (totalSuccess + totalFail)) * 100)}%`);
  
  if (totalFail > 0) {
    console.log('\n⚠️  いくつかのテストが失敗しました。');
    console.log('注: 未実装ページは404を返すことが期待されています。');
    process.exit(1);
  } else {
    console.log('\n✅ すべてのテストが成功しました！');
  }
};

// テスト実行前の待機時間
console.log('サーバーの起動を待っています...');
setTimeout(runTests, 2000);