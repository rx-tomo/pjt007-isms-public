---
title: ISMS Pilot Progress Snapshot 2026-06-04 18:58
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 18:58:55 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-184751.md
---

# ISMS Pilot Progress Snapshot 2026-06-04 18:58

## Purpose

このスナップショットは、2026-06-04 18:47時点の進捗記録と比較できるように、18:58時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約48%前後。

18:47からの大きな差分は、W-02 Step 5の `qa:initial-user-lifecycle` がpassし、ユーザー招待、受諾、membership、ロール変更、詳細権限保存、監査ログ、ユーザー管理画面表示まで代表証跡が取れたこと。

## Comparison From Previous Snapshot

| 比較項目 | 前回 18:47 | 現在 18:58 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約46%前後 | 約48%前後 | Step 5ユーザーライフサイクルQAがpassし、W-02の管理者/ユーザー招待周りが一段進んだ |
| W-02代表導線 | `qa:initial-w02-journey` pass | 変更なし | 文書、情報資産、リスク、管理策、タスク、Home次アクションは引き続き代表導線pass済み |
| ユーザー招待/ロール付与 | QA実装中、runtime未完 | `qa:initial-user-lifecycle` pass | 招待作成、受諾、membership、role、permission、audit log、画面表示まで確認 |
| audit log blocker | 未確認 | 解消 | `invitation.accepted` はDBに存在。QAが監査ログ挿入前に読みに行くテスト契約ズレだったため、待ち条件を監査ログ込みに修正 |
| 次のblocker候補 | 招待ライフサイクルQAのruntime結果 | deep CRUD / surveillance first QA | 文書/資産/リスク/管理策/タスクの作成・編集系と、継続運用の初回QAへ移る |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 75% | `initial` / `surveillance` の2ストーリーとW-02代表QA証跡を反映済み |
| シードデータ | 80% | 2つのモデルテナント、各テナント内ユーザー、業務データ、横断system_operatorを投入・QA済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | API境界修正、担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 60% | Step 5の招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 55% | seed資産の一覧表示はW-02代表QAでpass。新規登録/CSVは次段 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はW-02代表QAでpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はW-02代表QAでpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 20〜25% | seedは強化済み。内部監査、是正、マネジメントレビューの年次ストーリー検証は未着手 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Current Position

`initial` の初回登録準備ストーリーは、代表QAとして以下まで確認済み。

```text
フェーズ選択
→ 組織基本情報
→ ISMS適用範囲
→ 体制ロール/担当者
→ ユーザー招待/受諾/ロール/権限/監査ログ
→ 文書/情報資産/リスク/管理策/タスク/Home次アクション
```

ただし、これはseed済みモデルケースと代表操作の確認であり、各機能の深いCRUDを完全に確認したという意味ではない。次の主戦場は、作成・編集・承認・リンク更新の深掘りQAと、`surveillance` 年次運用の最初のruntime QAである。

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-04-184751.md` |
| Step 5 QA | `npm run qa:initial-user-lifecycle` pass |
| Step 5 QA結果 | `test-results/initial-user-lifecycle-run-2026-06-04T09-58-13-964Z.json`, firstBlocker `null` |
| audit log切り分け | `audit_logs` に `invitation.accepted` が存在することをSQLiteで確認。QAの待ち条件を監査ログ込みに修正 |
| 静的確認 | `node --check scripts/qa-initial-user-lifecycle.js` pass, `git diff --check` pass |

## Parallel Lanes

2026-06-04 18:58時点で、次の子スレッドをキューし、その後実体threadIdを回収した。

| Lane | Type | Scope | State |
| --- | --- | --- | --- |
| H: W-02 Step 5 Audit Log Blocker Explorer | child-thread / read-only | audit log blocker切り分け | 回収済み。thread `019e9210-7e94-7581-a5f5-1bac5d4cd494`。原因はQA raceによる `テスト契約ズレ` |
| I: Surveillance First-Step QA Planner | child-thread / read-only | surveillance最初のQA候補整理 | 回収済み。thread `019e9210-ae88-70f3-993e-84edd9e06a56`。推奨は `qa:surveillance-first-step` |
| J: W-02 Deep CRUD QA Prioritizer | child-thread / read-only | W-02 deep CRUDの優先順位整理 | 回収済み。thread `019e9210-e628-7f83-8932-eed3f7c23fbe`。推奨は `qa:initial-w02-assets-crud` |

## Next Planned Work

1. `surveillance` の最初のruntime QAとして `qa:surveillance-first-step` を作る。
2. W-02 deep CRUDの最初の1本として `qa:initial-w02-assets-crud` を作る。
3. 情報資産CRUDで見つかる browser direct DB access / API不足を最小修復する。
4. 変更後に `npm run typecheck`, `npm run lint:messages`, 対象QAを再実行する。

## Known Worktree State

2026-06-04 18:58:55 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール、通知API、実務検証seed、W-02後半QA、Step 5ユーザーライフサイクルQA、browser data boundary、docs進捗ログ周辺の未コミット変更あり。
- active goalは未完了。W-02代表導線は強化されたが、deep CRUDと `surveillance` 年次運用検証が残る。
