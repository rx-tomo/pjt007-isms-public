# 2025-11-08 レビュー (第2回) 対応メモ

作成: Codex / 2025-11-08

## サマリー
- リスク・タスク・監査の各画面が最小データのみで、フィルタやステータス挙動を実地検証できない。検証用ダミーデータと期間表示仕様を整備する必要がある。
- 期間/サイクルの明示はビジネス要件（年次 ISMS サイクル）として `docs/01-business/isms-process.md` で定義済みだが、実装画面では共通仕様が未確定。
- 共通 UI ガイドラインを `docs/07-design-system/ui-guidelines.md` として新設し、期間セレクター・ステータス色・デモデータ方針を集約した。

## 1. リスクアセスメント
- **現状サマリー**

| 観点 | 現状 | 課題 | 次アクション |
| --- | --- | --- | --- |
| データボリューム | デモ1件のみ | ソート/フィルタ検証不可 | デモ5件をシード投入 |
| 関連情報 | 新規作成で情報資産選択可能 | 編集画面で資産/業務タスクが閲覧・更新できない | 詳細モーダルに関連タブを追加 |
| 期間表示 | ビジネス要件あり（年度） | UIに期間要素なし | `assessment_period` フィルタ/ヘッダーを追加 |
- `app/[locale]/risks/page.tsx:18-120` では Supabase から取得したリスク配列を表示しているが、現状シードが 1 件しかなく、ソート/絞り込み/エクスポートの QA が困難。
- 新規作成画面は `AssetSelector` を使って情報資産を紐付けられるが（`app/[locale]/risks/new/page.tsx:208-227`）、編集時に既存資産や業務タスクとの関係を一覧・更新する UI が不足。レビューでは「発生源のトレーサビリティ」を求めている。
- `docs/01-business/isms-process.md:61` でリスク見直しが年度単位で求められているのに、画面には評価期間を示すフィールドが存在しない。

**TODO**
1. `supabase/seed/risk_demo.sql`（仮）で 5 件のデモリスクを投入。impact/likelihood/department を散らす。
2. リスク編集モーダルに「関連情報資産」「関連業務タスク」をタブ表示し、既存の `risk.assets`・`task_links` を CRUD 可能にする。
3. レイアウトヘッダーへ `assessment_period`（年度+四半期）を表示し、フィルタで切り替えられるよう API 契約を追記。

