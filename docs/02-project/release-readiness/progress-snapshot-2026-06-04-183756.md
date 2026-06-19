---
title: ISMS Pilot Progress Snapshot 2026-06-04 18:37
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 18:37:56 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-181926.md
---

# ISMS Pilot Progress Snapshot 2026-06-04 18:37

## Purpose

このスナップショットは、2026-06-04 18:19時点の進捗記録と比較できるように、18:37時点の状態を同じ粒度で記録する。

次回ユーザから「もう一度進捗を確認して報告して」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約45%前後。

18:19からの大きな差分は、W-02後半の `qa:initial-w02-journey` がpassし、`initial` 固定テナントで文書、情報資産、リスク、管理策、タスク、Home次アクションまで代表導線を1本で確認できたこと。

## Comparison From Previous Snapshot

| 比較項目 | 前回 18:19 | 現在 18:37 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約40%前後 | 約45%前後 | W-02後半の代表導線QAがpassし、初回登録準備ストーリーが一段進んだ |
| W-02後半QA | 子スレッド実装を親側確認中 | `qa:initial-w02-journey` pass | seed件数、文書、資産、リスク、管理策、タスク、Home次アクションまで確認 |
| client/server境界 | 通知設定中心に改善済み | W-02代表画面も改善 | 文書、情報資産、リスク、管理策、タスクの一覧系GETをAPI境界へ寄せた |
| タスク一覧 | seedあり、画面導線未確認 | seed初期タスク表示pass | `authUser` 依存抜けを修正し、`/api/tasks` が呼ばれるようにした |
| 残blocker | W-02後半の最初のblocker未確定 | W-02後半代表QAのfirstBlockerなし | 次のblocker候補はユーザー招待/ロール付与と作成・編集系の深掘り |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 75% | `initial` / `surveillance` の2ストーリーとW-02代表QA証跡を反映 |
| シードデータ | 80% | 2つのモデルテナント、各テナント内ユーザー、業務データ、横断system_operatorを投入・QA済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | API境界修正、担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 45% | データと画面はあるが、招待/ロール付与のW-02検証は未完 |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 55% | seed資産の一覧表示はW-02代表QAでpass。新規登録/CSVは次段 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はW-02代表QAでpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はW-02代表QAでpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 20〜25% | seedは強化済み。内部監査、是正、マネジメントレビューの年次ストーリー検証は未着手 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Current Position

`initial` の初回登録準備ストーリーは、代表QAとして以下まで1本で確認できた。

```text
フェーズ選択
→ 組織基本情報
→ ISMS適用範囲
→ 体制ロール/担当者
→ 文書/情報資産/リスク/管理策/タスク/Home次アクション
```

ただし、W-02が完全完了という意味ではない。今回passしたのはseed済みモデルケースの表示と代表導線であり、ユーザー招待、ロール付与、各画面の新規作成・編集・承認・リンク更新は次に深掘りする。

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 実務検証seed | `npm run seed:practical-verification -- --reset` pass, `npm run qa:practical-seed` pass |
| W-02後半代表QA | `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3007 npm run qa:initial-w02-journey` pass |
| W-02後半QA結果 | `test-results/initial-w02-journey-run-2026-06-04T09-37-20-489Z.json`, firstBlocker `null` |
| browser data boundary | 文書、情報資産、リスク、管理策、タスクの一覧系GETをAPI境界へ移動 |
| 静的確認 | `npm run typecheck` pass, `npm run lint:messages` pass, `git diff --check` pass |

## Next Planned Work

1. W-02 Step 5のユーザー招待/ロール付与を検証する。
2. 文書、情報資産、リスク、管理策、タスクの作成・編集・承認/リンク更新を、1つずつ深掘りQAにする。
3. W-02の深掘りで残るbrowser直DBアクセスやテスト契約ズレを検出して直す。
4. W-02代表導線が安定した後、`surveillance` の年次運用ストーリーへ進む。

## Known Worktree State

2026-06-04 18:37:56 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール、通知API、実務検証seed、W-02後半QA、browser data boundary、docs進捗ログ周辺の未コミット変更あり。
- `docs/05-quality/code-quality-scoring-summary-2026-05-22.md` と `docs/05-quality/saas-value-code-review-2026-05-22.md` は既存の未追跡docsとして今回対象外。
- active goalは未完了。W-02代表導線は進んだが、深掘り操作QAと `surveillance` 検証が残る。
