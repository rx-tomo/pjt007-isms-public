# ロール管理ガイド（開発用）

更新日: 2025-11-20  
対象: super_admin / system_operator / org_admin のロール管理とガード仕様

## 権限テーブル（概要）

- **super_admin**
  - super_admin と system_operator を作成・ロール変更・無効化できる（テナントをまたいで操作可能）。
    - API: `POST /api/super-admin/users` で super_admin / system_operator を直接作成（system_operator の場合は organizationId 必須）。
    - UI: `/[locale]/super-admin/users` でメール・ロール・テナントを指定して発行。
  - テナント内のその他のユーザー（org_admin / user など）のロール変更や無効化は不可（閲覧のみ）。
  - super_admin は常に 1 名以上維持される。最後の super_admin のロール変更・無効化は拒否。
  - 招待状況を全テナント横断で閲覧・管理できる。

- **system_operator**（テナント管理者）
  - 自テナントの system_operator を招待・ロール変更・無効化できるが、最後の 1 名を外す／無効化することはできない。
  - 自テナントの org_admin やその他ユーザーを作成・ロール変更・無効化できる。
  - テナント内の招待状況を閲覧・管理できる。

- **org_admin**
  - 自テナントの org_admin / user / auditor / approver を作成・ロール変更・無効化できる。
  - system_operator / super_admin のロール変更・無効化は不可。

## 実装ポイント

1. **サーバーサイド ガード**
   - `app/api/organizations/[organizationId]/members/role`  
     - PATCH: ロール変更。最後の system_operator／super_admin を外す操作を 409 で拒否。
     - org_admin は system_operator/super_admin を操作不可。super_admin は system_operator/super_admin 以外を操作不可。
   - `app/api/organizations/[organizationId]/members/status`  
     - PATCH: 有効/無効切替。最後の system_operator／super_admin を無効化する操作を拒否。自分自身の無効化も拒否。

2. **フロントエンド**
   - ユーザー管理画面（`app/[locale]/settings/users/page.tsx`）でロール変更・有効/無効切替を新 API 経由に統一。
   - 最後の system_operator にはロール変更／無効化ボタンを無効化し、トーストで理由を表示。

3. **翻訳**
   - 新しいガードメッセージ `permissions.rolesSection.systemOperatorLastGuard` を追加。

## 想定される動作シナリオ

- system_operator が自分以外の system_operator を org_admin に降格する場合: 他に system_operator がいれば成功、最後の 1 人なら 409 エラー。
- super_admin がテナントの org_admin を user に降格しようとした場合: 403 エラー（super_admin は system_operator と super_admin 以外を操作不可）。
- org_admin が system_operator を無効化しようとした場合: 403 エラー。
- super_admin が唯一の super_admin アカウントを無効化しようとした場合: 409 エラー。

## 今後のタスク候補

- super_admin 用のユーザー作成 UI（super_admin / system_operator 追加用）を専用ページに整理する。
- RLS 側ポリシーの再確認と、自動テスト（Playwright もしくは API テスト）の追加。
