# 一般ユーザー（user）ギャップ整理・方針

## 方針確定
- 一般ユーザは **割当タスクの実施/記録が主**。タスク自体の編集は不可
- 文書は **担当組織のみ編集可**、承認済み（固定）後は **全組織で閲覧可能**

## ギャップ/整合ポイント
- マニュアル上は「タスク作成・編集」が可能と記載されているため、権限方針に合わせて修正が必要
- 文書の閲覧範囲（承認後の全体公開）に関する記載追加が必要

## 追加開発対象（関連）
- ISMS事故報告（インシデント）機能
- 体制管理UI（役割一括割当/スナップショット）

## ドキュメント更新候補
- `docs/08-user-manual/01-user-approver/01-role-overview.md`
- `docs/08-user-manual/01-user-approver/03-tasks.md`
- `docs/08-user-manual/01-user-approver/02-documents.md`


## 実装反映（2026-02-05）
- 事故報告のMVPとして `/:locale/incidents` / `/:locale/incidents/new` / `/:locale/incidents/[id]` を追加
- Supabase マイグレーションで `incidents` / `incident_updates` / `incident_links` テーブルと RLS を追加
- サイドバー/ナビゲーションに「インシデント」を追加
- i18n 文言（ja/en）に incidents 名前空間を追加

### 実装済み（2026-02-06 確認）
- 承認WF連携（approval_requests / incident resource_type）
- インシデントリンク（incident_links テーブル + CRUD + UI）

### 未実装（次フェーズ）
- 部門責任者スコープ厳格化と org_admin 通知
- リンク更新通知（インシデントリンク変更時の通知は coming-soon）
