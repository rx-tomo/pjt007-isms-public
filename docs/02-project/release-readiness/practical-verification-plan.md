---
title: ISMS Pilot Practical Verification Plan
category: project
created: 2026-06-04
last_updated: 2026-06-08
author: Codex
status: active
---

# ISMS Pilot Practical Verification Plan

## Parent Objective

ISMS Pilotを、商用公開前の実務検証版として、未認証企業の初回審査登録準備と、認証済み企業の1年間の継続運用を、自分が利用者・テスターとして試せる状態に近づける。

当面は商用公開、課金運用、顧客配布、契約終了時責任範囲を完成条件にしない。ユーザ自身が使い、業務に役立つか、どこで詰まるか、何が過剰または不足かを判断できる状態を目指す。

## Phase Stories

| Phase | Story | Primary Workflow | Practical Output |
| --- | --- | --- | --- |
| `initial` | 未認証企業の初回審査登録準備 | W-02 顧客テナントのISMS初期導入 | スコープ、体制、文書、資産、リスク、管理策、初期タスクがつながり、次に何をすべきか分かる |
| `surveillance` | 認証済み企業の1年間継続運用 | W-03〜W-05 | 文書改訂、リスク見直し、内部監査、是正、マネジメントレビューが年次サイクルとして回る |

最初の実務検証は `initial` / W-02 を対象にする。`surveillance` はW-02で初期データと基本導線を整えた後に検証する。

2026-06-04時点で、W-02後半の通しQA足場として `npm run qa:initial-w02-journey` を追加した。`initial` 固定テナント `70000000-0000-4000-8000-000000000001` と shared system_operator `operator.practical@isms-practical.local` を使い、文書テンプレート、文書、情報資産、リスク、対応策、資産リンク、管理策、管理策リンク、初期タスクのDB存在確認と、`documents` / `settings/assets` / `risks` / `settings/controls` / `tasks` / `home` の代表導線表示を1本で確認する。失敗時は `仕様不足` / `実装不足` / `テスト契約ズレ` / `環境blocker` / `事業判断待ち` の分類を `test-results/initial-w02-journey-run-*.json` に残す。

2026-06-04 18:37 JSTに `npm run qa:initial-w02-journey` がpassした。結果は `test-results/initial-w02-journey-run-2026-06-04T09-37-20-489Z.json`。seed件数確認、文書、情報資産、リスク、管理策、タスク、Home次アクションまでpassし、firstBlockerは `null`。この過程で文書、情報資産、リスク、管理策、タスクの一覧系browser DB直アクセスをAPI境界へ寄せ、タスクページの `authUser` 依存抜けを修正した。

2026-06-04 18:58 JSTに `npm run qa:initial-user-lifecycle` がpassした。結果は `test-results/initial-user-lifecycle-run-2026-06-04T09-58-13-964Z.json`。招待作成、招待リンク受諾、profile/membership作成、`auditor` へのロール変更、詳細権限保存、`user.invited` / `invitation.accepted` / `user.role_updated` / `user.permissions_updated` の監査ログ、ユーザー管理画面での表示までpassし、firstBlockerは `null`。途中で、招待受諾後のHome遷移待ちをDB/監査ログ証跡待ちへ変更し、`auditor` の日本語表示を現行UIの `監査員` に合わせた。

2026-06-04 19:27 JSTに `npm run qa:surveillance-first-step` がpassした。結果は `test-results/surveillance-first-step-run-2026-06-04T10-27-49-625Z.json`。`surveillance` 固定テナント `70000000-0000-4000-8000-000000000002` と shared system_operator を使い、内部監査計画、チェックリスト、不適合、是正、フォローアップのDB存在、`/api/audit/periods` の `FY2026 Q2` 集計、`/ja/audit` と期間フィルタ、`/ja/audit/nonconformities` の代表表示を確認した。途中で監査画面のbrowser direct DB accessを検出し、`AuditService` の一覧/統計/期間/不適合GETを `/api/audit` / `/api/audit/periods` 経由へ寄せた。

2026-06-05 08:22 JSTに `npm run qa:initial-w02-assets-crud` がpassした。結果は `test-results/initial-w02-assets-crud-run-2026-06-04T23-22-51-973Z.json`。`initial` 固定テナントで情報資産の作成、編集、検索、削除を画面から実行し、SQLite DBへの保存/更新/削除まで確認した。途中で情報資産APIに `POST` / `PATCH` / `DELETE` とbrowser service branchを追加し、firstBlockerは `null`。2026-06-10に `npm run qa:assets:csv` を追加・実行し、情報資産CSVのエクスポート、description補正、upsertインポート、再エクスポート確認、description復元、QA用資産削除までpassした。結果は `test-results/assets-csv-roundtrip-20260610T055946.json`。

2026-06-05 12:08 JSTに `npm run qa:initial-w02-document-approval` がpassした。結果は `test-results/initial-w02-document-approval-run-2026-06-05T03-08-08-642Z.json`。`initial` 固定テナントでCISOユーザーが方針文書を下書き作成し、文書一覧で表示、同一CISOへ承認依頼、承認済み化まで画面から確認した。DBでは `documents.status=approved`、`approval_requests` 2件、`document.created` / `document.approval_requested` / `document.approved` の監査ログを確認した。途中で文書承認依頼/承認/却下を `/api/documents/[id]/approval` へ寄せ、文書一覧APIが `approval_requests` ベースの承認進捗を返すようにした。実行後は `npm run seed:practical-verification -- --reset --scenario all` と `npm run qa:practical-seed` で2テナントseed状態へ復元した。

2026-06-05 10:26 JSTに `npm run qa:surveillance-corrective-action-update` がpassした。結果は `test-results/surveillance-corrective-action-update-run-2026-06-05T01-26-42-845Z.json`。`surveillance` 固定テナントで `/ja/audit/nonconformities` から不適合ステータスを `resolved`、是正処置を `completed` へ更新し、DB永続化と `audit.nonconformity.updated` / `audit.corrective_action.updated` の監査ログを確認した。途中で `AuditService` の不適合/是正更新を `/api/audit` の `POST` / `PATCH` へ寄せ、firstBlockerは `null`。実行時に `user_department_scopes` がローカルSQLite DBに存在しないdev login警告が出たが、catchされQA本体はpassしたため、部門スコープSQLite整合は別P1候補として扱う。

2026-06-08 14:24 JSTに `npm run qa:surveillance-corrective-action-update` を拡張実行し、是正完了承認の正式な承認キュー連携までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1424-surveillance-corrective-action-closure-approval.json`。`surveillance` 固定テナントで是正処置を `completed` にした後、画面から `nonconformity_closure` 承認申請を作成し、CISOが却下、system_operatorが再申請、CISO承認後に是正処置と不適合が `verified` へ遷移することを確認した。`approval_events`、`audit.corrective_action.closure_approval_requested` / `closure_rejected` / `closure_approved`、`audit.nonconformity.verified` も確認済み。QA実行前にNext devの `127.0.0.1` originを許可し、Playwright上で画面hydrationと `/api/audit` 呼び出しが動くことも確認した。

2026-06-08 16:09 JSTに `npm run qa:surveillance-corrective-action-update` を再拡張実行し、通常タスクと監査不適合/CAPAの責務分離を画面とDBで確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1609-surveillance-capa-boundary.json`。`/ja/audit/nonconformities` の不適合カードに `CAPA / 監査不適合` 境界表示、是正処置カードに `CAPA是正処置` 要約を出し、責任者、原因、再発防止、完了承認状態を表示した。QAでは、対象是正処置が `corrective_actions.nonconformity_id` で不適合に紐づき、同じIDの汎用 `tasks` 行ではないことも確認した。

2026-06-08 16:14 JSTに `npm run qa:surveillance-corrective-action-update` を再拡張実行し、CAPAの深掘り項目を画面から更新できることを確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1614-surveillance-capa-deep-fields.json`。不適合カードから原因分析、是正方針、再発防止を更新し、是正処置カードから有効性確認を更新した。DBでは `nonconformities.root_cause` / `corrective_action` / `preventive_action` と `corrective_actions.effectiveness_review` の永続化を確認し、画面のCAPA要約と監査ログにも反映されることを確認した。

2026-06-08 16:20 JSTに `npm run qa:surveillance-corrective-action-update` を再拡張実行し、CAPA画面で有効性確認フォローアップの次アクションを確認できることを確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1620-surveillance-capa-follow-up-summary.json`。不適合IDに紐づく `follow_up_records` を `/api/audit?action=followUpsByNonconformity` で取得し、不適合カードにタイトル、状態、期限、担当者を表示する。QAでは対象不適合のフォローアップが画面に表示され、DB上も `follow_up_records.nonconformity_id` で紐づくことを確認した。

2026-06-08 16:26 JSTに `npm run qa:surveillance-corrective-action-update` を再拡張実行し、CAPA画面から有効性確認フォローアップを直接作成できることを確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1626-surveillance-capa-follow-up-create.json`。不適合カード上のフォームからタイトル、説明、期限を入力して作成し、API側では `nonconformity_id` から監査計画IDを解決して `follow_up_records` を作成する。QAでは画面表示、DB永続化、`audit.follow_up.created` 監査ログを確認した。

2026-06-08 16:32 JSTに `npm run qa:surveillance-corrective-action-update` を再拡張実行し、CAPA画面から有効性確認フォローアップの担当者を選択して作成できることを確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1632-surveillance-capa-follow-up-assignee.json`。`UserService.getOrganizationUsers` で組織メンバーを取得し、フォローアップ作成時に `assigned_to` を保存する。QAではCISOユーザーを担当者として選択し、DBの `follow_up_records.assigned_to`、画面表示、`audit.follow_up.created` 監査ログを確認した。

