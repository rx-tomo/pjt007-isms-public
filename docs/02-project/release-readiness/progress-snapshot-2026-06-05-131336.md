---
title: ISMS Pilot Progress Snapshot 2026-06-05 13:13
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 13:13:36 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-130355.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 13:13

## Purpose

このスナップショットは、2026-06-05 13:03時点の進捗記録と比較できるように、2026-06-05 13:13時点の状態を同じ粒度で記録する。

## Overall Progress

実務検証版としての全体進捗は、約66%前後で維持。

13:03からの差分は、コード実装の完了ではなく、次に進めるべき `surveillance` 側の残課題を「監査報告書の正式承認ワークフロー」に絞り込んだこと。現行コードには `audit_report` の承認サービスと承認キュー表示は存在するが、監査報告書ページ上では承認ステータスを手動変更する形が残っており、提出、承認キュー、承認、履歴化を一連の業務導線としてQAする余地がある。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 13:03 | 現在 2026-06-05 13:13 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約66%前後 | 約66%前後 | 実装完了差分はまだなし |
| W-02 initial | deep CRUDが一巡 | 同左 | 追加進捗なし |
| surveillance | 正式な承認ワークフロー、判断分類、受容理由/承認者/履歴が次課題 | 次の実装候補を監査報告書承認に特定 | 年次運用の出口側に向けた着手準備が進んだ |
| client/server境界 | タスク系はAPI境界へ寄せ済み | 監査報告書の作成/更新/承認申請/承認にもAPI境界追加が必要と判明 | 次の修復対象が具体化 |
| worktree | W-02差分はコミット/push済み、未追跡PNGのみ | 進捗ログ追加以外は未追跡PNGのみ | 実装着手前の整理状態 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 93% | W-02代表deep CRUDの進捗は維持 |
| シードデータ | 85% | 2つのモデルテナントを維持。今回の新規seed変更は未実施 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 初回登録準備 `initial` | 66%前後 | W-02の代表deep CRUDが一巡 |
| 継続運用 `surveillance` | 55% | 次の重点を監査報告書の正式承認ワークフローに設定 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-130355.md` |
| git状態 | `main...origin/main`、未追跡PNGのみ |
| 調査対象 | `app/[locale]/audit/plans/[planId]/report/page.tsx`, `app/[locale]/approvals/page.tsx`, `lib/services/audit.ts`, `app/api/audit/route.ts` |
| 判明事項 | `audit_report` 承認サービスは存在するが、報告書ページの提出/承認キュー連動QAが未整備 |

## Next Planned Work

1. `surveillance` の監査報告書について、保存、承認申請、承認キュー、承認済み化、監査ログ、承認イベントを1本の代表QAにする。
2. 必要に応じて `/api/audit` に監査報告書の作成/更新/承認申請/承認/却下アクションを追加し、ブラウザから直接DBに触る導線を避ける。
3. QA後に `surveillance` seedをresetし、`qa:practical-seed` と関連チェックを実行する。

## Known Worktree State

2026-06-05 13:13:36 JST 時点:

- mainとorigin/mainは一致している。
- 今回追加した進捗ログ以外の実装差分はまだない。
- 未追跡の `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の進捗ログ/実装候補とは別扱い。
