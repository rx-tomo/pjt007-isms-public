---
title: Progress Snapshot 2026-06-08 13:13 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 13:13 JST
compare_with: progress-snapshot-2026-06-08-130600.md
status: in_progress
---

# Progress Snapshot 2026-06-08 13:13 JST

## Summary

前回 2026-06-08 13:06 JST 時点では、SoA v2差分版をレビュー申請し、CISOが承認できるところまでだった。

今回の差分は、SoA版レビューをCISOが却下した後、修正版SoA v4を再発行して再レビュー申請し、承認済みにできる代表線を追加したことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 97% | 97% | SoA版レビューの差戻しから修正版承認までを代表QA化 |
| CAP-10 管理策・SoA支援 | 94% | 95% | `soa_versions.review_status=rejected/approved` と版差戻し証跡を確認 |
| CAP-07 承認・差戻し | 少し前進 | 少し前進 | SoA全体版でも却下理由、再発行、再承認を確認 |
| Practical QA evidence | 99% | 99% | `qa:initial-w02-soa-readiness` が版レビュー却下後再発行まで確認 |

## New Evidence

- Command: `npm run qa:initial-w02-soa-readiness`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1313-initial-w02-soa-version-review-reissue.json`
- Confirmed: SoA v3 rejection, rejection reason display, corrected SoA v4 publish, review resubmission, CISO approval, approval events, audit logs

## What This Means

初回登録準備のSoAは、単に発行・承認できるだけでなく、審査前レビューで不備を指摘され、修正版を別版として出し直し、承認証跡を残せる状態に近づいた。実務検証では「差し戻されたときに詰まらないか」を試せる。

## Remaining Gaps

- 本格PDF組版、多段承認、承認者ルール細分化、再レビュー日は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
