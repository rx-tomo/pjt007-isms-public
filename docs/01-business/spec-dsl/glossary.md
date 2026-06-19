---
title: 業務仕様用語集
category: business
last_updated: 2026-06-06
status: draft
---

# 業務仕様用語集

| 用語 | 意味 | 確認状況 |
| --- | --- | --- |
| organization | テナント/契約組織。多くの業務データは `organization_id` で分離される。 | confirmed |
| user_profile | システム利用者のプロファイル。ロール、部門、言語、役割フラグを持つ。 | confirmed |
| user_membership | ユーザーと組織の所属関係。ロールとステータスを持つ。 | confirmed |
| login role | `super_admin`, `system_operator`, `org_admin`, `user`, `auditor`, `approver` など、画面/APIアクセスを制御するシステム上のロール。 | confirmed |
| role flag | `is_ciso`, `is_security_manager`, `is_org_admin`, `is_audit_committee`, `is_isms_promoter` などの業務上の役割フラグ。 | confirmed |
| body role | CISO、情報セキュリティ責任者、ISMS管理責任者、リスクオーナー、部門責任者など、ISMS体制上の責任を表す業務ロール。ログインロールとは別に整理する。 | draft |
| approver | 承認行為を担当するログインロール。文書、監査報告書、是正完了、残留リスク受容、経営判断など、承認対象ごとに実務上の責任者が異なる可能性がある。 | draft |
| auditor | 内部監査に関するログインロール。監査計画、チェックリスト、証跡、不適合、是正、フォローアップ、監査報告書を扱う。 | confirmed |
| document | ISMS文書。状態は現行DB上 `draft`, `in_review`, `approved`, `obsolete`。 | confirmed |
| approval_request | 文書、監査計画、監査報告書、インシデント、SoA管理策判断等に使う汎用承認依頼。 | confirmed |
| approval_event | 承認依頼の履歴イベント。`requested`, `approved`, `rejected`, `expired`, `reminded`, `escalated`, `reverted`。 | confirmed |
| information_asset | 情報資産。資産種別、分類、重要度、所有者、状態を持つ。 | confirmed |
| risk | ISMS上のリスク。影響度、発生可能性、リスクスコア、状態を持つ。 | confirmed |
| risk_treatment | リスク対応。対応種別は `avoid`, `reduce`, `transfer`, `accept`。 | confirmed |
| iso_control | ISO 27001管理策。リスクやテンプレートと関連付ける。SoA判断として `not_reviewed`, `applicable`, `not_applicable` と理由、承認状態を持つ。 | confirmed |
| iso_control_soa | 管理策単位のSoA適用/除外判断。承認依頼では `approval_requests.resource_type=iso_control_soa` として扱う。 | confirmed |
| soa_version | SoA全体版。`soa_versions` に版番号、改訂理由、スナップショットJSON、管理策数、承認済み管理策数、発行者、発行日時、版レビュー状態を保持する。 | confirmed |
| audit_plan | 内部/外部/認証/サーベイランス監査の計画。状態は `planning`, `scheduled`, `in_progress`, `completed`, `cancelled`。 | confirmed |
| audit_report | 監査報告書。承認状態は `draft`, `submitted`, `approved`, `rejected`。 | confirmed |
| nonconformity | 監査で検出された不適合。`major`/`minor`種別を持つ。 | confirmed |
| corrective_action | 不適合に対する是正処置。 | confirmed |
| follow_up_record | 是正処置等のフォローアップ記録。 | confirmed |
| incident | セキュリティインシデント。承認後に `draft` から `in_progress` へ進む。 | partially_confirmed |
| management_review | マネジメントレビュー。議題、参加者、議事録、結論、アクションを持つ。 | confirmed |
| BCP | 事業継続計画。計画、シナリオ、訓練、RTO/RPOを管理する。 | confirmed |
| AI risk analysis | リスク識別、評価、対応案作成をAI補助する処理。 | confirmed |
