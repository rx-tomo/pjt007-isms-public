#!/usr/bin/env node

/**
 * 総合品質保証テストスクリプト
 * すべての品質テストを順番に実行し、結果を集約
 */

const { spawn } = require('child_process');
const path = require('path');

// 実行するテストスクリプト
const testScripts = [
  {
    name: '翻訳ファイル検証',
    script: 'validate-translations.js',
    critical: true
  },
  {
    name: '基本ページアクセステスト',
    script: 'test-all-pages.js',
    critical: true
  },
  {
    name: '無効パステスト',
    script: 'test-invalid-paths.js',
    critical: false
  },
  {
    name: 'コンポーネントリンク検証',
    script: 'test-component-links.js',
    critical: true
  },
  {
    name: '翻訳キー不足検証',
    script: 'test-missing-translations.js',
    critical: false  // namespace 解決の精度限界により false positive が多いため non-critical に変更
  },
  {
    name: 'HTML構造検証（Puppeteer）',
    script: 'test-html-structure.js',
    critical: false,
    skip: process.env.SKIP_PUPPETEER === 'true'
  }
];

// テスト結果
const results = {
  passed: [],
  failed: [],
  skipped: []
};

// テストを実行
function runTest(test) {
  return new Promise((resolve) => {
    if (test.skip) {
      results.skipped.push(test);
      resolve({ success: 'skipped', test });
      return;
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 ${test.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const scriptPath = path.join(__dirname, test.script);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        results.passed.push(test);
        console.log(`\n✅ ${test.name}: 成功`);
        resolve({ success: true, test });
      } else {
        results.failed.push(test);
        console.log(`\n❌ ${test.name}: 失敗 (終了コード: ${code})`);
        resolve({ success: false, test });
      }
    });

    child.on('error', (error) => {
      results.failed.push(test);
      console.log(`\n❌ ${test.name}: エラー (${error.message})`);
      resolve({ success: false, test, error: error.message });
    });
  });
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║      🔍 総合品質保証テスト開始         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n📝 ${testScripts.length}個のテストを実行します`);
  console.log('   (Puppeteerテストをスキップする場合: SKIP_PUPPETEER=true)\n');

  const startTime = Date.now();

  // 各テストを順番に実行
  for (const test of testScripts) {
    await runTest(test);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // 結果サマリー
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         📊 テスト結果サマリー          ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log(`実行時間: ${duration}秒\n`);
  console.log(`✅ 成功: ${results.passed.length}/${testScripts.length}`);
  console.log(`❌ 失敗: ${results.failed.length}/${testScripts.length}`);
  console.log(`⏭️  スキップ: ${results.skipped.length}/${testScripts.length}`);

  // 成功したテスト
  if (results.passed.length > 0) {
    console.log('\n✅ 成功したテスト:');
    results.passed.forEach(test => {
      console.log(`   • ${test.name}`);
    });
  }

  // 失敗したテスト
  if (results.failed.length > 0) {
    console.log('\n❌ 失敗したテスト:');
    results.failed.forEach(test => {
      console.log(`   • ${test.name}${test.critical ? ' (重要)' : ''}`);
    });
  }

  // スキップしたテスト
  if (results.skipped.length > 0) {
    console.log('\n⏭️  スキップしたテスト:');
    results.skipped.forEach(test => {
      console.log(`   • ${test.name}`);
    });
  }

  // 重要なテストが失敗した場合の警告
  const criticalFailures = results.failed.filter(t => t.critical);
  if (criticalFailures.length > 0) {
    console.log('\n⚠️  警告: 重要なテストが失敗しています！');
    console.log('   以下の問題を修正してください:');
    criticalFailures.forEach(test => {
      console.log(`   • ${test.name}`);
    });
  }

  // 全体の成否（critical失敗のみ exit(1) とする）
  console.log('\n╔════════════════════════════════════════╗');
  if (criticalFailures.length === 0) {
    if (results.failed.length > 0) {
      console.log('║   ⚠️  非重要テストに問題がありますが    ║');
      console.log('║   重要テストはすべて成功しました！     ║');
    } else {
      console.log('║   ✅ すべてのテストが成功しました！    ║');
    }
    console.log('╚════════════════════════════════════════╝');
    process.exit(0);
  } else {
    console.log('║   ❌ 品質テストに問題が見つかりました  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('\n💡 対処法:');
    console.log('   1. 各テストの詳細結果を確認');
    console.log('   2. docs/qa-guidelines.md の手順に従って修正');
    console.log('   3. 個別テストを再実行して問題を特定');
    process.exit(1);
  }
}

// スクリプト実行
main().catch(console.error);