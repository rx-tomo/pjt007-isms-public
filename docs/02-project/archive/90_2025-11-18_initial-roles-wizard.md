# 2025-11-18 体制ロール初期設定ウィザード設計
作成者: Codex / 2025-11-18

## ゴール
- System Operator / Org Admin が初期セットアップ中に ISMS 体制ロールを一括登録できるウィザードを提供し、オンボーディング「体制構築」ステップを時短する。
- 設定画面の「体制ロール管理」コンポーネントとホームのオンボーディングカードをつなぎ、ユーザーがモーダル承認のみで既定ロールを投入できるようにする。
- 登録済みのロールは後から編集・削除できることを明示し、ウィザード経路でも監査ログと履歴を残す。

## 既存フローとの接続
- Phase Selection Dialog（ホームでの初回ウィザード）が `organizations.isms_phase` を決めてオンボーディング進捗を進めている。
- 体制ロール管理 (`components/settings/organization/ProjectStructureManager.tsx`) は手動でロールを作成する UI のみ。
- OnboardingChecklist の「体制ロールを割り当て」ステップ完了判定は `project_roles` + `project_assignments` に依存。

## 想定ユーザーフロー
1. System Operator / Org Admin がホームまたは設定画面で「体制ロールを初期設定」CTA を押す。
2. モーダルで既定ロール一覧（下記 11 件）が表示され、チェックボックスで投入対象を選べる（デフォルト全選択）。
3. 「登録する」を押すと `project_roles` に一括挿入。既に同じキーが存在する場合はスキップし、結果サマリーを表示。
4. 成功時にオンボーディング進捗とフェーズ履歴（`source=wizard`）にイベントを記録し、`ProjectStructureManager` を再読込。

## 既定ロールセット
| 推奨キー | 日本語ラベル | 英語ラベル | is_required 初期値 | 補足 |
| --- | --- | --- | --- | --- |
| `isms_lead` | ISMS責任者 | ISMS Lead | true | 全体統括。責任範囲説明と `responsibilities` に「ISMSの維持管理」「経営層報告」等を初期挿入。 |
| `ciso` | 最高情報セキュリティ責任者 (CISO) | Chief Information Security Officer | true | 組織横断のセキュリティ戦略。 |
| `risk_officer` | リスク管理責任者 | Risk Management Owner | true | リスクアセスメント実施責任。 |
| `audit_lead` | 内部監査責任者 | Internal Audit Lead | true | 監査計画/報告承認。 |
| `auditor` | 内部監査員 | Internal Auditor | false | 複数割当を想定。 |
| `isirt` | 情報セキュリティインシデント対応チーム (ISIRT) | Security Incident Response Team | true | チーム扱い。説明に「複数担当者想定」を記載。 |
| `access_manager` | アクセス権管理者 | Access Control Manager | true | アクセスレビュープロセス。 |
| `system_ops` | システム管理者 / 運用管理者 | System / Operations Manager | true | インフラ運用責任。 |
| `hr_admin` | 人事・総務の責任者 | HR / General Affairs Lead | false | 人的セキュリティ統括。 |
| `isms_secretariat_head` | ISMS事務局長 | ISMS Secretariat Lead | true | ドキュメント統制。 |
| `isms_secretariat_staff` | ISMS事務局員 | ISMS Secretariat Staff | false | 日次業務支援。 |

> 既定 `display_order` は上記順。`is_required` が true のロールは Onboarding サマリーの分母となる。

## UI / UX 方針
1. **エントリーポイント**
   - ホームの OnboardingChecklist ステップ「体制ロールを割り当て」カードに `CTA: ウィザードを開く`。
   - `ProjectStructureManager` の空状態カードに「推奨ロールを読み込む」ボタンを設置。
   - 設定サイドバー（`DashboardLayout` の dev login メニュー付近）に「セットアップウィザード」リンクを追加し、Phase/Wizard 両方を呼び出せるハブにする検討。
2. **モーダル構成**
   - Step1: 説明 + 選択チェックボックス（11件 / 検索フィルタ）。
   - Step2: 確認画面（投入予定ロールの一覧 + is_required 表示）。
   - Step3: 結果画面（成功件数 / 既存スキップ件数）。`ProjectStructureManager` へ遷移できる CTA。
3. **エンプティケース対応**
   - すでに 5 件以上のロールがある場合は、モーダル冒頭で「追加投入は上書きしない」旨を表示。
4. **アクセシビリティ**
   - `aria-describedby` で Step 説明を紐付け、`role=listbox` で選択リストを操作できるようにする。

## データ / API 設計
- **サービス層**: `OrganizationService` に `bulkUpsertProjectRoles(organizationId, roles, source: 'wizard')` を追加し、`supabase.rpc('seed_project_roles', ...)` を呼び出す。
- **Supabase**:
  - 新規 RPC `seed_project_roles(target_org uuid, payload jsonb)` を作成し、`project_roles.key` ベースで UPSERT。
  - `project_roles` に `seed_source text` (nullable) と `seeded_at timestamptz` を追加してウィザード投入を判別。
  - RLS: Org Admin / System Operator のみが RPC を実行できるよう `SECURITY DEFINER` で権限チェック。
  - 監査: `audit_logs` に `organization.project_roles_seeded` アクションで記録。
- **API ルート**: `/api/organizations/[id]/structure/seed` (POST) を新設し、Next.js サーバールートからサービス層を呼ぶ。ホーム / 設定のクライアントからフェッチする。

## 監査・履歴
- `project_structure_events` (新規テーブル) または既存 `onboarding_phase_history` に `source='wizard_roles'` で記録し、Onboarding 履歴タブから辿れるようにする。
- `OnboardingChecklist` には「ウィザード経由で {date} に登録済み」というラベルを付加。

## QA / ドキュメント
- E2E: `tests/e2e/onboarding-structure-wizard.spec.ts` を追加し、ウィザード操作 → ロール作成 → カード更新まで自動検証。
- `scripts/qa-onboarding.js` に新ステップを追加。
- `docs/02-project/02_implementation-plan.md` と `docs/05-quality/qa-uc01-onboarding-operator.md` に手順を追記。

## 実装タスク一覧
1. Supabase マイグレーション: `project_roles.seed_source` / `seeded_at` 追加 + RPC 作成 + RLS 更新。
2. `OrganizationService` + 新 API ルートの実装。
3. 新規 UI コンポーネント `RoleSeedWizardDialog`（多段モーダル）を実装し、ホーム / 設定から呼び出す。
4. `OnboardingChecklist` の CTA とサマリー更新。
5. QA / ドキュメント更新とテスト追加。
