# ISMS事故報告（インシデント）機能 設計案

## 目的
一般ユーザーが事故（インシデント）を記録し、タスク/リスク/資産と紐付けて再発防止に活用する。

## 想定フロー（ISMS運用セオリー）
1. **初動記録**: 発生事象を登録（時刻/影響/関係者/初動対応）
2. **承認（オンライン）**: 部門責任者が承認（承認WFで完結）
3. **段階的更新**: 「第一報/第二報/最終報告」を段階で追記
4. **根本原因分析**: 関連タスク/リスク/資産と紐付け
5. **是正・予防**: 改善タスクの登録とフォロー
6. **学習/再発防止**: 事故履歴から類似インシデントを検索・分析

## 画面設計
- **インシデント一覧** (`/:locale/incidents`)
  - ステータス、重大度、部門、発生日でフィルタ
  - 既知の関連タスク/リスク/資産へのリンク
- **インシデント登録** (`/:locale/incidents/new`)
  - 発生日時、概要、影響、初動対応、担当者
  - 関連タスク/リスク/資産の選択
- **インシデント詳細** (`/:locale/incidents/[id]`)
  - タイムライン（第一報/第二報/最終報告）
  - 是正タスク/関連リスクのリンク

## データ設計（案）
### `incidents`
- id, organization_id, title, description
- occurred_at, detected_at
- severity, status
- department_id, reporter_id

### `incident_updates`
- id, incident_id, update_type (first/second/final)
- content, created_by, created_at

### `incident_links`
- id, incident_id, link_type (task/risk/asset)
- link_id

## 詳細設計（実装計画へ紐付け）

### ステータス
- `draft`（初期登録）
- `in_progress`（調査/対応中）
- `resolved`（対策完了）
- `closed`（最終報告完了）

### 画面追加
- `/:locale/incidents`（一覧/フィルタ）
- `/:locale/incidents/new`（新規登録）
- `/:locale/incidents/[id]`（詳細/更新）

### 権限
- user: 登録・更新（自部門/自分が関係する範囲）
- org_admin: 全件管理
- auditor: 閲覧のみ

### 通知
- 登録時: 部門責任者へ承認通知（approval_requests / resource_type = `incident`）
- 承認完了時: org_admin へ通知（全体監督のため）
- ステータス更新時: 関係者（担当/管理者）へ通知

### 実装タスク（概要）
1. DB: incidents / incident_updates / incident_links
2. API: CRUD / リンク更新 / フィルタ取得
3. UI: 一覧/登録/詳細/タイムライン
4. 通知: 登録・更新通知
5. テスト: 登録/更新/リンク/権限制御

## 権限
- **一般ユーザ**: 登録・更新（自分/所属部門）
- **org_admin**: 全件閲覧・管理
- **auditor**: 閲覧のみ（証跡）

## テスト計画（TDD）
- 事故登録/更新/リンクのユニット
- 部門スコープ制御の統合
- E2E: 登録→更新→リンク→一覧反映

## マニュアル更新対象
- `docs/08-user-manual/01-user-approver` に「事故報告」章を追加
