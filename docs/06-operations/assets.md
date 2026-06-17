# 情報資産 CSV 運用ガイド

本ドキュメントでは、情報資産の CSV エクスポート/インポート機能の使用方法と制約について記載します。

## 1. 概要

`/settings/assets` 画面では、情報資産のデータを CSV 形式でエクスポート・インポートできます。

### 機能一覧

| 機能 | 説明 |
|------|------|
| エクスポート | 現在登録されている資産を CSV でダウンロード |
| テンプレートダウンロード | インポート用のテンプレート CSV をダウンロード |
| インポート | CSV ファイルから資産を一括登録・更新 |

## 2. CSV フォーマット

### 列構成

エクスポートされる CSV は以下の列を含みます（BOM 付き UTF-8）：

| 列名 | 説明 | 必須 |
|------|------|------|
| `id` | 資産 UUID（upsert 時の一致キー） | - |
| `name` | 資産名 | ✓ |
| `asset_type` | 種別（hardware/software/data/service/facility/personnel/other） | - |
| `classification` | 分類（restricted/internal/public） | - |
| `criticality` | 重要度（low/medium/high） | - |
| `status` | 状態（in_use/retired/planned） | - |
| `owner_email` | 所有者メールアドレス | - |
| `location` | 保管場所 | - |
| `description` | 説明 | - |
| `updated_at` | 最終更新日時（エクスポート専用） | - |

### インポート時の値解決

- `owner_email` が指定された場合、組織内のユーザーから一致するメールアドレスを検索し `owner_id` に紐付けます。
- 見つからない場合は当該行のみエラーとなります。

## 3. インポートモード

### insert（新規のみ追加）

- 既定のモード。
- `name` が組織内で重複する場合はエラーとなり、スキップされます。
- 新規資産のみ登録されます。

### upsert（既存更新 / 未登録追加）

- `id` または `name` をキーに既存レコードを検索します。
- 一致するレコードがあれば更新、なければ新規追加します。
- エクスポート → 編集 → 再インポートのラウンドトリップに適しています。

### replace（全件置換）

- **System Operator 専用**（Org Admin やその他のロールは UI から選択不可）。
- インポート前に既存資産のスナップショットを `information_asset_import_jobs.backup_snapshot` に保存します。
- 組織内の全資産を削除し、CSV 内容で再生成します。
- 事前にバックアップを確認してから実行してください。

## 4. エクスポート手順

1. `/settings/assets` 画面を開く
2. 一覧の上部にある「CSV出力」ボタンをクリック
3. 検索フィルターが適用されている場合は、フィルター結果のみがエクスポートされます
4. ダウンロードされた CSV を Excel や Google Sheets で開いて確認

## 5. インポート手順

1. `/settings/assets` 画面を開く
2. 「取り込みモード」を選択（insert / upsert / replace）
3. 「CSV取込」ボタンをクリックし、ファイルを選択
4. 処理結果がトースト通知で表示されます
   - 成功件数、エラー件数、エラー詳細（最大3行）

### テンプレートの利用

- 「テンプレートDL」ボタンをクリックすると、空のテンプレート CSV をダウンロードできます
- テンプレートを編集し、`insert` モードでインポートしてください

## 6. バックアップの確認（replace モード）

`replace` モードで実行した場合、バックアップは `information_asset_import_jobs.backup_snapshot` に JSON 形式で保存されます。

### バックアップの取得（SQL）

```sql
SELECT
  id AS job_id,
  created_at,
  backup_snapshot
FROM information_asset_import_jobs
WHERE organization_id = '<organization-id>'
  AND mode = 'replace'
  AND backup_snapshot IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

### バックアップからの復元

バックアップ JSON を CSV に変換して再インポートするか、直接 SQL で `INSERT` してください。

## 7. トラブルシューティング

| 症状 | 対応 |
|------|------|
| `asset "<name>" already exists` | `insert` モードで既存資産と同名の行がある。`upsert` モードに変更するか、名前を変更してください |
| `owner xxx not found` | `owner_email` に指定されたメールアドレスが組織内ユーザーに存在しない。メールアドレスを確認するか、空にしてください |
| `CSV row limit exceeded` | CSV の行数が 1000 行を超えている。ファイルを分割してください |
| エクスポートしたファイルがそのままインポートできない | `insert` モードでは名前重複がエラーになる。`upsert` モードを使用してください |

## 8. 関連ファイル

- `app/api/information-assets/export/route.ts`
- `app/api/information-assets/import/route.ts`
- `lib/db/drizzle/schema/`
- `drizzle/`
- `app/[locale]/settings/assets/page.tsx`
