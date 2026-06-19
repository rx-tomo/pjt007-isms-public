# ダッシュボード実装状況レポート

作成日: 2025年6月9日
更新日: 2025年11月19日
記録者: Codex

> 注記: 本レポートは 2025-06-09 時点の実装状況をベースにしています。以降のダッシュボード改修（StatGrid ドリルダウン、ロール別 KPI 更新等）は `docs/02-project/10_plan-tracking.md` および各 90_* 設計ログ（例: `docs/02-project/archive/90_2025-11-18_risk-matrix-drilldown.md`）で管理しているため、最新仕様を確認する際は併読してください。

## 概要

このドキュメントは、ISMS Pilot のロール別ダッシュボード機能の実装状況と今後の改善点をまとめたものです。

## 実装完了機能

### 1. ロール別ダッシュボード表示機能

`app/[locale]/home/page.tsx` にて、ユーザーのロールに応じた専用ダッシュボードを表示する機能を実装しました。

#### 実装済みロール

- **admin（組織管理者）**: 完全実装済み
  - 統計サマリーカード
  - クイックアクション
  - 最近の活動表示
  - 監査・コンプライアンス状況
- **auditor（監査員）**: 監査ワークスペース向けウィジェットを実装（2025-10-07）
  - 担当監査計画テーブル（期間・ステータス・次のアクション）
  - 未解決の指摘サマリーカード
  - チェックリスト進捗バー
  - 納品物リストとレポート作成CTA
- **approver（承認者）**: 承認者ワークスペース（2025-11-11 / Issue #138）。承認待ち / 履歴 / 期限接近 / エスカレーションの 4 カードを `DocumentService.getApproverDashboardMetrics()` で集計し、`/documents`・`/notifications` へのドリルダウンを付与。
- **user（一般ユーザー）**: マイワークスペース（2025-11-07, Issue #114）。担当タスク / 必読文書 / 研修 / 改善アイデアの4カードとCTAを実装し、Dev Login「一般ユーザー」で確認可能。
- **operator（オペレーター）**: デフォルトダッシュボード表示（プレースホルダー）

### 2. 組織管理者ダッシュボードの詳細機能

#### 統計サマリーカード
- アクティブユーザー数の表示
- 承認待ち文書数の表示
- 未対応リスク数の表示
- 次回監査までの日数表示
- 2025-10-07: Supabase の `tasks`（todo / in_progress / review、期限超過）、`documents`（in_review）、`risks`（identified〜monitoring）、`audit_plans`（planning / scheduled / in_progress）を集計し、Insights でも同じ指標を用いて警告を出すよう更新。

#### クイックアクション
- ユーザー追加ボタン（`/[locale]/settings/users` へのリンク）
- 組織設定ボタン（`/[locale]/settings/organization` へのリンク）
- 承認待ち文書確認ボタン（`/[locale]/documents` へのリンク）

#### 最近の活動
- ユーザーログイン履歴
- 文書承認履歴
- リスク特定履歴

#### 監査・コンプライアンス状況
- 認証ステータス表示（有効/無効）
- 有効期限表示
- 監査進捗率表示（プログレスバー）
- 是正処置の状況（未対応/対応中/完了）

### 3. 監査員ダッシュボードの詳細機能

- `app/[locale]/home/page.tsx` に監査員専用セクションを追加
  - `/[locale]/audits` への導線ボタン
  - 監査計画・指摘・チェックリスト・納品物の4ウィジェット
- ダミーデータは翻訳キー経由で管理し、実データ連携時の置き換えが可能

### 4. 多言語対応

`messages/ja.json` および `messages/en.json` に以下の翻訳キーを追加：

```json
{
  "dashboard": {
    "adminWelcome": "...",
    "stats": {
      "activeUsers": "...",
      "openRisks": "..."
    },
    "quickActions": { ... },
    "recentActivity": { ... },
    "compliance": { ... }
  }
}
```

- 追加済みの `dashboard.*` キーに加え、`home.roleDashboards.auditor.*` を新設しロール別文言を共通管理

### 5. 関連ファイルの実装

- `app/[locale]/home/layout.tsx`: ダッシュボードレイアウト
- `app/[locale]/notifications/page.tsx`: 通知一覧ページ
- `components/layout/NotificationBell.tsx`: 通知ベルコンポーネント
- `lib/services/notification.ts`: 通知サービス

## 未実装・改善が必要な項目

### 1. 他のロール向けダッシュボードの実装

現在、以下のロールはデフォルトダッシュボードが表示されるのみです：

- **operator（オペレーター）向けダッシュボード**
  - モジュール別の運用チェックステータス
  - RLS/マルチテナント監視ウィジェット
  - デプロイ/タスク進捗の QA リマインダー

> 2025-11-07 更新: 一般ユーザー向けダッシュボード（Issue #114）はマイワークスペースとして実装済み。担当タスク／必読文書／研修／改善カードと CTA を揃えたため、本節の対象から除外した。
> 2025-11-11 更新: 承認者向けダッシュボード（Issue #138）も実装済み。残タスクは operator のみ。

