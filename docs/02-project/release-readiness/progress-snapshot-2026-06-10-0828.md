---
title: Progress Snapshot 2026-06-10 08:28 JST
snapshot_at: 2026-06-10 08:28:22 JST
compare_with: latest progress record before requested 19:00 baseline; main commit fab458e plus current worktree
status: in_progress
---

# Progress Snapshot 2026-06-10 08:28 JST

## Summary

今回の前進は、教育・訓練管理を「画面がある」段階から、ISMS実務で教育計画、対象者、教材、受講記録、未受講フォロー、メンバー本人の完了記録、期限リマインダーまで一連で試せる段階へ押し上げたことである。

特に、期限前/期限超過の教育リマインダーを対象テナント/教育計画に絞って実行できるようにし、実務検証seedに余計な通知を作らず代表計画だけQAできるようにした。

## Progress Estimate

| Part | Current | Note |
| ---- | ------- | ---- |
| 実務検証版全体 | 約82% | 初回登録準備と継続運用の代表線はかなり接続済み。教育・訓練も代表運用へ接続 |
| 方針整理/spec-dsl | 約86% | PR/FAQ境界、role actor usability、CAP更新が進行 |
| seedデータ | 約82% | 初回/継続の教育モデルケースを含む状態へ前進 |
| 初回登録準備 W-02 | 約94% | 審査準備パッケージに教育証跡も接続済み |
| 継続運用 W-03-W-05 | 約90% | 監査、是正、レビュー、残留リスク、教育証跡が提出束へ接続 |
| 教育・訓練管理 CAP-25 | 約78% | 計画、教材、対象者、本人受講、通知まで代表QA済み |
| QA/テスト基盤 | 約86% | `qa:education` 6 tests pass。対象限定リマインダーで副作用を抑制 |
| SaaS/課金/テナント提供 | 約45% | 将来実装の下地はあるが、商用運用完成度は後続 |

## Evidence

- `npm run typecheck`: pass
- `npm run lint:messages`: pass
- `git diff --check`: pass
- `npm run qa:education -- --project=chromium --reporter=line`: 6 passed

## Branch Aggregation

`origin/codex/github-mention-rbac` と `origin/codex/refer-to-task_plan.md-and-implement` は main の祖先で、mainへ新しく取り込む未集約コミットはなかった。大規模な古い木との差分が出るため、追加mergeは不要と判断した。

## Remaining

- 教育リマインダーのメール配信、失敗時再送、エスカレーション。
- 教材の表示順、専用教材ライブラリ画面、添付ファイル実体管理。
- 内部監査員力量、専門教育、任命記録をCAP-13とどう接続するか。
- PR/FAQや画面文言の外向き/内向き境界の継続棚卸し。
- 契約終了時エクスポート、課金、SaaS復旧責任など商用提供判断。
