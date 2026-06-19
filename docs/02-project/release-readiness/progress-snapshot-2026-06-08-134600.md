---
title: Progress Snapshot 2026-06-08 13:46 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 13:46 JST
compare_with: progress-snapshot-2026-06-08-132900.md
status: in_progress
---

# Progress Snapshot 2026-06-08 13:46 JST

## Summary

前回 2026-06-08 13:29 JST 時点では、残留リスク受容の承認者を一律CISOにせず、受容対応の責任者本人へ承認依頼できることまで確認した。

今回の差分は、残留リスク受容に `residual_review_due_date` を追加し、リスク詳細での入力/表示、準備状況判定、承認申請前必須条件、提出束のready判定までつなげたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-03〜W-05 継続運用 | 90% | 91% | 残留リスク受容の再レビュー日を代表QA化 |
| CAP-28 リスク基準・残留リスク受容 | 85% | 87% | `risk_treatments.residual_review_due_date` を保存/表示/申請前必須に追加 |
| 年次証跡提出束 | 88% | 89% | 承認済み残留リスク受容に再レビュー日がある場合に `residual_risk_acceptances` readyと判定 |

## New Evidence

- Command: `npm run qa:surveillance-residual-risk-acceptance`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1341-surveillance-residual-risk-review-due-date.json`
- Confirmed: residual review due date input, persistence, UI display, readiness status, approval-request gate, responsible approver approval detail
- Additional command: `npm run qa:surveillance-submission-bundle`
- Confirmed: `residual_risk_acceptances` uses approved residual acceptances with review due dates, and evidence includes `review_due_dates:1`

## What This Means

残留リスク受容が、単なる「受け入れた」という承認記録だけでなく、「いつ見直すか」まで運用証跡として残せるようになった。継続運用の1年サイクルで、受容済みリスクを放置せず次回レビュー対象に戻す説明力が上がった。

## Remaining Gaps

- 多段承認、経営層承認は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- 日本語フォント埋め込み、提出先向けデザイン品質は未確認。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
