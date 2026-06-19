---
title: ISMS Pilot Progress Snapshot 2026-06-05 10:49
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 10:49:48 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-104029.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 10:49

## Purpose

このスナップショットは、2026-06-05 10:40時点の進捗記録と比較できるように、2026-06-05 10:49時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約56%前後。

10:40からの大きな差分は、`surveillance` の内部監査・是正ストーリーで、フォローアップ記録を画面から `completed`、続けて `verified` へ進め、DB永続化と監査ログまで確認できたこと。これにより、W-04 Step 2は不適合/是正更新だけでなく、フォローアップ確認まで代表QAが通った。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 10:40 | 現在 2026-06-05 10:49 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約55%前後 | 約56%前後 | surveillanceのフォローアップ更新QAがpass |
| W-03〜W-05 surveillance | 不適合/是正更新、seed再現性、QA安定性までpass | フォローアップ完了/検証済み更新、DB永続化、監査ログまでpass | W-04 Step 2が代表レベルでreadyへ前進 |
| client/server境界 | 不適合/是正更新POST/PATCHと部門スコープseedは改善済み | 監査計画詳細のplan/units/followUps取得とfollow-up POST/PATCHも `/api/audit` へ移動 | 監査詳細画面のbrowser direct DB accessを追加解消 |
| シードデータ | `user_department_scopes` までQA対象化 | QA後に `surveillance` seedを再reset済み | 次回も同じ初期状態から試せる |
| 次タスク | follow-up更新、management review | management review、Home/タスクとの年次サイクル接続 | follow-up更新は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 84% | W-04のフォローアップ更新証跡をcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 83% | 2つのモデルテナント、業務データ、横断system_operator、部門スコープをseed/QA対象化済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass。部門スコープseed/QA整合も解消 |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 44% | 内部監査入口、期間集計、不適合/是正表示、不適合/是正更新、フォローアップ完了/検証済み更新、監査ログまでpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-104029.md` |
| surveillance follow-up update QA | `npm run qa:surveillance-follow-up-update` pass |
| surveillance follow-up QA結果 | `test-results/surveillance-follow-up-update-run-2026-06-05T01-49-20-244Z.json`, firstBlocker `null` |
| surveillance seed再復元 | `npm run seed:practical-verification -- --reset --scenario surveillance` pass。結果: `test-results/practical-verification-seed-surveillance-2026-06-05T01-49-32-862Z-7493.json` |
| 監査API境界 | `app/api/audit/route.ts`, `lib/services/audit.ts` |
| UI test id | `app/[locale]/audit/plans/[planId]/page.tsx` |
| QA追加 | `tests/e2e/surveillance-follow-up-update.spec.ts`, `scripts/qa-surveillance-follow-up-update.js`, `package.json` |

## New Finding

初回QAでは `in_progress` の日本語表示を「進行中」と期待していたが、現行UIでは「対応中」だった。これは実装不足ではなくテスト契約ズレとして、QA側を現行翻訳に合わせた。

## Next Planned Work

1. `surveillance` のマネジメントレビュー入力QAを作り、監査/是正/フォローアップ情報がレビュー項目やアクションにつながるか確認する。
2. Home/タスクとの年次サイクル接続を確認し、是正完了後の次アクション表示や期限・証跡不足の見え方を整理する。
3. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
4. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 10:49:48 JST 時点:

- main作業ツリーには、フォローアップAPI境界、監査計画詳細UI testid、surveillance follow-up QA追加、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
