# 2025-11-07 RBAC/UI レビューサマリー

作成日: 2025-11-07
記録者: Codex

## 1. Super Admin（SaaS全体管理者）未実装の整理
- `docs/03-architecture/rbac-revised.md` では Super Admin を定義し、テナント横断の操作・課金設定・ログ監査を担うと記載されているが、実装済みのロールは `system_operator | org_admin | user | auditor | approver` の 5 種のみで固定されている（`supabase/migrations/20250605000001_base_tables.sql` の `user_profiles.role` 制約、および `lib/dev-login/scenarios.ts`）。
- System Operator であっても `user_profiles.organization_id` が NOT NULL のため他テナントの作成・凍結・削除をトリガーする API や UI が存在しない。
- ログ監査も現状は `audit_logs.organization_id` ベースで RLS を分けているだけで、全体監査ビューやスコープ切替が仕様化されていない。
- **TODO**: 2025-11 Sprint に以下を計画へ追加する。
  1. DB: `user_role` enum および `user_profiles.role` に `super_admin` を追加し、`system_operator` との挙動を分離。
  2. Supabase Edge/API: テナント CRUD・ロック API と全体監査ログビュー、`user_has_global_role()` の実装。
  3. アプリ: `/super-admin/organizations` 管理画面、Dev Login ロールの追加、Plan Tracking タスク分解。
  4. 監査ログ: `audit_logs` に `scope` カラムを追加し、`global` と `tenant` を区別する。

## 2. ダッシュボードのユーザー表示/メニュー
- `components/layout/DashboardLayout.tsx` のサイドバー下部とヘッダー右上の双方で同じユーザー名・所属を表示している。レビュー指摘通り冗長で、左下の常時表示は削除予定（アクセシビリティ観点ではアバターのみ残しツールチップで補足）。
- 右上ユーザーメニューは `<button className="user-menu-button">` のみで、ドロップダウンや `Logout/Profile` アクションが存在しない。今後以下を実装する。
  - `Menu` コンポーネント + `@headlessui/react` もしくは自前のポップオーバーで表示。
  - アクション: プロファイル設定、通知設定、Dev Login（非本番限定）、サインアウト。
  - QA と a11y テスト（Esc とフォーカストラップ）。

> 2025-11-07 更新（Issue #109）: サイドバーのユーザー情報はアバター+ツールチップのみとし、ヘッダーにプロフィール/通知/Dev Login/サインアウトを備えたフォーカストラップ対応のドロップダウンを実装済み。Esc と Tab でのアクセシビリティ検証用 Playwright テストも追加した。

## 3. 設定 > ユーザー/管理策の翻訳欠落
- `app/[locale]/settings/users/page.tsx` と `app/[locale]/settings/controls/page.tsx` は `useTranslations('settings.users')` / `useTranslations('settings.controls')` を参照するが、`messages/ja.json`・`messages/en.json` には `settings.controls.*` や `settings.users.table.*` が未定義なため、UI 上は `table.name` など英語キーがそのまま表示される。
- **対応方針**: 翻訳 JSON に各セクションを追加し（JP/EN 並行）、`npm run lint:messages` に相当するチェックをスクリプト化。翻訳キー追加後は `docs/05-quality/uc-validation-20250918.md` の国際化チェックリストに再実施ログを残す。

> 2025-11-10 更新: `npm run lint:messages`（`node scripts/validate-translations.js` をラップ）を `package.json` と GitHub Actions (`qa.yml`) に追加し、翻訳キー検証が自動化されました。

## 4. ホームダッシュボード仕様の明文化
- 統計カード（Active Users 等）は現状クリック不可の単なる KPI 表示（`StatGrid`）、仕様書にも挙動が明記されていないため `docs/02-project/archive/90_2025-06-09_dashboard-status.md` に「表示のみ/ drill-down は今後検討」と追記。
- `StatusBreakdown` コンポーネントの算出基準（Supabase の tasks/documents/risks.status を直接集計）とラベル定義が docs に未反映だったため、同ドキュメントに分布定義とデータソースを追加。
- オンボーディングチェックリストはフィルタ・期間軸を持たないリスト表示のみのため、UX 改修タスクとして「年度/状態フィルタの仕様策定」「ステップ履歴 API」を backlog に追加。

## 5. 文書アップロードのバックエンド実装確認
- `lib/services/document.ts` では `uploadFile()` が Supabase Storage（`documents` バケット）へ保存し、成功後に `documents.file_path` とバージョン履歴へ反映している。ストレージクォータチェック (`StorageQuotaService.ensureUploadAllowed`) も前段で実行済み。
- ストレージ保存・DB更新が QA ドキュメントで未追跡だったため、`docs/05-quality/qa-guidelines.md` に「文書アップロード E2E の証跡取得」を追記予定。

