---
title: Progress Snapshot 2026-06-08 16:51 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:51 JST
compare_with: progress-snapshot-2026-06-08-164651.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:51 JST

## Summary

前回 2026-06-08 16:46 JST 時点では、未完了CAPAフォローアップの期限が近づいたときに担当者へ期限リマインダーを作れるようになった。

今回の差分は、期限を過ぎたCAPAフォローアップを別の期限超過通知として扱い、通知と監査ログを期限前リマインダーから分けて残せるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 97% | 97% | CAPAフォローアップ期限超過通知を代表QA化 |
| CAP-12 通知・リマインド | partial+ | partial+ | 期限前/期限超過のCAPA通知を区別できる |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | 期限超過フォローアップを `audit.follow_up.overdue_reminder_sent` で監査可能にした |
| Practical QA evidence | 99% | 99% | `qa:surveillance-overdue-reminder` を期限超過CAPA通知まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-overdue-reminder`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1651-surveillance-follow-up-overdue-reminder.json`
- Confirmed: task overdue display, task due reminder, CAPA follow-up due reminder, CAPA follow-up overdue reminder, `audit.follow_up.reminder_sent`, `audit.follow_up.overdue_reminder_sent`, assignee notification center display

## What This Means

CAPAフォローアップは、期限前の注意と期限超過後の例外を別々の通知・監査ログとして扱えるようになった。

実務検証では、是正フォローアップが未完了のまま埋もれるリスクを見つけやすくなった。

## Remaining Gaps

- CAPAフォローアップの再監査要否、再発時エスカレーション、管理者/責任者への段階的通知は未確認。
- 多段承認、監査責任者と情報セキュリティ責任者の分離は未確認。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
