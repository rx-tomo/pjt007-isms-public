作成日: 2025-06-02 (tom)
更新日: 2026-03-25
記録者: Codex

# ユースケース別ウォーキングスケルトンチェックリスト

本ドキュメントは UC-01〜UC-09 までのウォーキングスケルトン手順をチェックリスト形式で管理します。既存ドキュメントから参照する場合は `docs/02-project/11_walking-skeleton-plan.md` を基点にしてください。
※ UC-10（テナントプロビジョン）は追加済み。Supabase 新プロジェクト ref `vnuyhmytnveohbydlcoh` で Playwright/E2E が通過済み。詳細は下記ステータスを参照。

## 使い方
- チームで確認した最新状況に合わせてチェックボックスを更新します。
- GitHub Issue と同期する場合は本ドキュメント全体をコピーし、Issue本文に貼り付けてください。
- チェック実施日や担当者は必要に応じてコメント欄などへ追記してください。
- 各ユースケースの詳細なテスト観点・コマンド・Playwright 仕様は `docs/05-quality/uc/UC-01-onboarding/qa-plan.md` 〜 `UC-10-tenant-provision/qa-plan.md` を確認し、ウォーキングスケルトン完了後に必ず更新します。

---

## ロール別ウォーキングスケルトン状況（2025-10-25）

### Phase A 基盤安定化（2026-03 完了）
- ✅ Supabase Auth → Better Auth 完全移行。全ロールの Dev Login / セッション管理が Better Auth ベースで動作確認済み。
- ✅ Drizzle ORM（SQLite/libsql）スキーマ完成。全テーブルの Drizzle 定義とリレーション設定を検証済み。
- ✅ レート制限（Rate Limiting）を全 API エンドポイントに適用済み。
- ✅ 承認エスカレーション cron ジョブを設定し、期限超過承認の自動通知が動作確認済み。
- ✅ ユーザーマニュアル（docs/08-user-manual）を最新 UI に同期完了。

### スーパー管理者（super_admin）
- ✅ Dev Login で Super Admin ロールを選択し、テナント非依存のセッションが `/ja/super-admin/organizations` へリダイレクトされることを確認（2025-11-07 QA ログ）。
- ✅ `npm run e2e:super-admin` でテナント作成→ロック/解除→監査ログ確認のハッピーパスが自動化されていることを記録（`docs/05-quality/qa-2025-11-07-super-admin.md` 参照）。
- ✅ Runbook（`docs/06-operations/super-admin-runbook.md`）に従い、Edge Function `tenant-admin` と `list_global_audit_logs` RPC の前提条件をクリアしてからテナント操作ができることを確認。
- ✅ `supabase functions serve tenant-admin --env-file supabase/.env` を起動し、`/ja/super-admin/organizations` のテナント一覧 API（`list_all_tenants`）が 500 を返さないことを確認（2025-11-10）。
- [x] Edge Function `tenant-admin` にヘルスチェック／フェイルオーバー手順を整備し、Super Admin Runbook から監視・切替できるようにする（Plan Tracking #9, Issue `sa-function-ha`, 2025-11-14 実装完了。`/health` endpoint、Super Admin UI バナー、Runbook 更新済み。証跡: `test-results/super-admin-ha*.json`）。

### システム運営者（system_operator）
- ✅ UC-01 初期オンボーディング導線とホームダッシュボードのロール差分を Dev Login で確認済み。
- ✅ 監査ナビゲーション権限やクイックリンク構成は `lib/home/roleHomeConfig.ts` へ集約済み。
- ✅ `/ja/settings/organization`・`/ja/settings/users` で体制ロール／権限編集を実施し、必須ロール割当と権限トグルがオンボーディング進捗に反映されることを確認（Dev Login system_operator → 体制ロール割当 → 権限保存 → 100% 達成）。

