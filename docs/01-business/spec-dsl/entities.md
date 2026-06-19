---
title: Entities
category: business
last_updated: 2026-06-08
status: partially_confirmed
---

# Entities

このファイルは業務エンティティと現行実装の対応をまとめる。詳細スキーマは `data_schema.json` と `lib/db/drizzle/schema/**` を参照する。

| Entity Group | Business Purpose | Implementation Surface | Auth / Audit Notes | Status |
| --- | --- | --- | --- | --- |
| Organization / Tenant | 顧客テナント、契約、初期設定の単位 | organizations, user_profiles, organization_settings | org_id境界、super_admin/system_operator操作ログが重要 | partial |
| User / Membership / Invitation | 初期管理者、利用者、承認者、監査員の管理 | user_profiles, user_memberships, organization_invitations, user_permission_sets | `qa:initial-user-lifecycle` で招待、受諾、membership、role変更、permission保存、監査ログまで代表確認済み。無効化/削除は未確認 | mostly_ready |
| Department Scope / Member Access | 部門単位の閲覧・操作範囲を制御する | organization_departments, user_memberships.department_scope, user_department_scopes, DepartmentScopeService, department-scopes API | documents/risks/settings usersで部門スコープをUI/APIに反映。system_operator/org_admin等の全体アクセスとuser/approverの制限を区別する。runtime業務QAは未完 | partial |
| Documents / Versions / Templates | ISMS文書、版、テンプレート、承認対象 | documents, document_versions, document_templates, document approval API | `qa:initial-w02-document-approval` で下書き作成、承認依頼、承認済み化、DB、監査ログを代表確認済み。改訂、版管理、提出束export履歴は未確認 | mostly_ready |
| Approval Requests / Events | 汎用承認、差戻し、期限超過 | approval_requests, approval_events, escalation rules, approvals API | 文書承認、監査計画承認/却下/却下後修正再申請、監査報告書承認/却下/却下後修正再申請、残留リスク受容承認/却下は代表QA済み。監査計画/報告書/残留リスク受容では `approval_events` と `audit_logs` まで確認済み。期限超過、多段承認は未確認 | partial |
| Risks / Treatments / Criteria | リスク評価、対応、残留リスク受容 | risks, risk_treatments, risk_criteria, risk_assessment_history | `qa:initial-w02-risk-update` と `qa:initial-w02-control-link-update` で評価更新、評価履歴、対応策-管理策リンク編集を代表確認済み。`qa:surveillance-residual-risk-acceptance` で受容理由、CISO責任者、期限、再レビュー日、完了状態、承認申請、CISO承認/却下、却下後修正/再申請、監査ログを代表確認済み。多段承認、経営層承認は未確認 | partial |
| Controls / Evidence | 管理策、SoA、証跡 | iso_controls, soa_versions, risk_control_links, approval_requests, approval_events, audit_evidence, riskOperationalReadiness | 管理策リンク編集と証跡不足表示は代表確認済み。2026-06-06に管理策ページ/APIでSoA準備状況、管理策単位の適用/除外理由保存、承認申請、CISO承認、却下理由表示、修正後再申請、SoA v1固定、承認イベント、監査ログまで代表確認済み。2026-06-08に初回/継続運用の提出束マニフェスト/ZIP/PDF/UIへSoA・監査証跡を接続できることも代表確認済み。管理策別所有者、改訂差分表示、提出束内gapのready化は未確認 | mostly_ready |
| ISMS Phase / Practical Verification Seed | 初回登録準備と継続運用の2ストーリーを分ける | organizations.isms_phase, organization_phase_history, scripts/seed-practical-verification.mjs | phase selector、組織設定変更、履歴、2固定テナントseedをQA済み。実務検証のcurrent truthとして扱う | mostly_ready |
| Audit / Nonconformity / CAPA | 内部監査、指摘、是正、フォローアップ | audit_plans, audit_reports, nonconformities, corrective_actions, follow_up_records, approval_requests, approval_events | 内部監査入口、監査計画の新規作成/承認/却下/却下後修正再申請、監査チーム登録、不適合/是正更新、是正完了承認の申請/却下/再申請/CISO承認、フォローアップ完了/検証済み、監査報告書承認/却下/却下後修正再申請は代表確認済み。2026-06-08に継続運用側の提出束で年次監査計画、監査報告書、不適合/是正、フォローアップ、監査証跡のready/gap表示も代表確認済み。監査実施開始との連動、多段承認、提出束内gapのさらなる説明品質が次Gap | partial |
| Tasks / Notifications | 日常運用、期限、改善アクション | tasks, task_comments, task_history, notifications, email_logs, task_reminders | 初期タスク進捗更新、新規タスク作成、サブタスク作成/完了、コメント投稿、Home統計、期限超過表示、期限リマインダー、担当者通知一覧は代表確認済み。再送、エスカレーション、タグ/添付、担当者変更履歴は未確認 | mostly_ready |
| Billing / Subscription | 契約/プラン、支払い、ロック/再開 | billing schema, stripe service, stripe API routes | 契約終了/保持/削除と連動するため判断待ち | owner_decision_needed |
| Export / Retention / Soft Delete | 審査提出、ポータビリティ、契約終了 | export routes, examination submission bundle API, tenantSoftDelete, retention fields | 初回登録準備と継続運用の提出束マニフェスト/ZIP/PDF/UIは代表QA済み。契約終了時のデータ操作ログ、保持期限、復旧責任境界は判断待ち | partial |
| AI Suggestions / Usage | AI支援、人手確認、利用ログ | aiSuggestions, aiUsageLogs, app/api/ai/** | 入力フィルタ、採否、責任境界、キャッシュ方針が必要 | partial |
| BCP / Supplier / Education | 復旧、供給者、力量管理 | bcp, suppliers, education pages/APIs | MVP範囲と後続化範囲の判断が必要 | partial |
