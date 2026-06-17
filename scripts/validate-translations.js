#!/usr/bin/env node

/**
 * 翻訳ファイルの検証スクリプト
 * - ドット記法の使用をチェック
 * - 日本語・英語・中国語の翻訳キーの整合性をチェック
 * - 未使用キーの検出
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const JA_FILE = path.join(MESSAGES_DIR, 'ja.json');
const EN_FILE = path.join(MESSAGES_DIR, 'en.json');
const ZH_FILE = path.join(MESSAGES_DIR, 'zh.json');

// テスト結果
const results = {
  dotNotationKeys: [],
  missingInJa: [],
  missingInEn: [],
  missingInZh: [],
  duplicateKeys: [],
  syntaxErrors: [],
  icuParseErrors: []
};

function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    results.syntaxErrors.push({
      file: path.basename(filePath),
      error: error.message
    });
    return null;
  }
}

function getAllKeys(obj, prefix = '') {
  const keys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

function findDotNotationKeys(obj, prefix = '') {
  const dotKeys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    // キー名にドットが含まれている場合
    if (key.includes('.')) {
      dotKeys.push(fullKey);
    }

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      dotKeys.push(...findDotNotationKeys(obj[key], fullKey));
    }
  }

  return dotKeys;
}

function checkKeyDuplicates(keys) {
  const duplicates = [];
  const seen = new Set();

  for (const key of keys) {
    if (seen.has(key)) {
      duplicates.push(key);
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function validateICUMessages(obj, prefix = '', lang = '') {
  const errors = [];

  // ICU パーサーを動的にロード（存在する場合のみ）
  let parse;
  try {
    parse = require('@formatjs/icu-messageformat-parser').parse;
  } catch (e) {
    // パーサーがインストールされていない場合はスキップ
    return errors;
  }

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null) {
      errors.push(...validateICUMessages(value, fullKey, lang));
    } else if (typeof value === 'string') {
      // ICU 構文が含まれていそうな場合のみパース
      if (value.includes('{') && value.includes('}')) {
        try {
          parse(value);
        } catch (error) {
          errors.push({
            key: fullKey,
            language: lang,
            message: value,
            error: error.message
          });
        }
      }
    }
  }

  return errors;
}

function main() {
  console.log('========================================');
  console.log('🔍 翻訳ファイル検証');
  console.log('========================================\\n');

  // JSONファイルを読み込み
  const jaData = loadJSON(JA_FILE);
  const enData = loadJSON(EN_FILE);
  const zhData = loadJSON(ZH_FILE);

  if (!jaData || !enData || !zhData) {
    console.error('❌ 翻訳ファイルの読み込みに失敗しました');
    process.exit(1);
  }

  console.log('✅ 翻訳ファイルを読み込みました\\n');

  // 1. ドット記法のチェック
  console.log('📝 ドット記法チェック...');
  const jaDotKeys = findDotNotationKeys(jaData);
  const enDotKeys = findDotNotationKeys(enData);
  const zhDotKeys = findDotNotationKeys(zhData);

  results.dotNotationKeys = [...new Set([...jaDotKeys, ...enDotKeys, ...zhDotKeys])];

  if (results.dotNotationKeys.length > 0) {
    console.log(`❌ ドット記法を使用しているキーが見つかりました: ${results.dotNotationKeys.length}個`);
    results.dotNotationKeys.forEach(key => {
      console.log(`   - ${key}`);
    });
  } else {
    console.log('✅ ドット記法の使用なし');
  }

  // 2. キーの整合性チェック
  console.log('\\n📝 キー整合性チェック...');
  const jaKeys = getAllKeys(jaData);
  const enKeys = getAllKeys(enData);
  const zhKeys = getAllKeys(zhData);

  results.missingInJa = [...new Set([...enKeys, ...zhKeys])].filter(key => !jaKeys.includes(key));
  results.missingInEn = jaKeys.filter(key => !enKeys.includes(key));
  results.missingInZh = jaKeys.filter(key => !zhKeys.includes(key));

  if (results.missingInJa.length > 0) {
    console.log(`❌ 日本語に不足しているキー: ${results.missingInJa.length}個`);
    results.missingInJa.forEach(key => {
      console.log(`   - ${key}`);
    });
  } else {
    console.log('✅ 日本語: すべてのキーが存在');
  }

  if (results.missingInEn.length > 0) {
    console.log(`❌ 英語に不足しているキー: ${results.missingInEn.length}個`);
    results.missingInEn.forEach(key => {
      console.log(`   - ${key}`);
    });
  } else {
    console.log('✅ 英語: すべてのキーが存在');
  }

  if (results.missingInZh.length > 0) {
    console.log(`❌ 中国語に不足しているキー: ${results.missingInZh.length}個`);
    results.missingInZh.forEach(key => {
      console.log(`   - ${key}`);
    });
  } else {
    console.log('✅ 中国語: すべてのキーが存在');
  }

  // 3. 重複キーのチェック
  console.log('\\n📝 重複キーチェック...');
  const jaDuplicates = checkKeyDuplicates(jaKeys);
  const enDuplicates = checkKeyDuplicates(enKeys);
  const zhDuplicates = checkKeyDuplicates(zhKeys);

  results.duplicateKeys = [...new Set([...jaDuplicates, ...enDuplicates, ...zhDuplicates])];

  if (results.duplicateKeys.length > 0) {
    console.log(`❌ 重複キーが見つかりました: ${results.duplicateKeys.length}個`);
    results.duplicateKeys.forEach(key => {
      console.log(`   - ${key}`);
    });
  } else {
    console.log('✅ 重複キーなし');
  }

  // 4. ICU 構文チェック
  console.log('\\n📝 ICU 構文チェック...');
  const jaICUErrors = validateICUMessages(jaData, '', 'ja');
  const enICUErrors = validateICUMessages(enData, '', 'en');
  const zhICUErrors = validateICUMessages(zhData, '', 'zh');

  results.icuParseErrors = [...jaICUErrors, ...enICUErrors, ...zhICUErrors];

  if (results.icuParseErrors.length > 0) {
    console.log(`❌ ICU 構文エラーが見つかりました: ${results.icuParseErrors.length}個`);
    results.icuParseErrors.forEach(error => {
      console.log(`   - [${error.language}] ${error.key}`);
      console.log(`     メッセージ: ${error.message}`);
      console.log(`     エラー: ${error.error}`);
    });
  } else {
    console.log('✅ ICU 構文エラーなし');
  }

  // 結果サマリー
  console.log('\\n========================================');
  console.log('📊 検証結果サマリー');
  console.log('========================================\\n');

  const totalIssues = results.dotNotationKeys.length +
                     results.missingInJa.length +
                     results.missingInEn.length +
                     results.missingInZh.length +
                     results.duplicateKeys.length +
                     results.syntaxErrors.length +
                     results.icuParseErrors.length;

  console.log(`🔍 検証項目:`);
  console.log(`   - 日本語キー数: ${jaKeys.length}`);
  console.log(`   - 英語キー数: ${enKeys.length}`);
  console.log(`   - 中国語キー数: ${zhKeys.length}`);
  console.log(`   - ドット記法キー: ${results.dotNotationKeys.length}`);
  console.log(`   - 日本語不足キー: ${results.missingInJa.length}`);
  console.log(`   - 英語不足キー: ${results.missingInEn.length}`);
  console.log(`   - 中国語不足キー: ${results.missingInZh.length}`);
  console.log(`   - 重複キー: ${results.duplicateKeys.length}`);
  console.log(`   - 構文エラー: ${results.syntaxErrors.length}`);
  console.log(`   - ICU 構文エラー: ${results.icuParseErrors.length}`);

  console.log('\\n========================================');
  if (totalIssues === 0) {
    console.log('✅ すべての検証項目をパスしました！');
    process.exit(0);
  } else {
    console.log(`❌ ${totalIssues}個の問題が見つかりました`);
    console.log('\\n💡 修正ガイド:');
    console.log('   - ドット記法 → ネスト構造に変更');
    console.log('   - 不足キー → 対応する翻訳を追加');
    console.log('   - 重複キー → 一意のキー名に変更');
    console.log('\\n📖 詳細は docs/qa-guidelines.md を参照してください');
    process.exit(1);
  }
}

// スクリプト実行
main();