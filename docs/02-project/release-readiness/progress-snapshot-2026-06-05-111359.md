---
title: ISMS Pilot Progress Snapshot 2026-06-05 11:13
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 11:13:59 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-110157.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 11:13

## Purpose

このスナップショットは、2026-06-05 11:06時点の進捗記録と比較できるように、2026-06-05 11:13時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約58%前後。

11:06からの大きな差分は、`surveillance` の年次運用で、Homeのタスク統計が実データを返し、Homeタスクカードからレビュー関連の次アクションへ辿れるようになったこと。これにより、W-05はレビュー入力だけでなく、レビュー前後の次アクションを利用者が探せる代表導線まで確認できた。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 11:06 | 現在 2026-06-05 11:13 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約57%前後 | 約58%前後 | surveillanceのHome/タスク年次サイクルQAがpass |
| W-05 management review | レビュー入力と改善アクション追加までpass | Homeタスク統計、タスクカード遷移、レビュー関連次アクション検索表示までpass | W-05 Step 4が `unverified` から `representative_ready` へ前進 |
| Home統計 | リポジトリ実装がダミー0 | user/document/task/risk/auditの実データ集計に変更 | 実務検証seedの状態をHomeで読める |
| client/server境界 | management review更新/アクション追加は既存API + 監査ログ | Home統計もsettings API経由へ移動 | Homeでbrowser direct DB accessを避ける |
| 次タスク | Home/タスクとの年次サイクル接続、W-02残りdeep CRUD | 通知/証跡不足/期限超過表示、W-02残りdeep CRUD | Home/タスク接続は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 86% | W-05のHome/タスク接続証跡をcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 83% | 2つのモデルテナント、業務データ、横断system_operator、部門スコープ、レビューseedを維持 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 50% | 内部監査入口、期間集計、不適合/是正表示、不適合/是正更新、フォローアップ、マネジメントレビュー入力、Homeタスク統計/次アクション表示、監査ログまでpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-110157.md` |
| surveillance home/task cycle QA | `npm run qa:surveillance-home-task-cycle` pass |
| surveillance home/task cycle QA結果 | `test-results/surveillance-home-task-cycle-run-2026-06-05T02-13-45-012Z.json`, firstBlocker `null` |
| practical seed QA | `npm run qa:practical-seed` pass。2テナント、shared operator cross-tenant membership/permission、management review seed件数を確認 |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| Home stats API | `app/api/organizations/[organizationId]/settings/route.ts`, `lib/services/organization.ts`, `lib/db/repositories/sqlite/OrganizationRepository.ts` |
| QA追加 | `tests/e2e/surveillance-home-task-cycle.spec.ts`, `scripts/qa-surveillance-home-task-cycle.js`, `package.json` |

## New Finding

Home統計は、これまでリポジトリ側で0固定のダミー値を返していた。実務検証では、タスク、文書、リスク、監査の状態がHomeで見えないと「次に何をすべきか」が分からないため、今回はまずタスク統計と状態内訳がseedに同期するよう実データ集計へ変えた。

## Next Planned Work

1. `surveillance` で期限超過、証跡不足、通知/リマインドがHome/タスク/通知でどう見えるかを確認する。
2. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
3. 経営判断、資源配分、リスク受容をマネジメントレビュー上でどこまで扱うかを、既存モデルに合わせて小さく設計する。
4. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 11:13:59 JST 時点:

- main作業ツリーには、Home統計実データ化、settings stats API、タスク行testid、surveillance home/task cycle QA追加、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
