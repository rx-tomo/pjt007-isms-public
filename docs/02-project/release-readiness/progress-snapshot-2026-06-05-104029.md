---
title: ISMS Pilot Progress Snapshot 2026-06-05 10:40
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 10:40:29 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-102725.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 10:40

## Purpose

このスナップショットは、2026-06-05 10:27時点の進捗記録と比較できるように、2026-06-05 10:40時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約55%前後。

10:27からの大きな差分は、`user_department_scopes` のローカルSQLite不整合をseed/QAで解消し、実務検証seedの再現性を上げたこと。継続運用QAも、監査ログ挿入前にテストが先読みする競合を直して再passした。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 10:27 | 現在 2026-06-05 10:40 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約54%前後 | 約55%前後 | 機能面の新規ジャーニー追加ではなく、seed再現性とQA安定性が前進 |
| シードデータ | 2テナントと業務データはQA済み。部門スコープ詳細テーブルのSQLite整合は要確認 | `user_department_scopes` のテーブル作成、reset、seed、QA確認まで完了 | 実務検証開始時のロール/部門スコープ土台が安定 |
| W-03〜W-05 surveillance | 不適合/是正更新QAがpass。ただしdev loginで部門スコープ警告あり | 同QAが再passし、dev login警告なし。QAはPATCH完了待ちに修正 | QA競合を解消し、監査ログ確認の信頼性が向上 |
| client/server境界 | 不適合/是正更新POST/PATCHはAPI境界化済み | 変更なし | 今回は境界追加ではなく検証待ちの修正 |
| 新規リスク | `user_department_scopes` SQLite table不足警告 | 解消済み。Unknownsはresolvedへ移動 | 次の軽量P1候補から除外 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 83% | 部門スコープSQLite整合の解消をUnknowns/needed docsへ反映 |
| シードデータ | 83% | 2つのモデルテナント、業務データ、横断system_operatorに加え、`user_department_scopes` もseed/QA対象化 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass。部門スコープseed/QA整合も解消 |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 41% | 内部監査入口、期間集計、不適合/是正表示、不適合/是正更新、監査ログまでpass。QA待機競合も修正済み |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-102725.md` |
| practical seed reset all | `npm run seed:practical-verification -- --reset --scenario all` pass。結果: `test-results/practical-verification-seed-all-2026-06-05T01-35-45-856Z-78496.json` |
| practical seed QA | `npm run qa:practical-seed` pass。`user_department_scopes` は `initial` 3件、`surveillance` 3件を明示確認 |
| dev login再確認 | `/api/dev/login` に `operator.practical@isms-practical.local` / `surveillance` orgでPOSTし、200。server logに `user_department_scopes` 警告なし |
| surveillance corrective action update QA | `npm run qa:surveillance-corrective-action-update` pass。結果: `test-results/surveillance-corrective-action-update-run-2026-06-05T01-39-28-153Z.json` |
| surveillance seed再復元 | `npm run seed:practical-verification -- --reset --scenario surveillance` pass。結果: `test-results/practical-verification-seed-surveillance-2026-06-05T01-40-18-918Z-84430.json` |
| 静的確認 | `node --check scripts/seed-practical-verification.mjs`, `node --check scripts/qa-practical-seed.mjs` pass |

## New Finding

`qa:surveillance-corrective-action-update` は、画面クリック後にPATCHレスポンス完了を待たず、DB行の更新だけを先に見て監査ログを読みに行く競合があった。実装はログを残していたため、QAを `page.waitForResponse` でPATCH完了待ちに修正し、再passした。

## Next Planned Work

1. `surveillance` のフォローアップ状態更新QAを作り、是正完了後のフォローアップ記録、検証日、監査ログを確認する。
2. マネジメントレビュー入力QAを作り、監査/是正情報がレビュー項目やアクションにつながるか確認する。
3. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
4. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 10:40:29 JST 時点:

- main作業ツリーには、実務検証seedの部門スコープ補正、seed QA拡張、surveillance QA待機修正、docs更新、DSL図解SVG追加の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回のseed/QA差分とは別扱い。
