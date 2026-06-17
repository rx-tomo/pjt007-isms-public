作成日: 2025-06-04 (tom)
更新日: 2025-12-01
記録者: Codex

# コーディング規約：ディレクトリ構成とimportパス

## 目的

- 新メンバーの学習コストを削減
- コードの一貫性を保証
- バグの発生を防止
- レビュー時間を短縮

## 1. ディレクトリ構成

### 基本構造

```
pjt007/
├── app/                      # Next.js App Router
│   ├── [locale]/            # 多言語対応ルート
│   │   ├── (auth)/          # 認証関連ページグループ
│   │   ├── (dashboard)/     # ダッシュボード関連ページグループ
│   │   └── (public)/        # 公開ページグループ
│   ├── api/                 # APIルート
│   └── globals.css          # グローバルスタイル
├── components/              # 共通コンポーネント
│   ├── ui/                  # 基本UIコンポーネント
│   ├── features/            # 機能別コンポーネント
│   └── layouts/             # レイアウトコンポーネント
├── lib/                     # ユーティリティ・ライブラリ
│   ├── supabase/           # Supabase関連
│   ├── hooks/              # カスタムフック
│   ├── utils/              # ユーティリティ関数
│   └── constants/          # 定数定義
├── types/                   # TypeScript型定義
├── i18n/                    # 国際化設定
├── messages/                # 翻訳ファイル
├── public/                  # 静的ファイル
└── tests/                   # テストファイル
```

### ディレクトリ別の責務

#### `/app`
- **用途**: Next.js App Routerのページとレイアウト
- **命名規則**:
  - ページ: `page.tsx`
  - レイアウト: `layout.tsx`
  - エラー: `error.tsx`
  - ローディング: `loading.tsx`
- **グループ化**: `(groupname)`形式でルートグループを作成

#### `/components`
- **用途**: 再利用可能なReactコンポーネント
- **構造**:
  ```
  components/
  ├── ui/
  │   ├── Button/
  │   │   ├── Button.tsx
  │   │   ├── Button.test.tsx
  │   │   └── index.ts
  │   └── Card/
  ├── features/
  │   ├── DocumentList/
  │   └── RiskMatrix/
  └── layouts/
      ├── Header/
      └── Sidebar/
  ```
- **命名規則**: PascalCase（例: `Button.tsx`）
- **エクスポート**: 各ディレクトリに`index.ts`を配置

#### `/lib`
- **用途**: ビジネスロジック、ユーティリティ、外部サービス連携
- **命名規則**: camelCase（例: `formatDate.ts`）
- **構造例**:
  ```
  lib/
  ├── supabase/
  │   ├── client.ts        # Supabaseクライアント
  │   ├── auth.ts          # 認証関連
  │   └── queries/         # データベースクエリ
  ├── hooks/
  │   ├── useAuth.ts
  │   └── useDocuments.ts
  └── utils/
      ├── formatters.ts
      └── validators.ts
  ```

#### `/types`
- **用途**: TypeScript型定義
- **構造**:
  ```
  types/
  ├── database.types.ts    # Supabase自動生成型
  ├── api.types.ts        # API関連型
  └── ui.types.ts         # UI関連型
  ```

## 2. Import パスルール

### 絶対パスの使用

