---
title: Progress Snapshot 2026-06-08 16:26 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:26 JST
compare_with: progress-snapshot-2026-06-08-162050.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:26 JST

## Summary

前回 2026-06-08 16:20 JST 時点では、不適合に紐づくフォローアップ記録をCAPA画面に表示し、有効性確認の次アクションとして確認できるようになった。

今回の差分は、CAPA画面から有効性確認フォローアップを直接作成できるようにしたことである。監査計画詳細へ戻らなくても、不適合カード上でタイトル、説明、期限を入力してフォローアップを起票できる。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 95% | 96% | CAPA画面からフォローアップを直接作成できる |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | `nonconformity_id` から監査計画を解決して `follow_up_records` を作成 |
| Practical QA evidence | 99% | 99% | `qa:surveillance-corrective-action-update` をフォローアップ直接作成まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-corrective-action-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1626-surveillance-capa-follow-up-create.json`
- Confirmed: follow-up creation from CAPA screen, audit plan resolution from nonconformity id, DB persistence, follow-up display, `audit.follow_up.created`, closure approval request/reject/resubmit/approve

## What This Means

監査指摘への是正処置を完了した後、その場で有効性確認の次アクションを起票できる。

これにより、内部監査の不適合、是正、完了承認、フォローアップ検証の流れが、画面上でより途切れにくくなった。

## Remaining Gaps

- 再監査要否、再発時エスカレーション、多段承認、監査責任者と情報セキュリティ責任者の分離は未確認。
- フォローアップ担当者の選択、通知、期限リマインダーとの連携は次段。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
