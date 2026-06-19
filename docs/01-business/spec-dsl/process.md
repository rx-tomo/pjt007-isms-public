---
title: 業務フロー仕様
category: business
last_updated: 2026-06-05
status: draft
notation: BPMN-like
---

# 業務フロー仕様

## P-001 ISMS運用ライフサイクル

```yaml
id: P-001
name: ISMS運用ライフサイクル
status: representative_confirmed
sources:
  - docs/01-business/isms-process-detailed.md
  - docs/01-business/requirements.md
  - docs/CODEMAPS/backend.md
  - lib/services/*
actors:
  - 経営層
  - org_admin
  - auditor
  - approver
  - user
  - system
flow:
  - step: 組織/テナントを作成する
    actor: system_operator または super_admin
    system_outputs: [organizations, user_profiles]
    human_confirmation: テナント名、初期管理者、プランを確認
  - step: ISMSスコープと組織構造を設定する
    actor: org_admin
    system_outputs: [departments, project_roles, project_assignments, organization_settings]
    human_confirmation: 適用範囲、部門、責任者を確認
  - step: ユーザーを招待しロール/権限を割り当てる
    actor: org_admin
    system_outputs: [organization_invitations, user_memberships, user_permission_sets]
    human_confirmation: 招待先メール、ロール、部門スコープを確認
  - step: 情報資産を登録/インポートする
    actor: org_admin
    system_outputs: [information_assets, information_asset_import_jobs, information_asset_import_rows]
    human_confirmation: CSV取り込み結果、エラー行、上書きモードを確認
  - step: リスクを識別・評価する
    actor: org_admin または auditor
    system_outputs: [risks, risk_assessment_history]
    human_confirmation: 影響度、発生可能性、対応方針を確認
  - step: ISMS文書を作成し承認する
    actor: org_admin, approver
    subprocess: P-002
  - step: 監査計画を作成し承認する
    actor: auditor, approver
    subprocess: P-004
  - step: 監査を実施し、不適合/是正/フォローアップを記録する
    actor: auditor
    system_outputs: [audit_checklists, audit_evidence, nonconformities, corrective_actions, follow_up_records]
    human_confirmation: 指摘内容、是正責任者、期限、有効性確認結果を確認
  - step: 監査報告書を作成し承認する
    actor: auditor, approver
    subprocess: P-005
  - step: マネジメントレビューを実施する
    actor: 経営層, org_admin
    system_outputs: [management_reviews, management_review_items, management_review_actions]
    human_confirmation: 結論、決定事項、アクション担当者を確認
end_condition: 次回改善サイクルに入れる状態
```

## P-002 文書承認フロー

```yaml
id: P-002
name: 文書2段階承認
status: confirmed
sources:
  - lib/services/document.ts
  - lib/services/approval.ts
  - docs/02-project/stories/UC-04-approver-flow.md
actors: [document_creator, step1_approver, step2_approver, system]
preconditions:
  - document exists
  - document.status == draft
  - step1_approver_id is present
  - step2_approver_id is present
  - no pending approval_request exists for same document
flow:
  - step: 承認依頼を開始する
    actor: document_creator
    system_validation:
      - 未認証ならエラー
      - 文書が存在しなければエラー
      - 下書き以外ならエラー
      - 承認者未指定ならエラー
      - 既存pending承認があればエラー
  - step: 承認リクエストを作成する
    actor: system
    system_action:
      - step1_approver_id == step2_approver_id の場合、step1をapprovedとして作成しスキップ扱い
      - step2はpendingとして作成
      - 異なる承認者ならstep1/step2をpendingとして作成
      - document.statusをin_reviewへ変更
      - document.approved_by/approved_atをnullへ戻す
      - document.approval_requestedを監査ログへ記録
  - step: 現在の承認者へ通知する
    actor: system
    system_outputs: [notifications]
  - step: 承認者が承認する
    actor: current_approver
    system_validation:
      - current pending requestのapprover_idとactorが一致する
    system_action:
      - current requestをapprovedへ更新
      - approval_event.approvedを記録
      - 後続pendingがあれば次承認者へ通知
      - 後続pendingがなければdocument.statusをapprovedへ更新
  - step: 承認者が却下する
    actor: current_approver
    system_action:
      - current requestをrejectedへ更新
      - 後続pendingをすべてrejectedへ更新
      - document.statusをdraftへ戻す
      - document.rejectedを監査ログへ記録
human_confirmation_points:
  - 承認者選択
  - 承認/却下コメント
  - 却下後の文書修正
```

