#!/usr/bin/env node

/**
 * コンポーネント内のリンクパス検証スクリプト
 * href属性の値が正しいパス構造になっているかをチェック
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// 検証結果
const results = {
  validLinks: [],
  invalidLinks: [],
  suspiciousLinks: [],
  errors: []
};

// 正しいパスパターン
const validPathPatterns = [
  /^\/\$\{locale\}\/auth\/(login|signup|verify-email)$/,
  /^\/\$\{locale\}\/home$/,
  /^\/\$\{locale\}\/documents(\/.*)?$/,
  /^\/\$\{locale\}\/risks(\/.*)?$/,
  /^\/\$\{locale\}\/tasks(\/.*)?$/,
  /^\/\$\{locale\}\/audit(\/.*)?$/,
  /^\/\$\{locale\}\/settings\/(profile|organization|users|subscription)$/,
  /^\/\$\{locale\}\/pricing$/,
  /^\/\$\{locale\}\/contact$/,
  /^\/api\//,   // API routes don't need locale prefix
  /^\/docs(\/.*)?$/,  // Documentation links don't need locale prefix
  /^\/(about|contact|privacy|terms|help|status|cookies)$/,  // Public static pages don't need locale prefix
  /^\/(ja|en|zh)\//,  // Hardcoded locale paths (legacy or intentional)
  /^\/\$\{locale\}\/dev-login$/,
  /^\/\$\{locale\}$/,
  /^#\w+$/,  // アンカーリンク
  /^https?:\/\//,  // 外部リンク
];

// 間違いやすいパターン
const commonMistakes = {
  '/signup': '/${locale}/auth/signup',
  '/login': '/${locale}/auth/login',
  '/auth/signup': '/${locale}/auth/signup',
  '/auth/login': '/${locale}/auth/login',
  '/home': '/${locale}/home',
  '/dashboard': '/${locale}/home',
  '/${locale}/dashboard': '/${locale}/home',
  '/documents': '/${locale}/documents',
  '/risks': '/${locale}/risks',
  '/tasks': '/${locale}/tasks',
  '/settings': '/${locale}/settings/profile',
  '/profile': '/${locale}/settings/profile',
};

function extractLinks(content, filePath) {
  const links = [];
  
  // href属性を抽出（複数行対応）
  const hrefRegex = /href\s*=\s*{?\s*["`']([^"`']+)["`']\s*}?/g;
  const templateHrefRegex = /href\s*=\s*{[`"]([^`"]+)[`"]}/g;
  const dynamicHrefRegex = /href\s*=\s*{\s*`([^`]+)`\s*}/g;
  
  let match;
  
  // 通常のhref
  while ((match = hrefRegex.exec(content)) !== null) {
    links.push({
      href: match[1],
      line: content.substring(0, match.index).split('\\n').length,
      type: 'static'
    });
  }
  
  // テンプレートリテラル
  while ((match = templateHrefRegex.exec(content)) !== null) {
    links.push({
      href: match[1],
      line: content.substring(0, match.index).split('\\n').length,
      type: 'template'
    });
  }
  
  // 動的href
  while ((match = dynamicHrefRegex.exec(content)) !== null) {
    links.push({
      href: match[1],
      line: content.substring(0, match.index).split('\\n').length,
      type: 'dynamic'
    });
  }
  
  return links;
}

function validateLink(link, filePath) {
  const { href, line, type } = link;
  
  // 条件式は無視
  if (href.includes('?') && href.includes(':')) {
    return { valid: true, category: 'conditional' };
  }
  
  // 正しいパターンかチェック
  for (const pattern of validPathPatterns) {
    if (pattern.test(href)) {
      return { valid: true, category: 'valid' };
    }
  }
  
  // よくある間違いかチェック
  if (commonMistakes[href]) {
    return { 
      valid: false, 
      category: 'invalid',
      suggestion: commonMistakes[href]
    };
  }
  
  // ロケールが含まれていないパス
  if (href.startsWith('/') && !href.startsWith('/${locale}') && !href.startsWith('/#')) {
    return {
      valid: false,
      category: 'suspicious',
      reason: 'Missing locale prefix'
    };
  }
  
  return { valid: true, category: 'unknown' };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const links = extractLinks(content, filePath);
    
    for (const link of links) {
      const validation = validateLink(link, filePath);
      const result = {
        file: path.relative(process.cwd(), filePath),
        ...link,
        ...validation
      };
      
      if (validation.category === 'invalid') {
        results.invalidLinks.push(result);
      } else if (validation.category === 'suspicious') {
        results.suspiciousLinks.push(result);
      } else if (validation.category === 'valid') {
        results.validLinks.push(result);
      }
    }
  } catch (error) {
    results.errors.push({
      file: path.relative(process.cwd(), filePath),
      error: error.message
    });
  }
}

function main() {
  console.log('========================================');
  console.log('🔗 コンポーネントリンク検証');
  console.log('========================================\\n');

  // コンポーネントファイルを検索
  const componentFiles = globSync([
    'components/**/*.tsx',
    'components/**/*.jsx',
    'app/**/*.tsx',
    'app/**/*.jsx',
    'src/components/**/*.tsx',
    'src/components/**/*.jsx',
    'src/app/**/*.tsx',
    'src/app/**/*.jsx'
  ], {
    ignore: ['**/node_modules/**', '**/.next/**']
  });

  console.log(`📝 ${componentFiles.length}個のファイルを検証中...\\n`);

  // 各ファイルを処理
  for (const file of componentFiles) {
    processFile(file);
  }

  // 結果サマリー
  console.log('========================================');
  console.log('📊 検証結果サマリー');
  console.log('========================================\\n');

  console.log(`✅ 有効なリンク: ${results.validLinks.length}`);
  console.log(`❌ 無効なリンク: ${results.invalidLinks.length}`);
  console.log(`⚠️  疑わしいリンク: ${results.suspiciousLinks.length}`);
  console.log(`🚫 エラー: ${results.errors.length}`);

  // 無効なリンクの詳細
  if (results.invalidLinks.length > 0) {
    console.log('\\n❌ 無効なリンクの詳細:');
    for (const link of results.invalidLinks) {
      console.log(`\\n   ${link.file}:${link.line}`);
      console.log(`   現在: href="${link.href}"`);
      if (link.suggestion) {
        console.log(`   修正: href="${link.suggestion}"`);
      }
    }
  }

  // 疑わしいリンクの詳細
  if (results.suspiciousLinks.length > 0) {
    console.log('\\n⚠️  疑わしいリンクの詳細:');
    for (const link of results.suspiciousLinks) {
      console.log(`\\n   ${link.file}:${link.line}`);
      console.log(`   href="${link.href}"`);
      console.log(`   理由: ${link.reason}`);
    }
  }

  // エラーの詳細
  if (results.errors.length > 0) {
    console.log('\\n🚫 処理エラー:');
    for (const error of results.errors) {
      console.log(`   ${error.file}: ${error.error}`);
    }
  }

  // 修正ガイド
  if (results.invalidLinks.length > 0 || results.suspiciousLinks.length > 0) {
    console.log('\\n💡 修正ガイド:');
    console.log('   - すべてのリンクにロケールプレフィックス /${locale} を含める');
    console.log('   - 認証関連: /${locale}/auth/(login|signup)');
    console.log('   - ダッシュボード: /${locale}/home');
    console.log('   - 設定: /${locale}/settings/(profile|organization|users|subscription)');
    console.log('\\n📖 詳細は docs/qa-guidelines.md を参照してください');
  }

  // 全体の成否
  console.log('\\n========================================');
  if (results.invalidLinks.length === 0 && results.suspiciousLinks.length === 0) {
    console.log('✅ すべてのリンクが正しく設定されています！');
    process.exit(0);
  } else {
    console.log('❌ 修正が必要なリンクが見つかりました');
    process.exit(1);
  }
}

// globがインストールされているか確認
try {
  require('glob');
} catch (e) {
  console.error('❌ エラー: globがインストールされていません');
  console.error('   以下のコマンドを実行してください:');
  console.error('   npm install --save-dev glob');
  process.exit(1);
}

// スクリプト実行
main();
