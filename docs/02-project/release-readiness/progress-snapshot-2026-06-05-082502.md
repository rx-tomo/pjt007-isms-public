---
title: ISMS Pilot Progress Snapshot 2026-06-05 08:25
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 08:25:02 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-192925.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 08:25

## Purpose

このスナップショットは、2026-06-04 19:29時点の進捗記録と比較できるように、2026-06-05 08:25時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約52%前後。

19:29からの大きな差分は、W-02初回登録準備ストーリーの情報資産について、seed表示だけでなく作成、編集、検索、削除、DB永続化までruntime QAで確認できたこと。これにより、W-02は「代表表示」から「一部の実操作まで検証済み」へ少し進んだ。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-04 19:29 | 現在 2026-06-05 08:25 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約50%前後 | 約52%前後 | W-02情報資産CRUDがpassし、初回登録準備の深掘りQAが1つ前進 |
| W-02 initial | 代表導線とStep 5ユーザーライフサイクルまでpass。情報資産CRUDが次候補 | 情報資産の作成、編集、検索、削除、DB永続化までpass | Step 7が `representative_ready` から `ready` へ前進 |
| W-03〜W-05 surveillance | 内部監査入口、期間集計、不適合/是正表示までpass | runtime進捗は維持。子スレッドMで次QAを是正処置更新に特定 | 次に直すべき対象がマネジメントレビュー前の是正更新へ具体化 |
| client/server境界 | W-02代表GET、通知、監査GET系を改善済み | 情報資産POST/PATCH/DELETEもAPI境界へ移動 | 更新系browser direct DB accessの1つを解消 |
| デッドコード/docs整理 | `mock:activities` がP1候補として残存 | 子スレッドNで archive/non-active 推奨へ整理 | 旧UC-03 activity feed QAは今の実務検証を止めない扱いに寄せた |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 80% | `initial` / `surveillance` の2ストーリー、代表QA、資産CRUD証跡を反映済み |
| シードデータ | 80% | 2つのモデルテナント、各テナント内ユーザー、業務データ、横断system_operatorを投入・QA済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 60% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 30% | 内部監査入口、期間集計、不適合/是正表示の代表QAがpass。次は是正処置更新 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-04-192925.md` |
| W-02 information assets CRUD QA | `npm run qa:initial-w02-assets-crud` pass |
| W-02 information assets QA結果 | `test-results/initial-w02-assets-crud-run-2026-06-04T23-22-51-973Z.json`, firstBlocker `null` |
| seed再作成 | `npm run seed:practical-verification -- --reset --scenario initial` pass。結果: `test-results/practical-verification-seed-initial-2026-06-04T23-21-57-140Z-23991.json` |
| 情報資産API境界 | `app/api/information-assets/route.ts`, `lib/services/informationAsset.ts` |
| 静的確認 | `node --check scripts/qa-initial-w02-assets-crud.js`, `npm run typecheck`, `npm run lint:messages`, `git diff --check` pass |

## Parallel Lanes

2026-06-05 08:25時点で、次の子スレッドを作成し、結果を回収した。

| Lane | Type | Scope | Result |
| --- | --- | --- | --- |
| M: Surveillance Next QA Scout | child-thread / read-only | 継続運用ストーリーの次QA特定 | thread `019e94ee-5cc6-7510-9ac6-1002f8ecd6ec`。次はmanagement reviewではなく、`/ja/audit/nonconformities` の是正処置更新を先に深掘りするのが適切。`AuditService.createCorrectiveAction` / `updateCorrectiveAction` のbrowser branch/API不足が主な実装不足候補 |
| N: mock:activities / UC-03 QA Cleanup Scout | child-thread / read-only | 古い `mock:activities` QA経路の扱い確認 | thread `019e94ee-5cc5-7781-a0b6-1aca4583fea4`。旧seed scriptはSupabase依存として削除済みで、現行runner/testid契約も古い。今はrestoreより archive/non-active 化が妥当 |

## Next Planned Work

1. `surveillance-corrective-action-update` QAを作り、是正処置のステータス、完了日、監査ログ、フォローアップ表示を確認する。
2. 必要に応じて `app/api/audit` または専用APIと `AuditService` browser branchを追加し、是正更新をAPI境界へ寄せる。
3. `mock:activities` をactive QAから外すか、UC-03 docsでarchive/non-active扱いに整理する。
4. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
5. 変更ごとに `npm run typecheck`, `npm run lint:messages`, 関連QA、`git diff --check` を実行し、spec-dslとrelease-readiness docsへ戻す。

## Known Worktree State

2026-06-05 08:25:02 JST 時点:

- main作業ツリーには、情報資産CRUD実装、QA追加、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは停止対象。PlaywrightのmacOS権限制約により、実行時は必要に応じて権限付きで再実行する。
- child thread M/N はread-only調査として結果回収済み。親mainへ取り込むべきコード差分はない。
