---
title: ISMS Pilot Progress Snapshot 2026-06-05 12:33
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 12:33:46 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-120854.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 12:33

## Purpose

このスナップショットは、2026-06-05 12:08時点の進捗記録と比較できるように、2026-06-05 12:33時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約63%前後。

12:08からの大きな差分は、`initial` のW-02初回登録準備で、seed済みリスクを編集画面から再評価し、一覧表示、DB永続化、評価履歴、監査ログまで確認できたこと。これにより、リスク管理は「seed表示」から「実務中に評価を見直し、証跡を残す」段階へ一歩進んだ。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 12:08 | 現在 2026-06-05 12:33 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約62%前後 | 約63%前後 | W-02のリスク評価更新QAがpass |
| W-02 initial | 方針文書の下書き作成、一覧表示、CISO承認依頼、承認済み化までpass | seedリスクの再評価、DB永続化、評価履歴、監査ログまでpass | リスク管理が表示確認から評価更新の実操作へ前進 |
| CAP-09 リスク評価・対応 | seedリスク/対応策/管理策リンクの存在と表示は確認済み。評価更新は次段 | `qa:initial-w02-risk-update` で編集画面からの再評価と証跡保存を確認 | CAP-09が実務検証寄りに前進 |
| client/server境界 | リスク詳細GETはAPI化済み。リスク更新は未確認 | `PATCH /api/risks/[id]` を追加し、ブラウザ更新をAPI境界へ移動 | 更新系browser direct DB accessの1つを解消 |
| 次タスク | リスク評価更新、管理策リンク編集、タスク進捗更新 | 管理策リンク編集、タスク進捗更新 | リスク評価更新は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 91% | W-02リスク評価更新QAをcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 84% | QA後にseed resetと `qa:practical-seed` がpass。2つのモデルテナントを維持 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 62% | 方針文書の下書き作成、一覧表示、CISO承認依頼、承認済み化、DB/監査ログまでpass。改訂/多段承認/エクスポート提出束は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 60% | seedリスク表示、対応策/管理策リンク存在、Evidence Vault不足表示、レビュー上の期限付き受容条件記録に加え、リスク評価更新、DB永続化、評価履歴、監査ログまでpass。管理策リンク編集/正式承認は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 55% | 内部監査、是正、フォローアップ、レビュー、Home統計、期限超過、通知、Evidence Vault不足、経営判断/資源配分/リスク受容条件までpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-120854.md` |
| W-02 risk update QA | `npm run qa:initial-w02-risk-update` pass |
| W-02 risk update QA結果 | `test-results/initial-w02-risk-update-run-2026-06-05T03-27-34-062Z.json`, firstBlocker `null` |
| seed復元 | `node scripts/seed-practical-verification.mjs --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| QA追加 | `tests/e2e/initial-w02-risk-update.spec.ts`, `scripts/qa-initial-w02-risk-update.js`, `package.json` |
| API/Service修正 | `app/api/risks/[id]/route.ts`, `lib/services/risk.ts`, `lib/db/repositories/interfaces/IRiskRepository.ts`, `lib/db/repositories/sqlite/RiskRepository.ts` |

## New Finding

リスク評価履歴は既存実装では「更新後の現在値」を前後両方に入れる形だったため、実務検証の証跡としては弱かった。今回、更新前の影響度/発生可能性を履歴作成へ渡すようにし、`3/3` から `5/4` への再評価が `risk_assessment_history` に残ることをQAで確認した。

## Next Planned Work

1. W-02の残り深掘りとして、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
2. リスク管理では、必要に応じて新規登録、対応策、残留リスク受容、正式承認ワークフローを別QAにする。
3. `surveillance` では、正式な承認ワークフロー、判断分類、受容理由/承認者/履歴の構造化へ進む。

## Known Worktree State

2026-06-05 12:33:46 JST 時点:

- main作業ツリーには、W-02 risk update API/QA、評価履歴修正、spec-dsl/release-readiness docs更新、DSL図解ファイルの未コミット変更がある。
- QA用dev serverは停止済み。
- 未追跡の `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
