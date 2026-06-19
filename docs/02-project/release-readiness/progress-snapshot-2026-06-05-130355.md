---
title: ISMS Pilot Progress Snapshot 2026-06-05 13:03
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 13:03:55 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-125049.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 13:03

## Purpose

このスナップショットは、2026-06-05 12:50時点の進捗記録と比較できるように、2026-06-05 13:03時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約66%前後。

12:50からの大きな差分は、`initial` のW-02初回登録準備で、seed初期タスクを編集画面から進行中へ更新し、進捗率、DB永続化、監査ログまで確認できたこと。これにより、W-02の代表導線に加えて、情報資産CRUD、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新のdeep CRUD確認が一巡した。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 12:50 | 現在 2026-06-05 13:03 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約64%前後 | 約66%前後 | W-02のタスク進捗更新QAがpass |
| W-02 initial | 管理策リンク編集、DB永続化、監査ログまでpass | タスクのステータス/進捗更新、DB永続化、監査ログまでpass | W-02代表deep CRUDが一巡 |
| CAP-11 タスク・是正管理 | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 | `qa:initial-w02-task-progress-update` で画面編集と証跡保存を確認 | CAP-11が実務検証寄りに前進 |
| client/server境界 | タスク一覧GETはAPI化済み。詳細/作成/更新は未確認 | `/api/tasks` POST と `/api/tasks/[id]` GET/PATCH を追加 | タスク進捗更新系のbrowser direct DB accessを解消 |
| 次タスク | タスク進捗更新 | 新規リスク/対応策作成、SoA、審査提出束、正式承認の深掘り | W-02の残りdeep CRUDから次段検証へ移行 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 93% | W-02タスク進捗更新QAをworkflows/capabilities/evidence-map/unknownsへ反映 |
| シードデータ | 85% | QA後にseed resetと `qa:practical-seed` がpass。2つのモデルテナントを維持 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 62% | 方針文書の下書き作成、一覧表示、CISO承認依頼、承認済み化、DB/監査ログまでpass。改訂/多段承認/エクスポート提出束は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 63% | seedリスク表示、評価更新、対応策/管理策リンク編集、DB永続化、評価履歴、監査ログまでpass。SoA、正式承認、残留リスク承認は次段 |
| 初期タスク / 次アクション | 62% | seed初期タスクとHome次アクション表示に加え、編集画面からのステータス/進捗更新、DB永続化、監査ログまでpass。新規作成/サブタスクは次段 |
| 継続運用 `surveillance` | 55% | 内部監査、是正、フォローアップ、レビュー、Home統計、期限超過、通知、Evidence Vault不足、経営判断/資源配分/リスク受容条件までpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-125049.md` |
| W-02 task progress update QA | `npm run qa:initial-w02-task-progress-update` pass |
| W-02 task progress update QA結果 | `test-results/initial-w02-task-progress-update-run-2026-06-05T04-03-35-876Z.json`, firstBlocker `null` |
| seed復元 | `node scripts/seed-practical-verification.mjs --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| QA追加 | `tests/e2e/initial-w02-task-progress-update.spec.ts`, `scripts/qa-initial-w02-task-progress-update.js`, `package.json` |
| API/Service修正 | `app/api/tasks/route.ts`, `app/api/tasks/[id]/route.ts`, `components/tasks/TaskEditorForm.tsx`, `lib/services/task.ts` |

## New Finding

タスク編集フォームは、初回表示時のauth hookが一時的にnullになるだけで読み込み失敗へ落ちる状態だった。今回、フォーム初期化は `UserService.getUserProfile()` を正として扱い、タスク詳細取得/作成/更新はAPI境界へ寄せたため、実務検証用のsystem_operatorでも編集画面から進捗更新できるようになった。

## Next Planned Work

1. W-02は代表deep CRUDが一巡したため、新規リスク/対応策作成、SoA、審査提出束、正式承認のいずれかを次段QAにする。
2. `surveillance` では、正式な承認ワークフロー、判断分類、受容理由/承認者/履歴の構造化へ進む。
3. タスク周辺では、必要に応じて新規作成、サブタスク、タグ、添付、是正/CAPAとの接続を別QAにする。

## Known Worktree State

2026-06-05 13:03:55 JST 時点:

- main作業ツリーには、W-02 task progress update API/UI/QA、spec-dsl/release-readiness docs更新、進捗スナップショット追加の未コミット変更がある。
- QA用dev serverは停止確認予定。
- 未追跡の `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