### 組織管理者（org_admin）
- ✅ オンボーディング、文書テンプレート展開、監査/ホームの主要導線はウォークスルー済み。
- ✅ DocumentService 連携（OR-03/04）と情報資産台帳（OR-06）を実データで確認済み。
- ✅ Stripe テストモード（実環境または `STRIPE_TEST_MODE=mock`）で Price ID／Webhook 相当のデータ同期を完了。`npm run mock:stripe` により `subscriptions` / `payment_history` の更新ログを取得済み。

### 一般ユーザー（user）
- ✅ Dev Login で `/ja/home` の表示と通知センター（既読／設定）を確認済み。
- ✅ `npm run mock:tasks` 実行後に `/ja/tasks` でタスク作成・進捗更新・コメント追加・通知連携を確認済み（Dev Login org_admin で手動 QA / scripts ログ参照）。文書閲覧／ダウンロードの年次レビューは別途確認継続。

### 監査員（auditor）
- ✅ 監査ダッシュボード～証跡・不適合・報告書までの導線をウォーキングスケルトンで確認し、`tests/e2e/audit-walkthrough.spec.ts` で自動化済み。
- ✅ 監査報告書 PDF 出力と容量運用ガイドを整備し、Dev Login auditor → 報告書保存 → PDF ダウンロードまでウォークスルー確認済み。

### 承認者（approver）
- ✅ ホーム導線と 2 段階承認ワークフロー（文書レビュー）を QA 済み。
- ✅ 文書一覧・バージョン履歴モーダル・通知センターを承認者ロールで再確認（2025-11-04）。`tests/e2e/doc-approver.spec.ts` の "approver reviews assigned document with version history" と `npm run qa:documents:approver` のログで通過を記録。

## UC-01 初期オンボーディング
- [x] `npm run test:e2e` を実行し、サインアップ系E2Eテストが成功することを確認する。
- [x] `/ja/auth/signup` から新規登録し、Supabase Auth でアカウントが作成されることを確認する。
- [x] `/api/auth/signup` が `organizations` / `user_profiles` にレコードを作成することを Supabase Studio で確認する。
- [x] リダイレクトで `/ja/home?onboarding=success` に遷移し、オンボーディング完了バナーとセッション保持を確認する。
- [x] 招待リンク `/ja/auth/invite?token=...` で招待詳細が表示され、氏名・パスワード入力→Supabase Auth サインアップ→`/api/auth/invite/accept` 実行→`/ja/home` リダイレクトまでを通しで確認する（期限切れトークン／重複登録エラーも含めて検証）。
- [x] ホーム画面の「オンボーディング進捗」カードで初期設定ステップの完了状況とリンクが表示されることを確認する（ローディングスケルトン／取得失敗時フォールバック付き）。
- [x] メール認証有効化時の挙動（将来課題）を検証してメモを残す。
- [x] Org Admin がメンバー招待→メール受信→登録完了までを 1 度のウォークスルーで確認する（OR-01 完了後に実施）。
- [x] プロジェクト体制管理で必須ロールに担当者を割り当て、オンボーディングカードと設定画面サマリーの両方で「体制構築」ステップが完了になることを確認する。
## UC-02 課金と契約管理
- [x] Stripe API 2025-05-28.basil 仕様へ対応するコードを反映し、`npm run typecheck` / `npm run lint` を通過させる（2025-09-18）。
- [x] `.env.local` に Stripe テスト公開鍵／秘密鍵を設定し、Next.js 再起動で読み込まれることを確認する（2025-10-14）。
- [x] `.env.local` に Price ID（`STRIPE_PRICE_*`）と `STRIPE_WEBHOOK_SECRET` を設定し、`npm run setup:stripe` で `pricing_plans.stripe_price_id` が更新されることを確認する（2025-10-14）。
- [x] `stripe listen --forward-to http://localhost:3007/api/stripe/webhook` を起動して Webhook を受信できる状態を確認する（モック環境では `npm run mock:stripe` で代替、2025-10-14）。
- [x] Pricing 画面または `npm run qa:stripe` から Checkout を実行し、Stripe テスト鍵で決済が完了することを確認する（2025-10-23 QA ログ: `cs_test_a1A37Drhp5h2qSjkF1UaOiCwiIa1oK7DBALBccJGvhrzZ8oW0HfwVk5Lou`）。
- [x] Webhook 受信後に `subscriptions` と `payment_history` が更新されることを確認する（2025-10-23 `stripe listen` + QA スクリプトで実データ反映を確認）。
- [x] Webhook 処理で `organizations.subscription_plan` / `subscription_status` が最新値へ同期され、キャンセル時は `documents.retention_delete_at` を 90 日後に更新することを確認する（`supabase/migrations/20251007011000_document_version_usage.sql` 内の `update_organization_subscription_status`, 2025-10-23）。
- [x] Settings > Subscription ページで最新の契約情報が表示されることを確認する。
- [x] Billing Portal でプラン変更／キャンセル後に `/api/stripe/sync-subscription` を叩き、Settings/Home の契約情報が一致することを確認する（2025-11-13 `npm run qa:uc02-org-admin` へ更新。実行ログは `test-results/uc02-org-admin-*.json` を参照。Stripe テスト鍵/WHS 設定必須）。
- [x] `docs/05-quality/qa-uc02-org-admin-operator.md` / `qa-uc02-finance-operator.md` のオペレーター手順書を作成し、Portal 操作と異常系リカバリー手順を反映する（2025-11-12 Codex）。
- [x] Stripe 署名付き Webhook イベントの重複/並列配信でも `stripe_events` を参照して冪等に処理できることを自動/手動 QA し、Runbook へ追記する（Plan Tracking #10 完了。`stripe_events` にイベント ID 記録＋ユニーク制約で二重処理防止。重複イベントは 409 を返す。`npm run qa:uc02-org-admin` / `qa:webhook:abnormal` で検証済み。証跡: `test-results/uc02-org-admin-*.json`）。

