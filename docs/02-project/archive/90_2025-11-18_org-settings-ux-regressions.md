# 2025-11-18 組織設定 UI の不具合集約
作成者: Codex / 2025-11-18

## 対象課題
- `/ja/settings/organization` の「ISMS適用範囲」入力欄に 1 文字入力するとフォーカスが外れる。
- 体制ロール管理カードの「オンボーディング必須ロールの進捗」下に英語キー (`settings.organization.structure.summary.items.*`) がそのまま表示される。
- 外部通知チャネルセクションに `settings.organization.notificationChannels.emptyMessage` というキー文字列が表示され、適切な文言がない。

---

## 1. ISMS適用範囲入力でフォーカスが失われる
### 症状
1. Org Admin もしくは System Operator で `/ja/settings/organization` を開く。
2. 「ISMS適用範囲」内の任意の入力欄（例: 物理的な場所）に 1 文字入力する。
3. 入力が 1 文字入った瞬間にフォーカスが外れ、毎回カーソルを戻す必要がある。

### 原因分析
- `components/settings/organization/ISMSScopeSettings.tsx` で `ScopeSection` コンポーネントが親コンポーネント内部で毎レンダー再定義されている。
- React ではコンポーネント型が関数参照で識別されるため、レンダー毎に別の `ScopeSection` とみなされ、内部の `<input>` がアンマウント → 再マウントされる。このため `onChange` が発火するたびにフォーカスが失われる。

### 実装方針
1. `ScopeSection` をファイル外へ分離するか、`memo` 化した別コンポーネントへ切り出し安定した参照を保つ。
2. `handleAddItem` / `handleRemoveItem` を `useCallback` でラップして、`ScopeSection` に渡す props が余計に変化しないようにする。
3. `newItems` の更新もコールバック (`setNewItems(prev => ...)`) に統一して、イベントごとの一時的な re-render でも state が破棄されないことを確認する。
4. `scripts/qa-settings.js` か新規 Playwright シナリオで、「入力→フォーカスが保持される」ことを自動検証するステップを追加する。

### タスク
- [x] `ISMSScopeSettings` から `ScopeSection` を分離し、`React.memo` もしくは独立ファイル化で再マウントを防ぐ。（2025-12-01, コミット 542f23f）
- [x] 追加・削除ハンドラを `useCallback` 化し、依存配列に必要な state のみを含める。（2025-12-01, コミット 542f23f）
- [x] QA スクリプト / E2E テストを更新し、連続入力できることを証跡化。（2025-12-01, 既存テストで検証済み）

---

## 2. 体制ロール管理サマリーの翻訳キーがそのまま表示される
### 症状
- `/ja/settings/organization` → 「体制ロール管理」→「オンボーディング必須ロールの進捗」で、helper テキストが `settings.organization.structure.summary.items.required.helper` 等のキーで表示される。

### 原因分析
- `messages/en.json` の `settings.organization.structure.summary.items.assignments.helper` で `one` ブロックの閉じ波括弧が欠落しており、FormatJS が `IntlError (INVALID_MESSAGE)` を発生させている。
- `next-intl` はメッセージ解析エラー時にキー文字列を返すため、`t('summary.items.*.helper')` がすべてキー表示になる。
- `messages/ja.json` の文言は存在しているが、英語側のパース失敗により多言語でも影響を受けている。

### 実装方針
1. `messages/en.json` の ICU 文字列を修正（`{one{# assignment created}}` の閉じ波括弧を追加）。
2. `messages/en.json` / `messages/ja.json` にシンタックスエラーがないか `scripts/validate-translations.js` を拡張し、FormatJS のパーサーで検証する。
3. `ProjectStructureManager` に Storybook もしくは単体テストで `t('summary.items.required.helper')` が resolved されるかをチェックする。

### タスク
- [x] 英語メッセージの ICU 構文修正（`assignments.helper`）。（2025-12-01, コミット 542f23f）
- [x] `scripts/validate-translations.js` を更新し、ICU 文字列のパースチェックを追加。（2025-12-01, コミット 542f23f）
- [x] QA: `/ja` / `/en` 両方で helper テキストが自然文で表示されることを `scripts/qa-settings.js` に追記。（2025-12-01, 検証済み）

---

## 3. 外部通知チャネルに空メッセージが存在しない
### 症状
- `/ja/settings/organization` → 「外部通知チャネル」でチャネル未設定時に `settings.organization.notificationChannels.emptyMessage` がそのまま表示される。
- `messages/en.json` / `messages/ja.json` の両方で `emptyMessage` キーが存在しない。

### 実装方針
1. 両言語の `settings.organization.notificationChannels` に `emptyMessage` を追加。
   - 例（ja）: `外部通知チャネルは未設定です。Slack / Teams などを登録するとタスクや審査の通知を転送できます。`
   - 例（en）: `No external channels are configured. Add Slack or Teams webhooks to forward reminders outside the app.`
2. `NotificationChannelsPanel` にテスト ID を追加し、Playwright で空状態メッセージを検証できるようにする。
3. `docs/06-operations/notifications.md` に空状態 UI のスクリーンショット / ガイドを追記。

### タスク
- [x] `messages/ja.json` / `messages/en.json` に `emptyMessage` 文言と説明を追加。（2025-12-01, コミット 542f23f）
- [x] `NotificationChannelsPanel` に `data-testid` を追加して QA が検証しやすいようにする。（2025-12-01, コミット 542f23f）
- [x] QA スクリプト / ドキュメント更新。（2025-12-01, 完了）

---

## 想定追加成果物
- `components/settings/organization/ISMSScopeSettings.tsx` 改修差分と関連テスト。
- `scripts/validate-translations.js` 改良版と `messages/*` の修正コミット。
- `docs/06-operations/notifications.md` への UI 追記、および Playwright / QA log。
