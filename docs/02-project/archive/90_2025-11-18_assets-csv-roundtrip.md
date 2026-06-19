# 2025-11-18 情報資産 CSV エクスポート/インポート整合性
作成者: Codex / 2025-11-18

## 事象
- `/ja/settings/assets` で CSV をエクスポート → 加工せず即インポートしても毎回エラーになる。
- エラー内容は `asset "<name>" already exists` もしくは `owner xxx not found`。ユーザーから見ると「出力＝テンプレート」と期待しているため原因不明となる。

## 原因分析
1. **エクスポートは既存資産のスナップショット**  
   - `handleExportCsv` がクライアント側で `information_assets` の現在値（名前・種別・分類…) を CSV に書き出している。`id` や `organization_id` など一意情報は含まれない。
2. **インポート RPC は「新規登録専用」**  
   - `app/api/information-assets/import/route.ts` → Supabase RPC `run_information_asset_import` は、同一組織内で `name` が重複すると即 `asset "<name>" already exists` を返す（既存資産を上書きできない）。  
   - 所有者紐付けは `owner_email` で解決する仕様だが、エクスポート CSV では owner_email が空になるケース（未割当 / ユーザー削除）があり、そのまま再インポートすると `owner not found` になる。
3. **テンプレート不在**  
   - ドキュメント上でも「エクスポートした CSV を編集→再投入」の公式フローが記述されておらず、ユーザーは暗黙的に round-trip できると誤解している。

## 解決方針
1. **モードを分ける**  
   - `run_information_asset_import` に `p_mode`（`'insert' | 'upsert' | 'replace'`）を追加。  
   - `insert`（既定）: 現行挙動。  
   - `upsert`: `name` が一致した場合は更新、未存在は追加。  
   - `replace`: 事前に `information_assets` をバックアップした上で全削除→CSV 内容で再生成（要ダブル確認）。
   - **権限制御**: `replace` は System Operator（または Super Admin）だけが UI で選択できる。Org Admin やその他ロールは insert/upsert のみ利用可能とし、バックアップ承認ダイアログも System Operator 専用に表示する。
2. **エクスポート形式の拡張**  
   - CSV に `id`、`owner_email` を必須列として含め、空の場合は `owner_email` の列ヘッダーだけ残す。  
   - オプションで `exportForImport=true` を指定するとテンプレートに合わせた列（owner_email, owner_name, location, description, status など）だけを出力。`updated_at` など UI 専用列は除外。
3. **テンプレートファイルと検証**  
   - `/api/information-assets/template.csv` を追加し、必要な列とサンプル値を提供。  
   - インポート時に `owner_name` しか指定されていない場合でも `owner_email` を解決できる補助検索（`user_profiles.full_name`）を実装し、曖昧一致は警告を返す。
4. **UX 改善**  
   - `/settings/assets` に「既存資産を更新する」「新規追加のみ」「全入れ替え」の選択肢と説明をモーダルで表示。  
   - 結果サマリーには成功件数・上書き件数・スキップ件数を明示。
5. **ドキュメント/QA**  
   - `docs/06-operations/assets.md` に CSV round-trip 手順と制約を記載。  
   - `scripts/qa-assets-import.js` を追加し、`export → modify row → upsert import` の E2E を自動化。

## タスク
- [x] Supabase 関数 `run_information_asset_import` をモード付きにリファクタし、`id`/`owner_email` の扱いを拡張。（2025-11-18 実装済み）
- [x] `/api/information-assets/export` API を実装してサーバー側で CSV を生成（列順と BOM を統一）。（2025-11-18, `app/api/information-assets/export/route.ts` 実装済み）
- [x] `/settings/assets` UI へモード選択 + テンプレートダウンロード導線を追加し、旧クライアント側エクスポートロジックを廃止。（2025-12-01, コミット e87c332 - replace モード System Operator 制限追加）
- [x] QA スクリプト・ドキュメント更新。（2025-12-01, `scripts/qa-assets-import.js`, `docs/06-operations/assets.md` 追加）

## EARS 要件
1. **When** ユーザーが「エクスポート」ボタンを押下したとき、**the system shall** サーバー側 `/api/information-assets/export` で `id`, `name`, `asset_type`, `classification`, `criticality`, `status`, `owner_email`, `location`, `description`, `updated_at` をこの順序で含む UTF-8/BOM 付き CSV をダウンロードさせる。
2. **When** ユーザーが「インポート」モーダルで `モード=insert` を選択して CSV をアップロードしたとき、**the system shall** `run_information_asset_import` で名前重複を検出した行を失敗としてスキップし、成功/失敗件数と行番号をトーストおよび結果ダイアログに表示する。
3. **When** `モード=upsert` で CSV を送信したとき、**the system shall** `id` または `name` をキーに既存レコードを更新し、`owner_email` が一致しない場合は `owner_name` の部分一致検索を試み、解決できない場合は当該行のみエラーとして報告する。
4. **When** `モード=replace` を実行したとき、**the system shall** 事前に最新バックアップを保存し、ユーザーが最終確認を承認した場合のみ既存資産を全削除→CSV 内容で再生成し、完了後にバックアップダウンロードリンクを提示する。
