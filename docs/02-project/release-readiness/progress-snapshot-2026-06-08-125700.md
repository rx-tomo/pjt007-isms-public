---
title: Progress Snapshot 2026-06-08 12:57 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 12:57 JST
compare_with: progress-snapshot-2026-06-08-124800.md
status: in_progress
---

# Progress Snapshot 2026-06-08 12:57 JST

## Summary

前回 2026-06-08 12:48 JST 時点では、SoA v1固定後にSoA v2を発行し、前版との差分をAPIと画面で確認できるところまでだった。

今回の差分は、SoA版を発行するときに「なぜその版を発行したか」を版単位の改訂理由として保存し、API、snapshot、管理策画面で確認できるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 96% | 96% | SoA版の改訂理由を保存/表示できるようにした |
| CAP-10 管理策・SoA支援 | 92% | 93% | v1/v2版履歴に `change_summary` を追加 |
| Practical QA evidence | 98% | 99% | `qa:initial-w02-soa-readiness` が改訂理由まで確認 |

## New Evidence

- Command: `npm run qa:initial-w02-soa-readiness`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1257-initial-w02-soa-version-change-summary.json`
- Confirmed: SoA v1 change summary input, `soa_versions.change_summary`, snapshot `changeSummary`, SoA v2 change summary API response, UI `soa-version-change-summary-latest`, existing v2 diff

## What This Means

初回登録準備でSoAを一度固めた後、審査前レビューや差し戻し対応で判断理由を変えた場合に、単に「何が変わったか」だけでなく「なぜこの版を出したか」も残せるようになった。実務検証では、SoAの説明可能性が少し強くなった。

## Remaining Gaps

- SoA差分の専用レビュー/承認フローは未確認。
- 本格PDF組版、多段承認、承認者ルール細分化、再レビュー日は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
