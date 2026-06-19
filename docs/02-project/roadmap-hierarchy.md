# 開発フェーズ階層と進行構造（統合メモ）

> このメモは既存ドキュメントの整理用メモです。正式な docs へ転記する前のラフ案として扱ってください。

```
全体ロードマップ（Phase 0〜4、docs/02-project/10_plan-tracking.md）
└─ モジュール別ストリーム（docs/02-project/02_implementation-plan.md）
   └─ UI 実装ステップ（Phase A/B/C、docs/07-design-system/ui-screens-and-flows.md）
```

この3層以外にも、バックエンド/API 寄りの段階区分が暗黙で存在している。

例：Super Admin であれば
- Phase 2: API/Service (`user_has_global_role`, RPC, Edge Function)
- Phase 3: UI (`/super-admin/organizations`, `/super-admin/logs`)
- Phase 4: QA/Runbook
→ docs/02-project/archive/90_2025-11-07_rbac-ui-review.md に記載済み。

以下、全体像をラフにまとめる。

## 1. 全体ロードマップ階層（docs/02-project/10_plan-tracking.md）
- Phase 0: 基盤
- Phase 1: 組織・ユーザー / 文書
- Phase 2: リスク / タスク
- Phase 3: 監査 / ダッシュボード
- Phase 4: MVP 最終調整

## 2. 機能ストリーム（docs/02-project/02_implementation-plan.md）
- 文書管理
- リスク管理
- タスク管理
- 監査
- 通知
- データ・レポート
- 運用支援機能

## 3. UI 実装ステップ（docs/07-design-system/ui-screens-and-flows.md）
- Phase A: 基盤（状態/エラー/ナビ統一）
- Phase B: ビジュアル/共通シェル
- Phase C: テスト & アクセシビリティ

## 4. バックエンド/API 実装ステップ（暗黙 → 明文化へ）
- B-A: データモデル／マイグレーション整備
- B-B: RPC / Edge Function / API 実装
- B-C: QA / Runbook / Seed / Mock 反映

具体例: Super Admin
- B-A: `user_profiles` 制約、`audit_logs.scope`（20251107093000）
- B-B: `create_tenant`, `list_all_tenants`, Edge Function `tenant-admin`
- B-C: `docs/06-operations/super-admin-runbook.md`, `npm run e2e:super-admin`
- UI: Phase A/B/C で DashboardLayout＋専用ナビ → QA

このように、フロントの UI フェーズ (A/B/C) と平行して、バックエンド寄りの B-A/B-B/B-C を併記すると分かりやすい。

## 5. 想定される全体マトリクス（一例）

| モジュール | 全体Phase | 機能ストリーム | UI Phase | BE Phase | 状態 |
|------------|-----------|----------------|---------|----------|------|
| Super Admin | Phase 3 | RBAC拡張 | A: ✅ B: ⚠️ C: ▢ | B-A: ✅ B-B: ✅ B-C: ⚠️ | 左ナビ未実装 / Dev Loginテナント未選択 |
| 通知センター | Phase 3 | 通知 | A: ✅ B: ⚠️ C: ▢ | B-A: ✅ B-B: ✅ B-C: ⚠️ (Slack/Email) | Shell統一未完 |
| Dev Login | Phase 1 | 組織/ユーザー | A: ✅ B: ⚠️ C: ▢ | B-A: ✅ B-B: ⚠️ (テナント選択APIなし) | テナント固定|

※ 具体的なマトリクス化は別途。

```MD
