作成日: 2025-09-17 (Codex)
更新日: 2025-11-04
記録者: Codex

# ウォーキングスケルトン実行計画

## 1. ユースケース列挙

| ID | ユースケース | 主なロール | 概要 | 事業価値 | 技術リスク |
| --- | --- | --- | --- | --- | --- |
| UC-01 | 初期オンボーディング | System Operator, Org Admin | サインアップ、組織作成、初期設定完了 | ★★★★☆ | ★★★☆☆ |
| UC-02 | 課金と契約管理 | Org Admin | プラン選択、支払い、請求情報管理 | ★★★★★ | ★★★★★ |
| UC-03 | ダッシュボード閲覧 | Org Admin, Approver | KPI/タスク状況の俯瞰 | ★★★☆☆ | ★★☆☆☆ |
| UC-04 | 文書管理 | Org Admin, User | 文書の登録/整理/バージョン確認 | ★★★★☆ | ★★★☆☆ |
| UC-05 | リスクアセスメント | Org Admin, Approver | リスク登録・評価・マトリクス表示 | ★★★★☆ | ★★★★☆ |
| UC-06 | タスク運用 | Org Admin, User | タスク作成、担当割当、進捗更新 | ★★★☆☆ | ★★★☆☆ |
| UC-07 | 監査準備 | Org Admin, Auditor | 監査計画、チェックリスト、証跡管理 | ★★★★☆ | ★★★★☆ |
| UC-08 | 通知とアラート | Org Admin, User | 重要イベントの通知、招待メール | ★★★☆☆ | ★★★★☆ |
| UC-09 | 設定・権限管理 | System Operator, Org Admin | 組織設定、ユーザー管理、ロール割当 | ★★★★☆ | ★★★☆☆ |

> 評価目安: ★★★★★ = 非常に高い / ★★☆☆☆ = 低い

## 2. 優先スライスの選定（背骨）

初期リリースに必須となる事業価値とリスクを踏まえ、以下を背骨とする。

1. **UC-01 初期オンボーディング**  
   - 認証／組織作成／初期設定まで縦断的に通す。  
   - 依存: Supabase Auth、user_profiles、organizations。

2. **UC-02 課金と契約管理**  
   - Stripe ウォーキングスケルトンを発展させ、Checkout → Webhook → サブスクリプション反映まで。  
   - 依存: UC-01 完了後に着手。

3. **UC-03 ダッシュボード閲覧**  
   - 組織・契約情報を基に KPI のモック値を表示し、ユーザーが状況を把握できる。  
   - 依存: UC-02 の契約ステータス。

> 上記 3 本を完成させると「登録→契約→状況確認」の1本が完成。ここから文書/リスク/監査へ広げる。

## 3. 最小スライスの定義

| ユースケース | 最小スライスに含める要素 |
| --- | --- |
| UC-01 初期オンボーディング | サインアップフォーム → Supabase Auth 登録 → user_profiles 作成 → organizations 作成 → ダッシュボードへリダイレクト（UI 仮でも良い） |
| UC-02 課金と契約管理 | Pricing でプラン選択 → Stripe Checkout (テスト) → Webhook モックで subscriptions を更新 → Settings でプラン表示 |
| UC-03 ダッシュボード閲覧 | 現在プラン／ユーザー数などを Supabase から取得し、簡易 KPI を表示（グラフはプレースホルダ可） |

## 4. 実行ステップ

1. **現状骨格の整備**: Stripe モック API を維持しつつ、UC-01 の Auth フロー（既存のサインアップ／組織作成）をウォーキングスケルトンとして再確認。必要ならモック遷移を追加。
2. **UC-02 発展**: Stripe API 実装、Webhook 署名検証、subscriptions/billing 更新。テストモードで決済完了 → サブスクリプション反映まで一連を動かす。
3. **UC-03 ダッシュボード**: Supabase からメトリクス（ユーザー数・契約プランなど）を取得し、最小 UI で表示。後続で KPI やグラフを拡張する。
4. **検証と肉付け**: UC-01〜03 を通して社内検証 → ペインポイントを記録 → UI/仕様調整。
5. **次スライス**: 文書UC-04 / リスクUC-05 / 監査UC-07 の順に、同手順でスケルトン→肉付けを繰り返す。

## 5. コミュニケーション指針

- 「次は UC-01 の最小スライスを磨く」「UC-02 のスケルトン通しました」など、ユースケース ID で会話する。
- 仕様変更はスライス単位でチーム合意を取る。探索トラックでの学びは `docs/02-project/*` にログする。
- スケルトン状態のコードにもコメント／ドキュメントで将来の肉付けポイントを残す。

## 6. 現在の進捗（2025-11-04）