### 2. データ統合

主要な指標の一部は Supabase から取得するよう切り替えたものの、引き続き以下の改善が必要です：

- ✅ 統計カード／Insights：Supabase のステータス（タスク todo / in_progress / review、リスク identified〜monitoring 等）を参照（2025-10-07）
- ☐ Supabaseからのリアルタイムデータ取得
- ☐ データの自動更新機能
- ☐ ロールベースのデータフィルタリング

### 3. UI/UXの改善

- ダッシュボードウィジェットのカスタマイズ機能
- ドラッグ&ドロップでのレイアウト変更
- データのエクスポート機能
- グラフ・チャートの追加

### 4. 品質保証の課題

`scripts/test-all-quality.js` の実行結果から以下の課題が判明：

- 多数の翻訳キーが不足（特にtasks、audit関連）
- 開発サーバーのポート設定の不整合（旧3006設定の残存）
- HTMLタグエラーのチェック失敗

## 次のステップ

### 短期的対応（優先度高）

1. **翻訳キーの追加**
   - `messages/ja.json` と `messages/en.json` に不足しているキーを追加
   - 特に tasks、audit、notifications 関連のキー

2. **ロール別ダッシュボードの実装**
   - ✅ auditor向けダッシュボードの実装（2025-10-07 完了）
   - ✅ user向けダッシュボードの実装（2025-11-07 完了）
   - ✅ approver向けダッシュボードの実装（2025-11-11 / Issue #138）
   - ☐ operator向けダッシュボードの実装

3. **品質テストの修正**
   - ポート番号の統一（3007に統一）
   - テストスクリプトの更新

### 中期的対応

1. **データ統合**
   - Supabase RLSポリシーの実装
   - リアルタイムサブスクリプションの設定
   - APIエンドポイントの作成

2. **パフォーマンス最適化**
   - データのキャッシング
   - 遅延読み込みの実装
   - バンドルサイズの最適化

## EARS 要件（ダッシュボード）
1. **When** 組織管理者がホームダッシュボードへアクセスしたとき、**the system shall** ロール別 KPI（未対応リスク、承認待ち文書、次回監査までの日数）を 2 秒以内に取得し、カードから該当画面へ遷移できるリンクを提供する。
2. **When** 承認者・監査員など役割が切り替わったとき、**the system shall** 直近 7 日の担当アイテムを自動でフィルタリングして専用ウィジェットへ表示し、ダッシュボードヘッダーに現在のロールを明示する。
3. **When** ハイリスクや期限超過タスクが閾値を超えたとき、**the system shall** ダッシュボード上部にアラートバナーを表示し、同じ条件を通知センターと Insights パネルにも同期する。
4. **When** ユーザーがダッシュボードのウィジェット設定を保存したとき、**the system shall** レイアウトと表示項目をユーザープロファイルに永続化し、再ログイン後も同じ構成でレンダリングする。

## 2025-11-07 仕様補足

### ダッシュボード統計カード
- 2025-11-10 時点で StatGrid の 4〜5 枚の KPI カード（Active Users / Documents / Risks / Tasks / Audits）はすべてクリック遷移を備え、`lib/home/roleHomeConfig.ts` で定義した `getStatCardHref`・`hasStatCardAccess` によりロケール付き URL とロール制御を集中管理している。
- `statCards` は `{ id, label, helper, tone, href, ariaLabel, disabled? }` 構成に拡張済み。Users/Audits カードには `requiresRole` 相当の制約を設け、`system_operator | org_admin | super_admin` のみがユーザー管理へ遷移でき、`audits` は `auditor` か上位ロールでのみ有効になる。
- `StatGrid` コンポーネントは有効カードを `<Link>` として描画し、利用できないカードは `<button type="button" aria-disabled="true" disabled>` で表示しつつフォーカスリングを維持（`cursor-not-allowed` + `opacity-70`）。視覚的には全カードをグリッドで揃えつつ、ホバーシャドウは有効カードのみ有効化される。
- フォールバック経路は `ROLE_STAT_CARD_OVERRIDES` でロール別に再定義でき、例として `auditor/approver` 向けに Documents/Tasks をレビュー用クエリに差し替えている。`/${locale}` プレフィックスは `resolvePath()` で一元付与する。
- QA: `tests/e2e/home-stat-cards.spec.ts` で Org Admin のタスク/文書カード遷移と、一般ユーザーにおける Users カードの `aria-disabled` 状態を検証する。`npm run qa:home` 実行時も同ページで 404/Intl エラーを監視する。

### ステータス内訳（Status Breakdown）の算出基準
- `lib/services/organization.ts#getOrganizationStats` で tasks / documents / risks の `status` カラムを Supabase から集計し、`StatusBreakdown` に渡している。
- 各カテゴリの扱い:
  - Tasks: `todo / in_progress / review / done / cancelled`
  - Documents: `draft / in_review / approved / obsolete`
  - Risks: `identified / analyzing / treating / monitoring / closed`