**tsconfig.json**の設定:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/types/*": ["./types/*"],
      "@/hooks/*": ["./lib/hooks/*"],
      "@/utils/*": ["./lib/utils/*"]
    }
  }
}
```

### Import順序

以下の順序でimportを整理:

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. 外部ライブラリ
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// 3. 内部モジュール（絶対パス）
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/formatters';

// 4. 型定義
import type { User } from '@/types/database.types';

// 5. スタイル
import styles from './Component.module.css';
```

### 禁止事項

1. **相対パスの禁止**（同一ディレクトリ内を除く）
   ```typescript
   // ❌ 禁止
   import { Button } from '../../../components/ui/Button';

   // ✅ 推奨
   import { Button } from '@/components/ui/Button';
   ```

2. **バレルエクスポートの濫用禁止**
   ```typescript
   // ❌ 禁止（パフォーマンスに影響）
   export * from './components';

   // ✅ 推奨（明示的なエクスポート）
   export { Button } from './Button';
   export { Card } from './Card';
   ```

3. **循環参照の禁止**
   - ESLintプラグインで検出・警告

## 3. ファイル命名規則

### コンポーネント
- **ファイル名**: PascalCase（例: `DocumentList.tsx`）
- **テストファイル**: `ComponentName.test.tsx`
- **ストーリー**: `ComponentName.stories.tsx`

### ユーティリティ・フック
- **ファイル名**: camelCase（例: `useDocuments.ts`）
- **テストファイル**: `fileName.test.ts`

### 定数・設定
- **ファイル名**: camelCase（例: `appConfig.ts`）
- **環境変数**: SCREAMING_SNAKE_CASE（例: `NEXT_PUBLIC_SUPABASE_URL`）

## 4. コンポーネント構造

### 基本テンプレート

```typescript
// components/features/DocumentList/DocumentList.tsx

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Card } from '@/components/ui/Card';
import { useDocuments } from '@/hooks/useDocuments';

import type { Document } from '@/types/database.types';

interface DocumentListProps {
  organizationId: string;
  onSelect?: (document: Document) => void;
}

export function DocumentList({
  organizationId,
  onSelect
}: DocumentListProps) {
  const t = useTranslations('documents');
  const { documents, isLoading } = useDocuments(organizationId);

  // コンポーネントロジック

  return (
    <div className="space-y-4">
      {/* JSX */}
    </div>
  );
}
```

### エクスポートパターン

```typescript
// components/features/DocumentList/index.ts
export { DocumentList } from './DocumentList';
export type { DocumentListProps } from './DocumentList';
```

## 5. 実装例

### ページコンポーネント

```typescript
// app/[locale]/(dashboard)/documents/page.tsx

import { getTranslations } from 'next-intl/server';

import { DocumentList } from '@/components/features/DocumentList';
import { PageHeader } from '@/components/layouts/PageHeader';
import { getDocuments } from '@/lib/supabase/queries/documents';

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'documents' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div>
      <PageHeader title="documents.title" />
      <DocumentList documents={documents} />
    </div>
  );
}
```

### カスタムフック

```typescript
// lib/hooks/useDocuments.ts

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

import type { Document } from '@/types/database.types';

export function useDocuments(organizationId: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('organization_id', organizationId);

        if (error) throw error;
        setDocuments(data || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [organizationId]);

  return { documents, isLoading, error };
}
```

## 6. ESLint設定

```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "type"
        ],
        "pathGroups": [
          {
            "pattern": "react",
            "group": "builtin",
            "position": "before"
          },
          {
            "pattern": "next/**",
            "group": "builtin",
            "position": "before"
          },
          {
            "pattern": "@/**",
            "group": "internal"
          }
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }
    ]
  }
}
```

## 7. チェックリスト

新しいファイルを作成する際の確認項目:

- [ ] 適切なディレクトリに配置されているか
- [ ] ファイル名が命名規則に従っているか
- [ ] importが絶対パスを使用しているか
- [ ] import順序が正しいか
- [ ] 型定義が適切に分離されているか
- [ ] エクスポートがindex.tsから行われているか
- [ ] テストファイルが同じディレクトリにあるか

## 8. 移行計画

既存コードの段階的な移行:

1. **Phase 1**: 新規ファイルから適用
2. **Phase 2**: 頻繁に変更されるファイルを優先的に移行
3. **Phase 3**: 全ファイルの一括移行（自動化ツール使用）

## まとめ

この規約に従うことで:
- 新メンバーがコードベースを理解しやすくなる
- import文の整理に時間を取られない
- ファイルの場所が予測可能になる
- レビュー時の指摘事項が減る
- 長期的なメンテナンスが容易になる

定期的にこの規約を見直し、チームの成長に合わせて更新していきます。