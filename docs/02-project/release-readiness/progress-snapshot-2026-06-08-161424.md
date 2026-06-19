---
title: Progress Snapshot 2026-06-08 16:14 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:14 JST
compare_with: progress-snapshot-2026-06-08-160953.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:14 JST

## Summary

前回 2026-06-08 16:09 JST 時点では、不適合・是正画面で通常タスクと監査不適合/CAPAの境界が見えるようになり、DB上も `corrective_actions.nonconformity_id` で不適合に紐づくことを確認した。

今回の差分は、CAPAの深掘り項目を画面から更新できるようにしたことである。不適合カードで原因分析、是正方針、再発防止を編集でき、是正処置カードで有効性確認を編集できる。QAではDB永続化、画面要約、監査ログまで確認した。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 94% | 95% | CAPAの原因分析/再発防止/有効性確認入力を代表QA化 |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | `root_cause` / `corrective_action` / `preventive_action` / `effectiveness_review` を画面更新可能にした |
| Practical QA evidence | 99% | 99% | `qa:surveillance-corrective-action-update` をCAPA深掘り項目まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-corrective-action-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1614-surveillance-capa-deep-fields.json`
- Confirmed: root cause update, corrective action plan update, preventive action update, effectiveness review update, DB persistence, CAPA summary display, audit logs, closure approval request/reject/resubmit/approve

## What This Means

監査指摘を「完了にする」だけでなく、なぜ起きたのか、どう直すのか、再発をどう防ぐのか、完了確認時に何を見たのかを、CAPAの文脈で残せるようになった。

これにより、継続運用ストーリーの内部監査・是正は、実務検証でかなり具体的に試せる状態へ近づいた。

## Remaining Gaps

- 多段承認、監査責任者と情報セキュリティ責任者の分離、経営層承認ルールは未確認。
- CAPAの有効性確認期限、再監査要否、再発時のエスカレーションは未整理。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