- 上記以外のステータスは UI 側で末尾に表示し、翻訳キーが未定義の場合は英語キーをフォールバックさせる。分布の元データは `organization_id` フィルタのみ。必要に応じて部門・期間フィルタを将来の改修タスクに追加する。

### オンボーディング進捗ウィジェット
- `components/home/OnboardingChecklist.tsx` は進捗サマリーと 8 ステップの一覧を表示するのみで、状態（未開始/進行中/完了）や年度でのフィルタリング、期間軸の切替機能は未実装だった。
- 改修方針:
  1. 進捗 API へ `status`・`completed_at` を含む履歴を追加し、クエリパラメータで期間を受け付ける。
  2. UI 上はタブ or Select で「未開始」「進行中」「完了」および「当年度/前年度」を切り替えられるよう仕様化する。
  3. Plan Tracking に QA シナリオ（フィルタ組み合わせでの件数検証）を追記する。

**アップデート (2025-11-11 / Issue #137)**

- `lib/services/onboarding.ts` に年度別サマリーモデルを導入し、各ステップの `status`・`completedAt`・FY表示を返すよう刷新。現在/前年度の2期間を API で同時に受け取り、監査フェーズではサーベイランス専用ステップを年度判定できるようにした。
- `components/home/OnboardingChecklist.tsx` を再設計し、年度タブとステータスフィルタ（すべて/完了/進行中/未開始）、ステップごとの完了日バッジを実装。Dev Login/QA でも年度切替とフィルタ組み合わせを検証できる。
- 翻訳ファイル/QA ドキュメントを更新し、UC-01 で年度切替とステータス絞り込みの観点を追記した。

**アップデート (2025-11-11 / Issue #138)**

- `DocumentService.getApproverDashboardMetrics()` を追加し、`document_approvals` から承認者本人の pending / 履歴 / 48h 超過（期限接近）/ 96h 超過（エスカレーション）件数を集計。SLA 閾値と履歴集計期間（30 日）をレスポンスにも含め、UI と QA ドキュメントで参照できるようにした。
- `app/[locale]/home/page.tsx` に `ApproverDashboard` を実装し、4 カード＋CTA を表示。Dev Login「承認者」で `/documents`（status=in_review, view=approver）や `/notifications?view=approvals` へ遷移でき、読み込み失敗時は警告バナーを表示する。
- `messages/{ja,en}.json` へ承認者向け文言を追加し、`tests/e2e/home-approver-dashboard.spec.ts` を新設。Dev Login ロールスイッチでカードとリンクが描画されることを Playwright で検証し、`docs/05-quality/uc-validation-20250918.md` に QA 手順を追記した。

**アップデート (2025-11-12 / Issue #155)**

- Status Breakdown ウィジェットを KPI グラフ化。tasks/documents/risks それぞれの Supabase 集計を `KpiDonutChart`（SVG ドーナツ + 合計値）として表示し、凡例には色付きドットと割合（%）を追加した。
- `messages/{ja,en}.json` に `home.statusBreakdown.chart.*` を追加し、スクリーンリーダー向け `aria-label` と「チャートなし」メッセージを定義。`?qa_home=stats-offline` でフェールセーフを確認済み。
- UC-03 QA Plan (`docs/05-quality/uc/UC-03-dashboard/qa-plan.md`) に KPI グラフの観点 (U03-07) を追記し、`docs/02-project/12_uc-checklist.md` の KPI グラフ項目を ✅ に更新した。`npm run qa:home` 出力へグラフ検証ログを追加済み。

### 一般ユーザーマイワークスペース（2025-11-07）
- `app/[locale]/home/page.tsx` の `RoleDashboard` で `role === 'user'` の場合にマイワークスペースを挿入。4 枚のカード（タスク / 必読文書 / 研修 / 改善アイデア）を `UserDashboardSectionCard` で共通化し、すべて `/tasks` / `/documents` への CTA を設定した。
- 表示データは翻訳ファイル (`home.roleDashboards.user.*`) に閉じ込め、将来的に Supabase 集計へ差し替え予定。 badge 文言と進捗バーの割合も翻訳キーで表現している。
- QA: `tests/e2e/home-user-dashboard.spec.ts` を追加し、Dev Login「一般ユーザー」で 4 カードの表示／リンク先を検証。CLI では `npm run qa:home` が同ページをカバーする。

## 作業再開時のチェックリスト

- [ ] 開発サーバーの起動確認 (`npm run dev`)
- [ ] Supabaseローカル環境の起動確認 (`supabase start`)
- [ ] 現在のブランチ確認 (`feature/dev3`)
- [ ] 最新の変更を取得 (`git pull origin feature/dev3`)
- [ ] 依存関係の更新確認 (`npm install`)
- [ ] 環境変数の確認 (`.env.local`)

## 参考資料

- [品質保証ガイドライン](./qa-guidelines.md)
- [RBAC設計書](./rbac-design.md)
- [開発進捗管理](../開発計画・進捗管理.md)

## 関連Issue

- Issue #7: ロール別ダッシュボードの実装
- 関連ブランチ: `claude/issue-7-*` シリーズ
