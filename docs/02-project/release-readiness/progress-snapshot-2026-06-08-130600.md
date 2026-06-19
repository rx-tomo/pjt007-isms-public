---
title: Progress Snapshot 2026-06-08 13:06 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 13:06 JST
compare_with: progress-snapshot-2026-06-08-125700.md
status: in_progress
---

# Progress Snapshot 2026-06-08 13:06 JST

## Summary

前回 2026-06-08 12:57 JST 時点では、SoA版を発行するときに改訂理由を保存し、API、snapshot、管理策画面で確認できるところまでだった。

今回の差分は、SoA v2差分版をレビュー申請し、承認キューで `SoA版レビュー` としてCISOが承認できる代表線を追加したことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 96% | 97% | SoA版レビュー申請/CISO承認を代表QA化 |
| CAP-10 管理策・SoA支援 | 93% | 94% | `soa_versions.review_status` と承認キュー接続を追加 |
| CAP-07 承認・差戻し | 代表範囲あり | 少し前進 | 管理策単位だけでなくSoA全体版も承認対象化 |
| Practical QA evidence | 99% | 99% | `qa:initial-w02-soa-readiness` が版レビュー承認まで確認 |

## New Evidence

- Command: `npm run qa:initial-w02-soa-readiness`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1306-initial-w02-soa-version-review-approval.json`
- Confirmed: SoA v2 review submit, `approval_requests.resource_type=soa_version`, approval queue label, CISO approval, `soa_versions.review_status=approved`, approval events, audit logs

## What This Means

SoAの版を「発行しただけ」で終わらせず、審査前レビューとして承認キューに載せ、情報セキュリティ責任者/CISO相当が承認した証跡を残せるようになった。初回登録準備の説明可能性は、管理策単位の判断からSoA全体版のレビューまで一段つながった。

## Remaining Gaps

- SoA版レビューの却下後修正/再申請は未確認。
- 本格PDF組版、多段承認、承認者ルール細分化、再レビュー日は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