## 6. 次のアクション
1. Super Admin ロール対応の設計レビューとマイグレーション案を 2025-11-08 の設計会議で決定。
2. DashboardLayout の UX 改修（冗長表示削除 + ドロップダウン実装）を `feature/dashboard-user-menu` ブランチで着手。
3. 翻訳キー追加後、`npm run lint` / `npm run typecheck` / `npm run test:e2e -- --projects=dashboard` を再実行し、Plan Tracking に結果を追記。
4. ダッシュボード仕様ドキュメントの補筆と Onboarding フィルタ要件のワークショップをアサイン。

> 備考: Super Admin の要件は既存ロードマップに無いため、承認フローが必要。判断をユーザーへ確認中。

### 6.1 ロールアウト方針（2025-11-09更新）
- 現時点ではプロジェクト全体が非公開の開発段階にあるため、Super Admin 機能は **完成次第、社内/検証用すべてのテナントで一斉に有効化する**。
- 外部顧客向けの段階的リリースは不要。Feature Flag は QA/切り戻し用途として残すが、リリース手順は「migrate → QA → 全テナント enable」で統一する。

## 7. Super Admin 実装計画（方針A）

### 7.1 フェーズ構成
| フェーズ | スコープ | 主要成果物 | 完了条件 |
| --- | --- | --- | --- |
| Phase 0 | 仕様確定 | このドキュメント、ER 図差分、API 契約書ドラフト | 設計レビューで承認済み (2025-11-08) |
| Phase 1 | データ層 | `user_role` enum 拡張、`user_profiles` RLS/Trigger 更新、`audit_logs` に `scope` 追加 | Supabase migration がローカル / CI 双方で成功、既存ロールのログイン回帰テスト通過 |
| Phase 2 | API / Service | `supabase/functions/tenant-admin.ts`（テナント CRUD/ロック）、`user_has_global_role()`、Dev Login シード | E2E モックで Super Admin が複数テナントを作成・凍結できる |
| Phase 3 | フロントエンド | `/super-admin/organizations`、`/super-admin/logs`（scope 切替 UI）、Dev Login UI に Super Admin を追加 | Playwright で happy path（作成→ロック→監査ログ閲覧）を自動化 |
| Phase 4 | QA / 運用 | RBAC/監査テストケース更新、運用 Runbook（緊急フリーズ手順） | `docs/05-quality/uc-validation-20250918.md` に結果記載、Runbook 承認済み |

### 7.2 技術タスク詳細
1. **データベース**
   - `supabase/migrations` に `20251108090000_add_super_admin_role.sql` を追加。
   - 変更内容: `ALTER TYPE user_role ADD VALUE 'super_admin';`、`user_profiles.organization_id` を `super_admin` の場合のみ NULL 許可、`audit_logs` に `scope TEXT CHECK (scope IN ('global','tenant')) DEFAULT 'tenant'` を追加。
   - 影響テーブル: `organization_invitations`, `user_permission_sets`, `user_has_role()` 関数の改修。
2. **Supabase Edge / RPC**
   - 新 RPC `create_tenant(org_name, plan)`、`toggle_tenant_lock(org_id, locked_by)`、`list_all_tenants()` を Super Admin 限定で公開。
   - `user_has_global_role()` で JWT の `role` クレームに `super_admin` がある場合 true を返すよう更新。
3. **アプリケーション**
   - ルート `app/[locale]/super-admin/(...)` を追加し、Organizations 一覧（pagination + 状態フィルタ）と Audit Logs 全体ビュー（テナントスコープ切替）を実装。
   - `DashboardLayout` に Super Admin 用ナビ（テナント一覧 / 監査ログ / サービス設定）を挿入。既存 System Operator の UI は従来通りテナント内機能専用とする。
   - Dev Login UI (`app/[locale]/dev-login/page.tsx`) と `ROLE_SCENARIOS` に Super Admin を追加。
4. **監査 / QA**
   - `tests/e2e/super-admin-tenants.spec.ts` を追加し、テナント作成→ユーザー招待→ロック→解除の一連を検証。
   - `scripts/qa-home.js` に Super Admin 視点のホーム統計を追加（全テナント件数表示）。

