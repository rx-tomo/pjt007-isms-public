# 2025-11-18 管理策ウィザード（Annex A テンプレート）設計
作成者: Codex / 2025-11-18

## ゴール
- `/ja/settings/controls` でユーザーが 0 から管理策を登録する負担を減らし、ISO/IEC 27001 Annex A（2022版）に沿ったコントロールを一括投入できるようにする。
- ウィザードから登録した管理策は通常の CRUD と同様に編集・削除できる。削除した後に再度ウィザードから復元するユースケースもサポートする。

## 現状
- `iso_controls` テーブルはテナント専用。種別もカテゴリーもユーザーが自由入力する必要があり、規格準拠の初期セットがない。
- 管理策データソースは存在しないため、ウィザードの再現性が無い。
- UI はモーダルフォーム（`ControlsManagementPage`）で 1 件ずつ登録するのみ。

## 提案アーキテクチャ
### 1. テンプレートデータ層
- 新テーブル `control_templates`（または JSON シード）を追加。主キーは `template_key`（例: `annex_a.5.7`）。  
- カラム例: `locale`, `title`, `category`, `control_code`, `description`, `default_tags`, `annex_reference`, `is_default_selected`.
- Supabase シードに Annex A 93 個（必要に応じて追加）を登録。多言語対応は `messages` に key だけを置くのではなく、テンプレート側で `ja` / `en` の文言を保持する。

### 2. API / サービス
- `IsoControlService` に `listTemplates({ locale, query, category })` / `seedFromTemplates({ ids, overwriteMode })` を追加。  
- サーバー側 API `/api/settings/controls/seed`（POST）を実装し、`organizationId`・`templateIds[]`・`mode`（`insert` / `restore` / `overwrite`）を受け取る。  
- `mode=restore` の場合は既存レコードを保持しつつ、削除されたテンプレートのみ再作成。`overwrite` は同じ `control_code` を更新。

### 3. UI フロー
1. 「附属書 A から追加」ボタンを `/settings/controls` のヘッダーに追加。  
2. クリックでフルスクリーンモーダル（`ControlSeedWizardDialog`）を開き、以下のステップを表示。
   - **Step 1**: 規格/カテゴリを選択（Annex A / NIST CSF など拡張を見据え、タブ UI）。  
   - **Step 2**: コントロール一覧（検索・カテゴリフィルタ・チェックボックス）。Hover で説明をプレビュー、`View details` から全文をサイドパネルで表示。  
   - **Step 3**: インポート設定（`mode` 選択、既存ロールとの衝突表示）。  
   - **Step 4**: 結果サマリー（新規作成数 / 上書き数 / スキップ数 + トースト）。
3. 登録完了後は `controls` リストを再読み込みし、`WindowToast` で結果を通知。

### 4. データ整合性
- `iso_controls` に `template_key` カラムを追加し、ウィザード経由で作られたレコードを識別。  
- `template_key` が一致するレコードを削除した場合、ウィザードは「再適用可」と表示する。
- RLS: 既存の org 隔離ポリシーを維持。テンプレートは `public` スキーマ等で全テナント共通の読み取りができるようにする（`SECURITY DEFINER` 関数で提供）。

### 5. QA / ドキュメント
- Playwright シナリオ: `tests/e2e/controls-template-wizard.spec.ts`（選択 → seed → リスト反映→ 再適用）。  
- `scripts/qa-controls.js` に CLI でテンプレート投入 → 削除 → 再投入を行うステップを追加。  
- `docs/06-operations/controls.md` にウィザード利用手順・制限事項（最大投入件数、再適用の挙動）を記載。

## タスク
- [x] Supabase に `control_templates`（seed data）と `iso_controls.template_key` を追加。（2025-11-18, マイグレーション 20251118100500）
- [x] `IsoControlService` + 新規 API でテンプレート取得／投入処理を提供。（2025-11-18, `lib/services/isoControl.ts` 実装済み）
- [x] `ControlSeedWizardDialog` を実装し、UI からテンプレート選択～結果表示までを実現。（2025-11-18, `components/settings/controls/ControlTemplateWizard.tsx` 実装済み）
- [x] ドキュメント / QA 更新。（2025-12-01, コミット 584993f - `docs/06-operations/controls.md`, `scripts/qa-controls.js`, `tests/e2e/controls-template-wizard.spec.ts` 追加）

## EARS 要件
1. **When** 管理者が「附属書 A から追加」ボタンを押下したとき、**the system shall** テンプレート一覧モーダルを開き、カテゴリフィルタ・検索・チェックボックス選択を提供する。
2. **When** ユーザーがテンプレートを選択して `mode=insert` でシードを実行したとき、**the system shall** `control_templates.template_key` をキーに未存在の管理策のみ `iso_controls` へ追加し、結果サマリー（作成件数/スキップ件数）を表示する。
3. **When** 既存の管理策がテンプレート由来で削除されている状態で `mode=restore` を実行したとき、**the system shall** 同じ `template_key` を持つレコードを再作成し、復元件数を通知する。
4. **When** `mode=overwrite` を選択したとき、**the system shall** 同じ `template_key` のフィールド（タイトル/説明/タグ）を最新テンプレートで更新し、ユーザー編集済みのフィールドは差分ダイアログで確認させた後に上書きする。
5. **When** ユーザーがテンプレート詳細パネルで説明を確認したとき、**the system shall** Annex 参照（例: A.5.7）と翻訳済みタイトル/説明/推奨タグを表示し、チェックボックス状態と同期させる。
