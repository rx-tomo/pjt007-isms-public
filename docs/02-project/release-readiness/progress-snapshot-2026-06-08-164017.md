---
title: Progress Snapshot 2026-06-08 16:40 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:40 JST
compare_with: progress-snapshot-2026-06-08-163252.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:40 JST

## Summary

前回 2026-06-08 16:32 JST 時点では、CAPA画面から有効性確認フォローアップを担当者付きで作成できるようになった。

今回の差分は、その担当者へアプリ内通知を作り、担当者本人の通知一覧で確認できるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 96% | 97% | CAPAフォローアップ担当者への通知を代表QA化 |
| CAP-12 通知・リマインド | partial | partial+ | タスクリマインダーに加え、CAPA担当割当通知も確認済み |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | CAPA作成後に担当者が気づける導線を追加 |
| Practical QA evidence | 99% | 99% | `qa:surveillance-corrective-action-update` を通知一覧表示まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-corrective-action-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1640-surveillance-capa-follow-up-assignee-notification.json`
- Confirmed: CAPA follow-up creation with assignee, `notifications.type=info`, `metadata.follow_up_record_id`, `metadata.nonconformity_id`, assignee notification center display, closure approval request/reject/resubmit/approve

## What This Means

CAPAの有効性確認を起票した後、担当者が通知センターで自分の対応事項として気づけるようになった。

内部監査の指摘から是正、フォローアップ担当割当、担当者通知、完了承認までの実務検証線がより自然につながった。

## Remaining Gaps

- CAPAフォローアップの期限リマインダー、再監査要否、再発時エスカレーションは未確認。
- 多段承認、監査責任者と情報セキュリティ責任者の分離は未確認。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
