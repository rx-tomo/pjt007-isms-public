#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_SCRIPTS = [
  {
    name: 'TypeScript/構文エラーテスト',
    script: 'test-typescript-errors.js',
    description: 'TypeScript型チェック、ESLint、ビルドテスト、未定義変数検出',
    category: 'code-quality'
  },
  {
    name: 'コンポーネント完全性テスト',
    script: 'test-component-completeness.js',
    description: 'Reactコンポーネントの完全性チェック（インポート、ハンドラー、props）',
    category: 'code-quality'
  },
  {
    name: '翻訳ファイル検証',
    script: 'validate-translations.js',
    description: '日本語・英語翻訳ファイルの整合性チェック',
    category: 'i18n'
  },
  {
    name: '全ページHTTPステータステスト',
    script: 'test-all-pages.js',
    description: 'すべてのページが正常に表示されるか確認',
    category: 'functionality'
  },
  {
    name: '無効パス404チェック',
    script: 'test-invalid-paths.js',
    description: '存在しないパスが適切に404を返すか確認',
    category: 'functionality'
  },
  {
    name: 'HTML構造検証',
    script: 'test-html-structure.js',
    description: 'HTMLの基本構造とメタデータを検証（Puppeteer使用）',
    category: 'ui-structure'
  },
  {
    name: 'コンポーネントリンク検証',
    script: 'test-component-links.js',
    description: 'コンポーネント内のリンクが正しく機能するか確認',
    category: 'functionality'
  },
  {
    name: '翻訳キー不足検証',
    script: 'test-missing-translations.js',
    description: 'コード内で使用されている翻訳キーの不足を検出',
    category: 'i18n'
  }
];

// テスト結果の統計
const statistics = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  fixedIssues: 0,
  categories: {}
};

// カテゴリごとの統計初期化
TEST_SCRIPTS.forEach(test => {
  if (!statistics.categories[test.category]) {
    statistics.categories[test.category] = { total: 0, passed: 0, failed: 0 };
  }
});

// タイマー
const startTime = Date.now();

// ヘッダー表示
console.log('╔════════════════════════════════════════╗');
console.log('║    🔍 包括的品質保証テストスイート     ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log(`📅 実行日時: ${new Date().toLocaleString('ja-JP')}`);
console.log(`📁 プロジェクト: ${path.basename(process.cwd())}`);
console.log(`📝 テスト数: ${TEST_SCRIPTS.length}個`);
console.log('');

// 環境チェック
console.log('🔧 環境チェック');
console.log('----------------------------------------');

// Node.jsバージョン
console.log(`   Node.js: ${process.version}`);

// package.jsonの存在確認
if (!fs.existsSync(path.join(process.cwd(), 'package.json'))) {
  console.error('❌ package.jsonが見つかりません');
  process.exit(1);
}

// 開発サーバーの起動確認
const checkDevServer = () => {
  return new Promise((resolve) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 3006,
      path: '/',
      method: 'GET',
      timeout: 1000
    };
    
    const req = http.request(options, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
};

// テスト実行関数
function runTest(scriptPath, testName) {
  return new Promise((resolve) => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 ${testName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('');
    
    if (!fs.existsSync(scriptPath)) {
      console.log(`⏭️  スキップ: スクリプトが見つかりません`);
      statistics.skipped++;
      resolve({ name: testName, success: false, skipped: true });
      return;
    }
    
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      const success = code === 0;
      if (success) {
        statistics.passed++;
        console.log(`\n✅ ${testName}: 成功`);
      } else {
        statistics.failed++;
        console.log(`\n❌ ${testName}: 失敗 (終了コード: ${code})`);
      }
      resolve({ name: testName, success, skipped: false });
    });
    
    child.on('error', (error) => {
      statistics.failed++;
      console.error(`\n❌ ${testName}: エラー - ${error.message}`);
      resolve({ name: testName, success: false, skipped: false, error: error.message });
    });
  });
}

// メイン処理
async function main() {
  // 開発サーバーチェック
  const isDevServerRunning = await checkDevServer();
  if (!isDevServerRunning) {
    console.log('⚠️  開発サーバーが起動していません。一部のテストがスキップされる可能性があります。');
    console.log('   ヒント: npm run dev でサーバーを起動してください');
  } else {
    console.log('✅ 開発サーバー: 起動中（ポート3006）');
  }
  console.log('');
  
  // 各テストを実行
  const results = [];
  for (const test of TEST_SCRIPTS) {
    statistics.total++;
    statistics.categories[test.category].total++;
    
    const scriptPath = path.join(__dirname, test.script);
    const result = await runTest(scriptPath, test.name);
    
    // カテゴリ統計更新
    if (result.skipped) {
      statistics.categories[test.category].total--;
    } else if (result.success) {
      statistics.categories[test.category].passed++;
    } else {
      statistics.categories[test.category].failed++;
    }
    
    results.push({ ...result, category: test.category });
  }
  
  // 実行時間
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 結果サマリー
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         📊 テスト結果サマリー          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`実行時間: ${duration}秒`);
  console.log('');
  console.log(`✅ 成功: ${statistics.passed}/${statistics.total}`);
  console.log(`❌ 失敗: ${statistics.failed}/${statistics.total}`);
  console.log(`⏭️  スキップ: ${statistics.skipped}/${statistics.total}`);
  
  // カテゴリ別結果
  console.log('\n📂 カテゴリ別結果:');
  for (const [category, stats] of Object.entries(statistics.categories)) {
    if (stats.total > 0) {
      const categoryName = {
        'code-quality': 'コード品質',
        'i18n': '多言語対応',
        'functionality': '機能性',
        'ui-structure': 'UI構造'
      }[category] || category;
      
      const icon = stats.failed === 0 ? '✅' : '❌';
      console.log(`   ${icon} ${categoryName}: ${stats.passed}/${stats.total} 成功`);
    }
  }
  
  // 失敗したテストの詳細
  const failedTests = results.filter(r => !r.success && !r.skipped);
  if (failedTests.length > 0) {
    console.log('\n❌ 失敗したテスト:');
    failedTests.forEach(test => {
      console.log(`   • ${test.name}`);
      if (test.error) {
        console.log(`     エラー: ${test.error}`);
      }
    });
  }
  
  // 改善提案
  if (statistics.failed > 0) {
    console.log('\n💡 改善提案:');
    console.log('   1. 失敗したテストの詳細を確認してください');
    console.log('   2. npm run lint:fix で自動修正可能なエラーを修正');
    console.log('   3. TypeScriptエラーは tsconfig.json の設定確認');
    console.log('   4. 翻訳エラーは messages/*.json ファイルを確認');
    console.log('   5. 個別テストを実行して詳細を確認:');
    console.log('      node scripts/[テストスクリプト名]');
  }
  
  // 最終結果
  console.log('\n╔════════════════════════════════════════╗');
  if (statistics.failed === 0 && statistics.skipped === 0) {
    console.log('║   ✅ すべてのテストが成功しました！    ║');
    console.log('╚════════════════════════════════════════╝');
    process.exit(0);
  } else if (statistics.failed > 0) {
    console.log('║   ❌ 品質テストに問題が見つかりました  ║');
    console.log('╚════════════════════════════════════════╝');
    process.exit(1);
  } else {
    console.log('║   ⚠️  一部のテストがスキップされました ║');
    console.log('╚════════════════════════════════════════╝');
    process.exit(0);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('\n❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

// 実行
main().catch(error => {
  console.error('\n❌ テスト実行中にエラーが発生しました:', error);
  process.exit(1);
});