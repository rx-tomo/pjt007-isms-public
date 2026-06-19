# 承認ワークフロー再設計（全体整合）

## 目的
承認対象が文書以外にも拡張される前提で、承認フロー・承認者・通知・履歴を統一する。

## 前提整理（ロール/責任）
- **org_admin**: ISMS運営の実務責任者（複数登録可）
- **system_operator**: システム設定担当（情シス想定）
- **CISO**: org_admin の中から唯一の存在として設定可能（ユーザープロフィールのフラグで指定）
- **情報セキュリティ責任者**: 監査/報告の承認先として扱う（プロフィールのフラグで指定、CISOと同一でも良い）
- **被監査部門管理者**: 監査指摘の承認・フォローアップ受領者

## 承認対象の整理

### 1. 文書承認
- 作成/改訂完了 → 承認依頼 → 最終承認（情報セキュリティ責任者）
- 現行: 2段階承認（step1/step2）
- 差戻しは coming-soon（要件継続）

### 2. 監査計画
- 監査員が計画を作成 → 情報セキュリティ責任者へ承認通知
- 承認後に監査計画が確定

### 3. 監査報告書
- 監査終了後、報告書作成 → **情報セキュリティ責任者が承認**
- 監査報告の通知先として**セキュリティ管理者へCC**（同一人物でも可）
 - 事前確認: セキュリティ管理者・組織管理者（事務局）は確認できるが**承認者は責任者のみ**

### 4. 不適合（監査終了前）
- 不適合発見時、被監査部門管理者へ承認依頼
- 承認完了で監査終了扱い

### 5. フォローアップ記録
- 被監査部門が進捗入力 → **部門責任者（被監査部門管理者）**が承認
- 承認完了で監査担当者/組織管理者へ通知

### 6. 事故報告（インシデント）
- 一般ユーザが事故報告を登録 → **部門責任者が承認**
- 承認完了で org_admin へ通知（再発防止の全体把握）

## 設計方針
- 承認フローを「共通ワークフロー」として統一管理
- 承認者はユーザープロフィールのフラグで指定（CISO/情報セキュリティ責任者/セキュリティ管理者）
- 承認履歴/差戻し履歴は監査証跡として保存
- 承認・署名・通知は**オンライン完結**（紙/口頭は記録に残さない）

## 影響範囲（想定）
- 文書承認に加え、監査計画/監査報告/不適合/フォローアップに承認ワークフローを追加
- 通知種別の追加と承認履歴テーブルの拡張が必要

## 残課題
- CISO の一意性制御（org_adminの中で唯一）
- 案件別エスカレーション先の運用データ定義（承認対象ごと）

## 決定事項
- 承認者ロールは「ユーザープロフィールのフラグ」で指定する

## 詳細設計（実装計画へ紐付け）

### 共通承認モデル
- **approval_requests**
  - id, organization_id, resource_type, resource_id
  - status (pending/approved/rejected)
  - requested_by, requested_at
  - approver_id, approved_at, rejection_reason
  - due_at, notified_at
- **approval_events**
  - id, approval_request_id, event_type (requested/approved/rejected/expired)
  - actor_id, created_at, payload(json)

### 承認対象ごとの resource_type
- `document`
- `audit_plan`
- `audit_report`
- `nonconformity_closure`
- `followup_record`
- `incident`

### 承認ルール（誰が承認するか）
- **文書**: 情報セキュリティ責任者（プロフィールフラグ指定）
- **監査計画**: 情報セキュリティ責任者（プロフィールフラグ指定）
- **監査報告書**: 情報セキュリティ責任者（プロフィールフラグ指定、CISO同一可）
- **不適合終了**: 被監査部門管理者（部門責任者）
- **フォローアップ記録**: 部門責任者（被監査部門管理者）
- **事故報告**: 部門責任者（被監査部門管理者）

### 通知設計
- `approval_requests` 作成時に通知（type: `approval_request`）
- 承認/却下時に申請者へ通知
- 承認完了時に「監査担当者 + org_admin」へ通知（フォローアップのケース）
- 事故報告は承認完了時に org_admin へ通知（全体監督のため）

### 画面/UI
- **承認キュー**: `/:locale/approvals`
  - 承認待ち一覧、承認/却下アクション
- **対象画面へのリンク**: document/audit/nonconformity/detail へ遷移
- **承認履歴**: 承認イベント履歴を各対象詳細に表示

### 権限
- 承認者のみ承認操作が可能
- org_admin は承認フローの監視（一覧閲覧）可能

### 実装タスク（概要）
1. DB: `approval_requests`, `approval_events` の追加
2. API: 作成/承認/却下/一覧取得
3. UI: 承認キュー + 各対象画面へのバッジ/履歴表示
4. 通知: 承認通知の追加
5. テスト: 承認遷移/権限/通知

## SLA/期限設計（確定）

### 期限の付与ルール
- `approval_requests.due_at` を作成時に自動設定
- 期限は **カレンダー日** で計算（確定）
- 申請時に上書きできる（重要案件のみ短縮）

### 標準期限
| 承認対象 | 期限 | 理由 |
| --- | --- | --- |
| 文書承認 | 3日 | 通常運用の承認サイクルを想定 |
| 監査計画 | 5日 | 日程調整/承認余裕 |
| 監査報告書 | 5日 | 報告書レビュー時間 |
| 不適合終了 | 7日 | 被監査部門の確認余裕 |
| フォローアップ記録 | 7日 | 継続的改善の確認余裕 |
| 事故報告 | 3日 | 迅速対応を優先 |

### リマインド/エスカレーション
- T-2日: 承認者へリマインド通知
- 期限超過: 承認者 + **案件別のエスカレーション先**へ通知
- 重大案件（事故報告など）は T-1日 も通知

### 案件別エスカレーション先データモデル（実装用）
- `approval_escalation_rules`
  - id, organization_id, resource_type
  - escalation_target_type (`user` / `role_flag` / `department_manager`)
  - escalation_user_id（`user` 指定時）
  - escalation_role_flag（`role_flag` 指定時。例: `is_org_admin`, `is_security_manager`, `is_ciso`）
  - cc_role_flags jsonb（通知CC先のプロフィールフラグ配列）
  - is_active, created_at, updated_at
- 制約:
  - `organization_id + resource_type` は一意
  - `escalation_target_type='user'` のとき `escalation_user_id` 必須
  - `escalation_target_type='role_flag'` のとき `escalation_role_flag` 必須
- 解決ルール:
  - 期限超過時に `resource_type` 単位でルールを取得
  - ルール未設定時は `org_admin`（プロフィールフラグ）へフォールバック
  - `department_manager` 指定時は対象案件の部門責任者を解決して通知

## 決定事項（追記）
- 標準期限は上表を採用（カレンダー日）
