---
title: ISMS Fit & Gap Inventory
category: project
created: 2026-05-14
last_updated: 2026-05-14
author: Codex
---

# ISMS Fit & Gap Inventory

## 結論

Goal 2では、CAP-01〜CAP-24にGoal 1で追加されたCAP-25〜CAP-32を加え、現行コードベースとのFit & Gapを棚卸しした。現行実装は、文書、リスク、監査、タスク、教育、供給者、BCPなどの実装資産を広く持つ。一方で、ISMS実務ワークフローで必要な「審査時に説明できる証跡」と「最新QA実行結果」は不足している。

次のGoal 3へ進める。ただし、Goal 3は実装に入らず、まずP0/P1の実装バックログと検証計画を作る必要がある。特にP0は `CAP-02 RBAC/テナント分離` と `CAP-23 セキュリティ検証` である。CAP-28とCAP-29はGoal 1追加CAPだが、リスク管理と審査説明力の中核なのでP1として扱う。

## 判定ルール

| 判定 | 意味 |
| --- | --- |
| 実装済み | コード、画面/API、DB、テスト、QA証跡がそろい、実務ワークフロー上の証跡として説明できる |
| 実装あり未検証 | 実装資産はあるが、最新のQA/一気通貫証跡が不足している |
| docsのみ | docsや計画はあるが、現行コード/QA証跡に十分な裏づけがない |
| 不足 | 必要能力に対して機能、データモデル、証跡、検証のいずれかが明確に不足している |
| 判断待ち | データ保持、保証表現、契約終了時責任など、PO/事業判断が先に必要 |
| 過剰候補 | MVPでは重すぎる、または独立機能化せず既存CAPへ統合すべき |

## CAP別Fit & Gap

