---
title: Workflows
category: business
last_updated: 2026-06-08
status: partially_confirmed
---

# Workflows

このファイルは、商用公開前の実務検証版で使う業務ジャーニーの正本である。詳細根拠は `docs/02-project/release-readiness/isms-operational-workflow-model.md` と `process.md` を参照する。

## Phase Story Rule

既存実装には、ホームのフェーズ選択ダイアログ、組織設定の `initial` / `surveillance` 選択、フェーズ履歴、フェーズ別KPI表示がある。この分岐を、今後の実務検証における2つの利用ストーリーとして扱う。

| Phase | Story | Primary Workflows | Verification Focus |
| --- | --- | --- | --- |
| `initial` | 未認証企業の初回審査登録準備 | W-02, W-03の初期運用部分 | スコープ、体制、文書、資産、リスク、管理策、初期タスクがつながり、次に何をすべきか分かる |
| `surveillance` | 認証済み企業の1年間の継続運用 | W-03, W-04, W-05 | 文書改訂、リスク見直し、タスク消化、内部監査、是正、マネジメントレビュー、継続改善が年次サイクルとして回る |

初回検証の優先は `initial` の W-02 とする。`surveillance` は、初期データと基本導線が揃った後に、年次運用の証跡不足を確認する。

| ID | Workflow | Actors | Required Outputs | Linked CAP/Gate | Current Status |
| --- | --- | --- | --- | --- | --- |
| W-01 | SaaS運営者の顧客設定 | super_admin, system_operator | テナント、初期管理者、契約状態、監査ログ | CAP-01,02,03,05,17,23,24 / no_cross_tenant_access | implementation_gap + runtime_instability |
| W-02 | 顧客テナントのISMS初期導入 | org_admin, system_operator | 適用範囲、体制、文書、資産、リスク、管理策、初期タスク | CAP-04,05,06,08,09,10,11,18,19,21,25,28,30 / core_journeys_work | representative_ready。`initial` でフェーズ選択、組織、スコープ、体制、ユーザーライフサイクル、代表導線、情報資産CRUD、文書作成/承認、リスク評価更新、新規リスク/対応策作成、管理策リンク編集、SoA準備状況表示、管理策単位の適用/除外理由保存、承認申請/CISO承認、却下後修正/再申請、SoA v1固定、SoA v2差分、版単位の改訂理由保存/表示、SoA版レビュー申請/CISO承認、SoA版レビュー却下後の修正版再発行/CISO承認、審査提出束マニフェスト/ZIP/PDF/UI、PDF複数ページ化/日本語見出し、タスク進捗更新はruntime QA pass。日本語フォント埋め込み/提出先向けデザインと承認者ルール細分化は次段。 |
| W-03 | 日常・月次のISMS運用 | org_admin, user, approver | 承認済み文書、リスク履歴、タスク履歴、通知、監査ログ | CAP-06,07,09,11,12,16,18,20,21,28,29 / core_journeys_work | partial_verified。`qa:surveillance-overdue-reminder` で期限超過タスクの統計/画面表示と、期限接近タスクのリマインダー通知、送信記録、監査ログ、担当者通知一覧表示がpass。`qa:surveillance-evidence-gap` でリスク詳細のEvidence Vault不足表示もpass。文書改訂/リスク見直し/タスク消化の一気通貫証跡は不足。 |
| W-04 | 内部監査と是正 | auditor, org_admin, approver | 監査計画、監査証跡、不適合、是正、報告書、フォローアップ | CAP-13,14,17,18,25,29,30 / core_journeys_work | partial_verified。`surveillance-first-step` で監査入口、期間集計、不適合/是正表示がpass。`surveillance-audit-plan-approval` で監査計画の新規作成、監査チーム登録、承認申請、CISO承認/却下、却下後修正再申請、承認イベント、監査ログ、承認済み計画の監査開始、`in_progress` 遷移、実施開始日記録がpass。`surveillance-corrective-action-update` で不適合/是正更新、`nonconformity_closure` の承認申請、CISO却下、却下後再申請、CISO承認、是正処置/不適合の `verified` 遷移、監査ログまでpass。`surveillance-follow-up-update` でフォローアップの完了/検証済み更新と監査ログもpass。`surveillance-audit-report-approval` で報告書保存、承認申請、CISO承認/却下、却下後修正再申請、承認イベント、監査ログもpass。`qa:surveillance-submission-bundle` で年次監査計画、監査報告書、不適合/是正、フォローアップ、監査証跡を提出束へ束ね、未承認/未完了をgap表示できることもpass。多段承認、提出束内gapのさらなる説明品質は未確認。 |
| W-05 | 経営レビュー・継続的改善 | org_admin, approver, management reviewer | レビュー記録、判断履歴、改善タスク、次回アクション | CAP-15,16,20,26,27,28,29,31,32 / core_journeys_work | partial_verified。`qa:surveillance-management-review-input` でマネジメントレビュー入力、改善アクション追加、DB永続化、監査ログはpass。`qa:surveillance-home-task-cycle` でHome/タスクとの次アクション接続もpass。`qa:surveillance-overdue-reminder` で期限超過/通知の代表導線もpass。`qa:surveillance-evidence-gap` でレビュー入力情報散在リスクの証跡不足表示もpass。`qa:surveillance-management-decision` で経営判断、資源配分、リスク受容条件をレビュー記録/アクション/監査ログへ残せることもpass。`qa:surveillance-residual-risk-acceptance` でリスク詳細側の受容理由、CISO責任者、期限、完了状態、承認申請、CISO承認/却下、却下後修正/再申請、承認イベント、監査ログもpass。`qa:surveillance-submission-bundle` でマネジメントレビューと残留リスク受容の提出束gap表示もpass。多段承認、承認者ルール細分化、判断履歴のさらなる構造化、提出束内gapのready化は未確認。 |
| W-06 | 契約終了・データ保持・サポート調査 | super_admin, system_operator, org_admin | 契約状態、エクスポート、保持/削除予定、調査ログ | CAP-03,17,18,22,30,32 / no_critical_authz_gap | owner_decision_needed + evidence_gap |