2026-06-08 16:40 JSTに `npm run qa:surveillance-corrective-action-update` を再拡張実行し、CAPA画面から担当者付きフォローアップを作成したときに、担当者へアプリ内通知が届くことを確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1640-surveillance-capa-follow-up-assignee-notification.json`。QAでは `notifications.type=info`、`metadata.follow_up_record_id`、`metadata.nonconformity_id`、通知タイトル `監査フォローアップ担当`、担当者での `/ja/notifications` 表示まで確認した。

2026-06-08 14:34 JSTに `npm run qa:surveillance-audit-plan-approval` を拡張実行し、承認済み監査計画を画面から開始できることを確認した。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1434-surveillance-audit-plan-start.json`。CISO承認後に `scheduled` となった監査計画をsystem_operatorが開始し、`audit_plans.status=in_progress`、`actual_start_date`、`audit.plan.started` 監査ログが残る。これにより、監査計画は承認されて終わりではなく、実施開始状態へ進める代表線まで確認済みになった。

2026-06-05 10:40 JSTに、部門スコープSQLite整合をseed/QAへ反映した。`scripts/seed-practical-verification.mjs` は `user_department_scopes` テーブルとindexを `CREATE TABLE IF NOT EXISTS` で補完し、reset/seed対象に含める。`scripts/qa-practical-seed.mjs` は `initial` / `surveillance` 各3件の `user_department_scopes` を明示チェックする。`npm run seed:practical-verification -- --reset --scenario all`、`npm run qa:practical-seed`、dev server経由の `/api/dev/login`、修正後の `npm run qa:surveillance-corrective-action-update` がpassし、`no such table: user_department_scopes` 警告は再発しなかった。QA側では、画面クリック後にPATCH完了前へ監査ログを読みに行く競合を避けるため、`tests/e2e/surveillance-corrective-action-update.spec.ts` をPATCHレスポンス待ちに更新した。

2026-06-05 10:49 JSTに `npm run qa:surveillance-follow-up-update` がpassした。結果は `test-results/surveillance-follow-up-update-run-2026-06-05T01-49-20-244Z.json`。`surveillance` 固定テナントで `/ja/audit/plans/[planId]` からフォローアップ記録を `completed`、続けて `verified` へ更新し、DB永続化、`completed_at` / `verified_at` / `verified_by`、`audit.follow_up.completed` / `audit.follow_up.verified` の監査ログを確認した。途中で監査計画詳細の `plan` / `units` / `followUps` GETとfollow-up `POST` / `PATCH` を `/api/audit` へ寄せ、browser direct DB accessを避けるようにした。実行後は `npm run seed:practical-verification -- --reset --scenario surveillance` でseed状態へ復元した。

2026-06-05 11:05 JSTに `npm run qa:surveillance-management-review-input` がpassした。結果は `test-results/surveillance-management-review-input-run-2026-06-05T02-05-24-867Z.json`。`surveillance` 固定テナントでマネジメントレビュー詳細を開き、seedの議題、レビュー項目、既存アクションを確認したうえで、議事録、結論、ステータスを画面更新し、DB永続化と `management_review.updated` の監査ログを確認した。さらにレビュー結果から改善アクションを追加し、DB永続化と `management_review.action_created` の監査ログを確認した。実行後は `npm run seed:practical-verification -- --reset --scenario all` で2テナントseed状態へ復元した。

2026-06-05 11:13 JSTに `npm run qa:surveillance-home-task-cycle` がpassした。結果は `test-results/surveillance-home-task-cycle-run-2026-06-05T02-13-45-012Z.json`。`surveillance` 固定テナントで、Homeのタスク統計が実データから `activeTaskCount=4`、期限超過0、状態内訳 `todo=2` / `in_progress=1` / `review=1` を返すことを確認した。Homeのタスクカードから `/ja/tasks` へ遷移し、レビュー後の次アクションである `マネジメントレビュー入力情報を整理する` を検索・表示できることを確認した。

2026-06-05 11:32 JSTに `npm run qa:surveillance-overdue-reminder` がpassした。結果は `test-results/surveillance-overdue-reminder-run-2026-06-05T02-32-02-154Z.json`。`surveillance` 固定テナントでアクセスレビュータスクを期限超過状態にし、組織統計APIの `overdueTaskCount=1` とタスク画面の超過表示を確認した。さらに期限接近タスクで `/api/tasks/reminders` を実行し、担当者向け通知、`task_reminders`、`task.reminder_sent` 監査ログ、担当者ログイン後の通知一覧表示を確認した。QAの再実行性を保つため、`scripts/seed-practical-verification.mjs` のreset対象に通知、通知設定、リマインダー、通知配送ログを追加した。実行後は `npm run seed:practical-verification -- --reset --scenario all` と `npm run qa:practical-seed` でseed状態へ復元した。

2026-06-08 16:46 JSTに `npm run qa:surveillance-overdue-reminder` を再拡張実行し、CAPAフォローアップの期限リマインダーまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1646-surveillance-follow-up-due-reminder.json`。`surveillance` 固定テナントで、未完了フォローアップ `訓練後改善タスクの週次確認` の期限を接近日へ変更し、`/api/audit/follow-up-reminders` が担当者向け通知と `audit.follow_up.reminder_sent` 監査ログを作ること、担当者で `/ja/notifications` を開くと `監査フォローアップ期限リマインダー` が表示されることを確認した。リマインダーの外部送信は通知設定によりskipされる場合があるため、実務検証ではアプリ内通知と監査ログを代表証跡とする。

2026-06-08 16:51 JSTに `npm run qa:surveillance-overdue-reminder` を再拡張実行し、CAPAフォローアップの期限超過通知までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1651-surveillance-follow-up-overdue-reminder.json`。同じ `/api/audit/follow-up-reminders` で、期限前は `follow_up_due` / `audit.follow_up.reminder_sent`、期限超過後は `follow_up_overdue` / `audit.follow_up.overdue_reminder_sent` として通知と監査ログを分けて残す。QAでは担当者で `/ja/notifications` を開き、`監査フォローアップ期限超過` が表示されることも確認した。

2026-06-05 11:41 JSTに `npm run qa:surveillance-evidence-gap` がpassした。結果は `test-results/surveillance-evidence-gap-run-2026-06-05T02-41-44-012Z.json`。`surveillance` 固定テナントの `マネジメントレビューへの入力情報が散在` リスクで、対応策0件/管理策リンク0件をDB確認し、リスク詳細APIと画面でEvidence Vaultが `未準備`、`0/0`、対応策未登録、管理策未リンクを表示することを確認した。この過程でリスク詳細のbrowser direct DB accessを避けるため、`GET /api/risks/[id]` を追加し、ブラウザ側の `RiskService.getRiskById` をAPI経由にした。

2026-06-05 11:53 JSTに `npm run qa:surveillance-management-decision` がpassした。結果は `test-results/surveillance-management-decision-run-2026-06-05T02-53-38-829Z.json`。`surveillance` 固定テナントで、マネジメントレビューの判断系レビュー項目を表示し、議事録/結論に経営判断、0.5人月の資源配分、CISOによる期限付きリスク受容条件を保存できることを確認した。さらに資源配分とリスク受容条件を次回レビューへ持ち越す改善アクションを追加し、DB永続化、`management_review.updated` / `management_review.action_created` の監査ログまで確認した。実行後は `npm run seed:practical-verification -- --reset --scenario all` と `npm run qa:practical-seed` で2テナントseed状態へ復元した。

2026-06-05 12:27 JSTに `npm run qa:initial-w02-risk-update` がpassした。結果は `test-results/initial-w02-risk-update-run-2026-06-05T03-27-34-062Z.json`。`initial` 固定テナントで、seedリスク `委託先のセキュリティ確認が未完了` を編集画面から影響度5/発生可能性4へ再評価し、一覧の `20 - 高` 表示、DB永続化、`risk_assessment_history`、`risk.updated` 監査ログまで確認した。実行後は `seed:practical-verification -- --reset --scenario all` と `qa:practical-seed` で2テナントseed状態へ復元した。

2026-06-05 12:47 JSTに `npm run qa:initial-w02-control-link-update` がpassした。結果は `test-results/initial-w02-control-link-update-run-2026-06-05T03-47-35-655Z.json`。`initial` 固定テナントで、seedリスク `委託先のセキュリティ確認が未完了` の対応策に、既存の `委託先管理` に加えて `情報資産台帳` を画面からリンク追加し、DB永続化と `risk.treatment.updated` 監査ログまで確認した。途中でリスク対応策の作成/更新を `/api/risks/[id]/treatments` と `/api/risk-treatments/[id]` へ寄せ、ブラウザ側の管理策リンク編集をAPI境界で実行するようにした。実行後は `seed:practical-verification -- --reset --scenario all` と `qa:practical-seed` で2テナントseed状態へ復元した。

