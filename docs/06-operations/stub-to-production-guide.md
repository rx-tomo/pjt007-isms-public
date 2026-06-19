# 外部接続スタブ → 本接続 切替ガイド

実務検証版は **実キーなしのスタブ動作** を前提とする（DoD条件: 外部接続はスタブで全フロー通過）。
本ドキュメントは各外部接続のスタブ動作条件と、商用公開前の本接続切替手順を記録する。

最終更新: 2026-06-12（WS3 スタブ検証）

## 一覧

| 接続 | スタブ条件 | スタブ時の動作 | 本接続切替 |
|------|-----------|--------------|-----------|
| Stripe 決済 | `STRIPE_TEST_MODE=mock`、または非本番でシークレット未設定 | `/mock/checkout` `/mock/portal` でフロー完結（購読作成・プラン変更・解約予約をDBへ反映） | 下記 Stripe 手順 |
| メール送信 | `RESEND_API_KEY` 未設定 | 送信ペイロードをサーバーログへ出力。招待は `/api/dev/invitations/latest`（非本番のみ）でトークン確認可。通知メールは `email_logs` テーブルに記録 | Resend キー設定 |
| 添付ファイル | 常時（LocalFSStorageProvider 固定） | `.storage/<bucket>/` に保存、`/api/storage/*` で配信（非本番は既定許可、本番は `STORAGE_MODE=local` 明示時のみ） | 外部ストレージProvider実装後に切替 |
| AI 分析 | `AI_PROVIDER_MODE=mock`、または `claude` 指定でキー未設定/プレースホルダ | MockProvider がパーサ契約準拠のJSONを返す（リスク識別/評価/対策提案） | 下記 AI 手順 |

## Stripe 本接続切替

1. `.env.local`（本番は Vercel 環境変数）に設定:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`（検証は `pk_test_...`）
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_TEST_MODE` を削除（`mock` のままだとmock動作が優先される）
2. 料金プランの Stripe Price ID を設定: `pricing_plans.stripe_price_id` または環境変数
   （`STRIPE_<PLAN>_PRICE_ID`、`lib/stripe/config.ts` の `PRICE_ENV_MAP` 参照）
3. Stripe ダッシュボードで Webhook エンドポイント `/api/stripe/webhook` を登録
4. 確認: `/api/stripe/config-status` が `{"mockMode":false}` を返すこと、
   料金ページ・購読設定ページの「テストモード」バナーが消えること

## メール（Resend）本接続切替

1. `RESEND_API_KEY` を設定、`INVITE_EMAIL_FROM` を送信ドメインに合わせる
2. 送信ドメインのSPF/DKIM検証を Resend 側で完了させる
3. 確認: 招待作成時に実メールが届くこと（`email_logs.status` が `sent` になること）

## AI（Anthropic Claude）本接続切替

1. `AI_PROVIDER_MODE=claude` と `ANTHROPIC_API_KEY` を設定
   （キーがプレースホルダのままだと自動的に mock へフォールバックする）
2. 確認: `/api/ai/risks/analyze` の応答が MockProvider の定型文でないこと

## 添付ファイルストレージ

現状 `LocalFSStorageProvider` のみ実装（`lib/storage/`）。本番で外部ストレージ
（S3/R2等）へ移行する場合は `StorageProvider` インターフェースの実装を追加し、
`getStorageProvider()` を `STORAGE_MODE` で分岐させる。移行までは本番でも
`STORAGE_MODE=local` を明示設定することで `/api/storage/*` の配信を許可する
（Vercel はエフェメラルFSのため永続添付には外部ストレージが必須。商用前に要対応）。

## 関連

- `.env.example` — スタブ動作の最小設定テンプレート
- docs/10-improvement-plan/gap-register.md — GAP-021/022/024/025（WS3で発見・解消したスタブ系ギャップ）
