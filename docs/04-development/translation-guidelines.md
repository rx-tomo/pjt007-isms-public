# 翻訳ファイルガイドライン

## 概要
このドキュメントは、ISMS Pilot プロジェクトにおける翻訳ファイル（`messages/*.json`）の記述ルールを定めたものです。

## 重要：ドット記法の禁止

### エラーの原因
next-intl では、キー名にドット（`.`）を含めることができません。ドットはオブジェクトのネストを表すために予約されているためです。

### ❌ 誤った例（エラーになる）
```json
{
  "documents": {
    "status.draft": "下書き",
    "status.in_review": "レビュー中",
    "actions.upload": "アップロード"
  }
}
```

このような記述をすると、以下のエラーが発生します：
```
IntlError: INVALID_KEY: Namespace keys can not contain the character "." as this is used to express nesting.
```

### ✅ 正しい例
```json
{
  "documents": {
    "status": {
      "draft": "下書き",
      "in_review": "レビュー中"
    },
    "actions": {
      "upload": "アップロード"
    }
  }
}
```

## 翻訳ファイルの構造

### 基本構造
- トップレベルで機能やページごとにグループ化
- 各グループ内で論理的にネスト化
- 一貫性のある命名規則を使用

### 推奨される構造例
```json
{
  "common": {
    "appName": "ISMS Pilot",
    "buttons": {
      "save": "保存",
      "cancel": "キャンセル",
      "delete": "削除"
    }
  },
  "auth": {
    "login": {
      "title": "ログイン",
      "fields": {
        "email": "メールアドレス",
        "password": "パスワード"
      }
    }
  },
  "documents": {
    "title": "文書管理",
    "status": {
      "draft": "下書き",
      "approved": "承認済み"
    }
  }
}
```

## 命名規則

### キー名のルール
1. **小文字のキャメルケース**を使用（例：`firstName`, `emailAddress`）
2. **アンダースコア（`_`）は使用しない**
3. **ドット（`.`）は絶対に使用しない**
4. **意味のある、説明的な名前**を使用

### グループ化のルール
1. **ページ/機能単位**でトップレベルグループを作成
2. **論理的な関連性**でサブグループを作成
3. **深すぎるネスト**は避ける（最大3-4レベル程度）

## コンポーネントでの使用方法

### 基本的な使用例
```typescript
import { useTranslations } from 'next-intl';

export default function DocumentList() {
  const t = useTranslations('documents');

  return (
    <div>
      <h1>{t('title')}</h1>
      <span>{t('status.draft')}</span>
    </div>
  );
}
```

### ネストされたキーへのアクセス
```typescript
// ネストされたオブジェクトの場合
const status = t('status.draft'); // ✅ 正しい

// フラットなキーの場合（エラーになる）
const status = t('status.draft'); // ❌ status.draftというキーを探してしまう
```

## 新しい翻訳を追加する際のチェックリスト

1. ✅ キー名にドット（`.`）が含まれていないか確認
2. ✅ 適切なグループに配置されているか確認
3. ✅ 日本語（`ja.json`）と英語（`en.json`）の両方に追加
4. ✅ キー名が既存の命名規則に従っているか確認
5. ✅ 不要に深いネストになっていないか確認

## トラブルシューティング

### INVALID_KEY エラーが発生した場合
1. エラーメッセージに表示されているキーを確認
2. 該当するキーにドット（`.`）が含まれていないか確認
3. フラット構造をネスト構造に変換

### 移行スクリプト例
既存のフラット構造をネスト構造に変換する場合：

```javascript
// 変換前
const flatKeys = {
  "documents.status.draft": "下書き",
  "documents.status.approved": "承認済み"
};

// 変換後
const nestedKeys = {
  "documents": {
    "status": {
      "draft": "下書き",
      "approved": "承認済み"
    }
  }
};
```

## ベストプラクティス

1. **一貫性を保つ**: プロジェクト全体で同じ命名規則を使用
2. **コンテキストを明確に**: キー名から内容が推測できるようにする
3. **再利用を考慮**: 共通の翻訳は`common`グループに配置
4. **定期的な整理**: 使用されていない翻訳キーを削除
5. **型安全性**: TypeScriptの型定義を活用して翻訳キーの存在を保証

## 関連ドキュメント
- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [CLAUDE.md](../CLAUDE.md) - プロジェクトの開発ガイドライン