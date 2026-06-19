---
title: ISMS Pilot Progress Snapshot 2026-06-05 11:42
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 11:42:30 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-113307.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 11:42

## Purpose

このスナップショットは、2026-06-05 11:33時点の進捗記録と比較できるように、2026-06-05 11:42時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約60%前後。

11:33からの大きな差分は、`surveillance` の年次運用で、リスク詳細画面にEvidence Vaultの未準備状態が表示され、証跡不足が利用者に見える代表QAが通ったこと。これにより、期限/通知に続いて、リスク・管理策・証跡束の不足も画面上で説明できる状態へ一歩進んだ。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 11:33 | 現在 2026-06-05 11:42 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約59%前後 | 約60%前後 | surveillanceの証跡不足QAがpass |
| W-03 daily operation | 期限超過/通知までpass | リスク詳細のEvidence Vault不足表示までpass | 証跡不足の代表表示が未確認から確認済みへ |
| CAP-29 Evidence Vault | 実装/Unit証跡はあるが実務検証seedで未確認 | seed上の証跡不足リスクで画面表示を確認 | CAP-29がより実務検証寄りのpartialへ前進 |
| client/server境界 | リスク一覧GETはAPI化済み | リスク詳細GETも `/api/risks/[id]` 経由へ移動 | リスク詳細画面のbrowser direct DB accessリスクを低減 |
| 次タスク | 証跡不足表示、経営判断/資源配分/リスク受容、W-02残りdeep CRUD | 経営判断/資源配分/リスク受容、W-02残りdeep CRUD | 証跡不足表示は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 88% | W-03/W-05の証跡不足QAをcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 84% | 2つのモデルテナントと証跡不足リスクを維持。seed reset後の `qa:practical-seed` はpass |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 57% | seedリスク、対応策、管理策、リンク表示に加え、Evidence Vault不足表示がpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 53% | 内部監査、是正、フォローアップ、レビュー、Home統計、期限超過、通知、Evidence Vault不足表示までpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-113307.md` |
| surveillance evidence gap QA | `npm run qa:surveillance-evidence-gap` pass |
| surveillance evidence gap QA結果 | `test-results/surveillance-evidence-gap-run-2026-06-05T02-41-44-012Z.json`, firstBlocker `null` |
| seed復元 | `npm run seed:practical-verification -- --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| diff check | `git diff --check` pass |
| QA追加 | `tests/e2e/surveillance-evidence-gap.spec.ts`, `scripts/qa-surveillance-evidence-gap.js`, `app/api/risks/[id]/route.ts` |

## New Finding

リスク詳細画面はEvidence Vaultの準備状況を持っていたが、ブラウザから詳細取得する経路がAPI化されていなかった。今回 `GET /api/risks/[id]` を追加し、詳細取得をAPI境界へ寄せたことで、証跡不足表示のQAとclient/server境界整理を同時に進められた。

## Next Planned Work

1. `surveillance` で経営判断、資源配分、リスク受容をマネジメントレビュー上でどこまで扱うかを小さく確認する。
2. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
3. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 11:42:30 JST 時点:

- main作業ツリーには、リスク詳細API、surveillance evidence gap QA、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
