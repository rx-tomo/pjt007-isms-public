#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 TypeScript/構文エラーテスト\n');
console.log('========================================');

let hasErrors = false;
const fixedIssues = [];

// TypeScript型チェック
console.log('\n📋 TypeScript型チェック');
console.log('----------------------------------------');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript型チェック: 成功\n');
} catch (error) {
  console.error('❌ TypeScript型チェック: 失敗\n');
  hasErrors = true;
}

// TypeScript設定の最適化チェック
console.log('\n📋 TypeScript設定チェック');
console.log('----------------------------------------');
const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  const recommendations = [];
  
  // 厳格モードチェック
  if (!tsconfig.compilerOptions?.strict) {
    recommendations.push('⚠️  "strict": true を設定することを推奨');
  }
  
  // その他の推奨設定
  const recommendedOptions = {
    'noImplicitAny': true,
    'strictNullChecks': true,
    'strictFunctionTypes': true,
    'noUnusedLocals': true,
    'noUnusedParameters': true,
    'noImplicitReturns': true
  };
  
  for (const [option, value] of Object.entries(recommendedOptions)) {
    if (tsconfig.compilerOptions?.[option] !== value) {
      recommendations.push(`⚠️  "${option}": ${value} を設定することを推奨`);
    }
  }
  
  if (recommendations.length > 0) {
    console.log('TypeScript設定の改善提案:');
    recommendations.forEach(rec => console.log(`   ${rec}`));
  } else {
    console.log('✅ TypeScript設定: 最適化済み');
  }
}

// ESLintチェック
console.log('\n📋 ESLintチェック');
console.log('----------------------------------------');
try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ ESLintチェック: 成功\n');
} catch (error) {
  console.error('❌ ESLintチェック: 失敗');
  
  // 自動修正を試みる
  console.log('\n🔧 ESLintの自動修正を実行中...');
  try {
    const output = execSync('npm run lint -- --fix', { encoding: 'utf8' });
    fixedIssues.push('ESLintエラーの自動修正を実行');
    console.log('✅ 一部のESLintエラーを自動修正しました');
  } catch (fixError) {
    console.log('⚠️  自動修正できないエラーが残っています');
  }
  hasErrors = true;
}

// ビルドテスト
console.log('\n📋 ビルドテスト');
console.log('----------------------------------------');
try {
  console.log('ビルドを実行中... (これには時間がかかる場合があります)');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ ビルドテスト: 成功\n');
} catch (error) {
  console.error('❌ ビルドテスト: 失敗\n');
  hasErrors = true;
}

// 未定義変数の検出
console.log('\n📋 未定義変数の検出');
console.log('----------------------------------------');
const undefinedVars = [];

function checkUndefinedVariables(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
      checkUndefinedVariables(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // よくある未定義変数パターンの検出
      const patterns = [
        /useState\s*\(/g,
        /useEffect\s*\(/g,
        /useRouter\s*\(/g,
        /useTranslations\s*\(/g,
      ];
      
      const functionNames = ['useState', 'useEffect', 'useRouter', 'useTranslations'];
      
      functionNames.forEach((funcName, index) => {
        if (patterns[index].test(content)) {
          const importPattern = new RegExp(`import.*${funcName}`);
          if (!importPattern.test(content)) {
            undefinedVars.push({
              file: path.relative(process.cwd(), filePath),
              variable: funcName
            });
          }
        }
      });
    }
  }
}

// appディレクトリをチェック
if (fs.existsSync(path.join(process.cwd(), 'app'))) {
  checkUndefinedVariables(path.join(process.cwd(), 'app'));
}

// componentsディレクトリをチェック
if (fs.existsSync(path.join(process.cwd(), 'components'))) {
  checkUndefinedVariables(path.join(process.cwd(), 'components'));
}

// libディレクトリをチェック
if (fs.existsSync(path.join(process.cwd(), 'lib'))) {
  checkUndefinedVariables(path.join(process.cwd(), 'lib'));
}

if (undefinedVars.length > 0) {
  console.log('❌ 未定義変数が見つかりました:');
  undefinedVars.forEach(({ file, variable }) => {
    console.log(`   ${file}: ${variable} が未定義です`);
  });
  hasErrors = true;
} else {
  console.log('✅ 未定義変数なし');
}

// 結果サマリー
console.log('\n========================================');
console.log('📊 テスト結果サマリー');
console.log('========================================');

if (fixedIssues.length > 0) {
  console.log('\n🔧 自動修正された項目:');
  fixedIssues.forEach(issue => console.log(`   - ${issue}`));
}

if (hasErrors) {
  console.log('\n❌ エラーが見つかりました。修正が必要です。');
  process.exit(1);
} else {
  console.log('\n✅ すべてのチェックが成功しました！');
  process.exit(0);
}