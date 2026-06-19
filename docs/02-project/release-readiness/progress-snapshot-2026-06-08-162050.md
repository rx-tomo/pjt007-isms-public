---
title: Progress Snapshot 2026-06-08 16:20 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:20 JST
compare_with: progress-snapshot-2026-06-08-161424.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:20 JST

## Summary

前回 2026-06-08 16:14 JST 時点では、CAPAの原因分析、是正方針、再発防止、有効性確認を画面から更新できるようになった。

今回の差分は、不適合に紐づくフォローアップ記録をCAPA画面に表示し、有効性確認の次アクションとして確認できるようにしたことである。既存の `follow_up_records` を使い、DB追加なしでタイトル、状態、期限、担当者を表示する。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 95% | 95% | 有効性確認フォローアップの次アクション表示を代表QA化 |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | `follow_up_records.nonconformity_id` をCAPA画面へ接続 |
| Practical QA evidence | 99% | 99% | `qa:surveillance-corrective-action-update` をフォローアップ表示まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-corrective-action-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1620-surveillance-capa-follow-up-summary.json`
- Confirmed: follow-up records linked by nonconformity id, follow-up title/status/due date/assignee display on CAPA screen, CAPA updates, closure approval request/reject/resubmit/approve

## What This Means

CAPA完了後に「次に有効性をどう確認するか」が、不適合画面の中で見えるようになった。

これにより、監査指摘、是正処置、完了承認、フォローアップ検証の流れが画面上でもつながり、継続運用の内部監査ストーリーをより自然に試せる。

## Remaining Gaps

- 再監査要否、再発時エスカレーション、多段承認、監査責任者と情報セキュリティ責任者の分離は未確認。
- フォローアップ新規作成は監査計画詳細側で確認済みだが、不適合一覧から直接作成する導線は未実装。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