- **#55 UC-02（課金と契約管理）**: Billing Portal 正常系（S1/S2）をモックポータルで完走し、`npm run qa:webhook:abnormal` で署名不一致と一時的 5xx の異常系を CLI QA 化。Stripe CLI からの実イベントで `subscriptions` / `payment_history` の同期を再確認済み。残課題は `stripe_events` を用いた本番経路の冪等検証（STRIPE-IDEMP-PROD）。
- **#56 UC-04（文書承認フロー）**: `npm run qa:documents:approver` と `tests/e2e/doc-approver.spec.ts` で一次承認→最終承認と通知センター連携を自動検証。承認者・最終承認者双方に通知が届き、文書ステータスが意図どおり遷移することを確認した。
- **#57 UC-05（リスクマトリクス）**: `npm run qa:risks:matrix` で DOM/色/レスポンシブの回帰を整備し、`npm run qa:risks:export` で検索語・カテゴリ・ステータスフィルタ付きの Excel/PDF エクスポートを検証済み。
- **#58 QA 自動更新**: `npm run qa:all` が許可リスト制御・Slack 通知・`docs/02-project/12_uc-checklist.md` への自動差し込みに対応。`npm run qa:matrix` と組み合わせて主要 QA をまとめて回せる状態。
- **#59 UC-08（通知センター/設定）**: 通知ベル・通知一覧・通知設定のトグル→保存を `npm run qa:notifications:settings` で回帰。Edge Function `notifications-email` と運用手順を `docs/06-operations/notifications.md` に整理し、メール再送パスも定義。
- **#60 UC-09（RBAC）**: `npm run qa:rbac:matrix` で `/ja/settings/users` のアクセス可否をロール別に検証。2025-11-04 時点で Dev Login の権限マトリクスをロール別に可変化し、`settings/assets` / `settings/controls` の否定ケースも Playwright (`tests/e2e/rbac-assets-controls.spec.ts`) で緑化済み。
- **#61 ドキュメント整備**: UC-02 / UC-04 / UC-05 / UC-09 のストーリーカードを追加し、ウォークスルーと QA コマンドへの参照を統一。
- **#62 QA マトリクス**: `npm run qa:matrix` でロール×ユースケースの Playwright/CLI QA を一括実行できるようにし、既存サーバーを再利用する設定へ統一。