> 備考 (2025-11-12, 担当: Codex)
> - Runbook: `docs/05-quality/qa-uc02-org-admin-operator.md` / `qa-uc02-finance-operator.md` で Portal 差分 CLI・Finance 照合作業を標準化し、`docs/05-quality/uc/UC-02-billing/{assets,logs}` への証跡保存手順を追記。
> - Billing Portal 復旧: `docs/06-operations/billing-and-data-operations.md#6-billing-portal-変更キャンセル後の同期と復旧` と連携し、CLI (`npm run qa:uc02-org-admin`) / Playwright (`npm run qa:uc02-org-admin:playwright`) の実行結果を Issue #171 から参照。
> - 証跡: `test-results/uc02-org-admin-*.json` など CLI ログと Home/Settings スクリーンショットを docs/05-quality/uc/UC-02-billing/logs/ に保存済み。
> - 更新履歴: `docs/02-project/archive/90_2025-11-10_progress.md` に 2025-11-12 の追記あり。Plan Tracking 未対応 #10（Portal Sync Runbook）はクローズ。

## UC-03 ホーム閲覧（旧ダッシュボード）
- [x] Supabase/Stripe サービスの型整備とホーム連携コードを更新し、`npm run typecheck` / `npm run lint` を通過させる（2025-09-18）。
- [x] ログイン状態で `/ja/home` にアクセスし、Supabase から取得した統計カードとステータス内訳が表示されることを確認する。
- [x] （2025-10-07追記）統計カードとインサイトが Supabase の実データ（タスク: todo / in_progress / review、期限超過、文書: in_review、監査計画: planning / scheduled / in_progress、リスク: identified〜monitoring）を反映することを確認する。
- [x] Dev Login 経由で各ロール（super_admin / system_operator / org_admin / user / auditor / approver）の `/ja/home` 表示を確認し、ナビゲーション差分と権限に齟齬がないか記録する。（2025-10-10、Super Admin は `/ja/super-admin/organizations` へのリダイレクトも確認）
- [x] Stripe キー未設定時にモック値が表示され、エラーで UI が崩れないことを確認する。
- [x] Stripe キー設定済み環境で実際の契約情報が表示されることを確認する。
- [x] 異常系（ネットワーク断・Supabase 停止）時にフェールセーフ警告と暫定値表示が行われることを確認する（2025-11-05、`npm run qa:home` フェールセーフモードと `tests/e2e/home-failsafe.spec.ts` で検証）。
- [x] KPI グラフ（Status Breakdown ドーナツ / 凡例）を実装し、Supabase 集計値で描画されることを確認する（2025-11-12 Issue #155 / `npm run qa:home` で検証）。
- [x] 最近の活動ログと通知センター連携を実装し、`mock:activities` あるいは `npm run qa:home:activity` で Org Admin / Approver の Recent Activity feed と通知既読同期を検証 (`tests/e2e/home-activity-feed.spec.ts` + `test-results/home-activity-feed-*.json` に証跡)。

