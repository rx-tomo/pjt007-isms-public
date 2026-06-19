#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔍 コンポーネント完全性テスト\n');
console.log('========================================');

let hasErrors = false;
const issues = [];
const fixedIssues = [];

// React Hooksのインポートチェック
function checkReactImports(filePath, content) {
  const localIssues = [];
  
  // useState使用チェック
  if (/useState\s*\(/.test(content) && !/import.*useState.*from\s+['"]react['"]/.test(content)) {
    localIssues.push('useState が使用されているが、インポートされていない');
  }
  
  // useEffect使用チェック
  if (/useEffect\s*\(/.test(content) && !/import.*useEffect.*from\s+['"]react['"]/.test(content)) {
    localIssues.push('useEffect が使用されているが、インポートされていない');
  }
  
  // useRouter使用チェック (Next.js)
  if (/useRouter\s*\(/.test(content) && !/import.*useRouter.*from\s+['"]next\/(?:router|navigation)['"]/.test(content)) {
    localIssues.push('useRouter が使用されているが、インポートされていない');
  }
  
  // useTranslations使用チェック (next-intl)
  if (/useTranslations\s*\(/.test(content) && !/import.*useTranslations.*from\s+['"]next-intl['"]/.test(content)) {
    localIssues.push('useTranslations が使用されているが、インポートされていない');
  }
  
  return localIssues;
}

// イベントハンドラーの実装チェック
function checkEventHandlers(filePath, content) {
  const localIssues = [];
  
  // onClick, onChange などのイベントハンドラー
  const eventHandlerRegex = /(?:onClick|onChange|onSubmit|onBlur|onFocus)={(?:(\w+)|{(\w+)}|\((.*?)\)\s*=>\s*(\w+)\((.*?)\))}/g;
  let match;
  
  while ((match = eventHandlerRegex.exec(content)) !== null) {
    const handlerName = match[1] || match[2] || match[4];
    if (handlerName && !new RegExp(`(?:const|function)\\s+${handlerName}\\s*[=\\(]`).test(content)) {
      // インライン関数でない場合、定義をチェック
      if (!match[3] && !match[4]) {
        localIssues.push(`イベントハンドラー '${handlerName}' が定義されていない可能性があります`);
      }
    }
  }
  
  return localIssues;
}

// 必須propsのチェック
function checkRequiredProps(filePath, content) {
  const localIssues = [];
  
  // コンポーネントの型定義を探す
  const propsTypeRegex = /(?:interface|type)\s+(\w+Props)\s*[=\{]/g;
  let match;
  
  while ((match = propsTypeRegex.exec(content)) !== null) {
    const propsTypeName = match[1];
    
    // 必須プロパティを探す（?がついていないもの）
    const requiredPropsRegex = new RegExp(`${propsTypeName}[^}]*?\\n\\s*(\\w+):\\s*[^?]`, 'g');
    const requiredProps = [];
    let propMatch;
    
    while ((propMatch = requiredPropsRegex.exec(content)) !== null) {
      requiredProps.push(propMatch[1]);
    }
    
    // コンポーネントの使用箇所をチェック
    const componentName = propsTypeName.replace('Props', '');
    const usageRegex = new RegExp(`<${componentName}\\s+([^>]*)>`, 'g');
    let usageMatch;
    
    while ((usageMatch = usageRegex.exec(content)) !== null) {
      const propsString = usageMatch[1];
      requiredProps.forEach(prop => {
        if (!new RegExp(`${prop}=`).test(propsString)) {
          localIssues.push(`コンポーネント '${componentName}' で必須プロパティ '${prop}' が渡されていない可能性があります`);
        }
      });
    }
  }
  
  return localIssues;
}

// ファイルをスキャン
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const fileIssues = [];
  
  // Reactコンポーネントファイルかチェック
  if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
    // インポートチェック
    const importIssues = checkReactImports(filePath, content);
    fileIssues.push(...importIssues);
    
    // イベントハンドラーチェック
    const handlerIssues = checkEventHandlers(filePath, content);
    fileIssues.push(...handlerIssues);
    
    // 必須propsチェック
    const propsIssues = checkRequiredProps(filePath, content);
    fileIssues.push(...propsIssues);
    
    // useEffectの依存配列チェック
    const effectRegex = /useEffect\s*\(\s*\(\)\s*=>\s*{[^}]*}\s*,\s*\[\s*\]\s*\)/g;
    if (effectRegex.test(content)) {
      // 空の依存配列で、内部で使用されている変数をチェック
      const effectMatches = content.match(/useEffect\s*\(\s*\(\)\s*=>\s*{([^}]*)}\s*,\s*\[\s*\]\s*\)/g);
      if (effectMatches) {
        effectMatches.forEach(effectMatch => {
          // 簡易的なチェック：props や state の使用
          if (/props\.|state\.|useState/.test(effectMatch)) {
            fileIssues.push('useEffect内でpropsやstateを使用しているが、依存配列が空です');
          }
        });
      }
    }
  }
  
  if (fileIssues.length > 0) {
    issues.push({
      file: path.relative(process.cwd(), filePath),
      issues: fileIssues
    });
    hasErrors = true;
  }
}

// ディレクトリをスキャン
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
      scanDirectory(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      scanFile(filePath);
    }
  }
}

// 各ディレクトリをスキャン
console.log('📂 スキャン対象ディレクトリ:');
const dirsToScan = ['app', 'components', 'lib'];
dirsToScan.forEach(dir => {
  if (fs.existsSync(path.join(process.cwd(), dir))) {
    console.log(`   - ${dir}/`);
  }
});
console.log('');

dirsToScan.forEach(dir => {
  scanDirectory(path.join(process.cwd(), dir));
});

// 結果表示
console.log('\n========================================');
console.log('📊 テスト結果');
console.log('========================================');

if (issues.length > 0) {
  console.log('\n❌ 以下の問題が見つかりました:\n');
  issues.forEach(({ file, issues }) => {
    console.log(`📄 ${file}:`);
    issues.forEach(issue => {
      console.log(`   ⚠️  ${issue}`);
    });
    console.log('');
  });
  
  console.log('💡 修正方法:');
  console.log('   1. 不足しているインポートを追加してください');
  console.log('   2. 未定義のイベントハンドラーを実装してください');
  console.log('   3. useEffectの依存配列を確認してください');
  console.log('   4. 必須プロパティが正しく渡されているか確認してください');
} else {
  console.log('\n✅ すべてのコンポーネントが完全性チェックに合格しました！');
}

if (hasErrors) {
  process.exit(1);
} else {
  process.exit(0);
}