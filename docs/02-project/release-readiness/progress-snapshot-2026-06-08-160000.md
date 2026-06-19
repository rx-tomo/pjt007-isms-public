---
title: Progress Snapshot 2026-06-08 16:00 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:00 JST
compare_with: progress-snapshot-2026-06-08-155000.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:00 JST

## Summary

前回 2026-06-08 15:50 JST 時点では、W-02初回登録準備の追加タスクでコメント編集/削除を画面、DB、監査ログで確認できる状態になった。

今回の差分は、コメント内で同一組織ユーザーをメンションしたときに、メンションされたユーザーへアプリ内通知が作られ、通知一覧に表示されるところまで確認したことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 98% | 98% | 初期タスクのコメントメンション通知を確認可能 |
| CAP-11 タスク・是正管理 | mostly_ready+ | mostly_ready+ | タスクコメントから通知センターへの連動を代表QA化 |
| W-02 browser data boundary | representative_ready+ | representative_ready+ | `/api/tasks/[id]/comments` から `notifications` 作成まで接続 |
| Practical QA evidence | 99% | 99% | `qa:initial-w02-task-progress-update` をメンション通知まで拡張 |

## New Evidence

- Command: `npm run qa:initial-w02-task-progress-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1559-initial-w02-task-mention-notification.json`
- Confirmed: task status/progress/assignee update, task history, task creation, subtask, comment post/edit/delete, mention notification, notification center display, tag, attachment upload/delete, audit logs, seed reset

## What This Means

初回登録準備のタスクコメントで、関係者に作業確認を促す導線ができた。

「コメントを書いたが相手が気づかない」という実務上の詰まりを少し減らし、担当者変更やコメント履歴と合わせて、初回登録準備タスクを人に渡して進める感触が上がった。

## Remaining Gaps

- 監査不適合/CAPAとの責務分離は継続課題。
- 多段承認、承認者ルール細分化、日本語フォント埋め込み/提出先向けデザインは残る。
