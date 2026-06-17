---
title: 共通 UI ガイドライン（期間・状態表示）
category: design-system
created: 2025-11-08
last_updated: 2025-12-01
author: Codex
ears_compliant: true
---

# 共通 UI ガイドライン（期間・状態表示）

本ドキュメントは ISMS Pilot の運用画面で共通して採用する期間／状態表示のルールをまとめたものです。リスク、タスク、監査など主要モジュールにまたがる改善チケット（2025-11-08 レビュー）に基づき、実装前に仕様を一元化します。

## 1. 期間（年度・サイクル）の明示

1. **ヘッダーメタ情報**
   - 画面タイトル直下に「表示中の年度／期間」を `Tag` コンポーネントで表示（例: `FY2025 Q2`、`2025-04-01〜2026-03-31`）。
   - リスク一覧（`app/[locale]/risks/page.tsx`）や監査ダッシュボード（`app/[locale]/audit/page.tsx`）では、API から返却された `assessment_period` / `audit_period` を必須項目にする。
   - 実装状況: Issue #98 で `/[locale]/risks` にタグ表示と URL クエリ同期済み。監査ダッシュボードは次フェーズで着手予定。

2. **年度セレクター**
   - 画面右上に `Select` を配置し、事前に定義した年度マスター（`fiscal_years` テーブル予定）から選択。
   - 選択値は URL クエリ（例: `?year=2025&cycle=q2`）に反映し、サーバー API のフィルタへ渡す。

3. **データの無い年度の扱い**
   - 「データがありません」メッセージには対象期間を含める（例: `FY2024 に該当するリスクは登録されていません`）。

## 2. 状態フィルタとラベル

1. **統一フィルタ UI**
   - リスク／タスク／監査すべて `FilterBar` コンポーネントを共通化し、`status`, `cycle`, `owner` を左から配置。
   - ステータス変更時はバナー（`StatusFilterBanner`）を表示している実装（例: `app/[locale]/tasks/page.tsx:24-61`）を他画面にも展開。
   - 実装リファレンスは `components/filters/FilterBar.tsx` と `components/filters/StatusFilterBanner.tsx`。各ページは `FilterBarItem[]` でフィルタ構成を渡し、URL クエリと同期する。

2. **ステータス表示ルール**
   - カラーリングは `statusColorScheme` トークンで集中定義。高リスク／重大監査項目はウォームカラー、完了はグリーン系。
   - ラベルは `messages/{locale}.json` の `common.status.*` に集約し、各ドメインで個別定義しない。

## 3. ダミーデータ／検証用シード

1. **リスク**: 5 件のデモデータ（影響度×可能性が異なるもの）を `supabase/seed/risk_demo.sql`（新規）で提供し、`npm run seed:risks-demo` で投入可能にする。
2. **タスク**: 3 件の代表タスク（文書更新／リスクレビュー／教育実施）を同様のシードコマンドで登録。
3. **監査**: `planning`, `in_progress`, `completed` の各ステータスを含むサンプルを準備し、期間フィールドの表示検証を可能にする。

## 4. ドキュメントとの連動

- 各モジュールの仕様書（`docs/02-project/90_*.md`）には、対応する年度セレクター/ステータス仕様のリンクを追記する。
- Plan Tracking（`docs/02-project/10_plan-tracking.md`）の未対応事項に、期間 UI の導入ステータスを記録する。
- Figma/デザイン資産: `design/figma/period-filter.fig`（仮）にコンポーネント例を保存し、本ドキュメントからリンクする（リンク貼付はデザイン確定時）。

## 5. EARS 形式 UI動作要件定義

### 5.1 期間・フィルタ要件

#### ユビキタス要件
- EARS-UI-001: The system shall 全ての一覧画面（リスク、タスク、監査）で統一されたFilterBarコンポーネントを使用する。
- EARS-UI-002: The system shall ステータス表示のカラーリングを`statusColorScheme`トークンで集中定義する。
- EARS-UI-003: The system shall 全てのラベルテキストを`messages/{locale}.json`の翻訳キーから取得する。