## Verification Rule

各Workflowは、ページ/API/DBの存在だけでは `ready` にしない。少なくとも次を確認する。

- 操作またはテストが完了すること。
- DB/API/ログ/出力物のいずれかで業務結果を確認できること。
- 権限拒否、テナント越境拒否、例外時の状態が確認できること。
- spec-dsl上のCAP/Gate/evidence-mapへ戻せること。

## Latest Verification

2026-05-15に `npx playwright test tests/e2e/journeys --project=chromium --reporter=line` を再実行した。`/api/dev/login`, `/ja`, `/api/auth/get-session`, W-01/W-02代表ページが200となり、代表テストはrole setupと初期route renderingを越えた。Full suiteは52 failed / 3 passed / 2 skippedで、W-01〜W-06は共通runtime JSON blockerではなく個別の `implementation_gap` / `evidence_gap` / `runtime_instability` / `owner_decision_needed` として扱う。詳細は `docs/02-project/release-readiness/journey-verification-report.md` を参照する。

2026-06-04〜2026-06-08に、商用公開95%評価とは別軸で実務検証版QAを追加した。`initial` は `qa:phase-selector`, `qa:organization-profile`, `qa:isms-scope`, `qa:project-structure`, `qa:initial-w02-journey`, `qa:initial-user-lifecycle`, `qa:initial-w02-assets-crud`, `qa:initial-w02-document-approval`, `qa:initial-w02-risk-update`, `qa:initial-w02-risk-create`, `qa:initial-w02-control-link-update`, `qa:initial-w02-soa-readiness`, `qa:initial-w02-submission-bundle`, `qa:initial-w02-task-progress-update` がpass済み。`qa:initial-w02-soa-readiness` はSoA準備状況に加え、管理策単位の適用/除外理由保存、承認申請、CISO承認、却下後修正/再申請、SoA v1固定まで確認する。`qa:initial-w02-submission-bundle` はISMS範囲、体制、承認済み文書、情報資産、リスク、SoA v1、初期タスクを提出束マニフェスト/ZIP/PDF/UIとして束ねる。`surveillance` は `qa:surveillance-first-step`, `qa:surveillance-corrective-action-update`, `qa:surveillance-follow-up-update`, `qa:surveillance-management-review-input`, `qa:surveillance-home-task-cycle`, `qa:surveillance-overdue-reminder`, `qa:surveillance-evidence-gap`, `qa:surveillance-management-decision`, `qa:surveillance-residual-risk-acceptance`, `qa:surveillance-audit-plan-approval`, `qa:surveillance-audit-report-approval`, `qa:surveillance-submission-bundle` がpass済み。詳細は `docs/02-project/release-readiness/practical-verification-plan.md` と `evidence-map.md` を参照する。
