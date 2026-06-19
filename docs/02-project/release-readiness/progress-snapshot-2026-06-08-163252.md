---
title: Progress Snapshot 2026-06-08 16:32 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:32 JST
compare_with: progress-snapshot-2026-06-08-162641.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:32 JST

## Summary

前回 2026-06-08 16:26 JST 時点では、CAPA画面から有効性確認フォローアップを直接作成できるようになった。

今回の差分は、そのフォローアップに担当者を選択できるようにしたことである。組織メンバーを取得し、CAPA画面のフォローアップ作成フォームで担当者を選び、`follow_up_records.assigned_to` に保存する。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 96% | 96% | 有効性確認フォローアップの担当者選択を代表QA化 |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | CAPAから担当者付きフォローアップを起票可能 |
| Practical QA evidence | 99% | 99% | `qa:surveillance-corrective-action-update` を担当者選択まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-corrective-action-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1632-surveillance-capa-follow-up-assignee.json`
- Confirmed: assignee select from organization users, `follow_up_records.assigned_to`, follow-up display, `audit.follow_up.created`, closure approval request/reject/resubmit/approve

## What This Means

CAPAの有効性確認を、誰がいつ確認するかまでその場で起票できるようになった。

これにより、内部監査の指摘から是正、完了承認、フォローアップ担当割当までが、実務検証上の一連の操作としてつながった。

## Remaining Gaps

- フォローアップ担当者への通知、期限リマインダー、再監査要否、再発時エスカレーションは未確認。
- 多段承認、監査責任者と情報セキュリティ責任者の分離は未確認。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
