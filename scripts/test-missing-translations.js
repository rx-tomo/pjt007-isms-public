#!/usr/bin/env node

/**
 * 翻訳キー不足検証スクリプト
 * コンポーネント内で使用されている翻訳キーが実際に存在するかをチェック
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// 検証結果
const results = {
  validKeys: [],
  missingKeys: [],
  dynamicKeys: [],
  errors: []
};

// 翻訳ファイルを読み込み
let translations = {};
try {
  const jaTranslations = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'messages', 'ja.json'), 'utf-8'));
  const enTranslations = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'messages', 'en.json'), 'utf-8'));
  translations = { ja: jaTranslations, en: enTranslations };
} catch (error) {
  console.error('❌ 翻訳ファイルの読み込みに失敗しました:', error.message);
  process.exit(1);
}

// ネストしたオブジェクトから全てのキーパスを取得
function getAllKeyPaths(obj, prefix = '') {
  const paths = [];
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      paths.push(...getAllKeyPaths(obj[key], path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

const availableKeys = {
  ja: getAllKeyPaths(translations.ja),
  en: getAllKeyPaths(translations.en)
};

// 翻訳キーの使用を抽出
function extractTranslationUsages(content, filePath) {
  const usages = [];
  
  // useTranslations('namespace') パターン
  const namespaceRegex = /useTranslations\(['"`]([^'"`]+)['"`]\)/g;
  const namespaces = [];
  let match;
  
  while ((match = namespaceRegex.exec(content)) !== null) {
    namespaces.push({
      namespace: match[1],
      line: content.substring(0, match.index).split('\\n').length
    });
  }
  
  // t('key') パターン
  const keyRegex = /\bt\(['"`]([^'"`]+)['"`]\)/g;
  
  while ((match = keyRegex.exec(content)) !== null) {
    const key = match[1];
    const line = content.substring(0, match.index).split('\\n').length;
    
    // 各名前空間に対してキーをチェック
    for (const ns of namespaces) {
      const fullKey = ns.namespace ? `${ns.namespace}.${key}` : key;
      usages.push({
        key,
        fullKey,
        namespace: ns.namespace,
        line,
        type: 'namespaced'
      });
    }
    
    // 名前空間なしの場合
    if (namespaces.length === 0) {
      usages.push({
        key,
        fullKey: key,
        namespace: null,
        line,
        type: 'direct'
      });
    }
  }
  
  // getTranslations({namespace: 'name'}) パターン
  const getTranslationsRegex = /getTranslations\(\{[^}]*namespace:\s*['"`]([^'"`]+)['"`][^}]*\}\)/g;
  
  while ((match = getTranslationsRegex.exec(content)) !== null) {
    const namespace = match[1];
    const line = content.substring(0, match.index).split('\\n').length;
    
    // このファイル内でこのgetTranslationsの後のt()呼び出しを探す
    const afterIndex = match.index + match[0].length;
    const afterContent = content.substring(afterIndex);
    const localKeyRegex = /\bt\(['"`]([^'"`]+)['"`]\)/g;
    let localMatch;
    
    while ((localMatch = localKeyRegex.exec(afterContent)) !== null) {
      const key = localMatch[1];
      const keyLine = content.substring(0, afterIndex + localMatch.index).split('\\n').length;
      const fullKey = `${namespace}.${key}`;
      
      usages.push({
        key,
        fullKey,
        namespace,
        line: keyLine,
        type: 'getTranslations'
      });
    }
  }
  
  return usages;
}

// 翻訳キーが存在するかチェック
function validateKey(fullKey) {
  // 両言語で存在するかチェック
  const existsInJa = availableKeys.ja.includes(fullKey);
  const existsInEn = availableKeys.en.includes(fullKey);
  
  return {
    valid: existsInJa && existsInEn,
    existsInJa,
    existsInEn
  };
}

// ファイルを処理
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const usages = extractTranslationUsages(content, filePath);

    for (const usage of usages) {
      // 動的キー（${ を含む）をチェック
      if (usage.fullKey.includes('${') || usage.key.includes('${')) {
        const result = {
          file: path.relative(process.cwd(), filePath),
          ...usage
        };
        results.dynamicKeys.push(result);
        continue;
      }

      const validation = validateKey(usage.fullKey);
      const result = {
        file: path.relative(process.cwd(), filePath),
        ...usage,
        ...validation
      };

      if (validation.valid) {
        results.validKeys.push(result);
      } else {
        results.missingKeys.push(result);
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
  console.log('🔍 翻訳キー使用状況検証');
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

  console.log(`✅ 有効な翻訳キー: ${results.validKeys.length}`);
  console.log(`❌ 不足している翻訳キー: ${results.missingKeys.length}`);
  console.log(`⏭️ 動的キー（スキップ）: ${results.dynamicKeys.length}`);
  console.log(`🚫 エラー: ${results.errors.length}`);

  // 不足キーの詳細
  if (results.missingKeys.length > 0) {
    console.log('\\n❌ 不足している翻訳キーの詳細:');
    
    // ファイルごとにグループ化
    const byFile = {};
    for (const key of results.missingKeys) {
      if (!byFile[key.file]) {
        byFile[key.file] = [];
      }
      byFile[key.file].push(key);
    }
    
    for (const [file, keys] of Object.entries(byFile)) {
      console.log(`\\n   ${file}:`);
      for (const key of keys) {
        console.log(`     Line ${key.line}: ${key.type === 'namespaced' ? `t('${key.key}')` : key.fullKey}`);
        console.log(`       完全なキー: ${key.fullKey}`);
        if (!key.existsInJa && !key.existsInEn) {
          console.log('       ⚠️  両言語で不足');
        } else if (!key.existsInJa) {
          console.log('       ⚠️  日本語のみ不足');
        } else if (!key.existsInEn) {
          console.log('       ⚠️  英語のみ不足');
        }
      }
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
  if (results.missingKeys.length > 0) {
    console.log('\\n💡 修正方法:');
    console.log('   1. messages/ja.json と messages/en.json に不足しているキーを追加');
    console.log('   2. 名前空間が正しいことを確認（例: useTranslations("home")）');
    console.log('   3. ネスト構造でキーを追加（ドット記法は使用不可）');
    console.log('\\n📖 詳細は docs/qa-guidelines.md を参照してください');
  }

  // 全体の成否
  console.log('\\n========================================');
  if (results.missingKeys.length === 0) {
    console.log('✅ すべての翻訳キーが正しく設定されています！');
    process.exit(0);
  } else {
    console.log('❌ 翻訳キーの不足が見つかりました');
    process.exit(1);
  }
}

// スクリプト実行
main();