## UC-04 文書管理
- [x] 文書ページとフォルダーツリーの型定義を整備し、`npm run typecheck` / `npm run lint` を通過させる（2025-09-18）。
- [x] `/ja/documents` にアクセスし、フォルダーツリーと文書一覧が Supabase から取得されることを確認する（mock:tasks 実行後、関連文書のリンクを手動確認 2025-10-14）。
- [x] 文書アップロード・ダウンロードが成功し、`documents` テーブルと Supabase Storage に反映されることを確認する（2025-11-12 `npm run qa:documents:upload` / `qa:documents:evidence` ログ: `docs/05-quality/uc/UC-04-documents/logs/2025-11-12_upload-download.log`）。
- [x] フォルダー作成・削除が動作し、RLS 適用下で他組織データにアクセスできないことを確認する。（2025-10-25 更新。作成 UI は `app/[locale]/documents/page.tsx` に実装済み。）
- [x] 文書一覧で部門フィルタを適用し、作成者の所属部門に応じて表示が更新されることを確認する。（2025-10-25）
- [x] 権限設定モーダルで部門スコープを割り当て、限定ユーザーが他部門の文書・リスク・タスクへアクセスできないことを確認する。（2025-11-08）
- [x] 文書バージョン管理・承認フローを実装／確認する（承認モーダル + バージョン履歴モーダル: `app/[locale]/documents/page.tsx`、`submitApprovalRequest`: `lib/services/document.ts:695`。2025-11-04 Playwright `tests/e2e/doc-approver.spec.ts` で承認者視点・通知・バージョン履歴を自動検証）。
- [x] `/ja/documents/new` でドラフト保存／レビュー依頼が実データを作成することを確認する（2025-10-16 OR-03 完了）。
- [x] テンプレート一覧から文書生成を実行し、本文・バージョン・監査ログが作成されることを確認する（2025-10-15 OR-04 完了）。
- [x] 文書の Docx/PDF/Excel エクスポートを実行し、Docx（OpenXML ZIP, `word/document.xml` にメタデータ行）と Excel（SpreadsheetML）ともにダウンロードできることを確認する（API `/api/documents/[id]/export` 実装済み）。
- [x] Service Role ガードと `export_events` ログでエクスポート操作を監査し、`test-results/document-export-*.json` へ CLI/Playwright の `export_events` クエリ結果とファイル名を保存して検証できるようにしたうえで組織外リクエストを拒否する仕組みを整備する（Plan Tracking #7 / Issue `document-export-compliance`, 2025-11-14）。

