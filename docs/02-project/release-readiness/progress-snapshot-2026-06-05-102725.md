---
title: ISMS Pilot Progress Snapshot 2026-06-05 10:27
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 10:27:25 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-082502.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 10:27

## Purpose

このスナップショットは、2026-06-05 08:25時点の進捗記録と比較できるように、2026-06-05 10:27時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約54%前後。

08:25からの大きな差分は、`surveillance` 側で不適合と是正処置を画面から更新し、DB永続化と監査ログまで確認できたこと。これにより、継続運用ストーリーは「内部監査入口と表示確認」から、「是正を実際に進める操作確認」へ一段進んだ。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 08:25 | 現在 2026-06-05 10:27 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約52%前後 | 約54%前後 | surveillanceの更新操作QAがpassし、年次運用ストーリーが前進 |
| W-02 initial | 情報資産CRUDまでpass | 変更なし | 次は文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新 |
| W-03〜W-05 surveillance | 内部監査入口、不適合/是正表示までpass | 不適合ステータス更新、是正処置更新、DB永続化、監査ログまでpass | W-04 Step 2が `unverified` から `representative_ready` へ前進 |
| client/server境界 | 監査GET系と情報資産CRUDをAPI境界へ移動 | 不適合/是正更新POST/PATCHも `/api/audit` へ移動 | 更新系browser direct DB accessの追加解消 |
| 新規リスク | `mock:activities` archive/non-active候補 | `user_department_scopes` SQLite table不足警告を確認 | 部門スコープRBACのローカルDB整合が次の軽量P1候補 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 82% | `initial` / `surveillance` の2ストーリー、W-02/W-04証跡、API境界更新を反映済み |
| シードデータ | 80% | 2つのモデルテナント、業務データ、横断system_operatorを投入・QA済み。部門スコープ詳細テーブルのSQLite整合は要確認 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 60% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass。部門スコープSQLite整合は未解消 |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 40% | 内部監査入口、期間集計、不適合/是正表示、不適合/是正更新、監査ログまでpass。次はフォローアップ更新とマネジメントレビュー |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-082502.md` |
| surveillance corrective action update QA | `npm run qa:surveillance-corrective-action-update` pass |
| surveillance corrective action QA結果 | `test-results/surveillance-corrective-action-update-run-2026-06-05T01-26-42-845Z.json`, firstBlocker `null` |
| surveillance seed再作成 | `npm run seed:practical-verification -- --reset --scenario surveillance` pass。結果: `test-results/practical-verification-seed-surveillance-2026-06-05T01-26-08-748Z-56804.json` |
| 監査API境界 | `app/api/audit/route.ts`, `lib/services/audit.ts` |
| 静的確認 | `node --check scripts/qa-surveillance-corrective-action-update.js`, `npm run typecheck`, `npm run lint:messages`, `git diff --check` pass |

## New Finding

QA実行中、`/api/dev/login` が `user_department_scopes` テーブル不足をcatchして警告した。QA本体はpassしたため今回のblockerではないが、部門スコープRBAC統合後のローカルSQLite schema/seed整合として別P1候補にする。

## Next Planned Work

1. `surveillance` のフォローアップ状態更新QAを作り、是正完了後のフォローアップ記録、検証日、監査ログを確認する。
2. マネジメントレビュー入力QAを作り、監査/是正情報がレビュー項目やアクションにつながるか確認する。
3. `user_department_scopes` のSQLite table整合を確認し、必要ならSQLite schema/seed/migration経路を補正する。
4. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。

## Known Worktree State

2026-06-05 10:27:25 JST 時点:

- main作業ツリーには、監査API更新、是正更新QA追加、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは停止済み。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