**アップデート (2025-11-07 / Issue #98)**
- `supabase/migrations/20251107100000_risk_assessment_period.sql` で `risks.assessment_period` を FY/Quarter 文字列として自動計算する生成列を追加し、`idx_risks_assessment_period` を付与。
- `app/[locale]/risks/page.tsx` に期間セレクター・URLクエリ (`?period=`) 連動のフィルタとヘッダー用タグを実装。空データ時は対象期間を含むプレースホルダを表示。
- リスク編集画面（`app/[locale]/risks/[id]/edit/page.tsx`）へ「関連資産」「関連タスク」タブを追加。AssetSelector での CRUD と、タスクのチェックボックス保存（`TaskService.updateTask` で `related_risk_id` を同期）に対応。
- エクスポート API（`app/api/risks/export/route.ts`）と Excel ビルダー（`lib/utils/exporters/riskExcel.ts`）へ `assessment_period` 列を追加し、ダウンロードでも期間が追跡できるようにした。

**アップデート (2025-11-09 / Issue #104)**
- `components/filters/FilterBar.tsx` / `StatusFilterBanner.tsx` を新設し、リスク・タスク・監査ページのフィルタ UI を共通化。各ページは URL クエリと連動した `FilterBarItem[]` を渡すだけで同じレイアウトとバナー表示を再利用できる。
- `app/[locale]/risks|tasks|audit/page.tsx` でフィルタ変更時に `router.replace` を用いてクエリ同期し、共有 URL で同じ表示状態を再現できるようにした。
- QA ランナー（`npm run qa:risks`, `qa:tasks`, `qa:audit-report`）は実行前に `npm run db:seed -- --demo <module>` を自動で流すよう変更。必要に応じて `QA_SKIP_DEMO_SEED=1` で抑止できる。
- `supabase/seed/audit_demo.sql` を追加し、`planning / in_progress / completed` 各ステータスの監査計画と不適合 / 是正処置データを投入できるようにした。

### EARS 要件（リスク）
1. **When** ユーザーがリスク一覧で年度を選択したとき、**the system shall** その年度に属する `assessment_period` のリスクのみを表示し、ヘッダーに「FYXXXX QY」を表示する。
2. **When** ユーザーがリスク編集画面で情報資産または業務タスクタブを開いたとき、**the system shall** 現在紐付いている資産/タスクを一覧し、追加・削除操作を保存時に反映する。
3. **When** QA 用デモシードを実行したとき、**the system shall** 影響度・可能性・部門が異なる 5 件のリスクを挿入し、ビュー/フィルタ/エクスポートすべてで利用可能にする。

## 2. タスク管理
- **現状サマリー**

| 観点 | 現状 | 課題 | 次アクション |
| --- | --- | --- | --- |
| データボリューム | シード無し | 各ビュー検証不可 | 文書更新/リスクレビュー/教育タスクを登録 |
| 一覧情報 | 主要列のみ（タイトル/ステータス等） | 責任者・完了条件が一覧で把握できない | 列追加 + カンバン/カード表示調整 |
| フィルタ | ステータス/優先度など URL 連動 | デモデータが無く実利用に近い動作確認が困難 | サンプル投入後に QA 実行 |
- `app/[locale]/tasks/page.tsx:1-160` で `TaskService.getTasks` を呼び出しているが、シードが空のためリスト/カンバン/カレンダーの各ビューを確認できない。
- ステータスフィルタはクエリ反映済みだが、完了条件や責任者などのメタ情報はテーブル列に露出していないため、レビュー指摘の「一覧で理解できる」状態になっていない。

**TODO**
1. 文書更新／リスクレビュー／教育実施の 3 タスクをデモ投入し、状態が `todo/in_progress/done` で揃うようにする。
2. テーブル表示に「責任者」「完了条件」「期限」を追加し、カンバン・カレンダーにも表示ルールを定義。

### EARS 要件（タスク）
1. **When** QA 用サンプルタスク作成コマンドを実行したとき、**the system shall** 文書更新・リスクレビュー・教育実施の 3 タスクを `todo/in_progress/done` 状態で登録する。
2. **When** ユーザーがタスク一覧を開いたとき、**the system shall** 各行に責任者・完了条件・期限を表示し、同じ情報をカンバンカードとカレンダーイベントにも反映する。
3. **When** ステータスフィルタを切り替えたとき、**the system shall** ステータスバナーを表示し、解除時に URL クエリを削除する（共通 FilterBar を利用）。

## 3. 監査管理
- **現状サマリー**

| 観点 | 現状 | 課題 | 次アクション |
| --- | --- | --- | --- |
| 期間表示 | start/end 日付のみ | 年度/四半期が画面上部に無い | AuditPeriodSelector を追加 |
| 進捗可視性 | 統計カードあり | 完了/保留/再指摘の整理不足 | テーブルに progress + 不適合ステータス列 |
| フィルタ | ステータスフィルタのみ | 期間切替と連動せず | 期間セレクターと FilterBar を連携 |
- `app/[locale]/audit/page.tsx:1-120` では統計カードと監査一覧を表示しているが、期間情報は個別行の `start_date/end_date` だけで、画面上部に対象サイクルを明示していない。
- 監査ステータスは `plansByStatus` で数値化されるものの、完了/保留/再指摘の視点でフィルタする UI が不足。

**TODO**
1. 期間ヘッダー：`AuditPeriodSelector` を追加し、「年度」or「四半期」orカスタム日に切り替えられるようにする。
2. 監査項目テーブルに `progress` と `nonconformityStatus` を表示し、完了/保留/再指摘でバッジを色分け。

**アップデート (2025-11-07 / Issue #103)**
- `AuditService.getAuditPlans` でチェックリスト完了率と不適合の未完了数を集約し、`progressSummary` として UI へ提供。未完了の不適合がある完了済み計画は `reopened`、実施中は `on_hold`、未完了がゼロなら `completed` のフォローアップステータスを返すようにした。
- `/[locale]/audit` の一覧テーブルに進捗バーとフォローアップバッジを追加。`completed/on_hold/reopened` それぞれに緑/琥珀/赤の配色を適用し、未完了の指摘件数を併記することで QA が是正状況を一目で把握できるようにした。

**アップデート (2025-11-10 / Issue #128)**
- `supabase/seed/audit_demo.sql` で完了済み監査に未完了の不適合を 1 件残し、再指摘ステータスを QA で再現できるようにした。
- 進捗バーに `aria-label` を付与し、`再指摘あり` バッジをタイトル付近にも表示してフォローアップの緊急度を視認・読み上げで把握できるようにした。

### EARS 要件（監査）
1. **When** 監査ダッシュボードで年度/四半期を選択したとき、**the system shall** 統計カード・監査一覧・次のアクションに同じ期間を適用し、ヘッダーで選択期間を表示する。
2. **When** 監査計画が `completed` / `on_hold` / `reopened` 状態になったとき、**the system shall** 一覧のステータスバッジと進捗バーを該当色で表示する。
3. **When** 期間切り替え後に該当データが存在しないとき、**the system shall** 「該当期間の監査はありません」というプレースホルダとデフォルト期間へのリンクを表示する。

## 4. 共通期間・状態仕様
- ビジネス要件（`docs/01-business/isms-process.md`）ではリスク/タスク/監査の年次サイクルが前提だが、各画面が独自実装のまま。切り替え UI とメッセージの統一が必要。
- 要求事項に基づき、共通ガイドライン（`docs/07-design-system/ui-guidelines.md`）で期間タグ、年度セレクター、フィルタバナーのルールを定義した。実装タスクを Plan Tracking に登録済み。

### EARS 要件（デモデータ・共通フィルタ）
1. **When** `npm run seed:risks-demo` を実行したとき、**the system shall** デモリスクを現在年度に紐付け、WAF など異なるカテゴリを含める。
2. **When** `npm run db:seed -- --demo tasks` を実行したとき、**the system shall** 3 つのタスクを登録し、責任者と完了条件を自動セットする。
3. **When** `npm run db:seed -- --demo audits` を実行したとき、**the system shall** `planning/in_progress/completed` の各監査を作成し、期間フィールドを現在年度に合わせる。
4. **When** 上記いずれのシードが完了したとき、**the system shall** コンソールに操作結果と期間を表示し、QA 手順書に転記できるようにする。

**アップデート (2025-11-10 / Issue #125)**
- タスク一覧テーブルに「責任者」「完了条件」列を追加し、CSV エクスポートにも同じ列を反映。`TaskService.getTasks` は完了条件コメントを 5 件まで取得し、UI では `完了条件:` コメント・説明文からサマリーを抽出して表示する。
- カンバンカードは責任者・担当者・完了条件・期限をすべて露出するよう再設計し、優先度バッジと組み合わせてレビュー要件（一覧で責任の所在が把握できること）を満たした。
- カレンダービューを実装し、月別ナビゲーション / 期限別セル / 期限未設定リストを表示。すべてのセルでタスクタイトル・責任者・完了条件が確認でき、`docs/05-quality/uc/UC-06-tasks/qa-plan.md` の U06-05 手順を更新済み。

## 5. フェーズ選択（初回 vs 維持）
- 現状、システム上で企業が「初回認証サイクル」か「維持サイクル」かを選択する UI は未実装。`docs/01-business/isms-process-detailed.md` に基づき、`organizations` テーブルへ `isms_phase` カラムを追加し、System Operator が初期設定できるようにする必要がある。
- 要件（EARS）:
  1. **When** System Operator が初期セットアップウィザード（初回ログイン時に必須表示）でフェーズを選択したとき、**the system shall** `organizations.isms_phase` に `initial` または `surveillance` を保存し、Onboarding ステップ構成を切り替える。ウィザード完了後は `/settings/organization` から変更可能。
  2. **When** フェーズを変更したとき、**the system shall** ホームダッシュボードとチェックリストに反映し、変更履歴を監査ログへ記録する。
  3. **When** フェーズ未設定のままユーザーがアクセスしたとき、**the system shall** System Operator に設定を促すバナーを表示し、他ロールのユーザーにはデフォルト（初回サイクル）のチェックリストを提示する。

**アップデート (2025-11-10 / Issue #106)**
- `supabase/migrations/20251107120000_organization_phase.sql` で `organizations.isms_phase / isms_phase_set_at` と `organization_phase_history` を追加し、トリガーで変更履歴を自動記録するようにした。
- `OnboardingService` はフェーズ別ステップ・完了率・履歴を返却し、`components/home/OnboardingChecklist.tsx` はフェーズバッジ、履歴タイムライン、未設定時の警告を表示する。
- `/[locale]/home/page.tsx` の KPI カードとフェーズ概要カードをフェーズごとに切り替え、`messages/{ja,en}.json` にフェーズ関連の文言とステップを追加した。
- System Operator の初回ログイン時にフェーズ選択ウィザードを表示し、`set_organization_phase` 関数経由で履歴へ `source=wizard` を記録するようにした。
- `/settings/organization` にフェーズ切替セクションを追加し、維持サイクルへの移行や誤設定時の再選択が UI から行えるようにした。

## 5. ドキュメント更新
- 本メモと Plan Tracking の 2025-11-08 更新サマリーに今回の残課題を記録。
- 共通 UI ガイドラインを `docs/07-design-system/ui-guidelines.md` として追加。

## 次アクション
1. Plan Tracking の「未対応事項」にリスク/タスク/監査/期間 UI を追加し、担当と完了条件を設定。
2. シードデータ・期間フィルタ仕様が固まり次第、`docs/05-quality/uc-validation-20250918.md` の該当 UC に再検証手順を追記する。
