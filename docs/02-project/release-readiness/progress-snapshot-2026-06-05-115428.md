---
title: ISMS Pilot Progress Snapshot 2026-06-05 11:54
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 11:54:28 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-114230.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 11:54

## Purpose

このスナップショットは、2026-06-05 11:42時点の進捗記録と比較できるように、2026-06-05 11:54時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約61%前後。

11:42からの大きな差分は、`surveillance` の年次運用で、マネジメントレビューを単なる議事録入力ではなく、経営判断、資源配分、リスク受容条件、次回フォローアップアクションを残す場として代表QAできたこと。これにより、W-05の「経営レビュー・継続的改善」は、入力、改善アクション、Home/タスク接続、期限/通知、証跡不足、意思決定ログまで一通りの実務検証証跡が揃った。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 11:42 | 現在 2026-06-05 11:54 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約60%前後 | 約61%前後 | surveillanceの経営判断/資源配分/リスク受容QAがpass |
| W-05 management review | 入力、改善アクション、Home接続、期限/通知、Evidence Vault不足までpass | 経営判断、資源配分、期限付きリスク受容条件をレビュー記録とアクションへ保存できることまでpass | マネジメントレビューが実務上の意思決定ログとして使える代表証跡を追加 |
| CAP-15 マネジメントレビュー | 経営判断/資源配分/リスク受容は未確認 | 代表QAでレビュー記録/改善アクション/監査ログまで確認 | CAP-15のW-05深掘りが前進 |
| CAP-28 残留リスク受容 | リスク詳細の不足可視化とEvidence Vault不足表示まで | マネジメントレビュー上で期限付き受容条件を残せることまで | 正式承認ワークフローは未実装のまま、運用記録としての受容条件は確認済みへ |
| 次タスク | 経営判断/資源配分/リスク受容、W-02残りdeep CRUD | W-02残りdeep CRUD、正式な判断履歴/受容承認ワークフロー要否 | 経営判断/資源配分/リスク受容の代表QAは完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 89% | W-05の意思決定QAをcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 84% | 2つのモデルテナントを維持。QA後にseed resetと `qa:practical-seed` がpass |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 58% | seedリスク、対応策、管理策、リンク、Evidence Vault不足表示、レビュー上の期限付き受容条件記録がpass。新規評価/リンク編集/正式承認は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 55% | 内部監査、是正、フォローアップ、レビュー、Home統計、期限超過、通知、Evidence Vault不足、経営判断/資源配分/リスク受容条件までpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-114230.md` |
| surveillance management decision QA | `npm run qa:surveillance-management-decision` pass |
| surveillance management decision QA結果 | `test-results/surveillance-management-decision-run-2026-06-05T02-53-38-829Z.json`, firstBlocker `null` |
| seed復元 | `npm run seed:practical-verification -- --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| QA追加 | `tests/e2e/surveillance-management-decision.spec.ts`, `scripts/qa-surveillance-management-decision.js`, `package.json` |

## New Finding

既存のマネジメントレビュー詳細画面とAPIは、追加テーブルなしでも、議事録、結論、改善アクションとして経営判断、資源配分、リスク受容条件を残せる。ただし、これは自由記述として残せる段階であり、正式な判断分類、承認者、受容理由、履歴保全を構造化したワークフローではない。

## Next Planned Work

1. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
2. W-05で正式な判断分類、承認者、受容理由、履歴保全まで構造化する必要があるかを、実務検証の詰まりとして判断する。
3. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 11:54:28 JST 時点:

- main作業ツリーには、surveillance management decision QA、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
