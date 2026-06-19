---
title: Progress Snapshot 2026-06-08 16:09 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:09 JST
compare_with: progress-snapshot-2026-06-08-160000.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:09 JST

## Summary

前回 2026-06-08 16:00 JST 時点では、W-02初回登録準備のタスクコメントでメンション通知が作成され、通知一覧に表示されるところまで確認した。

今回の差分は、W-04継続運用側の不適合・是正画面で、通常タスクと監査不適合/CAPAの責務分離をユーザーに見える形へ寄せたことである。不適合カードに `CAPA / 監査不適合` 境界表示を追加し、是正処置カードに `CAPA是正処置` 要約、責任者、完了確認者、有効性確認、完了承認状態を表示するようにした。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-04 内部監査・是正 | 93% | 94% | 不適合/CAPAと通常タスクの境界表示を代表QA化 |
| CAP-11 タスク・是正管理 | mostly_ready+ | mostly_ready+ | 汎用タスクとCAPAの分離を画面/DBで確認 |
| CAP-14 不適合・是正 | mostly_ready+ | mostly_ready+ | CAPA要約、責任者、原因、再発防止、完了承認状態を表示 |
| Practical QA evidence | 99% | 99% | `qa:surveillance-corrective-action-update` をCAPA境界確認まで拡張 |

## New Evidence

- Command: `npm run qa:surveillance-corrective-action-update`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1609-surveillance-capa-boundary.json`
- Confirmed: nonconformity status update, corrective action update, CAPA boundary UI, `corrective_actions.nonconformity_id` linkage, no generic `tasks` row for the corrective action id, closure approval request, rejection, resubmission, CISO approval, audit logs

## What This Means

内部監査で出た指摘と是正処置が、単なるタスク管理に埋もれず、監査不適合/CAPAとして扱われていることが画面上でも分かるようになった。

これにより、通常の作業タスクはW-02の準備タスクとして、監査指摘への是正はW-04のCAPAとして、実務検証で見分けやすくなった。

## Remaining Gaps

- 原因分析、再発防止、有効性確認を画面から更新する深いCAPA入力は未確認。
- 多段承認、監査責任者と情報セキュリティ責任者の分離、経営層承認ルールは未確認。
- 日本語フォント埋め込み、PDF提出先向け体裁、W-01〜W-06 full journey suite復旧は継続課題。