#### イベント駆動要件
- EARS-UI-010: When ユーザーが年度セレクターで特定の年度/四半期を選択したとき、the system shall リスク・タスク・監査の各リスト API に同じ期間パラメータを渡し、ページ上部に選択した期間タグを表示する。
- EARS-UI-011: When フィルタ条件が適用されたとき、the system shall `FilterBar` 直下にステータス/期間バナーを表示する。
- EARS-UI-012: When フィルタバナーの解除ボタンが押下されたとき、the system shall 該当クエリをURLから削除し、フィルタを解除する。
- EARS-UI-013: When 期間セレクターでデータが存在しない年度を選択したとき、the system shall 「(例) FY2024 のデータは存在しません」というプレースホルダと、デフォルト期間に戻るショートカットを表示する。
- EARS-UI-014: When 画面がロールごとに描画されるとき、the system shall 期間タグ・フィルタバー・状態バッジのレイアウトを統一し（DashboardLayout 共通領域内）、翻訳キー `common.period.current` を利用して言語ごとに表示を切り替える。
- EARS-UI-015: When デモ/QA データシードコマンド（`npm run db:seed -- --demo <module>`）が実行されたとき、the system shall 期間フィールドを現在年度に自動設定し、UI での期間切り替えテストに利用できる状態にする。

### 5.2 ナビゲーション・画面遷移要件

#### イベント駆動要件
- EARS-UI-020: When ユーザーがサイドバーのメニュー項目をクリックしたとき、the system shall 対応する画面に遷移し、アクティブ状態を視覚的に表示する。
- EARS-UI-021: When ユーザーがブラウザの戻るボタンを押したとき、the system shall 前の画面状態（フィルタ条件含む）を復元する。
- EARS-UI-022: When ユーザーが権限のないページにアクセスしようとしたとき、the system shall アクセス拒否画面を表示し、ダッシュボードへのリンクを提供する。
- EARS-UI-023: When 認証セッションが切れた状態でページ操作が行われたとき、the system shall ログイン画面にリダイレクトし、元のURLを保持する。
- EARS-UI-024: When ログイン後に元のURLが保持されていたとき、the system shall 認証完了後にそのURLにリダイレクトする。

### 5.3 フォーム・入力要件

#### ユビキタス要件
- EARS-UI-030: The system shall 全ての入力フィールドに`label`要素を関連付ける（`htmlFor`と`id`の紐付け）。
- EARS-UI-031: The system shall フォームの説明テキストを`aria-describedby`で入力フィールドと関連付ける。
- EARS-UI-032: The system shall 必須フィールドを視覚的に識別可能にする（アスタリスク表示等）。

#### イベント駆動要件
- EARS-UI-040: When ユーザーがフォームを送信しようとしたとき、the system shall クライアント側でバリデーションを実行し、エラーがあれば該当フィールドにエラーメッセージを表示する。
- EARS-UI-041: When バリデーションエラーが発生したとき、the system shall 最初のエラーフィールドにフォーカスを移動する。
- EARS-UI-042: When フォーム送信が成功したとき、the system shall 成功メッセージを表示し、適切な画面に遷移する。
- EARS-UI-043: When フォーム送信が失敗したとき、the system shall エラーメッセージを表示し、入力内容を保持する。
- EARS-UI-044: When ユーザーが未保存の変更がある状態でページを離れようとしたとき、the system shall 確認ダイアログを表示する。

### 5.4 テーブル・一覧表示要件

#### イベント駆動要件
- EARS-UI-050: When ユーザーがテーブルヘッダーをクリックしたとき、the system shall 該当列でソートを実行し、ソート方向を視覚的に表示する。
- EARS-UI-051: When ユーザーがページネーションを操作したとき、the system shall 指定ページのデータを取得し、現在ページを視覚的に表示する。
- EARS-UI-052: When データ読み込み中であるとき、the system shall ローディングインジケーターを表示する。
- EARS-UI-053: When データが0件のとき、the system shall 空状態メッセージと新規作成へのガイダンスを表示する。
- EARS-UI-054: When テーブル行にマウスホバーしたとき、the system shall 行をハイライト表示する。
- EARS-UI-055: When テーブル行がクリックされたとき、the system shall 詳細画面に遷移するか、選択状態を切り替える。

