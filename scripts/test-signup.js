const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// カラー出力用のヘルパー関数
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

// テスト用の一意のメールアドレスを生成
function generateTestEmail() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `test.user.${timestamp}.${random}@example.com`;
}

async function testSignupFlow() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  try {
    const page = await browser.newPage();
    
    // ビューポートを設定
    await page.setViewport({ width: 1280, height: 800 });

    logSection('新規登録フローのテスト');

    // テスト1: 新規登録ページへのアクセス
    testResults.total++;
    try {
      log('テスト1: 新規登録ページへのアクセス', 'yellow');
      await page.goto('http://localhost:3006/ja/auth/signup', { waitUntil: 'networkidle2' });
      
      // ページタイトルを確認
      const title = await page.title();
      log(`  ページタイトル: ${title}`, 'magenta');
      
      // 新規登録フォームの存在を確認
      const signupForm = await page.$('form');
      if (signupForm) {
        log('  ✓ 新規登録フォームが表示されています', 'green');
        testResults.passed++;
      } else {
        throw new Error('新規登録フォームが見つかりません');
      }
    } catch (error) {
      log(`  ✗ エラー: ${error.message}`, 'red');
      testResults.failed++;
      testResults.errors.push({ test: '新規登録ページへのアクセス', error: error.message });
    }

    // テスト2: 必須項目の検証
    testResults.total++;
    try {
      log('\nテスト2: 必須項目の検証', 'yellow');
      
      // 空のフォームで送信ボタンをクリック
      const submitButton = await page.$('button[type="submit"]');
      await submitButton.click();
      
      // HTML5バリデーションメッセージを確認
      await page.waitForTimeout(1000);
      
      // フィールドが必須であることを確認
      const requiredFields = ['fullName', 'organizationName', 'email', 'password', 'confirmPassword'];
      let allRequired = true;
      
      for (const fieldName of requiredFields) {
        const field = await page.$(`input[name="${fieldName}"]`);
        const isRequired = await page.evaluate(el => el.hasAttribute('required'), field);
        if (!isRequired) {
          allRequired = false;
          log(`  ✗ ${fieldName}フィールドが必須になっていません`, 'red');
        }
      }
      
      if (allRequired) {
        log('  ✓ すべての必須フィールドが正しく設定されています', 'green');
        testResults.passed++;
      } else {
        throw new Error('一部のフィールドが必須になっていません');
      }
    } catch (error) {
      log(`  ✗ エラー: ${error.message}`, 'red');
      testResults.failed++;
      testResults.errors.push({ test: '必須項目の検証', error: error.message });
    }

    // テスト3: パスワード不一致エラーの確認
    testResults.total++;
    try {
      log('\nテスト3: パスワード不一致エラーの確認', 'yellow');
      
      // フォームに入力
      await page.type('input[name="fullName"]', 'テスト太郎');
      await page.type('input[name="organizationName"]', 'テスト株式会社');
      await page.type('input[name="email"]', generateTestEmail());
      await page.type('input[name="password"]', 'TestPassword123!');
      await page.type('input[name="confirmPassword"]', 'DifferentPassword123!');
      
      // 利用規約に同意
      await page.click('input[name="agreeToTerms"]');
      
      // 送信
      await page.click('button[type="submit"]');
      
      // エラーメッセージを待つ
      await page.waitForSelector('.bg-red-50', { timeout: 5000 });
      
      const errorText = await page.$eval('.bg-red-50 .text-red-800', el => el.textContent);
      if (errorText.includes('パスワードが一致しません')) {
        log('  ✓ パスワード不一致エラーが正しく表示されました', 'green');
        testResults.passed++;
      } else {
        throw new Error(`予期しないエラーメッセージ: ${errorText}`);
      }
    } catch (error) {
      log(`  ✗ エラー: ${error.message}`, 'red');
      testResults.failed++;
      testResults.errors.push({ test: 'パスワード不一致エラーの確認', error: error.message });
    }

    // テスト4: 利用規約未同意エラーの確認
    testResults.total++;
    try {
      log('\nテスト4: 利用規約未同意エラーの確認', 'yellow');
      
      // ページをリロード
      await page.reload({ waitUntil: 'networkidle2' });
      
      // フォームに入力（利用規約に同意しない）
      await page.type('input[name="fullName"]', 'テスト太郎');
      await page.type('input[name="organizationName"]', 'テスト株式会社');
      await page.type('input[name="email"]', generateTestEmail());
      await page.type('input[name="password"]', 'TestPassword123!');
      await page.type('input[name="confirmPassword"]', 'TestPassword123!');
      
      // 送信
      await page.click('button[type="submit"]');
      
      // エラーメッセージを待つ
      await page.waitForSelector('.bg-red-50', { timeout: 5000 });
      
      const errorText = await page.$eval('.bg-red-50 .text-red-800', el => el.textContent);
      if (errorText.includes('利用規約に同意する必要があります')) {
        log('  ✓ 利用規約未同意エラーが正しく表示されました', 'green');
        testResults.passed++;
      } else {
        throw new Error(`予期しないエラーメッセージ: ${errorText}`);
      }
    } catch (error) {
      log(`  ✗ エラー: ${error.message}`, 'red');
      testResults.failed++;
      testResults.errors.push({ test: '利用規約未同意エラーの確認', error: error.message });
    }

    // テスト5: 正常な登録フロー
    testResults.total++;
    try {
      log('\nテスト5: 正常な登録フロー', 'yellow');
      
      // ページをリロード
      await page.reload({ waitUntil: 'networkidle2' });
      
      const testEmail = generateTestEmail();
      
      // フォームに正しい情報を入力
      await page.type('input[name="fullName"]', 'テスト太郎');
      await page.type('input[name="organizationName"]', 'テスト株式会社');
      await page.type('input[name="email"]', testEmail);
      await page.type('input[name="password"]', 'TestPassword123!');
      await page.type('input[name="confirmPassword"]', 'TestPassword123!');
      
      // 利用規約に同意
      await page.click('input[name="agreeToTerms"]');
      
      log(`  テスト用メールアドレス: ${testEmail}`, 'magenta');
      
      // 送信
      await page.click('button[type="submit"]');
      
      // ローディング状態を確認
      const isLoading = await page.waitForSelector('button[type="submit"] svg.animate-spin', { timeout: 2000 })
        .then(() => true)
        .catch(() => false);
      
      if (isLoading) {
        log('  ✓ ローディング状態が表示されました', 'green');
      }
      
      // verify-emailページへのリダイレクトを待つ（または、エラーメッセージ）
      await page.waitForFunction(
        () => window.location.pathname.includes('/auth/verify-email') || document.querySelector('.bg-red-50'),
        { timeout: 10000 }
      );
      
      const currentUrl = page.url();
      if (currentUrl.includes('/auth/verify-email')) {
        log('  ✓ メール確認ページにリダイレクトされました', 'green');
        
        // メールアドレスがURLパラメータに含まれているか確認
        if (currentUrl.includes(encodeURIComponent(testEmail))) {
          log('  ✓ メールアドレスがURLパラメータに正しく含まれています', 'green');
        }
        
        testResults.passed++;
      } else {
        // エラーメッセージを確認
        const errorElement = await page.$('.bg-red-50 .text-red-800');
        if (errorElement) {
          const errorText = await page.evaluate(el => el.textContent, errorElement);
          throw new Error(`登録エラー: ${errorText}`);
        } else {
          throw new Error('予期しない結果: verify-emailページにリダイレクトされませんでした');
        }
      }
    } catch (error) {
      log(`  ✗ エラー: ${error.message}`, 'red');
      testResults.failed++;
      testResults.errors.push({ test: '正常な登録フロー', error: error.message });
    }

    // テスト6: 英語版での新規登録ページ
    testResults.total++;
    try {
      log('\nテスト6: 英語版での新規登録ページ', 'yellow');
      await page.goto('http://localhost:3006/en/auth/signup', { waitUntil: 'networkidle2' });
      
      // 英語のテキストを確認
      const pageContent = await page.content();
      if (pageContent.includes('Sign up') || pageContent.includes('Create account')) {
        log('  ✓ 英語版のページが正しく表示されています', 'green');
        testResults.passed++;
      } else {
        throw new Error('英語版のテキストが見つかりません');
      }
    } catch (error) {
      log(`  ✗ エラー: ${error.message}`, 'red');
      testResults.failed++;
      testResults.errors.push({ test: '英語版での新規登録ページ', error: error.message });
    }

  } catch (error) {
    log(`\n致命的なエラー: ${error.message}`, 'red');
    testResults.errors.push({ test: '全体', error: error.message });
  } finally {
    await browser.close();
    
    // テスト結果のサマリー
    logSection('テスト結果サマリー');
    log(`総テスト数: ${testResults.total}`);
    log(`成功: ${testResults.passed}`, 'green');
    log(`失敗: ${testResults.failed}`, 'red');
    
    if (testResults.errors.length > 0) {
      log('\n失敗したテスト:', 'red');
      testResults.errors.forEach((err, index) => {
        log(`  ${index + 1}. ${err.test}: ${err.error}`, 'red');
      });
    }
    
    // 終了コード
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

// 開発サーバーが起動していることを確認
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:3006');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// メイン実行
(async () => {
  log('新規登録機能のテストを開始します...', 'blue');
  
  const serverRunning = await checkDevServer();
  if (!serverRunning) {
    log('\n開発サーバーが起動していません。', 'red');
    log('以下のコマンドで開発サーバーを起動してください:', 'yellow');
    log('  npm run dev', 'yellow');
    process.exit(1);
  }
  
  await testSignupFlow();
})();