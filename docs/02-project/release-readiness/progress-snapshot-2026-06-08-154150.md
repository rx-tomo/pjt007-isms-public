---
title: Progress Snapshot 2026-06-08 15:41 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 15:41 JST
compare_with: progress-snapshot-2026-06-08-153504.md
status: in_progress
---

# Progress Snapshot 2026-06-08 15:41 JST

## Summary

前回 2026-06-08 15:35 JST 時点では、W-02初回登録準備の追加タスクで添付ファイルの作成/削除が一巡し、監査ログまで確認できる状態になった。

今回の差分は、seed初期タスクの担当者変更を、DB、監査ログ、`task_history`、変更履歴タブで確認できるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 98% | 98% | 初期タスクの担当者変更履歴を確認可能 |
| CAP-11 タスク・是正管理 | mostly_ready+ | mostly_ready+ | `task_history` と変更履歴タブを代表QA化 |
| W-02 browser data boundary | representative_ready+ | representative_ready+ | `/api/tasks/[id]/history` を追加 |
| Practical QA evidence | 99% | 99% | `qa:initial-w02-task-progress-update` を担当者変更履歴まで拡張 |

## New Evidence

- Command: `npm run qa:initial-w02-task-progress-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1541-initial-w02-task-assignee-history.json`
- Confirmed: task status/progress/assignee update, `task.updated`, `task_history` for `assignee_id` / `status` / `progress`, history tab display, task creation, subtask, comment, tag, attachment upload/delete, seed reset

## What This Means

初回登録準備で、タスクを誰に渡したか、進捗やステータスをどう変えたかを後から確認できるようになった。

ISMSの実務では「作業が完了したか」だけでなく「誰が担当し、いつ状態が変わったか」が証跡になるため、タスク履歴が実際に動く意味は大きい。

## Remaining Gaps

- コメントの編集/削除、メンション、通知連動は未確認。
- 監査不適合/CAPAとの責務分離は継続課題。
- 多段承認、承認者ルール細分化、日本語フォント埋め込み/提出先向けデザインは残る。
