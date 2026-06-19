---
title: Progress Snapshot 2026-06-08 15:50 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 15:50 JST
compare_with: progress-snapshot-2026-06-08-154150.md
status: in_progress
---

# Progress Snapshot 2026-06-08 15:50 JST

## Summary

前回 2026-06-08 15:41 JST 時点では、W-02初回登録準備のseed初期タスクで担当者変更、`task_history`、変更履歴タブ表示まで確認できる状態になった。

今回の差分は、追加タスクに残した実務判断コメントを編集し、不要になったコメントを削除できることを、画面、DB、監査ログで確認したことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 98% | 98% | 初期タスクのコメント編集/削除を確認可能 |
| CAP-11 タスク・是正管理 | mostly_ready+ | mostly_ready+ | `task.comment.updated` / `task.comment.deleted` を代表QA化 |
| W-02 browser data boundary | representative_ready+ | representative_ready+ | `/api/tasks/[id]/comments` をPATCH/DELETEまで拡張 |
| Practical QA evidence | 99% | 99% | `qa:initial-w02-task-progress-update` をコメント編集/削除まで拡張 |

## New Evidence

- Command: `npm run qa:initial-w02-task-progress-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1549-initial-w02-task-comment-edit-delete.json`
- Confirmed: task status/progress/assignee update, task history, task creation, subtask, comment post/edit/delete, tag, attachment upload/delete, audit logs, seed reset

## What This Means

初回登録準備のタスク運用で、コメントを一度投稿して終わりではなく、実務判断の補足や誤記修正、不要コメントの削除まで画面から扱えるようになった。

ISMSの実務では、判断メモの修正や削除も「いつ誰が変えたか」を説明できる必要があるため、コメント操作の監査ログが残る意味は大きい。

## Remaining Gaps

- メンション、通知連動は未確認。
- 監査不適合/CAPAとの責務分離は継続課題。
- 多段承認、承認者ルール細分化、日本語フォント埋め込み/提出先向けデザインは残る。