## UC-05 リスクアセスメント
- [x] リスク一覧／詳細／編集ページの型定義と副作用整理を行い、`npm run typecheck` / `npm run lint` を通過させる（2025-09-18）。
- [x] `/ja/risks` にアクセスし、リスク一覧とカテゴリが Supabase から取得されることを確認する。（Playwright `tests/e2e/risks.spec.ts` で空状態メッセージと登録導線を確認 2025-10-12）
- [x] 文書作成ステップで承認用ドラフトが登録できることを確認する（/ja/documents/new のドラフト保存・レビュー依頼を実行）。
- [x] 新規リスク作成・編集・削除が動作し、マトリクス表示が更新されることを確認する（新規/編集ページ: `app/[locale]/risks/new/page.tsx`, `app/[locale]/risks/[id]/edit/page.tsx`、削除ハンドラ: `app/[locale]/risks/page.tsx:104`）。
- [x] リスク対応策（Treatment）の登録・更新ができることを確認する（対応策フォーム: `app/[locale]/risks/[id]/page.tsx:172`、`RiskService.addRiskTreatment`: `lib/services/risk.ts:172`）。
- [x] レポート生成・PDF/Excel 出力を実装／確認する（`/api/risks/export?format=` で Excel/PDF を切り替え、リスク一覧のフィルタ条件を尊重してダウンロードできることを 2025-11-12 に確認）。
- [x] 情報資産台帳に資産を登録し、リスク作成時に資産を紐付けできることを確認する（/ja/settings/assets と RiskAssetService で検証済み 2025-10-12）。
- [x] ギャップ分析ダッシュボードで部門別適合状況を閲覧し、CSV/PDF を出力できることを確認する（`/risks/gap-analysis` 実装済み）。
- [x] リスク対応で Annex A 管理策を検索・割当できることを確認する（ISO 管理策ライブラリ + risk_control_links を 2025-10-12 に検証）。
- [x] リスク一覧で部門フィルタを適用し、所有者の所属部門に応じて表示が更新されることを確認する。（2025-10-25）
- [x] リスクの PDF/Excel エクスポートを実行し、ダウンロードファイルの列構成と PDF シグネチャ/Content-Type が仕様通りであることを確認する（`npm run qa:risks:export` で Excel フィルタと PDF 生成を 2025-11-12 に検証完了）。
- [x] Dev Login の標準テナントで `npm run seed:risks-demo` を実行し、`npm run db:seed -- --demo risks` / `psql -f supabase/seed/risk_demo.sql` のフォールバック経路でも同じ 5 件（Critical 1 / High 2 / Medium 2）＋情報資産/関連タスクが `/ja/risks` に現れることを確認し、`docs/05-quality/qa-uc05-org-admin-operator.md` と `docs/05-quality/qa-uc05-approver-operator.md`、`docs/05-quality/uc/UC-05-risks/qa-plan.md`、`docs/05-quality/uc-validation-20250918.md`、`docs/06-operations/development-environment-guide.md` に Seed と `/ja/risks` 確認手順、ログ（`docs/05-quality/uc/UC-05-risks/logs/`）/スクリーンショット（`docs/05-quality/uc/UC-05-risks/assets/`）/`test-results/risks-export.xlsx` の保存場所を明示して Plan Tracking #2 を完了（2025-11-16 Issue #190）。
- [x] `docs/05-quality/qa-uc05-org-admin-operator.md` / `qa-uc05-approver-operator.md` のオペレーター手順書を作成し、関連タブ・期間フィルタの手動検証フローを定義する（2025-11-12 Runbook 初版作成）。
- [x] Approver ロール向け `npm run qa:uc05-approver` と Runbook (`docs/05-quality/qa-uc05-approver-operator.md`) を更新し、Approve/Reject 判断と通知/監査証跡の突合せ手順を記録する（2025-11-13, Issue #173）。

