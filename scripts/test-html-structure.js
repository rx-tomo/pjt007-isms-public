#!/usr/bin/env node

/**
 * HTMLドキュメント構造をチェックするテストスクリプト
 * Puppeteerを使用してブラウザで実際にレンダリングされたHTMLを確認
 */

const puppeteer = require('puppeteer');

const PORT = 3007;
const BASE_URL = `http://localhost:${PORT}`;

// テスト対象のページ
const testPages = [
  '/ja',
  '/ja/auth/signup',
  '/en/auth/signup',
  '/ja/home',
  '/ja/settings/profile'
];

// テスト結果
const results = {
  passed: [],
  failed: []
};

async function testPage(browser, path) {
  const page = await browser.newPage();
  const fullUrl = `${BASE_URL}${path}`;
  
  try {
    // コンソールメッセージを記録
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    // ページエラーを記録
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.toString());
    });

    // ページにアクセス
    const response = await page.goto(fullUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const status = response.status();
    const html = await page.content();
    
    // HTML構造の問題をチェック
    const issues = [];

    // Next.jsのエラーオーバーレイをチェック
    const errorOverlay = await page.$('#__next-build-error');
    if (errorOverlay) {
      const errorText = await page.evaluate(el => el.textContent, errorOverlay);
      issues.push(`Next.js Error: ${errorText}`);
    }

    // 必須のHTML要素をチェック
    const hasHtml = await page.$('html') !== null;
    const hasBody = await page.$('body') !== null;
    const hasHead = await page.$('head') !== null;
    
    if (!hasHtml) issues.push('Missing <html> tag');
    if (!hasBody) issues.push('Missing <body> tag');
    if (!hasHead) issues.push('Missing <head> tag');

    // langアトリビュートをチェック
    const lang = await page.evaluate(() => {
      const htmlElement = document.querySelector('html');
      return htmlElement ? htmlElement.getAttribute('lang') : null;
    });
    
    if (!lang) {
      issues.push('Missing lang attribute on <html> tag');
    }

    // タイトルをチェック
    const title = await page.title();
    if (!title) {
      issues.push('Missing or empty <title> tag');
    }

    // エラーメッセージをチェック
    if (html.includes('Missing required html tags')) {
      issues.push('Next.js Error: Missing required html tags');
    }

    // コンソールエラーを追加
    if (consoleMessages.length > 0) {
      consoleMessages.forEach(msg => {
        issues.push(`Console Error: ${msg}`);
      });
    }

    // ページエラーを追加
    if (pageErrors.length > 0) {
      pageErrors.forEach(err => {
        issues.push(`Page Error: ${err}`);
      });
    }

    // 結果を記録
    const result = {
      path,
      status,
      issues,
      title,
      lang
    };

    if (issues.length === 0 && status === 200) {
      results.passed.push(result);
    } else {
      results.failed.push(result);
    }

  } catch (error) {
    results.failed.push({
      path,
      status: 'ERROR',
      issues: [`Test Error: ${error.message}`]
    });
  } finally {
    await page.close();
  }
}

async function runTests() {
  console.log('========================================');
  console.log('🔍 HTML構造テスト (Puppeteer使用)');
  console.log('========================================\n');

  // Puppeteerがインストールされているか確認
  try {
    require('puppeteer');
  } catch (e) {
    console.error('❌ エラー: puppeteerがインストールされていません');
    console.error('   以下のコマンドを実行してください:');
    console.error('   npm install --save-dev puppeteer');
    process.exit(1);
  }

  // ブラウザを起動
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (e) {
    console.error('❌ エラー: ブラウザの起動に失敗しました');
    console.error(`   ${e.message}`);
    process.exit(1);
  }

  console.log('✅ Puppeteerブラウザを起動しました\n');
  console.log('📝 テスト実行中...\n');

  // 各ページをテスト
  for (const page of testPages) {
    process.stdout.write(`Testing ${page}... `);
    await testPage(browser, page);
    
    const result = [...results.passed, ...results.failed].find(r => r.path === page);
    
    if (results.passed.find(r => r.path === page)) {
      console.log(`✅ OK (${result.status}) - lang="${result.lang}", title="${result.title}"`);
    } else {
      console.log(`❌ FAILED (${result.status})`);
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => {
          console.log(`   └─ ${issue}`);
        });
      }
    }
  }

  // ブラウザを閉じる
  await browser.close();

  // 結果サマリー
  console.log('\n========================================');
  console.log('📊 テスト結果サマリー');
  console.log('========================================\n');

  console.log(`✅ 成功: ${results.passed.length}/${testPages.length}`);
  console.log(`❌ 失敗: ${results.failed.length}/${testPages.length}`);

  // 失敗の詳細
  if (results.failed.length > 0) {
    console.log('\n❌ 失敗したページの詳細:');
    results.failed.forEach(({ path, status, issues }) => {
      console.log(`\n   ${path} (Status: ${status})`);
      if (issues && issues.length > 0) {
        console.log('     問題:');
        issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      }
    });
  }

  // 全体の成否
  console.log('\n========================================');
  if (results.failed.length === 0) {
    console.log('✅ すべてのテストが成功しました！');
    process.exit(0);
  } else {
    console.log('❌ 一部のテストが失敗しました');
    console.log('\n💡 対処法:');
    console.log('   - Missing required html tags: ルートレイアウトでHTMLタグが正しく提供されているか確認');
    console.log('   - Missing lang attribute: locale layoutでlang属性が設定されているか確認');
    console.log('   - Console/Page Errors: 開発者ツールでエラーの詳細を確認');
    process.exit(1);
  }
}

// テスト実行
runTests().catch(console.error);