2026-06-05 13:03 JSTに `npm run qa:initial-w02-task-progress-update` がpassした。結果は `test-results/initial-w02-task-progress-update-run-2026-06-05T04-03-35-876Z.json`。`initial` 固定テナントで、seed初期タスク `リスク対応計画を管理策に紐づける` を編集画面から `todo` / 0% から `in_progress` / 60% へ更新し、DB永続化と `task.updated` 監査ログまで確認した。途中でタスク詳細取得/作成/更新を `/api/tasks` と `/api/tasks/[id]` へ寄せ、ブラウザ側のタスク進捗更新をAPI境界で実行するようにした。実行後は `seed:practical-verification -- --reset --scenario all` と `qa:practical-seed` で2テナントseed状態へ復元した。

2026-06-08 15:01 JSTに `npm run qa:initial-w02-task-progress-update` を拡張実行し、初回登録準備の追加タスク新規作成とサブタスク作成/完了までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1501-initial-w02-task-create-subtask.json`。既存seedタスクの `in_progress` / 60% 更新に加え、画面から `審査登録前チェックリストを整える` を作成し、追加タスクへ `適用範囲とSoAの確認観点を整理する` サブタスクを追加、完了状態へ更新した。DBでは親タスク/サブタスク、`task.created` / `task.updated` 監査ログまで確認した。途中でタスク詳細の `authUser` 依存抜けと、ブラウザ側サブタスク作成がAPI境界を通らない問題を修正した。

2026-06-08 15:15 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクへ実務判断コメントを残せることまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1515-initial-w02-task-comment-audit.json`。追加タスクのコメントタブから、適用範囲とSoAの整合性をCISO確認事項として残すメモを投稿し、画面表示、`task_comments` DB永続化、`task.comment.created` 監査ログまで確認した。ブラウザ側コメント投稿は `/api/tasks/[id]/comments` 境界へ寄せた。

2026-06-08 15:25 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクへ分類タグを付けられることまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1525-initial-w02-task-tag-audit.json`。追加タスクに `初回審査準備` タグを画面から作成・保存し、`task_tags`、`task_tag_relations`、`task.tag.created`、`task.tags.updated` 監査ログまで確認した。ブラウザ側タグ操作は `/api/tasks/tags` と `/api/tasks/[id]/tags` 境界へ寄せた。

2026-06-08 15:31 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクへ確認資料ファイルを添付できることまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1531-initial-w02-task-attachment-audit.json`。追加タスクの添付ファイルタブから `task-attachment.txt` をアップロードし、画面表示、`task_attachments` DB永続化、`task.attachment.created` 監査ログまで確認した。ブラウザ側添付アップロード/削除は `/api/tasks/[id]/attachments` 境界へ寄せた。

2026-06-08 15:35 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクの確認資料ファイルを削除できることまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1535-initial-w02-task-attachment-delete-audit.json`。添付済み `task-attachment.txt` を画面から削除し、`task_attachments` から消えること、`task.attachment.deleted` 監査ログが残ることを確認した。

2026-06-08 15:41 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクの担当者変更履歴までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1541-initial-w02-task-assignee-history.json`。seed初期タスクの担当者を別ユーザーへ変更し、DB永続化、`task.updated` 監査ログ、`task_history` の `assignee_id` / `status` / `progress` 履歴、変更履歴タブの表示まで確認した。ブラウザ側履歴取得は `/api/tasks/[id]/history` 境界へ寄せた。

2026-06-08 15:49 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクのコメント編集/削除までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1549-initial-w02-task-comment-edit-delete.json`。追加タスクに投稿した実務判断コメントを画面から編集し、`task_comments.comment` 更新、`task.comment.updated` 監査ログを確認した後、同コメントを削除し、DBから消えることと `task.comment.deleted` 監査ログまで確認した。

2026-06-08 15:59 JSTに `npm run qa:initial-w02-task-progress-update` を再拡張実行し、初回登録準備タスクのコメントメンション通知までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1559-initial-w02-task-mention-notification.json`。コメント編集時に `@高橋誠` を含め、同一組織ユーザー向けに `notifications.type=info` の通知が作成され、メンションされたユーザーで `/ja/notifications` にログインすると通知項目が表示されることを確認した。

2026-06-05 18:52 JSTに `npm run qa:initial-w02-soa-readiness` がpassした。結果は `test-results/initial-w02-soa-readiness-run-2026-06-05T09-51-58-232Z.json`。`initial` 固定テナントで、リスク対応策を画面から完了にし、管理策ページでSoA準備状況の登録済み管理策3件、リスク対応策リンク済み2件、完了証跡あり1件、未リンク1件を表示できることを確認した。API `GET /api/controls?action=soa&organizationId=...` でも同じSoA準備状況を取得できる。これは正式な適用宣言書ではなく、既存のリスク対応策リンクから正式SoA作成前の準備状況を復元する代表面である。

2026-06-05 20:44 JSTに `npm run qa:initial-w02-soa-readiness` を拡張実行し、管理策単位の正式SoA判断保存までpassした。結果は `test-results/initial-w02-soa-readiness-run-2026-06-05T11-44-32-360Z.json`。`initial` 固定テナントで、`アクセス制御` を `applicable`、`情報資産台帳` を `not_applicable` として画面から保存し、適用理由、適用除外理由、判断者、判断日時、`control.soa_decision.updated` 監査ログ、API `GET /api/controls?action=soa&organizationId=...` の `soa_status` を確認した。これは管理策単位のSoA判断保存であり、改訂履歴、審査提出束は次段で扱う。

2026-06-06 16:54 JSTに `npm run qa:initial-w02-soa-readiness` をさらに拡張実行し、SoA判断の承認申請とCISO承認までpassした。結果は `test-results/initial-w02-soa-readiness-run-2026-06-06T07-54-16-237Z.json`。管理策ページからSoA判断を承認申請し、`approval_requests.resource_type=iso_control_soa`、承認イベント `requested` / `approved`、管理策の `soa_approval_status=approved`、`soa_approved_by`、`soa_approved_at`、`control.soa.approval_requested` / `control.soa.approved` 監査ログまで確認した。これは管理策単位の承認済みSoAの代表線であり、SoA全体版数、提出束、却下後の修正/再申請は次段で扱う。

2026-06-06 17:03 JSTに `npm run qa:initial-w02-soa-readiness` を再拡張実行し、SoA判断の却下後修正/再申請までpassした。結果は `test-results/initial-w02-soa-readiness-run-2026-06-06T08-03-12-646Z.json`。管理策ページで適用除外判断を承認申請し、CISOが承認キューで却下、管理策画面で却下理由表示、理由修正による `draft` 復帰、再申請、CISO承認、`approval_requests` の `rejected` / `approved` 併存、承認イベント、`control.soa.rejected` / `control.soa_decision.updated` / `control.soa.approval_requested` / `control.soa.approved` 監査ログまで確認した。これは管理策単位のSoA差戻しループであり、SoA全体版数と審査提出束は次段で扱う。

2026-06-06 17:17 JSTに `npm run qa:initial-w02-soa-readiness` をさらに拡張実行し、SoA全体版数のv1固定までpassした。結果は `test-results/initial-w02-soa-readiness-run-2026-06-06T08-17-01-030Z.json`。管理策ページで未判断管理策を判断済みにしたうえで、SoA版発行ボタンから `soa_versions.version_number=1` を作成し、管理策3件のスナップショットJSON、承認済み管理策数、発行者、発行日時、`control.soa.version_published` 監査ログ、画面の最新v1表示まで確認した。これは審査提出束へ含めるためのSoA版固定であり、PDF/Excel等の提出束生成は次段で扱う。

2026-06-08 12:57 JSTに `npm run qa:initial-w02-soa-readiness` を再拡張実行し、SoA版単位の改訂理由保存までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1257-initial-w02-soa-version-change-summary.json`。管理策ページの `soa-version-change-summary` からSoA v1の改訂理由を入力し、`soa_versions.change_summary`、snapshot内 `changeSummary`、APIレスポンスを確認した。続けてSoA v2を改訂理由付きでAPI発行し、`action=soa_versions` と画面の最新版表示で `changeSummary`、前版との差分、変更管理策名が確認できることを検証した。差分レビュー専用の承認フローは次段で扱う。

2026-06-08 13:06 JSTに `npm run qa:initial-w02-soa-readiness` を再拡張実行し、SoA v2差分版のレビュー申請/CISO承認までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1306-initial-w02-soa-version-review-approval.json`。管理策画面から最新版SoAをレビュー申請し、`approval_requests.resource_type=soa_version`、承認キューの `SoA版レビュー` 表示、CISO承認、`soa_versions.review_status=approved`、承認イベント、`control.soa.version_review_requested` / `control.soa.version_review_approved` 監査ログを確認した。SoA版レビューの却下後修正/再申請は後続の13:13 QAで回収した。