## P-003 汎用承認・エスカレーション

```yaml
id: P-003
name: 汎用承認と期限超過エスカレーション
status: confirmed
sources:
  - lib/services/approval.ts
  - app/api/cron/escalate-overdue-approvals/route.ts
resource_types: [document, audit_plan, audit_report, nonconformity_closure, followup_record, incident]
flow:
  - step: approval_requestを作成する
    default_due_at: requested_at + 7 days
    default_status: pending
    event: requested
  - step: 承認する
    transition: pending -> approved
    event: approved
  - step: 却下する
    transition: pending -> rejected
    event: rejected
  - step: 差戻しする
    actor_constraint: UI上はorg_admin/system_operator想定
    preconditions:
      - status in [approved, rejected]
      - reverted_by != approver_id
    transition: approved/rejected -> pending
    event: reverted
  - step: cronで期限超過pendingを検出する
    auth: Authorization: Bearer CRON_SECRET
    duplicate_prevention: escalated eventが既にあればskip
  - step: エスカレーション通知を作成する
    target_resolution:
      service_layer: approval_escalation_rules
      cron_route_fallback: same organizationのactive org_admin/system_operator
    outputs: [notifications, approval_event.escalated]
```

## P-004 監査計画承認

```yaml
id: P-004
name: 監査計画承認
status: confirmed
sources:
  - lib/services/audit.ts
  - lib/db/drizzle/schema/audit.ts
  - app/[locale]/audit/plans/[planId]/page.tsx
  - app/api/audit/route.ts
  - app/api/approvals/route.ts
  - tests/e2e/surveillance-audit-plan-approval.spec.ts
verification:
  - 2026-06-05 `npm run qa:surveillance-audit-plan-approval` pass
  - 2026-06-08 `npm run qa:surveillance-audit-plan-approval` pass for create, reject, revise, resubmit, approve
  - 2026-06-08 `npm run qa:surveillance-audit-plan-approval` pass for approved plan start
preconditions:
  - authenticated audit manager has surveillance tenant access
flow:
  - step: 監査計画を新規作成する
    actor: auditor
    system_action:
      - audit_planをplanningで作成
      - audit_team_memberを登録
      - audit.plan.createdを監査ログへ記録
  - step: 監査計画を承認申請する
    actor: auditor
    system_action:
      - audit approverを解決
      - approval_request(resource_type=audit_plan)を作成
      - audit.plan.approval_requestedを監査ログへ記録
  - step: 承認する
    actor: approver
    system_action:
      - approval_requestをapprovedへ更新
      - audit_plan.statusをscheduledへ更新
      - audit.plan.approvedを監査ログへ記録
  - step: 承認済み監査計画を開始する
    actor: auditor
    system_action:
      - audit_plan.statusをin_progressへ更新
      - audit_plan.actual_start_dateを記録
      - audit.plan.startedを監査ログへ記録
  - step: 却下する
    actor: approver
    system_action:
      - approval_requestをrejectedへ更新
      - audit.plan.rejectedを監査ログへ記録
    note: 監査計画ステータスはサービスコメント上「変更しない」
remaining_gap:
  - 多段承認
  - 提出束内で承認済み証跡としてさらに説明品質を高めること
```

## P-005 監査報告書承認

