#!/usr/bin/env node

/**
 * 翻訳レンダリング検証スクリプト
 * 実際にページを開いてハードコードされた翻訳キーが表示されていないか確認
 */

const puppeteer = require('puppeteer');

const TEST_URL = process.env.TEST_URL || 'http://localhost:3006';

async function checkTranslationKeys(page) {
  // Find any text content that looks like a translation key
  const translationKeyPattern = /\b(common|auth|landing|home|settings|documents|risks|tasks|audit|pricing|notifications)\.[a-zA-Z0-9_.]+\b/g;
  
  const pageContent = await page.evaluate(() => document.body.innerText);
  const matches = pageContent.match(translationKeyPattern) || [];
  
  return matches;
}

async function main() {
  console.log('========================================');
  console.log('🔍 翻訳レンダリング検証');
  console.log('========================================\n');
  console.log(`テストURL: ${TEST_URL}\n`);

  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const pagesToCheck = [
      { path: '/ja', name: 'ホームページ（日本語）' },
      { path: '/en', name: 'Homepage (English)' },
      { path: '/ja/auth/login', name: 'ログインページ' },
      { path: '/ja/auth/signup', name: 'サインアップページ' },
    ];

    let totalIssues = 0;

    for (const pageInfo of pagesToCheck) {
      console.log(`\n📄 ${pageInfo.name} をチェック中...`);
      
      try {
        await page.goto(`${TEST_URL}${pageInfo.path}`, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });

        // Wait a bit for any client-side rendering
        await page.waitForTimeout(1000);

        const translationKeys = await checkTranslationKeys(page);
        
        if (translationKeys.length > 0) {
          console.log(`❌ 翻訳キーが表示されています:`);
          translationKeys.forEach(key => {
            console.log(`   - ${key}`);
          });
          totalIssues += translationKeys.length;
        } else {
          console.log(`✅ 翻訳キーの表示なし`);
        }

        // Also check for specific known issues
        const loginButtonText = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const loginButton = buttons.find(el => el.textContent?.includes('common.login'));
          return loginButton ? loginButton.textContent : null;
        });

        if (loginButtonText) {
          console.log(`❌ ログインボタンに翻訳キーが表示されています: "${loginButtonText}"`);
          totalIssues++;
        }

      } catch (error) {
        console.log(`⚠️  エラー: ${error.message}`);
      }
    }

    console.log('\n========================================');
    if (totalIssues === 0) {
      console.log('✅ すべてのページで翻訳が正しく表示されています！');
    } else {
      console.log(`❌ ${totalIssues}個の翻訳表示問題が見つかりました`);
      console.log('\n💡 修正方法:');
      console.log('1. コンポーネントでuseTranslations()が正しく呼ばれているか確認');
      console.log('2. NextIntlClientProviderでメッセージが渡されているか確認');
      console.log('3. 翻訳ファイルにキーが存在するか確認');
    }

  } catch (error) {
    console.error('❌ スクリプトエラー:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run if server is available
const http = require('http');
const checkServer = () => {
  return new Promise((resolve) => {
    http.get(TEST_URL, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
};

checkServer().then(isRunning => {
  if (!isRunning) {
    console.log('⚠️  開発サーバーが起動していません');
    console.log('以下のコマンドでサーバーを起動してください:');
    console.log('  npm run dev');
    process.exit(1);
  } else {
    main();
  }
});
