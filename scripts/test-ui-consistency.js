/**
 * UIコンポーネント一貫性チェックスクリプト
 * デザインシステムの一貫性を検証
 */

const fs = require('fs');
const path = require('path');

// チェック対象のパターン
const designPatterns = {
  colors: {
    primary: ['indigo-600', 'indigo-700', 'indigo-500'],
    neutral: ['gray-50', 'gray-100', 'gray-200', 'gray-300', 'gray-400', 'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900'],
    background: ['bg-gray-50', 'bg-white'],
    text: ['text-gray-900', 'text-gray-700', 'text-gray-600', 'text-gray-500'],
  },
  spacing: {
    padding: ['p-4', 'p-6', 'p-8', 'px-4', 'py-2', 'py-3', 'py-4'],
    margin: ['m-4', 'mt-4', 'mb-4', 'mx-auto'],
    gap: ['gap-4', 'gap-6', 'gap-8', 'space-x-4', 'space-y-4'],
  },
  components: {
    buttons: ['rounded-md', 'px-4', 'py-2', 'font-medium'],
    cards: ['bg-white', 'rounded-lg', 'shadow-md', 'p-6'],
    inputs: ['border', 'rounded-md', 'px-3', 'py-2'],
  },
  responsive: {
    breakpoints: ['sm:', 'md:', 'lg:', 'xl:'],
    grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3'],
  }
};

// ファイルを再帰的に検索
function findFiles(dir, pattern, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules と .next は除外
      if (!file.startsWith('.') && file !== 'node_modules') {
        findFiles(filePath, pattern, fileList);
      }
    } else if (pattern.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// ファイル内のパターンをチェック
function checkPatterns(filePath, content) {
  const results = {
    file: filePath,
    patterns: {},
    inconsistencies: [],
    suggestions: []
  };
  
  // カラーパターンのチェック
  Object.entries(designPatterns.colors).forEach(([category, colors]) => {
    colors.forEach(color => {
      const regex = new RegExp(`\\b${color}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        if (!results.patterns[category]) {
          results.patterns[category] = {};
        }
        results.patterns[category][color] = matches.length;
      }
    });
  });
  
  // 非推奨パターンのチェック
  const deprecated = [
    { pattern: /style={{[^}]+}}/g, message: 'インラインスタイルの使用を避けてください' },
    { pattern: /className="[^"]*\s{2,}[^"]*"/g, message: '複数の空白が含まれています' },
    { pattern: /\b(red|blue|green|yellow)-\d{3}\b/g, message: 'デザインシステム外の色を使用しています' },
  ];
  
  deprecated.forEach(({ pattern, message }) => {
    const matches = content.match(pattern);
    if (matches) {
      results.inconsistencies.push({
        type: 'deprecated',
        message: message,
        occurrences: matches.length,
        examples: matches.slice(0, 3)
      });
    }
  });
  
  // アクセシビリティチェック
  const a11yChecks = [
    { pattern: /<img(?![^>]*alt=)/g, message: 'img要素にalt属性がありません' },
    { pattern: /<button(?![^>]*type=)/g, message: 'button要素にtype属性を指定してください' },
    { pattern: /onClick={[^}]+}(?![^>]*onKeyDown)/g, message: 'onClickにはonKeyDownも追加してください' },
  ];
  
  a11yChecks.forEach(({ pattern, message }) => {
    const matches = content.match(pattern);
    if (matches) {
      results.suggestions.push({
        type: 'accessibility',
        message: message,
        occurrences: matches.length
      });
    }
  });
  
  return results;
}

// レポート生成
function generateReport(allResults) {
  console.log('=================================');
  console.log('UI一貫性チェックレポート');
  console.log('=================================\n');
  
  // カラー使用統計
  console.log('【カラーパレット使用状況】');
  console.log('------------------------');
  const colorUsage = {};
  
  allResults.forEach(result => {
    Object.entries(result.patterns).forEach(([category, colors]) => {
      if (!colorUsage[category]) colorUsage[category] = {};
      Object.entries(colors).forEach(([color, count]) => {
        colorUsage[category][color] = (colorUsage[category][color] || 0) + count;
      });
    });
  });
  
  Object.entries(colorUsage).forEach(([category, colors]) => {
    console.log(`\n${category}:`);
    Object.entries(colors)
      .sort((a, b) => b[1] - a[1])
      .forEach(([color, count]) => {
        console.log(`  ${color}: ${count}回使用`);
      });
  });
  
  // 非推奨パターン
  console.log('\n\n【非推奨パターンの検出】');
  console.log('------------------------');
  let deprecatedCount = 0;
  
  allResults.forEach(result => {
    if (result.inconsistencies.length > 0) {
      console.log(`\n${result.file}:`);
      result.inconsistencies.forEach(issue => {
        console.log(`  ⚠️  ${issue.message} (${issue.occurrences}件)`);
        deprecatedCount += issue.occurrences;
      });
    }
  });
  
  if (deprecatedCount === 0) {
    console.log('✅ 非推奨パターンは検出されませんでした');
  }
  
  // アクセシビリティ
  console.log('\n\n【アクセシビリティの提案】');
  console.log('------------------------');
  let a11yIssues = 0;
  
  allResults.forEach(result => {
    if (result.suggestions.length > 0) {
      console.log(`\n${result.file}:`);
      result.suggestions.forEach(suggestion => {
        console.log(`  💡 ${suggestion.message} (${suggestion.occurrences}件)`);
        a11yIssues += suggestion.occurrences;
      });
    }
  });
  
  if (a11yIssues === 0) {
    console.log('✅ アクセシビリティの問題は検出されませんでした');
  }
  
  // サマリー
  console.log('\n\n=================================');
  console.log('サマリー');
  console.log('=================================');
  console.log(`チェックしたファイル数: ${allResults.length}`);
  console.log(`非推奨パターン: ${deprecatedCount}件`);
  console.log(`アクセシビリティの提案: ${a11yIssues}件`);
  
  const score = Math.max(0, 100 - deprecatedCount * 5 - a11yIssues * 2);
  console.log(`\n一貫性スコア: ${score}/100`);
  
  if (score >= 90) {
    console.log('✅ 優れたUI一貫性です！');
  } else if (score >= 70) {
    console.log('⚠️  いくつかの改善点があります');
  } else {
    console.log('❌ UI一貫性の改善が必要です');
  }
}

// メイン実行
async function main() {
  console.log('UIコンポーネントの一貫性をチェックしています...\n');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const files = findFiles(srcDir, /\.(tsx|jsx)$/);
  
  const results = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const result = checkPatterns(file, content);
    results.push(result);
  });
  
  generateReport(results);
}

main().catch(console.error);