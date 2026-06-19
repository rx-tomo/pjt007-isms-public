# 開発進捗レポート - 2025年10月11日

## 概要
通知ドメインのウォーキングスケルトンを完成させ、アプリ内の通知ベル・通知一覧・通知設定が一貫したサービス層の上で動作するようになりました。ユーザーは重要なイベントをアプリ内で確認し、受信方法を自分で制御できます。

## 完了タスク

### 1. アプリ内通知 UI の実装
- `components/layout/NotificationBell.tsx` を実装し、最新 10 件の通知プレビューと既読・全既読操作を提供。30 秒間隔で未読件数を同期。【F:components/layout/NotificationBell.tsx†L12-L200】
- `app/[locale]/notifications/page.tsx` に通知センターを追加。未読／既読／アーカイブの切替、全件既読、個別アーカイブ、詳細導線を備えた一覧を提供。【F:app/[locale]/notifications/page.tsx†L13-L200】

### 2. 通知設定 UX の整備
- `app/[locale]/settings/notifications/page.tsx` に通知設定ページを実装。アプリ通知・メール通知の切替、種別別トグル、リマインダー日数を編集可能にした。【F:app/[locale]/settings/notifications/page.tsx†L10-L200】

### 3. 通知サービス層の拡張
- `lib/services/notification.ts` に通知取得、未読件数取得、既読化、アーカイブ、通知設定 CRUD、各種通知生成ヘルパーを実装し、UI から共通利用できるよう整理。【F:lib/services/notification.ts†L1-L240】

### 4. エッジ関数とドメインイベント連携の整備（2025-11-04）
- Supabase Edge Function `notifications-email` を実装し、通知メールの送信キュー処理と `email_logs` 更新を一元化。【F:supabase/functions/notifications-email/index.ts†L1-L360】
- `app/api/notifications/deliver` をエッジ関数呼び出しベースに再設計し、Edge Function 停止時は従来の `EmailService` へフォールバックするユーティリティを追加。【F:app/api/notifications/deliver/route.ts†L1-L60】【F:lib/server/notificationDelivery.ts†L1-L154】
- `app/api/tasks/reminders` を追加し、期限接近タスクに対する通知生成・メール配信・`task_reminders`/`audit_logs` 記録を自動化。`qa:notifications` からも呼び出して検証可能。【F:app/api/tasks/reminders/route.ts†L1-L220】
- 監査計画の開始日変更／`scheduled` 化に合わせてチームメンバーへスケジュール通知を送付するロジックを `AuditService.updateAuditPlan` に追加。【F:lib/services/audit.ts†L450-L540】

## 影響
- 通知ドメインの主要ユースケース（閲覧・既読処理・設定変更）が UI から実行可能となり、MVP チェックリストの通知項目を「UI 実装済み・メール送信待ち」の状態まで引き上げました。
- 通知ベルがナビゲーションに常駐し、ダッシュボードから通知センターや設定への導線が強化されました。

## 未完了・フォローアップ
- 通知センターのテーブルデザイン最適化とアクセシビリティ検証（キーボード操作、スクリーンリーダーラベル）。
