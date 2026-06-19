---
title: Gates
category: business
last_updated: 2026-06-08
status: partially_confirmed
---

# Gates

Release candidateは、scoreが90以上で、required gatesがすべてpassの場合のみ成立する。

2026-06-04以降の当面の親目標は商用公開ではなく実務検証版である。ただし、セキュリティ、テナント分離、認証・認可、主要業務ジャーニー、P0/P1残件は、実務検証でも妥協しない安全ゲートとして扱う。

| Gate ID | Business Meaning | Current Status | Evidence | Blocking Gap |
| --- | --- | --- | --- | --- |
| no_high_or_critical_security_issue | 高/重大セキュリティ問題が未処理で残っていない | pass | 2026-05-15 `npm run qa:security`: critical 0 / high 0 / OSV 0 | なし。ただしdocsの旧fail記述は更新対象。 |
| no_cross_tenant_access | テナント越境アクセスがない | pass | `qa:rbac:matrix` 34 passed、tenant API isolation 2 passed | W-01〜W-06内で監査ログ・業務証跡としての確認は未実行。 |
| no_critical_authz_gap | 認証・認可の重大不備がない | unknown | route guard、RBAC、tenant isolationは確認済み | 本番 `BETTER_AUTH_SECRET` / auth originの設定証跡が未確認。 |
| core_journeys_work | 主要業務ジャーニーが成立する | fail for commercial release / partial_verified for practical verification | smoke/documents/unitはpass。2026-05-15 full journey suiteは52 failed / 3 passed / 2 skipped。2026-06-04〜2026-06-08の実務検証QAでは、W-02 initial代表deep CRUD、SoA v1固定、初回審査提出束マニフェスト/ZIP/PDF/UI、W-03〜W-05 surveillance代表操作が複数pass。監査計画、監査報告書、残留リスク受容の承認/却下/却下後修正再申請、継続運用側提出束ready/gap表示も代表QA済み。提出束PDFは複数ページ化、日本語見出し、ページフッターまで代表QA済み。 | 商用release gateとしてのW-01〜W-06 full journey suiteは未復旧。実務検証版では、残る主Gapを多段承認/承認者ルール細分化、継続運用側提出束の不足項目ready化、日本語フォント埋め込み/提出先向けデザインへ絞る。 |
| no_open_p0_p1 | P0/P1が未処理で残っていない | fail | security P0は解消。P1 test debt/本番auth設定/業務journey gapsが残る。実務検証ではW-02/W-03/W-04/W-05の代表QAが進展し、初回/継続運用の提出束マニフェスト/ZIP/PDF/UI、残留リスク受容の承認/却下/却下後修正再申請もpass。提出束PDFは複数ページ化、日本語見出し、ページフッターまで代表QA済み。 | 本番auth設定確認、runner一時除外test debt整理、多段承認/承認者ルール細分化、継続運用側提出束の不足項目ready化、日本語フォント埋め込み/提出先向けデザイン。 |

## Practical Verification Gate Overlay

商用公開release gateとは別に、現在の親目標では次の実務検証overlayを使う。

| Practical Gate | Current Status | Evidence | Remaining Gap |
| --- | --- | --- | --- |
| initial_w02_representative_deep_crud | representative_ready | `qa:phase-selector`, `qa:organization-profile`, `qa:isms-scope`, `qa:project-structure`, `qa:initial-w02-journey`, `qa:initial-user-lifecycle`, `qa:initial-w02-assets-crud`, `qa:initial-w02-document-approval`, `qa:initial-w02-risk-update`, `qa:initial-w02-risk-create`, `qa:initial-w02-control-link-update`, `qa:initial-w02-soa-readiness`, `qa:initial-w02-submission-bundle`, `qa:initial-w02-task-progress-update` | 承認者ルール細分化、日本語フォント埋め込み/提出先向けデザイン |
| surveillance_yearly_cycle_representative | partial_verified | `qa:surveillance-first-step`, `qa:surveillance-corrective-action-update`, `qa:surveillance-follow-up-update`, `qa:surveillance-management-review-input`, `qa:surveillance-home-task-cycle`, `qa:surveillance-overdue-reminder`, `qa:surveillance-evidence-gap`, `qa:surveillance-management-decision`, `qa:surveillance-residual-risk-acceptance`, `qa:surveillance-audit-plan-approval`, `qa:surveillance-audit-report-approval`, `qa:surveillance-submission-bundle` | 多段承認、提出束内gapのready化、経営層承認 |

## Gate Update Rule

- Gate statusは `docs/02-project/release-readiness/scoring-model.yaml` を機械判定の正本にする。
- 本ファイルは、Gateの業務意味、CAP/Workflowとの対応、次Goal設計の補助に使う。
- `pass` は証跡がある場合のみ。判断待ちや未実行は `unknown` または `fail` にする。