## 7. UC-01 実装メモ（2025-09-17）
- `components/auth/AuthForm.tsx` でサインアップ成功時にモックユーザー情報を `sessionStorage` / Cookie に保存し、`/${locale}/home?onboarding=success` へ遷移するよう変更。
- `/api/auth/signup` は引き続き Supabase 上に組織とユーザープロファイルを作成するため、データベース側の整合性も維持。
- サインアップ後は Supabase Auth のセッションが即時確立され、「登録 → 組織作成 → ダッシュボード表示」まで一本で通る。
- 将来的にメール認証を有効化する際は、`AuthForm` のリダイレクト先を `/auth/verify-email` へ切り替えるフラグを追加する想定。
- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` を `true` にするとメール確認待ちのまま `/auth/verify-email` に遷移し、未確認メールでのログインはガードされる。

## 8. UC-02 実装メモ（2025-09-18）
- `/app/api/stripe/create-checkout-session` を Stripe SDK 実装に置き換え、Supabase Service Role から価格IDと組織情報を取得して Checkout Session を発行。鍵未設定時は従来どおりモック ID を返す。
- `/app/api/stripe/create-portal-session` では最新サブスクリプションの `stripe_customer_id` を取得し、Billing Portal を生成（未契約時は 400 を返す）。
- `/app/api/stripe/webhook` に署名検証・イベント重複排除・`subscriptions`／`payment_history` の更新を実装。`checkout.session.completed`・`customer.subscription.*`・`invoice.payment_succeeded` を処理。
- `lib/supabase/admin.ts` を追加し、Service Role クライアント経由で Supabase を更新。環境変数が未設定の場合はウォーキングスケルトンのモックパスへ自動フォールバック。
- 検証手順（Stripe CLI の `listen` コマンド等）を開発ガイドへ追記し、テストモードでの E2E 検証が可能になった。
- `scripts/qa-stripe-webhook-abnormal.js` と `tests/e2e/stripe-idempotency.spec.ts` を追加し、署名不一致・一時的 5xx の異常系や開発用冪等ヘッダー（`X-Test-Event-ID`）の検証を自動化した（2025-10-29）。

## 9. UC-03 実装メモ（2025-09-18）
- `app/[locale]/home/page.tsx` をリファクタリングし、`UserService` / `OrganizationService` / `StripeService` から実データを取得。ウォーキングスケルトン時はモックデータ、鍵設定済み環境では Supabase / Stripe の値を表示。
- 組織統計（ユーザー数・文書数・タスク件数・リスク件数）をカード表示し、契約プラン情報と「オンボーディング完了」バナーを追加。
- `messages/*.json` にダッシュボード用の翻訳キーを追加し、エラー表示やステータスバッジを国際化。
- 将来的な肉付けとして、KPI グラフ・最近の活動ログ・通知センター連携を追加予定。

## 10. UC-04 実装メモ（2025-10-29）
- 文書承認モーダルで一次承認者と最終承認者を指定し、下書き → 承認依頼 → 承認済みまでを 2 段階で通すフローを整備。承認結果は通知センターとも連動する。
- Playwright `tests/e2e/doc-approver.spec.ts` で S1/S2（一次承認経由の承認）と通知到達を自動検証し、`npm run qa:documents:approver` から CLI QA として実行できるようにした。
- 承認トリガー時の通知メッセージと `DocumentService` のステータス更新を整理し、Dev Login からのウォークスルーでも同じ導線を確認済み。
- バージョン履歴モーダルを追加し、承認者ロールでの文書一覧・通知・バージョン履歴を `tests/e2e/doc-approver.spec.ts` の追加シナリオで再検証（2025-11-04）。

## 11. UC-05 実装メモ（2025-10-29）
- リスクマトリクスのクラス/閾値/凡例 DOM を `scripts/qa-risks-matrix.js` と `tests/e2e/risks-matrix.spec.ts` で自動検証。375/768/1920 のビューポートで崩れないことを確認する回帰を追加。
- リスク Excel/PDF エクスポート API `/api/risks/export?format=` を実装し、検索語・カテゴリ・ステータスフィルタを適用した出力を `npm run qa:risks:export` で検証。Content-Type や抽出件数、PDF シグネチャを QA ログに残すようにした。
- `docs/05-quality/uc-validation-20250918.md` にエクスポート QA 手順を追記し、UC チェックリスト OR-09 を完了へ更新。

## 12. UC-07 実装メモ（2025-10-15 着手）
- 監査ウォーキングスケルトンのギャップを洗い出し、`docs/02-project/02_implementation-plan.md` に 10 項目の改善ロードマップを追記。
- `app/[locale]/audit/**` 向けにアクセスガードとナビゲーション制御を追加し、`auditor`／`org_admin`／`system_operator`／`can_manage_audit` 保有者のみに表示する方針を決定。
- 監査計画詳細ページ・チェックリスト画面・不適合一覧・報告書編集の 4 画面を新規実装し、ステータス遷移・チーム管理・証跡アップロード・是正処置までを 1 つの導線で通す設計を定義。
- Supabase 型定義・`AuditService` の拡張（監査ログ記録、署名付き URL、関連リソース削除）と Dev Login シード更新（監査データ投入、`can_manage_audit` 権限付与）をタスクとして列挙。
- `scripts/test-audit.js` の巡回チェックと `tests/e2e/audit-walkthrough.spec.ts` 新設を決定し、証跡アップロード用ダミーファイルを `tests/fixtures/evidence.txt` に追加する。
- 翻訳キー／ドキュメント更新（Walking Skeleton 計画、UC チェックリスト、QA ドキュメント、開発ガイド、README）をタスク化し、完了後に `docs/05-quality/uc-validation-20250918.md` へ結果を反映する。

## 13. UC-08 実装メモ（2025-10-11）
- `components/layout/NotificationBell.tsx` を実装し、最新 10 件を表示・既読化できる通知ベルを提供。30 秒間隔で未読件数を更新し、全件既読アクションをサポート。
- `app/[locale]/notifications/page.tsx` で通知一覧ページを実装。未読／既読／アーカイブ切替、全件既読、単体アーカイブ、通知先リンク遷移を提供。
- `app/[locale]/settings/notifications/page.tsx` に通知設定 UI を追加し、アプリ／メール通知の有効化、種別別トグル、リマインダー日数の更新を可能にした。
- `lib/services/notification.ts` に通知取得・既読化・アーカイブ化・未読件数カウント・通知設定の CRUD を実装し、ベル／一覧／設定画面で共通利用できるサービス層を整備。
- Playwright `tests/e2e/notifications-settings.spec.ts` と `npm run qa:notifications:settings` でトグル→保存の回帰を整備し、メール送信経路は `supabase/functions/notifications-email` で運用可能にした。

## 14. UC-09 実装メモ（2025-10-29）
- `/ja/settings/users` のアクセスをロール別に制御し、system_operator / org_admin のみがユーザー管理 UI を閲覧可能。その他のロールは `/ja/home` へ誘導する。
- `tests/e2e/rbac-matrix.spec.ts` と `scripts/qa-rbac-matrix.js` でロール×機能のアクセス可否を自動検証し、`npm run qa:matrix` の対象に組み込んだ。
- Dev Login の権限マトリクスを 2025-11-04 にロール別へ可変化し、否定ケースを `tests/e2e/rbac-assets-controls.spec.ts` で再有効化した。CLI (`npm run qa:rbac:matrix`) からも否定経路が実行される。

## 15. QA チェックリスト（2025-11-04 更新）
最新のチェック項目は `docs/02-project/12_uc-checklist.md` に集約しています。GitHub Issue を作成する際も同ファイルをコピーしてご利用ください。

- 2025-11-04: `npm run qa:risks:export` でフィルタ条件を尊重した Excel 出力と Content-Type を検証し、UC-05 OR-09 の QA を記録。
- 2025-10-29: `npm run qa:documents:approver` / `qa:risks:matrix` / `qa:notifications:settings` / `qa:rbac:matrix` を追加し、`npm run qa:matrix` から一括実行できるよう整備。`docs/02-project/stories/` へ対応ストーリーカードを追加した。
- 2025-09-18: サインアップ時に `42P17 infinite recursion detected in policy for relation "user_profiles"` が発生したため、`supabase/migrations/20250918090000_fix_recursive_policies.sql` で RLS ポリシーをヘルパー関数経由の参照に置き換え。適用後に UC-01 QA を再実施する。
- 2025-09-18: Playwright 自動テスト（`tests/e2e/signup.spec.ts`）を追加。手動 QA 前に Chromium でのサインアップ成功・重複登録エラーを確認する。
- 2025-09-18: `tests/e2e/signup.spec.ts` にログイン・Pricing モック検証を追加。Stripe キー未設定の環境ではチェックアウトモック／ポータル生成を自動確認できる。
- 2025-09-18: `/api/auth/signup` は Supabase Service Role で組織・ユーザープロファイルを作成するよう修正し、`user_profiles` / `organizations` に Playwright で生成したデータが登録されることを確認。
- 2025-09-18: Stripe Basil API（`2025-05-28.basil`）への追随を実施し、Webhook・決済履歴同期ロジックを更新。`npm run typecheck` / `npm run lint` で正常確認。
- 2025-09-18: Supabase 管理 API を `listUsers` ベースにリファクタリングし、`user_profiles` などの型定義を拡張して Dev Login の安定性を向上。
- 2025-09-18: 文書一覧とフォルダーツリーの型定義を整理し、Documents ページの依存関係を `useCallback` + 型付きサービスで統一。
- 2025-09-18: リスク／タスク／監査ダッシュボードの主要ページを型安全化し、`npm run typecheck` / `npm run lint` がグリーンであることを確認。

> ⚠️ 手動 QA は Stripe テストキー・Supabase ローカル環境を用意した上で実施してください。結果と改善点は次のスプリントで backlog に追加します。

## 16. 追加フォローアップ（Backlog 候補）
- **DEVLOGIN-RBAC**: ✅ 2025-11-04 完了。Dev Login の権限付与をロール別に可変化し、否定 RBAC E2E（`rbac-assets-controls.spec.ts`）を回帰へ復帰済み。
- **NOTIFY-CONSISTENCY**: 通知ベル／一覧／設定／メールの既読・再通知挙動を横断で整合させる。`NotificationService` の再フェッチと Edge Function の再送ログを確認する。
- **NOTIFY-SLACK-QA**: `npm run qa:notifications:slack` を実行し、Slack チャネルへの通知と `organization_notification_channel_logs` の送信履歴（`status=sent/attempt/error`）を検証した証跡を `test-results/notifications-slack-*.json`/`.png` に残す。2025-11-19 UCレビューで Slack チャネル QA が未実施のため、実行ログを `docs/02-project/archive/90_2025-11-19_progress.md` に追記して UC-08 のチェックリストを完了させてください。
- **STRIPE-IDEMP-PROD**: 署名付き Stripe イベント（`stripe_events`）の重複/並行配信でも本番経路が冪等となる E2E/QA を整備する。
  - **2025-11-19 UCレビューで確認**: `docs/02-project/12_uc-checklist.md` の Stripe 署名イベント QA が未完了。`npm run qa:uc02-org-admin`/`qa:webhook:abnormal` で署名付きイベントを繰り返し送信し、本番同等の idempotent 処理を確認して `test-results/qa-uc02-*` と `docs/02-project/archive/90_2025-11-19_progress.md` に証跡を入れてください。
- **STORIES-EXTEND**: 通知（UC-08）と監査（UC-07）の詳細ストーリーカードを `docs/02-project/stories/` に追加し、欠番シナリオを補完する。
- **UC-06 タスク運用**: コメント添付・タグ運用・リマインダー通知のウォーキングスケルトン化と QA シナリオ化を追跡する。