| CAP | 判定 | 優先 | 実装/テスト資産 | 実務Gap・次アクション |
| --- | --- | --- | --- | --- |
| CAP-01 テナント作成・初期管理者招待 | 実装あり未検証 | P1 | `lib/services/superAdmin.ts`, `app/[locale]/super-admin/*`, `tests/e2e/super-admin*.spec.ts`, `qa:tenant-provision` | テナント作成後の初期設定、初期管理者招待、監査ログ、契約状態との整合を最新E2Eで証跡化する。 |
| CAP-02 RBAC/テナント分離 | 実装あり未検証 | P0 | `lib/services/permissions.ts`, `lib/server/auth/secureClient.ts`, `tests/e2e/rbac-matrix.spec.ts`, `qa:rbac:matrix` | テナント越境拒否、権限拒否、否定系ログの最新証跡が必須。リリースゲート。 |
| CAP-03 契約/プラン状態管理 | 実装あり未検証/判断待ち | P1 | `lib/db/drizzle/schema/billing.ts`, `lib/services/stripe.ts`, `app/api/stripe/*`, `billing-portal.spec.ts` | 契約変更、契約終了、ロック、再開、保持期間との接続を確認する。CAP-22と事業判断が連動する。 |
| CAP-04 ISMSスコープ・組織体制設定 | 実装あり未検証 | P1 | `organizationIsmsScopes`, `projectRoles`, `projectAssignments`, `settings/organization`, `settings/structure` | 利害関係者、順守義務、除外理由、境界システム、変更履歴まで証跡定義を広げる。 |
| CAP-05 ユーザー招待・権限付与 | 実装あり未検証 | P1 | `organizationInvitations`, `userMemberships`, `app/api/invitations/route.ts`, `invite-acceptance.spec.ts` | 招待、権限変更、退職/無効化、承認/監査ログの通し確認が必要。 |
| CAP-06 文書テンプレート・文書管理 | 実装あり未検証 | P1 | `documents`, `documentVersions`, `documentTemplates`, `lib/services/document.ts`, documents E2E/unit, `qa:documents` | `qa:documents` timeoutが残る。版、承認、改訂理由、適用開始日、出力を実行証跡化する。 |
| CAP-07 承認・差戻し・期限管理 | 実装あり未検証 | P1 | `approvalRequests`, `approvalEvents`, `approvalEscalationRules`, `approval-revert.spec.ts` | 差戻し理由、期限超過、再承認、代理承認の扱いを一気通貫で確認する。 |
| CAP-08 情報資産台帳 | 実装あり未検証 | P2 | `informationAssets`, import/export routes, `scripts/qa-assets-import.js`, asset/control E2E | 資産分類、所有者、棚卸日、変更履歴、リスク接続の最新証跡が不足。 |
| CAP-09 リスク評価・リスク対応 | 実装あり未検証 | P1 | `risks`, `riskTreatments`, `riskAssessmentHistory`, risks E2E, `qa:risks:matrix`, `qa:risks:export` | CAP-28を統合し、リスク基準、受容基準、残留リスク承認まで必須証跡にする。 |
| CAP-10 管理策・SoA支援 | 実装あり未検証/不足 | P2 | `isoControls`, `riskControlLinks`, `controlTemplates`, `settings/controls`, controls template E2E | SoAの適用/不適用理由、運用頻度、例外、関連証跡との接続が弱い。CAP-29と連動。 |
| CAP-11 タスク・是正管理 | 実装あり未検証 | P1 | `tasks`, `taskHistory`, `taskReminders`, `lib/services/task.ts`, `tasks.spec.ts`, `qa:tasks` | 汎用タスク基盤はある。監査不適合/CAPAはCAP-14へ寄せ、重複を避ける。 |
| CAP-12 通知・リマインド・エスカレーション | 実装あり未検証 | P2 | `notifications`, `emailLogs`, notification APIs, `qa:notifications:settings` | 通知失敗、再送、エスカレーション、証跡保存方針が未確認。 |
| CAP-13 内部監査計画・実施・報告 | 実装あり未検証 | P1 | `auditPlans`, `auditChecklists`, `auditEvidence`, `auditReports`, audit E2E/QA/unit | 監査プログラム、独立性、監査員力量、監査証拠、サンプリング、フォローアップ確認が必要。CAP-25の監査員力量をここへ統合する。 |
| CAP-14 不適合・是正フォローアップ | 実装あり未検証 | P1 | `nonconformities`, `correctiveActions`, `followUpRecords`, audit corrective journey | 不適合、原因分析、是正、効果確認、再発防止の通し証跡が不足。 |
| CAP-15 マネジメントレビュー | 実装あり未検証 | P2 | `managementReviews`, `managementReviewItems`, `managementReviewActions`, `management-reviews.spec.ts` | レビュー入力、経営判断、資源配分、改善指示、リスク受容を記録できるか確認する。CAP-27と接続。 |
| CAP-16 インシデント/変更管理 | 実装あり未検証/不足 | P2 | `incidents`, `incidentUpdates`, `incidentLinks`, `bcp.spec.ts` | インシデント、変更管理、復旧/BCPが混在。変更管理はCAP-31、復旧/BCPはCAP-32へ分ける。 |
| CAP-17 証跡検索・監査ログ | 実装あり未検証 | P1 | `auditLogs`, `lib/server/logging/*`, `super-admin/logs`, audit routes | 重要操作ログ、失敗系ログ、検索、保全、エクスポート、改ざん耐性の説明が必要。 |
| CAP-18 エクスポート/ポータビリティ | 実装あり未検証 | P1 | `app/api/export/*`, `lib/utils/exporters/*`, `compare-tenant-export.js`, document/risk/task exporters | 単なる出力ではなく、審査提出パッケージと契約終了時ポータビリティとして確認する。CAP-30と接続。 |
| CAP-19 初期導入ガイド・未完了可視化 | 実装あり未検証 | P1 | `lib/services/onboarding.ts`, `app/[locale]/home/page.tsx`, `settings/setup`, `qa:onboarding` | 初期導入で次に何をすべきか、未完了が見えるか、実操作効率を確認する。 |
| CAP-20 日常運用ダッシュボード | 実装あり未検証 | P2 | `home/*`, `lib/home/roleHomeConfig.ts`, home E2E/QA | KPI、期限、未承認、リスク、監査状態の運用負荷低減を検証する。CAP-27と接続。 |
| CAP-21 AI支援の人手確認・監査ログ | 実装あり未検証 | P1 | `aiSuggestions`, `aiUsageLogs`, `lib/ai/*`, `app/api/ai/*`, AI unit tests | AI高度化より、入力/出力、人手確認、採否、責任境界、ログを最低条件にする。既存unit失敗の復旧が必要。 |
| CAP-22 データ保持・論理削除・契約終了運用 | 判断待ち/実装あり未検証 | P1 | `deletedAt`, `retentionDeleteAt`, `tenantSoftDelete.ts`, `app/api/export/immediate-delete/route.ts` | 保持、削除、復旧、契約終了、サポート調査の責任境界がPO判断待ち。 |
| CAP-23 セキュリティ検証・脆弱性管理 | 不足 | P0 | `scripts/qa-security.js`, `npm run qa:security` | high/critical残存がリリースゲート。修正、到達性評価、リスク受容のいずれかを明示する必要がある。 |
| CAP-24 品質検証・主要ジャーニー確認 | 不足 | P1 | lint/typecheck/unit/E2E/QA scripts, `release-readiness:score` | unit失敗、E2E browser未整備、documents QA timeoutが残る。最新証跡がない。 |
| CAP-25 教育・力量・認識管理 | 実装あり未検証/一部統合 | P2 | `educationPlans`, `educationRecords`, `educationMaterials`, education pages/APIs, `education.spec.ts` | 独立LMS化は後続。内部監査員力量はCAP-13へ統合し、教育計画/受講/力量記録はP2で検証する。 |
| CAP-26 供給者/クラウド/サプライチェーン管理 | 実装あり未検証 | P2 | `suppliers`, `supplierAssessments`, `supplierContracts`, `supplierIncidents`, `suppliers.spec.ts` | 採用。ただしMVPは軽量台帳、契約要求、評価日、関連リスク、定期レビューに絞る。 |
| CAP-27 情報セキュリティ目的・KPI・監視測定 | 不足/docsのみ寄り | P2 | home KPI/metrics, usage tracking, management review assets | 独立機能化せず、CAP-15とCAP-20へ統合する。情報セキュリティ目的/KPI専用モデルは見当たらない。 |
| CAP-28 リスク基準・残留リスク受容 | 一部実装/不足 | P1 | `riskCriteria`, `riskTreatments.treatmentType=accept`, risk history, `lib/utils/riskOperationalReadiness.ts`, risk detail readiness panel | 2026-05-15に残留リスク受容の不足可視化を追加。CAP-09へ統合し必須化する。正式な承認履歴/レビュー履歴はまだ弱い。 |
| CAP-29 管理策運用証跡・Evidence Vault | 一部実装/不足 | P1 | `auditEvidence`, document evidence assets, storage routes, audit logs, `riskControlLinks`, risk detail readiness panel | 2026-05-15に対応策-管理策リンクのEvidence Vault準備状況を追加。CAP-10/17/18と役割分担する。管理策別の所有者、期間、承認、関連リスク束/提出出力は不足。 |
| CAP-30 外部審査・サーベイランス証跡パッケージ | 実装あり未検証/判断待ち | P2 | `auditType=certification/surveillance`, `auditReports`, export routes | CAP-18へ統合し、MVPは証跡束エクスポートまで。保証範囲は事業判断待ち。 |
| CAP-31 変更管理・構成変更影響評価 | 不足 | P2 | approval/revision/incident/review/action assets | CAP-16から分離採用。変更要求、影響評価、承認、実施記録、ロールバック/周知の専用能力が不足。 |
| CAP-32 バックアップ・復旧・事業継続証跡 | 実装あり未検証/判断待ち | P2 | `bcpPlans`, `bcpDrills`, `bcpRecoveryObjectives`, bcp pages/APIs, `bcp.spec.ts` | 顧客ISMSのBCP記録とSaaS自身のバックアップ/復旧責任を分ける。扱う深さは事業判断待ち。 |