### 7.3 リスクと緩和策
- 既存 System Operator の挙動が変わる: Feature flag `NEXT_PUBLIC_ENABLE_SUPER_ADMIN` で段階的に展開、flag OFF 時は従来挙動を維持。
- RLS 誤設定リスク: Migration 後ただちに `supabase db lint` と `tests/e2e/rbac-matrix.spec.ts` を実行し、super_admin ロールを含む期待権限を snapshot で検証。
- 運用負荷: Runbook に監査ログ閲覧・テナントロック手順を記載し、Ops チームへハンドオフ。

### 7.4 Phase 2 実装結果（2025-11-07）
- DB:
  - `supabase/migrations/20251107093000_super_admin_tenant_api.sql` で `super_admin` ロールの制約を追加し、`audit_logs.scope`（`tenant`/`global`）と `user_has_global_role()` を導入。
  - `create_tenant` / `list_all_tenants` / `toggle_tenant_lock` RPC は `SECURITY DEFINER` で実装し、どれも `user_has_global_role()` を通過したセッションのみ実行できる。
- Edge Function:
  - `supabase/functions/tenant-admin/index.ts` が `GET`（一覧）、`POST`（作成+初期 System Operator 発行）、`PATCH`（ロック/解除）を提供。`Authorization: Bearer <access_token>` を必須とし、内部で RPC を呼び出す。
  - System Operator 初期化時は Supabase Auth(Admin) でユーザーを作成し、`user_profiles` と `user_permission_sets` を自動投入。失敗時はテナントをロールバックして一貫性を保持。
- Dev Login:
  - `lib/dev-login/scenarios.ts` と `/[locale]/dev-login` UI に `super_admin` ロールを追加し、開発セッションから Super Admin API を即試験できるようにした。
  - Dev Login API は `organization_id` が存在しないシナリオを許容するよう更新済み。

## 8. EARS 形式の Super Admin 要件
1. **When** ユーザーが `super_admin` ロールでテナント一覧を開いたとき、**the system shall** すべてのテナントの状態・プラン・ロック可否・最新監査ログ件数を含む一覧を表示する（本プロジェクトはクローズド開発中のため、リリース時は社内/検証用全テナントで一斉に有効化する）。
2. **When** Super Admin がテナントロック操作を確定したとき、**the system shall** 対象テナントのログインを即時無効化し、`audit_logs` に `scope='global'` の記録（操作者・理由・時刻）を追加する。
3. **When** Super Admin が新規テナントを登録したとき、**the system shall** 初期 System Operator アカウントを発行し、初回表示時のみ資格情報を提示し、再表示は禁止する。
4. **When** Super Admin が Dev Login 画面にアクセスしたとき、**the system shall** `super_admin` 選択肢を表示し、既存テナントに紐付かないセッションで `/super-admin/*` ルートへ遷移させる。
5. **When** Super Admin が監査ログビューでスコープを切り替えたとき、**the system shall** `global` と `tenant` の両方のログをフィルタリングし、UI に選択中スコープを明示する。

## 9. Shared System Operator Accounts（新要求）

- **背景**: Super Admin が複数テナントの運用を一元管理するケースでは、同じ System Operator（メールアドレス）が複数のテナントに所属する可能性がある。現行実装では Supabase Auth のメール一意制と `user_profiles.organization_id` の単一紐付け制約により、同一メールで追加のテナントをプロビジョニングすると Edge Function `tenant-admin` が 500（`Operator provisioning failed`）を返す。
- **仕様変更**: System Operator のメールアドレス重複を許可し、既存アカウントを追加テナントへ参加させられるようにする。Super Admin UI では「既存アカウントを再利用」シナリオを案内し、Runbook/QA でもメール重複による失敗を異常系として扱わない。
- **技術課題**:
  1. `user_profiles` を単一テナント前提から解放する（例: `user_memberships` のような中間テーブルを新設し、`organization_id` を多対多にする）。
  2. Edge Function `tenant-admin` で `auth.admin.createUser` の重複エラーを捕捉し、既存ユーザーの `organization_memberships` 追加入力と `user_permission_sets` の upsert に切り替える。
  3. 監査ログと Dev Login Seed/QA スクリプトを更新し、同一ユーザーが複数テナントに所属しても一貫した体験になるようにする。
- **ステータス（2025-11-13, Issue #182 完了）**: `user_memberships` / RLS 更新と `tenant-admin` の重複メールフォールバック（Issue #181）に加え、Runbook・QA 手順・handoff を刷新し、共有オペレーター再利用シナリオを `npm run qa:super-admin:shared-operator` / `test-results/super-admin-shared-operator.json` で証跡化できるようになった。
