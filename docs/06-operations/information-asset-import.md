# 情報資産 CSV 取込運用ガイド

最終更新: 2025-11-12 / 担当: Codex

## ゴール
- 資産台帳（`information_assets`）へテンプレート CSV から一括登録できること。
- 取込ジョブと検証結果（重複・オーナー不一致など）を追跡できること。
- 取込失敗時のリカバリー手順と QA スクリプトを共有し、再現可能にすること。

## 取込フロー概要
1. `/[locale]/settings/assets` の「CSV取込」ボタンから CSV ファイルを選択。
2. フロントエンドでファイルを `FormData` に格納し、`POST /api/information-assets/import` へ送信。
3. ルートが Drizzle/libSQL の repository/service 層を通じて以下を実行:
   - `information_asset_import_jobs`/`information_asset_import_rows` にジョブ・行を記録。
   - 重複 (name) や owner_email 不存在、列バリデーションを実施。
   - 成功件数・エラー件数・エラー行を JSON で返却。
4. UI ではジョブ ID と結果をトースト表示し、`loadAssets` を再実行して一覧を更新。

## CSV フィールドマッピング
| 列名 | 必須 | 受入値 | 説明 |
| --- | --- | --- | --- |
| `name` | ✅ | 文字列 (200 文字以内) | 資産名。ジョブ内で重複不可。 |
| `asset_type` | 任意 | `hardware`/`software`/`data`/`service`/`facility`/`personnel`/`other` | 無効値は `other` にフォールバック。 |
| `classification` | 任意 | `restricted`/`internal`/`public` | 無効値は `internal`。 |
| `criticality` | 任意 | `low`/`medium`/`high` | 無効値は `medium`。 |
| `status` | 任意 | `in_use`/`retired`/`planned` | 無効値は `in_use`。 |
| `owner_email` | 任意 | 組織内ユーザーのメールアドレス | 一致するユーザーがいない場合はエラー行としてスキップ。 |
| `owner_name` | 任意 | 文字列 | ログ用途のみ (DB には保存されない)。 |
| `location`/`description` | 任意 | 文字列 | 空文字は null。 |

> 最大 1,000 行まで同時取込可。必要に応じてファイルを分割する。

## トラブルシュート
| 症状 | 原因 | 対応 |
| --- | --- | --- |
| `asset "XXX" already exists` | 同一組織で `name` が重複 | CSV 内または既存資産から重複を解消後に再取込。 |
| `owner user@example.com not found in organization` | `owner_email` と一致するユーザーがいない | ユーザーを作成/招待するか、列を空欄にして取込。 |
| `rows must be a JSON array` | CSV が空/ヘッダー欠落 | テンプレート形式 (`name,...`) を守る。 |
| `CSV row limit exceeded` | 1,000 行を超える | 複数ファイルに分割。 |

## QA とログ
1. `.env.local` などから対象テナントの `QA_ORGANIZATION_ID` と `QA_USER_ID`（Org Admin 以上）を取得。
2. 開発サーバーを `npm run dev`（Port 3007 デフォルト）で起動。
3. `scripts/qa-asset-import.js` を実行:
   ```bash
   QA_ORGANIZATION_ID=<org_uuid> \
   QA_USER_ID=<user_uuid> \
   QA_SERVER_PORT=3007 \
   node scripts/qa-asset-import.js
   ```
4. 成功すると `test-results/asset-import-YYYY-MM-DDTHH-mm-ss.json` が生成され、
   - `jobId`, 成功/失敗件数, サンプル CSV が保存される。
5. エラー行が存在する場合はログ内 `errors` を参照し、UI トーストと内容が一致することを確認。

## 付録
- スキーマ/マイグレーション: `lib/db/drizzle/schema/`, `drizzle/`
- API ルート: `app/api/information-assets/import/route.ts`
- クライアント: `app/[locale]/settings/assets/page.tsx` (CSV 取込ボタン), `InformationAssetService.getAssetsForRisk()`