## 優先度別バックログ候補

| 優先 | 対象CAP | バックログ候補 |
| --- | --- | --- |
| P0 | CAP-02, CAP-23 | RBAC/テナント分離の否定E2Eとログ証跡を復旧する。`qa:security` high/criticalを修正、到達性評価、または明示的リスク受容でゲート解除する。 |
| P1 | CAP-01, 03, 04, 05, 06, 07, 09, 11, 13, 14, 17, 18, 19, 21, 22, 24, 28, 29 | 主要ISMS導線を最新証跡ありに変える。unit/E2E/QAの失敗を復旧し、リスク基準/残留リスク承認とEvidence Vaultを審査説明可能な形へ設計する。 |
| P2 | CAP-08, 10, 12, 15, 16, 20, 25, 26, 27, 30, 31, 32 | MVPに含める最小範囲と後続化する範囲を分ける。教育、供給者、KPI、変更管理、BCPは実務上重要だが、リリースゲートより後に扱う。 |
| P3 | 高度AI、外部連携高度化、スクリーンショット/多言語マニュアル補強、詳細LMS、詳細サプライチェーン分析 | P0/P1が解除された後の完成度向上。 |

## CAP-25〜CAP-32の採用方針

| CAP | 方針 | 理由 |
| --- | --- | --- |
| CAP-25 | 一部統合 + 後続化 | 教育計画/受講記録は既存実装あり。監査員力量だけCAP-13へ統合し、独立LMS化は後続。 |
| CAP-26 | 採用 | 供給者/クラウド管理はISMS実務上重要。MVPは軽量台帳とレビュー記録に絞る。 |
| CAP-27 | CAP-15/CAP-20へ統合 | 独立機能化すると過剰。経営レビュー入力とダッシュボードKPIとして扱う。 |
| CAP-28 | CAP-09へ統合、P1 | リスク評価の中核。残留リスク受容まで含めないと審査説明力が弱い。 |
| CAP-29 | 採用、P1 | SoA、監査ログ、エクスポートをつなぐ証跡基盤。審査説明力に直結する。 |
| CAP-30 | CAP-18へ統合 + 後続強化 | MVPは証跡束エクスポートまで。サーベイランス履歴や保証表現は後続/判断待ち。 |
| CAP-31 | CAP-16から分離採用 | インシデントと変更管理は実務が違う。変更要求、影響評価、承認、ロールバックを独立定義する。 |
| CAP-32 | 判断待ち + 後続化 | 顧客ISMSのBCP支援とSaaS自身の復旧責任が混ざりやすい。扱う深さをPO判断する。 |