2026-06-08 13:13 JSTに `npm run qa:initial-w02-soa-readiness` を再拡張実行し、SoA版レビューの却下後修正版再発行/CISO承認までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1313-initial-w02-soa-version-review-reissue.json`。SoA v3をレビュー申請し、CISOが却下理由付きで却下した後、管理策画面で却下状態と理由を表示できることを確認した。続けて理由を修正したSoA v4を再発行し、再度レビュー申請してCISO承認まで進め、`soa_versions.review_status=rejected/approved`、`approval_requests` の却下/承認、`approval_events=requested/rejected/approved`、`control.soa.version_review_rejected` / `control.soa.version_review_approved` 監査ログを確認した。

2026-06-06 22:18 JSTに `npm run qa:initial-w02-submission-bundle` を拡張実行し、審査提出束ZIPまでpassした。結果は `test-results/initial-w02-submission-bundle-run-2026-06-06T13-18-42-928Z.json`。`initial` 固定テナントで、SoA未発行状態では提出束マニフェストの `soa_version` がmissingになることを確認した。続けて審査提出束QA用の承認済み代表文書をAPI作成し、管理策3件を判断済みにしてSoA v1を固定した後、`/api/examination/submission-bundle` がISMS適用範囲、体制・担当者、承認済み文書、情報資産、リスクアセスメント、SoA版、初期タスクをすべてreadyとして返すこと、`examination.submission_bundle.generated` 監査ログが残ることを確認した。さらに `format=zip` で `submission-bundle-manifest.json`、summary/items/gaps CSVを含むZIPを取得し、ZIP内manifestが `ready` とSoA v1を含むことを確認した。PDF整形と画面ダウンロードUIは次段で扱う。

2026-06-08 09:48 JSTに `npm run qa:initial-w02-submission-bundle` を再拡張実行し、審査提出束の画面確認とZIPダウンロード開始までpassした。結果は `test-results/initial-w02-submission-bundle-run-2026-06-08T00-48-28-897Z.json`。`/ja/examination/submission-bundle` で提出準備状況、7/7 ready、SoA v1、各提出材料カードを表示し、同画面のZIPダウンロードボタンから成果物取得を開始できることを確認した。これにより、実務検証者がAPIを直接叩かずに初回登録準備の提出候補を確認できる代表導線ができた。PDF整形は次段で扱う。

2026-06-08 09:54 JSTに `npm run qa:initial-w02-submission-bundle` をPDF確認まで再拡張した。提出束APIに `format=pdf` を追加し、ZIPにも `submission-bundle-summary.pdf` を同梱する。画面ではPDFダウンロードボタンを追加し、QAではAPIのPDF content-type、PDFシグネチャ、ZIP内PDF、画面からのPDFダウンロード開始を確認する。PDFの体裁改善は次段で扱う。

2026-06-08 10:59 JSTに `npm run qa:surveillance-submission-bundle` を再拡張実行し、継続運用側の年次証跡提出束入口から7/7 readyまでpassした。結果は `test-results/surveillance-submission-bundle-run-2026-06-08T01-59-11-982Z.json`。`surveillance` 固定テナントで、提出束APIが承認前に `phase=surveillance`、`ready_with_gaps`、7項目中2項目readyを返すことを確認した。続けて監査報告書を承認申請し、CISO承認後に `audit_reports` が `ready` へ変わり、提出束readyが3/7になることを確認した。さらに不適合を `resolved`、是正処置を `completed`、フォローアップを `verified` へ進めると、`nonconformity_corrective_actions` と `follow_up_records` が `ready` へ変わり、提出束readyが5/7になることを確認した。マネジメントレビューを `completed` に更新すると `management_reviews` がready化し、残留リスク受容を作成/承認申請/CISO承認すると `residual_risk_acceptances` もready化し、提出束readyが7/7、readiness statusが `ready` になることを確認した。ZIP/PDF成果物、画面表示、`examination.submission_bundle.generated` 監査ログも確認した。次段はPDF体裁、保証表現、多段承認などの残ジャーニーを扱う。

2026-06-08 11:10 JSTに `npm run qa:initial-w02-submission-bundle` と `npm run qa:surveillance-submission-bundle` を再実行し、提出束PDF/manifest/画面に実務検証用の注意書きを含める修正までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1109-initial-w02-submission-bundle-notice.json` と `docs/02-project/release-readiness/evidence/2026-06-08-1110-surveillance-submission-bundle-notice.json`。注意書きは、この提出束が内部確認用の候補証跡整理であり、ISO 27001認証取得、審査での受理、商用サービスとしての提供可否を保証しないことを明示する。これにより、提出束が審査合格保証のように見えるリスクを下げた。PDFの細かな組版改善は次段で扱う。

2026-06-08 12:40 JSTに `npm run qa:initial-w02-submission-bundle` と `npm run qa:surveillance-submission-bundle` を再実行し、提出束PDFの最小構造化までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1240-initial-w02-submission-bundle-pdf-structure.json` と `docs/02-project/release-readiness/evidence/2026-06-08-1240-surveillance-submission-bundle-pdf-structure.json`。PDF本文に `Review scope`、`Readiness summary`、`Evidence checklist`、`Gap review` を追加し、初回登録準備は `Phase story: Initial certification preparation`、継続運用は `Phase story: Certified organization annual surveillance operation` として分岐が読めること、ready 7/7時に `No open gaps` が入ることを確認した。PDF複数ページ化と日本語見出しは後続の13:21〜13:22 QAで回収した。

2026-06-08 13:21〜13:22 JSTに `npm run qa:surveillance-submission-bundle` と `npm run qa:initial-w02-submission-bundle` を再実行し、提出束PDFの複数ページ化と日本語見出しまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1321-surveillance-submission-bundle-pdf-pagination-ja.json` と `docs/02-project/release-readiness/evidence/2026-06-08-1322-initial-w02-submission-bundle-pdf-pagination-ja.json`。従来の60行切り捨てをやめ、PDFを複数ページに分割し、ページフッター、`準備状況サマリー`、`証跡チェックリスト`、`不足確認` がPDF本文に含まれることを初回登録準備/継続運用の両方で確認した。日本語フォント埋め込み、視覚的な改ページ調整、提出先向けデザインは次段で扱う。

2026-06-08 14:45 JSTに `npm run qa:initial-w02-submission-bundle` と `npm run qa:surveillance-submission-bundle` を再実行し、提出束PDFに `Document profile` / `文書プロファイル` と `Reviewer sign-off` / `確認欄` を含める修正までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1444-initial-w02-submission-bundle-pdf-review-signoff.json` と `docs/02-project/release-readiness/evidence/2026-06-08-1445-surveillance-submission-bundle-pdf-review-signoff.json`。PDF本文には、初回登録準備/継続運用のbundle type、内部実務検証レビュー用途、同梱成果物、判断根拠、作成者、確認者、確認日、内部証跡として受け入れるか/フォローアップ要否の判断欄が入る。これは提出先向けの最小確認資料化であり、日本語フォント埋め込みと視覚的な組版品質は引き続き未解決である。

2026-06-08 15:07 JSTに `npm run qa:initial-w02-submission-bundle` を再実行し、初期タスクを提出束内で進捗・親子構造付きで説明できることまでpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1507-initial-w02-submission-bundle-task-progress-metrics.json`。QA内で提出束確認用の親タスクと完了サブタスクを作成し、`initial_tasks` のevidenceに `parent_tasks`、`subtasks`、`completed_tasks`、`open_tasks`、`average_progress` が入り、manifest、items CSV、PDF、画面で確認できることを検証した。これにより、初期タスクは単なる存在確認ではなく、準備作業の分解状況と進捗を提出束で読めるようになった。

2026-06-08 13:29 JSTに `npm run qa:surveillance-residual-risk-acceptance` を再実行し、残留リスク受容の責任者本人承認までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1329-surveillance-residual-risk-acceptance-responsible-approver.json`。これまでのCISO代表承認に加え、受容対応の `responsible_id` がCISO以外の `approver` である場合は、その責任者本人を `approval_requests.approver_id` に設定し、本人の承認キューから承認できることを確認した。再レビュー日は13:41 JSTの後続QAで回収済み。多段承認、経営層承認は次段で扱う。

2026-06-08 13:41 JSTに `npm run qa:surveillance-residual-risk-acceptance` を再実行し、残留リスク受容の再レビュー日までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1341-surveillance-residual-risk-review-due-date.json`。リスク詳細で `accept` 対応を作る時に `residual_review_due_date` を保存し、画面表示、DB永続化、準備状況判定、承認申請前必須条件、責任者本人承認の証跡detailまで確認した。`qa:surveillance-submission-bundle` も同時に再実行し、承認済み残留リスク受容に再レビュー日がある場合に `residual_risk_acceptances` がreadyになり、提出束証跡に `review_due_dates:1` が入ることを確認した。多段承認、経営層承認は次段で扱う。

2026-06-05 19:11 JSTに `npm run qa:initial-w02-risk-create` がpassした。結果は `test-results/initial-w02-risk-create-run-2026-06-05T10-11-13-742Z.json`。`initial` 固定テナントで新規リスクを情報資産付きで作成し、作成後の詳細画面で対応策と管理策リンクを追加できることを確認した。DBでは `risks.risk_score=16`、`risk_assets`、`risk_treatments`、`risk_control_links`、`risk.created` / `risk.treatment.created` 監査ログを確認した。途中で新規リスク作成を `POST /api/risks` へ移し、画面側の余分な `useAuth` 依存を外してAPI側で認証/権限確認する形にした。実行後はseed resetで2テナントseed状態へ復元した。

