---
title: Progress Snapshot 2026-06-08 13:29 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 13:29 JST
compare_with: progress-snapshot-2026-06-08-132200.md
status: in_progress
---

# Progress Snapshot 2026-06-08 13:29 JST

## Summary

前回 2026-06-08 13:22 JST 時点では、提出束PDFの複数ページ化と日本語見出しまで確認した。

今回の差分は、残留リスク受容の承認者を一律CISOにせず、受容対応の責任者が設定されている場合は責任者本人へ承認依頼できるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-03〜W-05 継続運用 | 90% | 90% | 残留リスク受容で責任者本人承認を代表QA化 |
| CAP-28 リスク基準・残留リスク受容 | 82% | 85% | CISO代表ルールに加えて `responsible_id` 優先の承認者解決を追加 |
| 承認責任整理 | 60% | 64% | `approver` ロール本人の承認キューで受容承認できることを確認 |

## New Evidence

- Command: `npm run qa:surveillance-residual-risk-acceptance`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1329-surveillance-residual-risk-acceptance-responsible-approver.json`
- Confirmed: residual acceptance responsible approver resolution, approver queue visibility, approval by responsible approver, approval events, treatment approval state

## What This Means

残留リスク受容が「全部CISOに投げる」だけでなく、対応責任者が明確な場合にその本人へ承認依頼できるようになった。実務検証では、リスクオーナーや部門責任者が承認に関わる運用を試しやすくなった。

## Remaining Gaps

- 多段承認、経営層承認、再レビュー日は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- 日本語フォント埋め込み、提出先向けデザイン品質は未確認。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
