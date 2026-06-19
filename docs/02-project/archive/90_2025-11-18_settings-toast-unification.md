# 2025-11-18 設定画面トースト通知の統一
作成者: Codex / 2025-11-18

## 背景
- 設定配下の画面は縦長フォームが多く、保存や CSV 取込などを実行するとページ最上部に表示される従来型のアラート（`div` のみ）がスクロール位置の外へ消えてしまう。
- `/ja/settings/assets` で CSV エクスポート／インポートを実行すると、実行結果メッセージはフォーム先頭にレンダリングされるため、テーブル下部で操作しているユーザーにはフィードバックが見えない。
- 一部画面（例: `/settings/controls`, `/settings/profile`）では `WindowToast` を利用してビューポート上部にフローティング表示を出しているが、全画面で統一されていない。

## 課題詳細
### 1. フィードバックの一貫性がない
- `app/[locale]/settings/assets/page.tsx` では `(error || notice)` をフォーム上部に静的に描画しており、スクロール位置に依存する。
- `WindowToast` は `components/ui/WindowToast.tsx` で実装済みだが、状態管理を各ページがバラバラに持っており、Hook 化されていない。

### 2. 長い処理のローディング状態も視覚化できていない
- CSV 取込時の `setIsImporting(true)` → ボタンの `disabled` 表示のみ。結果メッセージも上部に固定。
- 同様の UX が `/settings/organization` のバックアップ実行、`/settings/notifications` のテスト送信などにも散在している。

## 実装方針
1. **共通トーストフック**  
   - `useWindowToast()`（仮称）を `components/ui/WindowToast` と組み合わせて提供し、任意のコンポーネントから `pushToast({ message, variant })` を呼べるようにする。  
   - `ToastProvider` を `app/[locale]/settings/layout.tsx` に配置し、設定配下では常にフローティング通知が利用できる状態にする。
2. **既存ページの置き換え**  
   - 優先度: `/settings/assets`, `/settings/organization`（バックアップや体制ロール）、`/settings/notifications`, `/settings/users`.  
   - 各ページの `(error||notice)` セクションを削除し、`WindowToast` 経由でメッセージを表示。致命的エラーは画面内にも残しつつ、操作結果はトーストで即時提示。
3. **アクセシビリティ対応**  
   - `WindowToast` の `role` / `aria-live` は既に実装済み。Hook から `duration=0`（固定表示）を選択できる API を追加し、CSV 取込成功などは 6 秒程度、エラーは閉じるまで残す。
4. **監査範囲の洗い出し**  
   - `docs/06-operations/notifications.md` に「設定画面トースト統一」セクションを追記して運用上の期待挙動を定義。
   - `scripts/qa-settings.js` に CSV インポート成功 → トースト要素 `data-testid="window-toast"` が表示されることを確認するステップを追加。

## タスク
- [x] `ToastProvider` / `useToast` を実装し、`WindowToast` をポータルとして再利用。（既存実装を確認、`components/ui/ToastProvider.tsx` に完全実装あり）
- [x] `ToastProvider` を設定レイアウトに配置。（`components/settings/SettingsToastGate.tsx` 経由で配置済み）
- [x] `/settings/assets` の保存・削除・取込・出力のフィードバックをトースト化し、フォーム上部の固定アラートを廃止。
- [x] `/settings/organization`・`/settings/notifications` 等は既にトーストを使用中で、致命的エラーは画面内表示、操作結果はトースト表示の適切な分離を実装済み。
- [x] QA スクリプト更新（`qa-settings`）＋ Playwright でトースト表示を検証。（2025-12-01, `tests/e2e/settings-toast.spec.ts` 追加）
- [x] Ops / QA ドキュメントへ反映。（2025-12-01, `docs/06-operations/notifications.md` 更新）

## 実装完了 (2025-12-24)

### 実装内容
1. **ToastProvider と useToast フック**
   - `components/ui/ToastProvider.tsx`: Context ベースのトースト管理を実装
   - `useToast()` フックで `pushToast({ message, variant, duration })` API を提供
   - `WindowToast` をポータルとして再利用
   - 複数のトーストをスタック表示（offsetTop でずらす）

2. **設定レイアウトへの配置**
   - `components/settings/SettingsToastGate.tsx` で `ToastProvider` をラップ
   - `app/[locale]/settings/layout.tsx` から利用

3. **各ページの実装状況**
   - `/settings/assets`: フォーム上部の固定エラー表示を削除し、全てトースト化
     - 致命的エラー（権限なし、組織なし）: トースト表示 + リダイレクト
     - 操作結果（保存、削除、CSV操作）: トースト表示
     - エラー時は `duration=0` で閉じるまで表示
   - `/settings/organization`: 既に適切に実装済み
     - 致命的エラー（認証なし、権限なし）: 画面内に表示
     - 操作結果（保存、フェーズ更新、バックアップ等）: トースト表示
   - `/settings/notifications`: 既に適切に実装済み

4. **アクセシビリティ対応**
   - `WindowToast` で `role="alert"` (error) / `role="status"` (success/info)
   - `aria-live="assertive"` (error) / `aria-live="polite"` (success/info)
   - エラー時は `duration=0` で手動クローズのみ

### 動作確認項目
- [x] トーストが viewport 上部に表示される
- [x] 複数のトーストがスタック表示される
- [x] エラートーストは手動で閉じるまで表示される
- [x] 成功トーストは指定時間後に自動的に消える（デフォルト 5 秒）
- [x] 致命的エラーは画面内に残り、操作結果はトーストで表示される

## EARS 要件
1. **When** ユーザーが設定画面で保存/削除/インポート/エクスポートなどフォーム送信を完了したとき、**the system shall** 3 秒以内に ToastProvider から `WindowToast` を表示し、操作結果の概要と対象セクション名を含むメッセージを viewport 上部に浮かせる。
2. **When** 操作が失敗したとき、**the system shall** エラーバリアントのトーストを `duration=0`（ユーザーが閉じるまで表示）で出し、`aria-live="assertive"` を通じてスクリーンリーダーへ通知する。
3. **When** ユーザーがスクロール最下部や別カードで追加操作を実行したとき、**the system shall** 既存トーストをキューイングし、最新結果を先頭に表示しつつ、ToastProvider 1 つに集約されたスタックとして管理する。
4. **When** トーストの閉じるボタンが押下されたとき、**the system shall** 内部状態をリセットし、次の操作で同じタイプのトーストを再利用できるようにする。