## 事業判断待ち

- 認証取得支援と表現するか、ISMS運用・証跡管理支援に留めるか。
- CAP-22の保持、削除、復旧、契約終了、サポート調査の責任境界。
- CAP-26のMVP範囲を、軽量台帳だけにするか、契約要求/定期レビューまで含めるか。
- CAP-30の審査提出パッケージに保証ニュアンスを持たせるか。
- CAP-32で顧客のBCP/復旧証跡まで扱うか、テンプレート/記録欄に留めるか。

## Goal 3への引き継ぎ

Goal 3へ進める。Goal 3では実装に入らず、次を計画へ落とす。

1. P0: CAP-02とCAP-23を最優先のリリースゲートとして扱う。
2. P1: unit失敗、Playwright/E2E環境、`qa:documents` timeoutを品質土台として扱う。
3. CAP-28/CAP-29は追加CAPだがP1へ昇格し、CAP-09/CAP-10/CAP-17/CAP-18との統合設計を行う。2026-05-15にリスク詳細へ不足可視化を追加したため、次段は正式承認履歴と監査提出束の実装に絞る。
4. CAP-22/CAP-30/CAP-32は実装計画から分離し、事業判断待ちとして扱う。
5. CAP-25〜CAP-32は独立実装前に、採用/統合/後続化/判断待ちの方針をバックログに反映する。