### 5.5 モーダル・ダイアログ要件

#### イベント駆動要件
- EARS-UI-060: When モーダルが開いたとき、the system shall 背景をオーバーレイで覆い、モーダル内にフォーカスをトラップする。
- EARS-UI-061: When ユーザーがモーダル外をクリックしたとき、the system shall モーダルを閉じる（設定により無効化可能）。
- EARS-UI-062: When ユーザーがEscキーを押したとき、the system shall モーダルを閉じる。
- EARS-UI-063: When 確認ダイアログで「キャンセル」が押されたとき、the system shall 操作をキャンセルしダイアログを閉じる。
- EARS-UI-064: When 確認ダイアログで「確認」が押されたとき、the system shall 対象操作を実行する。
- EARS-UI-065: When 削除確認ダイアログが表示されるとき、the system shall 削除対象の名称を明示し、取り消し不可能であることを警告する。

### 5.6 通知・フィードバック要件

#### イベント駆動要件
- EARS-UI-070: When 操作が成功したとき、the system shall 成功トースト通知を画面右上に3秒間表示する。
- EARS-UI-071: When 操作が失敗したとき、the system shall エラートースト通知を表示し、ユーザーが閉じるまで維持する。
- EARS-UI-072: When 新しい通知が到着したとき、the system shall 通知ベルにバッジを表示し、未読数を更新する。
- EARS-UI-073: When ユーザーが通知ベルをクリックしたとき、the system shall 通知ドロップダウンを表示し、最新10件の通知を一覧表示する。
- EARS-UI-074: When ユーザーが通知項目をクリックしたとき、the system shall 当該通知を既読にし、関連画面に遷移する。

### 5.7 レスポンシブ・アクセシビリティ要件

#### ユビキタス要件
- EARS-UI-080: The system shall 画面幅320px以上の全デバイスで正常に表示する。
- EARS-UI-081: The system shall キーボードのみでの全機能操作を可能にする。
- EARS-UI-082: The system shall WCAG 2.1 Level AAのコントラスト比を満たす。
- EARS-UI-083: The system shall スクリーンリーダーで読み上げ可能なaria属性を適切に設定する。

#### イベント駆動要件
- EARS-UI-090: When 画面幅が768px未満になったとき、the system shall サイドバーを折りたたみ、ハンバーガーメニューに切り替える。
- EARS-UI-091: When Tabキーで要素間を移動したとき、the system shall フォーカスインジケーターを明確に表示する。

### 5.8 エラーハンドリング要件

#### イベント駆動要件
- EARS-UI-100: When APIリクエストがタイムアウトしたとき、the system shall 「接続がタイムアウトしました。再試行してください」メッセージを表示する。
- EARS-UI-101: When APIリクエストが認証エラー（401）を返したとき、the system shall ログイン画面にリダイレクトする。
- EARS-UI-102: When APIリクエストが権限エラー（403）を返したとき、the system shall 「この操作を実行する権限がありません」メッセージを表示する。
- EARS-UI-103: When APIリクエストがサーバーエラー（500）を返したとき、the system shall 「サーバーエラーが発生しました。しばらくしてから再試行してください」メッセージを表示する。
- EARS-UI-104: When 予期せぬJavaScriptエラーが発生したとき、the system shall エラーバウンダリでキャッチし、フォールバックUIを表示する。

## 6. リアルタイム通知ストリームの共有

1. **共通フックの利用** 通知ベル（`components/layout/NotificationBell.tsx`）と通知ページ（`app/[locale]/notifications/page.tsx`）では `lib/hooks/useNotificationStream.ts` が提供する `useNotificationStream` を使い、`NotificationService.subscribeToRealtimeNotifications` を直接呼ばない。内部的には `subscribeToNotificationStream` が `userId + options` ごとに Supabase Realtime チャネルを一つだけ開き、複数のハンドラを同一ソケットへ集約する。
   - フックは `console.info` で `shared channel ${key} (total channels=N)`、`console.debug` でリスナー増減を常時出力する。QA 時に通知ベルと通知センターを同時に開いて開発者ツールを確認し、`shared channel` ログが 1 件で `total channels=1` になることを確認する。また `window.getNotificationStreamMetrics && window.getNotificationStreamMetrics()` を叩いて `channelCount` が 1、`entries[0].listeners` がリスナー数の合計になっているかを検証する。