```yaml
id: P-005
name: 監査報告書承認
status: representative_verified
sources:
  - lib/services/audit.ts
  - app/[locale]/audit/plans/[planId]/report/page.tsx
  - app/[locale]/approvals/page.tsx
gap:
  - service層には承認申請/承認/却下がある
  - 承認キュー画面はaudit_reportを扱う
  - 監査報告書ページからの保存/承認申請は `/api/audit` 経由に整理済み
  - 承認キューの一覧/承認/却下は `/api/approvals` 経由に整理済み
  - 2026-06-05に報告書ページから承認申請し、CISOを承認者として承認キューへ投入し、承認済み化/却下、approval_events/audit_logs/report statusまで確認するruntime QAがpass
  - 2026-06-08に継続運用側提出束のgap項目として接続確認済み
  - 2026-06-08に却下後の修正、draft復帰、再申請、CISO承認までruntime QAがpass
  - 監査実施開始との連動、多段承認、提出束内で承認済み報告書としてさらに説明品質を高めることは未確認
flow:
  - step: 監査報告書を承認申請する
    system_action:
      - report.approval_statusをsubmittedへ更新
      - approval_request(resource_type=audit_report)を作成
      - audit.report.approval_requestedを記録
  - step: 承認する
    system_action:
      - approval_requestをapprovedへ更新
      - report.approval_statusをapprovedへ更新
      - approved_by/approved_atを記録
  - step: 却下する
    system_action:
      - approval_requestをrejectedへ更新
      - report.approval_statusをrejectedへ更新
      - rejection_reasonを記録
  - step: 却下後に修正して再申請する
    system_action:
      - 報告書本文更新時にreport.approval_statusをdraftへ戻す
      - rejection_reasonをクリア
      - audit.report.revisedを記録
      - 新しいapproval_request(resource_type=audit_report)を作成
```

## P-006 残留リスク受容

```yaml
id: P-006
name: 残留リスク受容
status: representative_verified
sources:
  - app/[locale]/risks/[id]/page.tsx
  - app/api/risk-treatments/[id]/route.ts
  - app/api/approvals/route.ts
  - docs/01-business/spec-dsl/approval-responsibility-matrix.md
actors: [risk_owner, information_security_manager, CISO, org_admin, system]
current_fit:
  - リスク詳細に受容件数、証跡あり件数、不足理由の可視化はある
  - management_reviewでは期限付きリスク受容条件を自由記述として残せる
  - 2026-06-05 `qa:surveillance-residual-risk-acceptance` で、リスク詳細から `accept` 対応を作成し、受容理由、CISO責任者、期限、完了状態、監査ログを残せることを確認済み
  - 2026-06-08 `qa:surveillance-residual-risk-acceptance` で、完了済み受容対応の承認申請、CISO承認、別申請の却下、`approval_events`、`risk_treatments.residual_approval_status`、監査ログを確認済み
  - 2026-06-08 `qa:surveillance-residual-risk-acceptance` で、却下後の管理策リンク修正、`draft` 復帰、再申請、`risk.residual_acceptance.revised` 監査ログを確認済み
  - 2026-06-08 `qa:surveillance-residual-risk-acceptance` で、`residual_review_due_date` の保存/表示/準備状況判定/承認申請前必須化と責任者本人承認の証跡を確認済み
gap:
  - 多段承認は未確認
  - 現行の代表承認者解決はCISO優先であり、リスクオーナー、情報セキュリティ責任者、経営層の関与ルールは未整理
target_flow:
  - step: 残留リスク受容を申請する
    actor: risk_owner または org_admin
    required_fields: [risk_id, treatment_id, acceptance_reason, accepted_until, reviewer_or_approver]
  - step: 承認者を解決する
    actor: system
    candidate_rules:
      - risk_owner
      - information_security_manager
      - CISO
      - management_review decision
  - step: 承認または却下する
    actor: approver/body_role_holder
    system_outputs: [approval_requests, approval_events, risk_assessment_history, audit_logs]
  - step: 再レビュー期限を表示する
    actor: system
    system_outputs: [tasks, notifications, home next actions]
```

## P-007 AIリスク分析

```yaml
id: P-007
name: AIリスク分析
status: confirmed
sources:
  - app/api/ai/risks/analyze/route.ts
actors: [org_admin, system_operator, auditor, system]
auth:
  allowed_roles: [org_admin, system_operator, auditor]
flow:
  - step: リクエストを受ける
    endpoint: POST /api/ai/risks/analyze
  - step: typeを検証する
    allowed: [identify, evaluate, suggest_treatments]
  - step: contextを検証する
    rules:
      - identify requires context.assetName and context.assetType
      - evaluate/suggest_treatments requires context.riskName and context.riskCategory
  - step: 組織/ユーザー/ロケール/キャッシュ設定を組み立てる
  - step: AIサービスを呼び分ける
    mapping:
      identify: suggestThreatsAndVulnerabilities
      evaluate: estimateRiskLevels
      suggest_treatments: suggestTreatments
human_confirmation_points:
  - AI提案の採用可否
  - saveSuggestionの指定
```
