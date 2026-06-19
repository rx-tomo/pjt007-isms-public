---
title: Progress Snapshot 2026-06-08 16:46 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:46 JST
compare_with: progress-snapshot-2026-06-08-164017.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:46 JST

## Summary

前回 2026-06-08 16:40 JST 時点では、CAPAフォローアップを担当者付きで作成したときに、担当者へアプリ内通知が届くところまで確認した。

今回の差分は、未完了CAPAフォローアップの期限が近づいたときに、担当者へ期限リマインダーを作り、通知一覧で確認できるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 97% | 97% | CAPAフォローアップ期限リマインダーを代表QA化 |
| CAP-12 通知・リマインド | partial+ | partial+ | タスク期限リマインダーに加えてCAPAフォローアップ期限通知も確認済み |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | フォローアップ担当割当後の見落とし防止導線を追加 |
| Practical QA evidence | 99% | 99% | `qa:surveillance-overdue-reminder` をCAPAフォローアップ期限通知まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-overdue-reminder`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1646-surveillance-follow-up-due-reminder.json`
- Confirmed: task overdue display, task due reminder, CAPA follow-up due reminder, `audit.follow_up.reminder_sent`, assignee notification center display

## What This Means

CAPAフォローアップは、起票時の担当通知だけでなく、期限が近づいたときにも担当者が気づけるようになった。

内部監査の指摘から是正、フォローアップ担当割当、期限リマインダー、完了承認までの運用線が少し実務に近づいた。

## Remaining Gaps

- CAPAフォローアップの再監査要否、再発時エスカレーション、期限超過後の段階的通知は未確認。
- 多段承認、監査責任者と情報セキュリティ責任者の分離は未確認。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