## UC-10 テナントプロビジョン（Super Admin → Org Admin 初期設定）
- [x] `PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/tenant-provision.spec.ts --project=chromium` が通過することを確認する。
- [x] `.env.local` に `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定し、`scripts/seed-tenant-sample1.js --org <id>` が成功することを確認する。
- [x] エクスポート結果（`test-results/tenant-export-actual.zip`）が期待 ZIP（docs/sample/tenant-sample1/tenant-sample1.zip）と一致することを `scripts/compare-tenant-export.js` で確認する。
- 状態: ✅ Pass（Supabase 新プロジェクト ref `vnuyhmytnveohbydlcoh` で差分ゼロ）
- 最終実行: 2025-11-27 / 証跡: Playwright trace（tests/e2e/tenant-provision.spec.ts, trace on）

## UC-06 タスク運用
- [x] タスク一覧／詳細／新規ページの型定義と Supabase クライアントの整備を実施し、`npm run typecheck` / `npm run lint` を通過させる（2025-09-18）。
- [x] `/ja/tasks` にアクセスし、タスク一覧とフィルターが Supabase から取得されることを確認する。（Playwright `tests/e2e/tasks.spec.ts` でシードタスク表示を確認 2025-10-12）
- [x] 新規タスク作成・編集・ステータス更新が動作することを確認する（Dev Login org_admin + `npm run mock:tasks` で `todo→in_progress` 更新を確認 2025-10-14）。
- [x] コメントが適切に表示・更新されることを確認する（mock スクリプトでコメント挿入→詳細画面で表示を確認 2025-10-14）。
- [x] 添付ファイルの追加・削除が動作し、`task_attachments` が更新されることを確認する（タスク詳細 UI: `app/[locale]/tasks/[id]/page.tsx:98`）。
- [x] タグ・サブタスクが適切に編集できる UI／QA を整備する（2025-11-04 Playwright `tests/e2e/tasks.spec.ts` でタグ編集・サブタスク完了率の自動検証を追加）。
- [x] ガントチャートやリアルタイム通知を実装／確認する（Slack 連携は別課題で追跡）。
  - [x] タスク一覧にガントチャートビューを追加し、`/ja/tasks?view=gantt` でフィルター・エクスポート結果と整合することを 2025-11-12 に確認。
  - [x] リアルタイム通知（Supabase Realtime 経由で NotificationBell/通知センターが即時更新されること）を 2025-11-12 Issue #160 で実装し、Slack Webhook 連携は別 Issue で管理する。

## UC-07 監査準備
- [x] 監査ダッシュボードの型定義と統計計算ロジックを整備し、`npm run typecheck` / `npm run lint` を通過させる（2025-09-18）。
- [x] `/ja/audit`（もしくは監査関連ページ）で監査計画・チェックリスト・証跡管理が表示されることを確認する。
- [x] 監査レコードの作成・更新・是正処置登録が動作することを確認する。（2025-10-19 是正処置 UI 実装・検証完了）
- [x] 監査レポート生成を実装／確認する（PDF ダウンロードで報告書内容が出力されることを確認）。
- [x] 監査ページ共通アクセスガードとナビゲーション制御が `auditor` / `org_admin` / `system_operator` / `can_manage_audit` 保有者に限定されていることを確認する。（`useAuditAccess` + Dashboard ナビ制御実装済）
- [x] Supabase 型定義に監査テーブル（plans / team_members / checklists / evidence / nonconformities / corrective_actions / reports）が追加され、`AuditService` の CRUD が型安全になっていることを確認する。（2025-10-19 型定義更新）
- [x] `AuditService` が監査ログ記録・署名付き URL 返却・関連リソース削除を行い、証跡ファイルパスが `${organization_id}/${checklistId}/...` 形式で保存されることを確認する。（2025-10-20 監査ログ連携実装確認）
- [x] `/[locale]/audit/plans/[planId]` 詳細ページでステータス遷移・チーム編集・実績日付入力が動作することを確認する。
- [x] `/[locale]/audit/plans/[planId]/checklist` で担当者フィルタ・証跡アップロード・不適合登録モーダルが機能することを確認する。
- [x] `/[locale]/audit/nonconformities` で不適合一覧・詳細編集・是正処置 CRUD が機能することを確認する。
- [x] `/[locale]/audit/plans/[planId]/report` で監査報告書の入力・保存・ステータス連動が動作することを確認する（PDF 出力は TODO 表示であることを確認）。
- [x] `/[locale]/audit/requirements` で ISO 要件ツリー表示・適用可否トグル・チェックリスト一括生成が動作することを確認する。
- [x] 監査ダッシュボードの統計カードと「次のアクション」がチェックリスト／是正処置の最新状況を反映することを確認する。
- [x] 監査ダッシュボードに期間ヘッダーと進捗バー（Follow-up バッジ付き）を追加し、`tests/e2e/audit-progress.spec.ts` / `docs/05-quality/uc-validation-20250918.md` で選択期間の同期を確認する（2025-11-14）。
- [x] Dev Login Auditor シードで監査データが投入され、`user_permission_sets.can_manage_audit` が true になっていることを確認する。
- [x] `scripts/test-audit.js` と `tests/e2e/audit-walkthrough.spec.ts` が成功し、証跡アップロードを含むウォーキングスケルトンが自動検証できることを確認する。
- [x] 監査関連の翻訳キー・ドキュメント（Implementation Plan / Walking Skeleton / UC Checklist / QA / 開発ガイド / README）が更新されていることを確認する。
- [x] 証跡容量運用ガイドを docs/06-operations/audit-storage-guideline.md に整備し、容量チェック手順を記録する。
- [x] `docs/05-quality/qa-uc07-auditor-operator.md` / `qa-uc07-system-operator-operator.md` のオペレーター手順書を作成し、監査ダッシュボード→証跡アップロード→権限制御の手動検証を定義する。（2025-11-13、`npm run qa:uc07-auditor` / `npm run qa:uc07-system-operator` を整備し、`docs/05-quality/uc/UC-07-audit/logs/uc07-*-<ts>.log` と `test-results/system-operator-invite-*.json` / `storage-metrics-*.json` を証跡として保存）
- [x] `npm run qa:uc07-auditor`（`qa:audit-report` + `audit-walkthrough` + `audit-progress`）を整備し、`docs/05-quality/uc/UC-07-audit/logs/uc07-auditor-*.log` と `test-results/audit-*-<ts>.json` を成果物として収集できるようにした。（2025-11-13 Issue #174）

## UC-08 通知とアラート
- [x] 通知ベル（`NotificationBell`）がログインユーザーの通知を取得・表示することを確認する。（2025-10-11）
- [x] 通知既読化・全既読が動作し、`notifications` テーブルが更新されることを確認する。（2025-10-11）
- [x] 通知設定（メール/アプリ）が管理でき、`notification_preferences` が更新されることを確認する。（2025-10-11）
- [x] Supabase Edge Function `notifications-email` でメール通知を配信し、RESEND 未設定時は `email_logs` へ pending 登録とログ出力にフォールバックする。（2025-11-04）
- [x] `POST /api/tasks/reminders` で期限接近タスクを自動通知し、`task_reminders` と `audit_logs` に記録されることを確認する。（2025-11-04）
- [x] 監査計画が `scheduled` になる、または開始日が更新された際にリーダー／チームへ通知・メールが届くことを確認する。（2025-11-04）
- [x] Slack/Teams 外部チャネルが `/ja/settings/organization` で設定可能になり、`organization_notification_channel_logs` に配信の証跡が残ることを確認する。（2025-11-16）
- [x] `npm run qa:notifications` で `mock:tasks` → `/api/tasks/reminders` → NotificationBell/通知センターの Playwright ウォークスルーを行い、`test-results/notifications/notifications-*.json` / `.png` / `.webm` に成果物を保存する手順を記録し、QA runbook へリンクを残した。（2025-11-16）
- [x] `npm run qa:notifications:slack` で `test-results/notifications-slack-*.json`（`channelResults` + `channelLogs`）と `test-results/notifications-slack-*.png`（External Notification Channels パネルのスクリーンショット）を生成する手順を記録し、定期的に実行できることを確認する。（2025-12-01 確認: スクリプト実装済み。実行には `.env.local` に `QA_NOTIFICATION_SLACK_WEBHOOK_URL` の設定が必要。Webhook 未設定環境ではスキップされる設計）

## UC-09 設定・権限管理
- [x] `/ja/settings/organization` で組織情報・体制ロール（ProjectStructureManager）が読み書きできることを確認する。
- [x] `/ja/settings/users` でユーザー一覧・招待・ステータス切替が動作することを確認する。
- [x] ユーザー一覧で部門フィルタを適用し、組織部門に応じてメンバーを絞り込めることを確認する。（2025-10-25）
- [x] `/ja/settings/profile` ／ `/ja/settings/subscription` で個人設定・契約情報が更新できることを確認する（Stripe モック含む）。
- [x] ロール別アクセス制御、メール招待フローを実装／確認する（OR-01/02 チェック済み）。
- [x] 細粒度権限設定 UI でユーザーのモジュール権限を変更し、アクセス制御が反映されることを確認する（Dev Login system_operator → 権限トグル → audit ダッシュボード表示で検証）。
- [x] Dev Login でロール別権限マトリクスを切り替え、`tests/e2e/rbac-assets-controls.spec.ts` が assets / controls の否定経路を緑化することを確認する（2025-11-04）。
- [x] 部門スコープ RBAC（Issue #74/#64）を有効化し、`/settings/users` やドキュメント/リスク一覧で部門ベースのアクセス制御が適用されることを QA する。（2025-11-11 部門フィルタ強制を実装）
- [x] Supabase Auth の MFA/SAML フック（Dev Login / ログインフォーム / API）を実装し、Plan Tracking #8 に沿って OTP 送信/検証 API、`auth_mfa_challenges` と `auth.mfa.*` ログ、Dev Login・組織設定のステータス表示、QA 手順・Runbook（docs/06-operations、docs/05-quality）を整えた。

---

### メモ・補足
- チェックにあたっては Supabase のローカル環境および Stripe テスト環境を起動してください。
- Playwright など自動テストでカバーできる項目は可能な限りスクリプト化することを推奨します。
- チェック済み項目でも仕様変更やバグ修正後は再確認が必要です。更新日を適宜記録してください。
- Org Admin 招待〜受諾フローは `tests/e2e/invite-acceptance.spec.ts` で自動化済み。Resend 未設定環境ではメール送信がモックログにフォールバックする。
- 文書エクスポート・ギャップ分析・タスク CSV のヘルパーは `npm run test:unit` で単体テストを実行できます。
- メール認証を有効化する場合は `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true` を設定し、サインアップ後に `/auth/verify-email` へ誘導されることを確認してください。未確認メールでのログイン時は専用メッセージが表示されます。
- Stripe ポータルでのプラン変更直後は設定画面・ホームダッシュボードが `/api/stripe/sync-subscription` を呼び出し、即時に契約情報を同期します。Webhook 遅延時の手動更新としても利用できます。
- Phase A（基盤安定化）完了により、Supabase への依存は完全に排除されました。ローカル開発では SQLite、本番では libsql を使用します。

<!-- QA_SUMMARY:BEGIN -->
## Automated QA Summary (2026-06-17T04:55:03.502Z)

| Script | Result | Duration |
|--------|--------|----------|
| qa:notifications:settings | success | 1.47s |
| qa:rbac:matrix | success | 5.44s |
| qa:submission-copy | success | 39.29s |
<!-- QA_SUMMARY:END -->


## Automated QA Summary (2025-10-29T08:27:36.424Z)

| Script | Result | Duration |
|--------|--------|----------|
| qa:webhook:abnormal | success | 0.33s |
| qa:documents:approver | success | 3.81s |
| qa:risks:matrix | success | 5.02s |
| qa:notifications:settings | success | 2.67s |
| qa:rbac:matrix | success | 6.93s |
| qa:matrix | success | 17.09s |
