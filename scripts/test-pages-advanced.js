#!/usr/bin/env node

/**
 * 高度なページテストスクリプト
 * HTTPステータスだけでなく、HTMLの構造やエラーメッセージも検出
 */

const http = require('http');
const https = require('https');
const { JSDOM } = require('jsdom');

const PORT = 3006;
const BASE_URL = `http://localhost:${PORT}`;

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

// HTML構造をチェックする関数
function checkHTMLStructure(html, path) {
  const issues = [];
  
  // Next.jsのエラーメッセージをチェック
  if (html.includes('Missing required html tags')) {
    issues.push('Missing required HTML tags (<html>, <body>)');
  }
  
  if (html.includes('IntlError')) {
    const errorMatch = html.match(/IntlError: ([^<]+)/);
    if (errorMatch) {
      issues.push(`IntlError: ${errorMatch[1].trim()}`);
    }
  }
  
  if (html.includes('Error:')) {
    const errorMatch = html.match(/Error: ([^<]+)/);
    if (errorMatch) {
      issues.push(`Error: ${errorMatch[1].trim()}`);
    }
  }
  
  // JSDOMでHTMLを解析（エラーがない場合のみ）
  if (!html.includes('Error') && !html.includes('error')) {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // 基本的なHTML構造をチェック
      if (!document.querySelector('html')) {
        issues.push('Missing <html> tag');
      }
      
      if (!document.querySelector('body')) {
        issues.push('Missing <body> tag');
      }
      
      if (!document.querySelector('head')) {
        issues.push('Missing <head> tag');
      }
      
      // langアトトリビュートをチェック
      const htmlElement = document.querySelector('html');
      if (htmlElement && !htmlElement.getAttribute('lang')) {
        issues.push('Missing lang attribute on <html> tag');
      }
      
      // タイトルをチェック
      if (!document.querySelector('title')) {
        issues.push('Missing <title> tag');
      }
      
      // Next.jsの開発モードエラーをチェック
      const errorOverlay = document.querySelector('#__next-build-error');
      if (errorOverlay) {
        issues.push('Next.js build error detected');
      }
    } catch (e) {
      // JSDOMパースエラー
      issues.push(`HTML parsing error: ${e.message}`);
    }
  }
  
  // コンソールエラーの痕跡をチェック
  if (html.includes('console.error')) {
    issues.push('Console errors detected');
  }
  
  // React hydrationエラーをチェック
  if (html.includes('Hydration failed') || html.includes('Text content does not match')) {
    issues.push('React hydration error detected');
  }
  
  return issues;
}

// HTTPリクエストを送信する関数
function testPage(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'GET',
      timeout: 10000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Test Bot)'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          path,
          status: res.statusCode,
          headers: res.headers,
          htmlIssues: []
        };

        // HTML構造の問題をチェック
        if (res.statusCode === 200 || res.statusCode === 500) {
          result.htmlIssues = checkHTMLStructure(data, path);
        }

        // リダイレクトの場合
        if (res.statusCode === 302 || res.statusCode === 307) {
          result.redirectTo = res.headers.location;
        }

        if ((res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 307) && result.htmlIssues.length === 0) {
          results.passed.push(result);
        } else {
          results.failed.push(result);
        }
        resolve();
      });
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
  console.log('📋 高度なページテスト開始');
  console.log('========================================\n');

  // JSDOMがインストールされているか確認
  try {
    require('jsdom');
  } catch (e) {
    console.error('❌ エラー: jsdomがインストールされていません');
    console.error('   以下のコマンドを実行してください:');
    console.error('   npm install --save-dev jsdom');
    process.exit(1);
  }

  // サーバー確認
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ エラー: 開発サーバーが起動していません');
    console.error(`   ポート${PORT}でサーバーを起動してください: npm run dev`);
    process.exit(1);
  }

  console.log(`✅ 開発サーバーがポート${PORT}で稼働中\n`);

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
      if (lastResult.htmlIssues && lastResult.htmlIssues.length > 0) {
        lastResult.htmlIssues.forEach(issue => {
          console.log(`   └─ ${issue}`);
        });
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
    console.log('\n❌ 失敗したページの詳細:');
    results.failed.forEach(({ path, status, htmlIssues, redirectTo }) => {
      console.log(`\n   ${path} (Status: ${status})`);
      if (redirectTo) {
        console.log(`     └─ Redirects to: ${redirectTo}`);
      }
      if (htmlIssues && htmlIssues.length > 0) {
        console.log('     └─ HTML構造の問題:');
        htmlIssues.forEach(issue => {
          console.log(`        - ${issue}`);
        });
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
    console.log('   - HTMLタグエラー: レイアウトファイルを確認してください');
    console.log('   - IntlError: 翻訳ファイルのキー構造を確認してください');
    console.log('   - Hydrationエラー: サーバーとクライアントのレンダリング差異を確認してください');
    process.exit(1);
  }
}

// テスト実行
runTests().catch(console.error);