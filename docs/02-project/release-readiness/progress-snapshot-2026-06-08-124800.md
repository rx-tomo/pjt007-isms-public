---
title: Progress Snapshot 2026-06-08 12:48 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 12:48 JST
compare_with: progress-snapshot-2026-06-08-124000.md
status: in_progress
---

# Progress Snapshot 2026-06-08 12:48 JST

## Summary

前回 2026-06-08 12:40 JST 時点では、提出束PDFが `Review scope`、`Readiness summary`、`Evidence checklist`、`Gap review` を持つ最小構造になったところまでだった。

今回の差分は、W-02初回登録準備のSoAについて、v1固定後に管理策判断を変更し、SoA v2を発行したときの前版差分をAPIと画面で確認できるようにしたことである。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 95% | 96% | SoA v2差分をAPI/画面で確認可能 |
| CAP-10 管理策・SoA支援 | 90% | 92% | v1/v2版履歴に前版差分を追加 |
| CAP-30 外部審査証跡パッケージ | 93% | 93% | 提出束自体は維持。SoA改訂追跡が前進 |
| Practical QA evidence | 98% | 98% | `qa:initial-w02-soa-readiness` がv2差分まで確認 |

## New Evidence

- Command: `npm run qa:initial-w02-soa-readiness`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1248-initial-w02-soa-v2-diff.json`
- Confirmed: SoA v1 publication, SoA v2 publication, API `diffFromPrevious`, UI `soa-version-diff-summary`, changed control name

## What This Means

初回登録準備で、SoAを一度固めた後に判断理由が変わっても、最新版が前版から何件変わったかを確認できるようになった。実務検証では、審査準備中の見直しや差し戻し後の再整理で「何が変わったか」を追う足場になる。

## Remaining Gaps

- SoA差分の専用レビュー/承認フローは未確認。
- 差分理由をSoA版単位で入力・保存する専用欄は未実装。
- 本格PDF組版、多段承認、承認者ルール細分化、再レビュー日は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