2026-06-05 14:35 JSTに `npm run qa:surveillance-audit-report-approval` がpassした。結果は `test-results/surveillance-audit-report-approval-run-2026-06-05T05-35-52-450Z.json`。`surveillance` 固定テナントで、監査報告書を画面から保存し、shared system_operatorが承認申請、CISOが承認キューから承認、別シナリオでCISOが却下するところまで確認した。DBでは `audit_reports.approval_status=submitted/approved/rejected`、`approval_requests.status=pending/approved/rejected`、CISO `approver_id=72000000-0000-4000-8000-000200000001`、`approval_events` の `requested` / `approved` / `rejected`、`audit.report.approval_requested` / `audit.report.approved` / `audit.report.rejected` の監査ログを確認した。途中で承認キューの一覧/承認/却下を `/api/approvals` へ寄せ、報告書保存/承認申請は `/api/audit` 経由にした。承認キュー表示時のサイドバーHydration mismatchも、保存状態をマウント後に反映する修正後の再QAログでは再発していない。実行後は `seed:practical-verification -- --reset --scenario all` と `qa:practical-seed` で2テナントseed状態へ復元する。

2026-06-08 14:06 JSTに `npm run qa:surveillance-audit-report-approval` を再実行し、監査報告書の却下後修正/再申請までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1406-surveillance-audit-report-reapply.json`。CISOが却下した報告書をsystem_operatorが修正すると `audit_reports.approval_status=draft` に戻り、`rejection_reason` がクリアされ、`audit.report.revised` 監査ログが残ることを確認した。その後、同じ画面から再申請し、新しい `approval_requests(resource_type=audit_report)` を作成し、CISO承認により最新依頼が `approved`、報告書が `approved` になることも確認した。

2026-06-05 14:41 JSTに `npm run qa:surveillance-audit-plan-approval` がpassした。結果は `test-results/surveillance-audit-plan-approval-run-2026-06-05T05-41-09-089Z.json`。`surveillance` 固定テナントで、監査計画を `planning` へ戻したうえで画面から承認申請し、CISOが承認キューから承認して `audit_plans.status=scheduled` になることを確認した。別シナリオではCISOが却下し、`audit_plans.status=planning` を維持することを確認した。DBでは `approval_requests.status=pending/approved/rejected`、CISO `approver_id=72000000-0000-4000-8000-000200000001`、`approval_events` の `requested` / `approved` / `rejected`、`audit.plan.approval_requested` / `audit.plan.approved` / `audit.plan.rejected` の監査ログを確認した。

2026-06-08 13:56 JSTに `npm run qa:surveillance-audit-plan-approval` を再実行し、監査計画の新規作成と却下後再申請までpassした。結果は `docs/02-project/release-readiness/evidence/2026-06-08-1356-surveillance-audit-plan-create-reapply.json`。画面から新しい監査計画を作成し、監査対象ユニット、主任監査員、監査チーム、日程、サインを保存した。続けて承認申請、CISO却下、却下後の説明修正、再申請、CISO承認まで確認し、最新承認依頼が `approved`、計画が `scheduled` になることを確認した。多段承認、監査実施開始との深い連動は次段で扱う。

2026-06-05 18:41 JSTに `npm run qa:surveillance-residual-risk-acceptance` がpassした。結果は `test-results/surveillance-residual-risk-acceptance-run-2026-06-05T09-41-37-339Z.json`。`surveillance` 固定テナントで、リスク詳細から残留リスク受容として `accept` 対応を追加し、理由、CISO責任者、期限を登録したうえで、画面の「完了にする」操作で `risk_treatments.status=completed` にできることを確認した。リスク詳細の残留リスク受容パネルは `未準備` から `準備済み` へ変わり、DBでは `risk.treatment.created` / `risk.treatment.updated` の監査ログまで確認した。これは正式な多段承認ワークフローではなく、既存リスク対応モデルで受容理由・責任者・完了証跡を残せる代表線である。

2026-06-08 10:06 JSTに `npm run qa:surveillance-residual-risk-acceptance` を承認/却下確認まで拡張してpassした。結果は `test-results/surveillance-residual-risk-acceptance-run-2026-06-08T01-06-17-360Z.json`。完了済みの `accept` 対応を残留リスク受容として承認申請し、CISO承認者へ `approval_requests(resource_type=risk_residual_acceptance)` が作られること、承認キューから承認できること、別申請を却下できることを確認した。DBでは `approval_events` の `requested` / `approved` / `rejected`、`risk_treatments.residual_approval_status`、`residual_approved_by`、`residual_approved_at`、`residual_rejection_reason`、`risk.residual_acceptance.*` 監査ログを確認した。残る検証対象は、多段承認、リスクオーナー/経営層を含む承認者ルール細分化、却下後の修正/再申請である。

2026-06-08 10:18 JSTに同じ `npm run qa:surveillance-residual-risk-acceptance` を却下後修正/再申請まで拡張してpassした。結果は `test-results/surveillance-residual-risk-acceptance-run-2026-06-08T01-17-43-602Z.json`。CISOが却下した残留リスク受容について、system_operatorがリスク詳細で管理策リンクを修正すると `risk_treatments.residual_approval_status=draft` に戻り、却下理由が消え、`risk.residual_acceptance.revised` 監査ログが残ることを確認した。その後、同じ画面から再申請し、新しい `approval_requests(resource_type=risk_residual_acceptance)` と `approval_events=requested` が作成され、画面表示が `承認待ち` に戻ることを確認した。再レビュー日は13:41 JSTの後続QAで回収済み。残る検証対象は、多段承認、リスクオーナー/経営層を含む承認者ルール細分化である。

2026-06-10に `npx playwright test tests/e2e/education.spec.ts --grep '教育計画CSVエクスポート' --project=chromium --reporter=line --workers=1` がpassした。教育・訓練管理のCSVエクスポートで、画面の `status` / `search` / `followUp=needs_attention` 条件を `/api/education/export` へ引き継ぎ、CSVに受講記録数、合格数、要フォロー件数、修了率、期限超過、要フォロー状態を含めることを確認した。これにより、継続運用中の教育・訓練フォローアップを画面だけでなく、教育証跡の持ち出し資料としても確認できる代表線ができた。

2026-06-10に `npx playwright test tests/e2e/backup-export.spec.ts --project=chromium --reporter=line --workers=1` がpassした。組織バックアップZIP `/api/export/backup` に、従来の `documents.csv`、`risks.csv`、`tasks.csv` に加えて、`information_assets.csv`、`education_plans.csv`、`education_records.csv`、`audit_plans.csv`、`audit_reports.csv`、`nonconformities.csv`、`corrective_actions.csv`、`follow_up_records.csv`、`management_reviews.csv`、`management_review_actions.csv` とmetadata countsを追加した。これにより、初回登録準備/継続運用の代表データを、画面外で見返せる一括バックアップとして取得できる範囲が広がった。追加で、バックアップ取得は `org_admin` / `system_operator` に限定し、一般メンバーが同一組織のバックアップを取得しようとすると403になることを確認した。

2026-06-10に同じバックアップZIPを拡張し、`document_versions.csv`、`document_approvals.csv`、`task_attachments.csv`、`audit_evidence.csv` を追加対象にした。文書改訂、文書承認、タスク添付、監査証跡ファイルのメタデータをmetadata countsつきで確認できる。さらに取得できるストレージ実体は `files/` 配下へ同梱し、同梱結果や未取得理由を `backup_files_manifest.csv` に残すようにした。ZIP直下には `README.md` を入れ、`metadata.json`、`backup_files_manifest.csv`、`files/` の読み方を利用者が確認できる。対象E2Eではテスト用タスク添付ファイルが本文つきでZIPに含まれることまで確認する。契約終了時の正式な対象範囲、保持/削除手順、復元方法、外部ストレージ連携時のファイル取得保証は引き続きowner decision対象である。

## W-03〜W-05 Surveillance Verification Checklist

| Step | User Action | Expected Evidence | Existing Surface | Current Classification |
| --- | --- | --- | --- | --- |
| 1 | system_operatorで継続運用テナントの監査ダッシュボードを開く | 内部監査計画、FY2026 Q2集計、次アクション、不適合/是正の入口が確認できる | `app/[locale]/audit/page.tsx`, `app/[locale]/audit/nonconformities/page.tsx`, `app/api/audit/route.ts`, `app/api/audit/periods/route.ts`, `qa:surveillance-first-step` | representative_ready。2026-06-04 `qa:surveillance-first-step` がpassし、監査入口、期間集計、不適合/是正表示まで確認 |
| 2 | 是正処置を更新し、フォローアップ状態を確認する | 不適合ステータス、是正処置、フォローアップの更新と監査ログが残る | `audit/nonconformities`, `audit/plans/[planId]`, `AuditService`, `app/api/audit/route.ts`, `qa:surveillance-corrective-action-update`, `qa:surveillance-follow-up-update` | ready。2026-06-05 `qa:surveillance-corrective-action-update` がpassし、不適合ステータス、是正処置、DB永続化、監査ログを確認。2026-06-08 14:24 JSTには是正完了承認の申請/却下/再申請/CISO承認と `verified` 遷移を確認。16:09 JSTには通常タスクではなくCAPAとして扱う境界表示と `corrective_actions.nonconformity_id` 紐づきも確認。16:14 JSTには原因分析、是正方針、再発防止、有効性確認の画面更新とDB永続化も確認。16:20 JSTには不適合に紐づく有効性確認フォローアップのタイトル、状態、期限、担当者をCAPA画面で確認。16:26 JSTにはCAPA画面からフォローアップを直接作成し、DB永続化と `audit.follow_up.created` 監査ログも確認。16:32 JSTにはフォローアップ担当者を選択して `assigned_to` 保存/表示まで確認。2026-06-05 `qa:surveillance-follow-up-update` でフォローアップの完了/検証済み更新、DB永続化、監査ログも確認 |
| 3 | マネジメントレビューを開き、監査/是正の入力情報を確認する | レビュー項目、アクション、監査/是正入力がつながる | `management-reviews`, `qa:surveillance-management-review-input`, `qa:surveillance-management-decision` | representative_ready。2026-06-05 `qa:surveillance-management-review-input` がpassし、レビュー項目/既存アクション表示、議事録/結論/ステータス更新、改善アクション追加、DB永続化、監査ログを確認。`qa:surveillance-management-decision` で経営判断、資源配分、期限付きリスク受容条件をレビュー記録と改善アクションへ残せることも確認 |
| 4 | 年次運用の次アクションをHome/タスク/通知/リスク証跡と照合する | 月次/年次の通知、期限超過、証跡不足が分かる | `home`, `tasks`, `notifications`, `risks/[id]`, `qa:surveillance-home-task-cycle`, `qa:surveillance-overdue-reminder`, `qa:surveillance-evidence-gap` | representative_ready。2026-06-05 `qa:surveillance-home-task-cycle` がpassし、Homeタスク統計、タスクカード遷移、レビュー関連次アクション検索表示を確認。2026-06-05 `qa:surveillance-overdue-reminder` で期限超過の統計/タスク表示、リマインダー通知、送信記録、監査ログ、担当者通知一覧表示も確認。2026-06-05 `qa:surveillance-evidence-gap` でEvidence Vault未準備、対応策不足、管理策リンク不足の表示も確認 |
| 5 | 監査報告書を保存し、承認申請、承認、却下、却下後再申請を確認する | 報告書ステータス、承認キュー、承認イベント、監査ログが残る | `audit/plans/[planId]/report`, `approvals`, `app/api/audit/route.ts`, `app/api/approvals/route.ts`, `qa:surveillance-audit-report-approval` | representative_ready。2026-06-05 `qa:surveillance-audit-report-approval` がpassし、保存、承認申請、CISO承認者解決、承認キューからの承認/却下、DB永続化、承認イベント、監査ログを確認。2026-06-08 14:06 JSTには却下後の本文修正、`draft` 復帰、再申請、CISO承認、`audit.report.revised` 監査ログまで確認 |
| 6 | 監査計画を新規作成し、承認申請、承認、却下、却下後再申請、監査開始を確認する | 計画ステータス、監査チーム、承認キュー、承認イベント、実施開始日、監査ログが残る | `audit/plans/new`, `audit/plans/[planId]`, `approvals`, `app/api/audit/route.ts`, `app/api/approvals/route.ts`, `qa:surveillance-audit-plan-approval` | representative_ready。2026-06-05 `qa:surveillance-audit-plan-approval` がpassし、承認申請、CISO承認者解決、承認キューからの承認/却下、承認時 `scheduled`、却下時 `planning` 維持、DB永続化、承認イベント、監査ログを確認。2026-06-08 13:56 JSTには新規作成、監査チーム登録、却下後説明修正、再申請、CISO承認まで確認。2026-06-08 14:34 JSTには承認済み計画を画面から開始し、`in_progress`、`actual_start_date`、`audit.plan.started` まで確認 |
| 7 | 残留リスク受容をリスク詳細で記録し、完了後に承認申請/承認/却下/修正再申請を確認する | 受容理由、責任者、期限、再レビュー日、完了状態、承認申請、承認/却下、却下後修正、再申請、承認イベント、監査ログが残る | `risks/[id]`, `approvals`, `app/api/risks/[id]/treatments/route.ts`, `app/api/risk-treatments/[id]/route.ts`, `app/api/approvals/route.ts`, `qa:surveillance-residual-risk-acceptance` | representative_ready。2026-06-08 `qa:surveillance-residual-risk-acceptance` がpassし、`accept` 対応の作成、CISO責任者、理由、期限、再レビュー日、完了更新、承認申請、CISO承認、別申請の却下、却下後の管理策リンク修正による `draft` 復帰、再申請、`approval_events`、`risk_treatments.residual_approval_status`、`risk_treatments.residual_review_due_date`、`risk.residual_acceptance.*` 監査ログを確認 |

## W-02 Initial Verification Checklist

| Step | User Action | Expected Evidence | Existing Surface | Current Classification |
| --- | --- | --- | --- | --- |
| 1 | system_operatorでログインし、フェーズ未設定のHomeを開く | `initial` / `surveillance` 選択が表示され、`initial` を保存できる。組織設定で `surveillance` へ変更でき、履歴に `wizard` / `settings` の2件が残る | `app/[locale]/home/page.tsx`, `tests/e2e/phase-selector.spec.ts`, `npm run qa:phase-selector` | ready。2026-06-04 `npm run qa:phase-selector` pass。結果: `test-results/phase-selector-run-2026-06-04T07-43-25-385Z.json` |
| 2 | 組織基本情報を入力する | 業種、従業員数、認証ステータスが保存され、リロード後も残る | `app/[locale]/settings/organization/page.tsx`, `tests/e2e/organization-profile.spec.ts`, `npm run qa:organization-profile` | ready。2026-06-04 `npm run qa:organization-profile` pass。結果: `test-results/organization-profile-run-2026-06-04T07-56-02-212Z.json` |
| 3 | ISMS適用範囲を登録する | 物理拠点、ITシステム、部門、プロセス、除外が保存され、リロード後も残る | `ISMSScopeSettings`, `tests/e2e/isms-scope.spec.ts`, `npm run qa:isms-scope` | ready。2026-06-04 `npm run qa:isms-scope` pass。結果: `test-results/isms-scope-run-2026-06-04T08-01-15-985Z.json` |
| 4 | 体制ロールと担当者を設定する | 必須ロール、担当者、体制履歴が確認できる | `ProjectStructureManager`, `RoleSeedWizardDialog`, `SO-03`, `npm run qa:project-structure` | ready。2026-06-04にAPI境界を修正し、担当者割当、再読込、推奨ロールseed、通知チャネルAPI境界の代表QAがpass |
| 5 | ユーザーを招待し、ロールを付与する | 招待、受諾、membership、権限変更、監査ログが確認できる | `settings/users`, `SO-04`, `OA-01`, `qa:initial-user-lifecycle` | representative_ready。2026-06-04 `qa:initial-user-lifecycle` がpassし、招待作成、受諾、membership、role変更、permission保存、監査ログ、ユーザー管理表示まで確認 |
| 6 | 文書テンプレートから初期文書を作る | 文書が作成され、承認導線へ進める | `documents/new`, `OA-08`, `qa:documents`, `qa:initial-w02-journey` | representative_ready。2026-06-04 `qa:initial-w02-journey` でseed文書表示はpass。テンプレートからの新規作成/承認導線は別QAで継続確認 |
| 7 | 情報資産を登録する | 資産台帳に資産が残り、分類/重要度が保存される | `settings/assets`, `SO-08`, `qa:initial-w02-journey`, `qa:initial-w02-assets-crud`, `qa:assets:csv` | ready。2026-06-05 `qa:initial-w02-assets-crud` で作成、編集、検索、削除、DB永続化がpass。2026-06-10 `qa:assets:csv` でCSVエクスポート、upsertインポート、再エクスポート確認、復元までpass |
| 8 | リスクを登録し評価する | リスク、責任者、評価、対応策、残留リスク準備状況が確認できる | `risks/new`, `risks/[id]/edit`, `OA-03`, `riskOperationalReadiness`, `qa:initial-w02-journey`, `qa:initial-w02-risk-update`, `qa:initial-w02-risk-create` | representative_ready。2026-06-04 `qa:initial-w02-journey` でseedリスク表示とDBリンク存在はpass。2026-06-05 `qa:initial-w02-risk-update` で編集画面からの再評価、DB永続化、評価履歴、監査ログもpass。2026-06-05 `qa:initial-w02-risk-create` で新規リスク作成、情報資産リンク、対応策作成、管理策リンク、監査ログもpass。残留リスク受容は別QAで継続確認 |
| 9 | 管理策テンプレートを適用する | Annex A管理策が追加され、リスク/対応策と接続できる | `settings/controls`, `SO-09`, `qa:initial-w02-journey`, `qa:initial-w02-control-link-update`, `qa:initial-w02-soa-readiness`, `qa:initial-w02-submission-bundle` | representative_ready。2026-06-04 `qa:initial-w02-journey` でseed管理策表示とDBリンク存在はpass。2026-06-05 `qa:initial-w02-control-link-update` で対応策からの管理策リンク編集、DB永続化、監査ログもpass。2026-06-05〜2026-06-08 `qa:initial-w02-soa-readiness` で管理策ページ/APIのSoA準備状況（リンク済み/未リンク、完了対応策数）、管理策単位の `applicable` / `not_applicable`、適用理由、適用除外理由、判断者、判断日時、承認申請、CISO承認、却下後修正/再申請、SoA v1固定、SoA v2差分、版単位の改訂理由保存/表示、SoA版レビュー申請/CISO承認、SoA版レビュー却下後の修正版再発行/CISO承認、承認イベント、監査ログもpass。2026-06-08 `qa:initial-w02-submission-bundle` でSoA v1を審査提出束マニフェスト/ZIP/PDF/UIへ束ねる代表API/監査ログもpassし、PDFの最小構造化、複数ページ化、日本語見出しも確認済み。日本語フォント埋め込み/提出先向けデザインは別QAで継続確認 |
| 10 | 初期タスクを作成し進捗管理する | 担当者、期限、サブタスク、完了率、コメント、タグ、添付、変更履歴が確認できる | `tasks/new`, `tasks/[id]`, `OA-04`, `qa:initial-w02-journey`, `qa:initial-w02-task-progress-update`, `qa:initial-w02-submission-bundle` | representative_ready。2026-06-04 `qa:initial-w02-journey` でseed初期タスク表示はpass。2026-06-05 `qa:initial-w02-task-progress-update` で編集画面からのステータス/進捗更新、DB永続化、監査ログもpass。2026-06-08 15:01 JSTには同QAを拡張し、新規タスク作成、サブタスク作成、サブタスク完了、`task.created` / `task.updated` 監査ログまで確認。15:07 JSTには `qa:initial-w02-submission-bundle` で提出束の `initial_tasks` evidenceに親タスク数、サブタスク数、完了数、未完了数、平均進捗が出ることも確認。15:15 JSTにはコメント投稿、DB永続化、`task.comment.created` 監査ログを確認。15:25 JSTにはタグ作成/付与、DB永続化、`task.tag.created` / `task.tags.updated` 監査ログを確認。15:31 JSTには添付アップロード、DB永続化、`task.attachment.created` 監査ログを確認。15:35 JSTには添付削除、DB削除、`task.attachment.deleted` 監査ログを確認。15:41 JSTには担当者変更、`task_history`、変更履歴タブ表示まで確認。15:49 JSTにはコメント編集/削除、DB更新/削除、`task.comment.updated` / `task.comment.deleted` 監査ログまで確認。15:59 JSTにはコメント内メンションによるアプリ内通知作成と通知一覧表示まで確認 |
| 11 | Homeで次アクションを確認する | Onboarding progress、phase summary、未完了/次アクションが業務順に見える | `home/page.tsx`, `OnboardingService`, `qa:initial-w02-journey` | ready。2026-06-04 `qa:initial-w02-journey` でphase summaryと次アクション表示がpass |

## Execution Order

1. 依存導入済み環境で `npm ci` と `npm run typecheck` を先に通す。
2. `npm run seed:practical-verification -- --reset` を実行し、実務検証用の `initial` / `surveillance` 固定テナントを作り直す。
3. `npm run qa:practical-seed` を実行し、DB内に両ストーリーの主要データと `user_department_scopes` が揃っていることを確認する。
4. 開発サーバーを `E2E_MODE=1 NEXT_PUBLIC_E2E_MODE=1 npm run dev -- --hostname 127.0.0.1 --port 3007` で起動する。
5. `npm run qa:onboarding` を実行し、認証ページ、Dev Login、主要ページを確認する。
6. `npm run qa:phase-selector` を実行し、フェーズ初期化とフェーズ選択を確認する。必要に応じて `npx playwright test tests/e2e/phase-selector.spec.ts --project=chromium --reporter=line` で直接再実行する。
7. `npm run qa:organization-profile` を実行し、組織基本情報の保存、再読込、元値復元を確認する。
8. `npm run qa:isms-scope` を実行し、ISMS適用範囲の5分類保存、再読込、元値復元を確認する。
9. `npm run qa:initial-w02-journey` を実行し、W-02後半のseed存在確認と代表画面導線をまとめて確認する。
10. `npm run qa:initial-user-lifecycle` を実行し、W-02 Step 5の招待、受諾、membership、role、permission、audit logを確認する。
11. `npm run qa:initial-w02-assets-crud` を実行し、W-02 Step 7の情報資産作成、編集、検索、削除、DB永続化を確認する。
12. `npm run qa:assets:csv` を実行し、情報資産CSVのエクスポート、upsertインポート、再エクスポート確認、復元まで確認する。
13. `npm run qa:initial-w02-risk-update` を実行し、W-02 Step 8のリスク評価更新、DB永続化、評価履歴、監査ログを確認する。
14. `npm run qa:initial-w02-risk-create` を実行し、W-02 Step 8の新規リスク作成、情報資産リンク、対応策作成、管理策リンク、監査ログを確認する。
15. `npm run qa:initial-w02-control-link-update` を実行し、W-02 Step 9の対応策-管理策リンク編集、DB永続化、監査ログを確認する。
16. `npm run qa:initial-w02-soa-readiness` を実行し、W-02 Step 9のSoA準備状況表示/API取得、管理策リンク数、完了対応策数、未リンク管理策、管理策単位の適用/除外判断、理由、承認申請、CISO承認、却下後修正/再申請、SoA v1固定、承認イベント、監査ログを確認する。
17. `npm run qa:initial-w02-submission-bundle` を実行し、W-02のISMS適用範囲、体制、承認済み文書、情報資産、リスク、SoA v1、初期タスクが提出束マニフェストとしてreadyになること、初期タスクの親子構造/完了数/未完了数/平均進捗、監査ログ、ZIP/PDF出力、画面確認・ZIP/PDFダウンロード開始を確認する。
18. `npm run qa:initial-w02-task-progress-update` を実行し、W-02 Step 10のタスク進捗更新、担当者変更履歴、新規タスク作成、サブタスク作成/完了、実務判断コメントの投稿/編集/削除、コメントメンション通知、タグ作成/付与、添付アップロード/削除、DB永続化、監査ログを確認する。
19. `npm run qa:surveillance-first-step` を実行し、継続運用テナントの内部監査入口、期間集計、不適合/是正表示を確認する。
20. `npm run qa:surveillance-corrective-action-update` を実行し、W-04 Step 2の不適合/是正更新、CAPAの原因分析/是正方針/再発防止/有効性確認、有効性確認フォローアップの次アクション表示/担当者選択付き直接作成、通常タスクではなくCAPAとして扱う境界表示、是正完了承認の申請/却下/再申請/承認、DB永続化、承認イベント、監査ログを確認する。
21. `npm run qa:surveillance-follow-up-update` を実行し、W-04 Step 2のフォローアップ完了/検証済み更新、DB永続化、監査ログを確認する。
22. `npm run qa:surveillance-management-review-input` を実行し、W-05 Step 3のマネジメントレビュー入力、改善アクション追加、DB永続化、監査ログを確認する。
23. `npm run qa:surveillance-home-task-cycle` を実行し、W-05 Step 4のHomeタスク統計、タスクカード遷移、レビュー関連次アクション表示を確認する。
23. `npm run qa:surveillance-overdue-reminder` を実行し、W-03/W-05の期限超過表示、リマインダー通知、送信記録、監査ログ、担当者通知一覧を確認する。
24. `npm run qa:surveillance-evidence-gap` を実行し、W-03/W-05の証跡不足リスクのEvidence Vault未準備表示を確認する。
25. `npm run qa:surveillance-management-decision` を実行し、W-05の経営判断、資源配分、リスク受容条件のレビュー記録化を確認する。
26. `npm run qa:surveillance-audit-plan-approval` を実行し、W-04の監査計画新規作成、監査チーム登録、承認申請、承認キュー、承認済み化、却下、却下後修正/再申請、承認後の監査開始、承認イベント、監査ログを確認する。
27. `npm run qa:surveillance-audit-report-approval` を実行し、W-04の監査報告書保存、承認申請、承認キュー、承認済み化、却下、却下後修正/再申請、承認イベント、監査ログを確認する。
28. `npm run qa:surveillance-residual-risk-acceptance` を実行し、W-03/W-05の残留リスク受容について、理由、責任者、期限、完了状態、承認申請、CISO承認/却下、却下後修正/再申請、承認イベント、監査ログ、準備済み表示を確認する。
29. `npm run qa:surveillance-submission-bundle` を実行し、W-03〜W-05の年次監査計画、監査報告書、不適合/是正、フォローアップ、マネジメントレビュー、残留リスク受容、監査証跡が提出束マニフェストとしてready/gap表示されること、監査報告書承認後に `audit_reports` がready化すること、不適合/是正とフォローアップ完了後に `nonconformity_corrective_actions` と `follow_up_records` がready化すること、マネジメントレビュー完了後に `management_reviews` がready化すること、残留リスク受容承認後に `residual_risk_acceptances` がready化して7/7 readyになること、ZIP/PDF出力、画面確認、監査ログを確認する。
30. 必要に応じて `npx playwright test tests/e2e/journeys/system-operator-journeys.spec.ts --project=chromium --grep "SO-03|SO-07|SO-08|SO-09" --reporter=line` を実行する。
31. 必要に応じて `npx playwright test tests/e2e/journeys/org-admin-journeys.spec.ts --project=chromium --grep "OA-01|OA-03|OA-04|OA-08" --reporter=line` を実行する。
32. 失敗した最初の1箇所を、仕様不足、実装不足、テスト契約ズレ、環境blocker、事業判断待ちへ分類する。
33. 1回のremediation goalでは、1つの失敗分類だけを直す。

## Seed Baseline

`scripts/seed-practical-verification.mjs` をW-02以降の実務検証seedの正本にする。通常デモseedは汎用デモ用であり、実務検証では以下の固定テナントを使う。

| Scenario | Organization | Phase | Seed Content |
| --- | --- | --- | --- |
| `initial` | `初回登録準備モデル株式会社` | `initial` | 組織、ISMS適用範囲、部門、体制ロール、ユーザー、文書テンプレート、文書、情報資産、リスク、対応策、管理策、初期タスク |
| `surveillance` | `継続運用モデル株式会社` | `surveillance` | 継続運用用の組織、文書、情報資産、リスク、対応策、管理策、月次/内部監査/是正/レビュー系タスク、内部監査計画、監査チーム、チェックリスト、不適合、是正、監査報告、フォローアップ、マネジメントレビュー |

管理者視点の横断確認には `operator.practical@isms-practical.local` を使う。このユーザーは固定IDの `system_operator` で、`initial` と `surveillance` の両方に active membership を持ち、各テナントで `department_scope = all` と文書、リスク、タスク、監査、資産、管理策の全権限を持つ。

- 全件再作成: `npm run seed:practical-verification -- --reset`
- 初回登録準備だけ再作成: `npm run seed:practical-verification -- --reset --scenario initial`
- 継続運用だけ再作成: `npm run seed:practical-verification -- --reset --scenario surveillance`
- seed投入後QA: `npm run qa:practical-seed`
- 継続運用の期限/通知QA: `npm run qa:surveillance-overdue-reminder`
- 継続運用の証跡不足QA: `npm run qa:surveillance-evidence-gap`
- 実行結果: `test-results/practical-verification-seed-*.json`

seedは固定IDで作る。テスト拡張で新しい業務前提が必要になった場合は、このseedに追加し、W-02/W-03/W-04/W-05のどの検証前提かをこの文書へ戻す。

2026-06-04時点で、`surveillance` seedはW-04/W-05の最小確認用に、内部監査計画2件、監査チーム、チェックリスト4件、不適合1件、是正1件、監査報告1件、フォローアップ1件、マネジメントレビュー1件を含む。

2026-06-04時点で、実務検証用の shared system_operator を追加した。QAは同じユーザーIDが2テナントに所属し、両方で全権限を持つことをDBから直接確認する。

2026-06-04時点で、`npm run seed:practical-verification -- --reset` と `npm run qa:practical-seed` はローカルSQLite DBに対してpass済み。QAは固定IDを使い、2組織、体制、文書、資産、リスク、タスク、内部監査、是正、マネジメントレビューの主要件数をDBから直接確認する。

## Known Evidence Gaps

- `docs/05-quality/uc/UC-01-onboarding/qa-plan.md` と `docs/05-quality/qa-uc01-onboarding-operator.md` が参照する `qa:phase-selector` / `qa:phase-selector:reset` は、2026-06-04に現行SQLite/libSQL向けscriptとして復元した。
- `npm run qa:phase-selector` は `scripts/reset-isms-phase.mjs` で `isms_phase` と履歴を初期化し、`tests/e2e/phase-selector.spec.ts` を実行して `test-results/phase-selector-run-*.json` を保存する。
- 2026-06-04 runtime QAで、初回フェーズ選択、Homeのphase summary表示、組織設定での `surveillance` 変更、フェーズ変更履歴の `wizard` / `settings` 表示までpassした。結果: `test-results/phase-selector-run-2026-06-04T07-43-25-385Z.json`。
- 同QAの過程で、Homeのphase summaryがOnboarding progress取得失敗に依存して消える問題と、SQLite repositoryが `organization_phase_history` を保存/取得しない問題を修復した。
- 2026-06-04 runtime QAで、組織基本情報の業種、従業員数、認証ステータスの保存、再読込後の保持、元値復元までpassした。結果: `test-results/organization-profile-run-2026-06-04T07-56-02-212Z.json`。
- `SO-01` は過去のtoast待ち失敗を前提にせず、Step 2専用の `qa:organization-profile` でAPIレスポンスと再読込値を証跡にする。
- 2026-06-04 runtime QAで、ISMS適用範囲の物理拠点、ITシステム、部門、プロセス、除外の保存、再読込後の保持、元値復元までpassした。結果: `test-results/isms-scope-run-2026-06-04T08-01-15-985Z.json`。
- `SO-06` は過去の部分的な画面確認だけでなく、Step 3専用の `qa:isms-scope` で5分類すべてを証跡化する。
- `tests/e2e/phase-selector.spec.ts` は存在するため、Playwrightだけを直接実行することもできる。
- `organizationIsmsPhase` は service層/schema seedともに `initial` / `surveillance` を正本にする。古い `implementation` / `gap_analysis` は実務検証seedでは使わない。
- `surveillance` の内部監査導線は、2026-06-04に `lib/db/repositories/sqlite/AuditPlanRepository.ts` を実装済み `SQLiteAuditPlanRepository` への互換exportへ変更した。runtime containerの既存import pathを維持しつつ、未実装placeholder例外を避ける。
- W-02はページ/APIの存在だけではreadyにしない。保存後の再読込、DB/API、監査ログ、Homeの次アクション表示まで見る。

## Next Routed Goal

```text
/goal Parent Objective: ISMS Pilotを、商用公開前の実務検証版として、未認証企業の初回審査登録準備と、認証済み企業の1年間の継続運用を、自分が利用者・テスターとして試せる状態に近づける。