2. **接続のライフサイクル** `useNotificationStream` には `loadNotifications` などをラップした `useCallback` を渡し、マウント中のみ `listenerCount` をインクリメントする。コンポーネントがアンマウントすると最後のリスナーであることを検知して `subscribeToNotificationStream` が Supabase チャネルを閉じるため、`supabase.removeChannel` を呼ぶ必要はない。
3. **テスト・検証メモ** `tests/unit/notification-stream.test.ts` では同一 `userId` で多重登録して 1 回だけ `NotificationService.subscribeToRealtimeNotifications` を叩き、最後に `cleanup` したときに `unsubscribe` も 1 回だけ呼ぶことを確認している。QA 計画では多重タブでベル＋通知センターを開きつつ、このテスト結果とコンソールログ/メトリクスを照らし合わせて接続漏れを防ぐこと。

## 7. フォーム/入力のアクセシビリティ

A11y を害する原因の多くは、`label` と `input` の結びつきが弱いことです。すべての入力コントロールは `label` の `htmlFor` を使って `id` 付きの `input`/`select` と結び、必要な説明を `aria-describedby` 付きの helper span から提供してください。`app/[locale]/super-admin/organizations/page.tsx` のテナント作成フォームでは、`messages/{locale}.json` の `superAdmin.organizations.create.helpTexts` を参照する helper span に `id` を振り、その `id` を `aria-describedby` で使って目に見える説明を伝えています。変更するたびに helper text を `messages/ja.json` と `messages/en.json` の両ロケールに追加し、`t('create.helpTexts.xxx')` を使ってレンダリングしてください。

Playwright テスト（`tests/e2e/super-admin.spec.ts`）は `getByLabel` をベースにフォームにアクセスするため、ラベルが存在しない場合にすぐ失敗します。新しいフォームや設定項目を追加する場合も、先に `label`/`id` をつなげてから QA で `npx playwright test tests/e2e/super-admin.spec.ts --reporter=json=test-results/super-admin-a11y.json` を実行し、`test-results/super-admin-a11y.json` を evidence として保存してください。この JSON には `getByLabel('テナント名')`, `'プラン'`, `'ステータス'`, `'トライアル日数（日）'`, `'System Operator のメールアドレス'` が使う `id`/`aria-describedby` の証跡が含まれる想定です。

将来 `/super-admin/settings` に入力フォームが登場したときも同じルールを適用してください。`superAdmin.settings.helpTexts` という名前空間を用意し、翻訳・helper span・`aria-describedby` を揃えてから Playwright のラベルチェックに対応させることで、CI の `getByLabel` シナリオを壊さずに拡張できます。

> 実装時は本ガイドラインを更新し、最終的なスクリーンショット／デザインパラメータを追記してください。

---

## 8. EARS要件ID一覧

| カテゴリ | ID範囲 | 件数 |
|---------|--------|------|
| 期間・フィルタ (5.1) | EARS-UI-001 〜 015 | 9件 |
| ナビゲーション (5.2) | EARS-UI-020 〜 024 | 5件 |
| フォーム・入力 (5.3) | EARS-UI-030 〜 044 | 8件 |
| テーブル・一覧 (5.4) | EARS-UI-050 〜 055 | 6件 |
| モーダル・ダイアログ (5.5) | EARS-UI-060 〜 065 | 6件 |
| 通知・フィードバック (5.6) | EARS-UI-070 〜 074 | 5件 |
| レスポンシブ・A11y (5.7) | EARS-UI-080 〜 091 | 6件 |
| エラーハンドリング (5.8) | EARS-UI-100 〜 104 | 5件 |
| **合計** | | **50件** |

---

## 更新履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|-----------|---------|--------|
| 2025-11-08 | 1.0 | 初版作成 | Codex |
| 2025-12-01 | 2.0 | EARS形式の要件定義を追加（50件） | Claude |
