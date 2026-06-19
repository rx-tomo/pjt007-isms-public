# 組織管理者（org_admin）ギャップ整理・残課題

## 方針
- **実装する**: 具体的に実装タスクとして計画に反映
- **後回し**: coming-soon/運用設計待ちとして残課題に記録
- **整合性整理**: 実装とマニュアルのズレはドキュメント/権限設計で整合させる

## 実装に反映する項目

### 招待の再送信 ✅ 実装済み
- **内容**: 招待中ユーザーに対する「再送信」機能
- **状態**: API + UI（`settings/users` の招待セクション）で実装完了
- **影響範囲**: `settings/users` の招待状況セクションと `/api/invitations` 周辺

### 組織設定の権限範囲（ロール上下関係の整合）
- **内容**: 上位ロール（org_admin/system_operator）が下位権限を包含できるように統一する
- **補足**: 実装に合わせる方針。通常運用では上位ロールが下位権限を兼ねる
- **影響範囲**: 権限チェックの共通化、画面/APIのアクセス制御

### org_admin の機能アクセス拡張
- **内容**: org_admin が以下にアクセスできるようにする
  - ISMSスコープ
  - 体制ロール管理
  - 外部通知チャネル
- **補足**: マニュアルでは system_operator 専用と記載だが、要件として org_admin も操作可にする
- **影響範囲**: `settings/organization` 内のセクション表示/操作権限、関連API

## 後回し・残課題として記録

### AI使用量ダッシュボードの整合
- **内容**: マニュアルは coming-soon だが `/settings/ai/usage` 実装が存在
- **方針**: coming-soon のまま保留（後回し）

### サブスク「データ管理」説明とUIの一致
- **内容**: マニュアルの説明と現行UIが一致するかの検証が未完
- **方針**: 後回しで確認する残課題として記録

### 通知設定の Slack/Teams 整合
- **内容**: 通知設定では coming-soon と記載、外部通知チャネルは実装済み
- **方針**: 外部連携と運用設計の確認後に整合性を調整（残課題）

## 変更が必要なドキュメント候補
- `docs/08-user-manual/03-org-admin/03-user-management.md`（招待再送信記載の整合）
- `docs/08-user-manual/03-org-admin/02-organization-setup.md`（org_admin の操作範囲見直し）
- `docs/08-user-manual/03-org-admin/09-notification-settings.md`（Slack/Teams整合）
- `docs/08-user-manual/03-org-admin/08-ai-settings.md`（AI使用量ダッシュボードの扱い）
- `docs/08-user-manual/03-org-admin/05-subscription-billing.md`（データ管理の一致確認）