Target Journey/CAP/Gate:
- W-02 顧客テナントのISMS初期導入
- `initial` 初回審査登録準備ストーリー
- W-03〜W-05 継続運用ストーリーの入口確認
- CAP-04,05,06,08,09,10,11,19,21,25,28
- core_journeys_work / no_open_p0_p1

Source of Truth:
- docs/01-business/spec-dsl/
- docs/02-project/release-readiness/practical-verification-plan.md
- tests/e2e/journeys/system-operator-journeys.spec.ts
- tests/e2e/journeys/org-admin-journeys.spec.ts
- tests/e2e/phase-selector.spec.ts

Current Gap:
- W-02の代表導線、Step 5ユーザーライフサイクル、Step 7情報資産CRUD、方針文書の作成/承認、リスク評価更新、新規リスク/対応策作成、管理策リンク編集、SoA準備状況表示、管理策単位の適用/除外理由保存、SoA判断の承認申請/CISO承認、却下後修正/再申請、SoA v1固定、SoA v2差分、SoA版単位の改訂理由保存/表示、SoA版レビュー申請/CISO承認、SoA版レビュー却下後の修正版再発行/CISO承認、審査提出束マニフェスト/ZIP/PDF/UI、PDF最小構造化、複数ページ化、日本語見出し、タスク進捗更新、担当者変更履歴、新規タスク作成、サブタスク作成/完了、タスクコメント投稿/編集/削除/メンション通知、タスクタグ、タスク添付、提出束内の初期タスク進捗/親子構造表示はpass済み。次段は日本語フォント埋め込み/提出先向けデザインまたは承認者ルール細分化。
- `surveillance` は内部監査入口、監査計画新規作成/監査チーム登録/承認/却下/却下後修正再申請、不適合/是正表示、不適合/是正更新、是正完了承認の申請/却下/却下後再申請/CISO承認、フォローアップ完了/検証済み更新、マネジメントレビュー入力、改善アクション追加、Homeタスク統計/次アクション表示、期限超過表示、リマインダー通知、送信記録、Evidence Vault不足表示、経営判断/資源配分/リスク受容条件のレビュー記録化、残留リスク受容の理由/責任者/再レビュー日/完了証跡/承認申請/CISO承認/却下/却下後修正再申請/責任者本人承認、監査報告書承認/却下/却下後修正再申請、継続運用側提出束ready/gap表示、監査報告書承認、不適合/是正/フォローアップ完了、マネジメントレビュー完了、残留リスク受容承認による提出束7/7 ready化、保証しない注意書き、PDF複数ページ化/日本語見出し、監査ログまでpass済み。残りは多段承認、経営層承認、監査実施開始との深い連動、日本語フォント埋め込み/提出先向けデザイン。

Scope:
- `initial` は代表deep CRUD、新規リスク/対応策作成、SoA準備状況の可視化、管理策単位の適用/除外理由保存、承認申請/CISO承認、却下後修正/再申請、SoA v1固定、SoA v2差分、版単位の改訂理由保存、SoA版レビュー申請/CISO承認、SoA版レビュー却下後の修正版再発行/CISO承認、審査提出束マニフェスト/ZIP/PDF/UI、PDF最小構造化、複数ページ化、日本語見出しが一巡したため、次は日本語フォント埋め込み/提出先向けデザインまたは承認者ルール細分化を小さく実行・分類する。
- 失敗した最初の1箇所を最小修復する。
- 課金、契約終了、保証表現、SaaS復旧責任には広げない。

Done When:
- W-02 deep CRUDまたはsurveillance次段のどこまで使えるかが証跡付きで分類される。
- 最初のblockerが1つ修復されるか、修復不能なら明確に分類される。
- spec-dslとrelease-readiness docsへ結果が反映される。
```
