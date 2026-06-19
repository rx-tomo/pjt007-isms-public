---
title: ISMS Pilot Progress Snapshot 2026-06-05 11:33
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 11:33:07 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-111359.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 11:33

## Purpose

このスナップショットは、2026-06-05 11:13時点の進捗記録と比較できるように、2026-06-05 11:33時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約59%前後。

11:13からの大きな差分は、`surveillance` の年次運用で、期限超過タスクが統計APIとタスク画面で見え、期限接近タスクのリマインダー通知が担当者の通知一覧に届く代表QAが通ったこと。これにより、W-03/W-05の「次アクションを見つける」導線に、期限と通知の証跡が加わった。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 11:13 | 現在 2026-06-05 11:33 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約58%前後 | 約59%前後 | surveillanceの期限超過/通知QAがpass |
| W-03 daily operation | 通知/期限超過は未確認 | 期限超過の統計/タスク画面表示、リマインダー通知、送信記録、監査ログがpass | W-03が `implementation_gap` から `partial_verified` へ前進 |
| W-05 next action | Home/タスク統計とレビュー次アクションまでpass | Home/タスクに加えて通知一覧まで確認 | 年次運用の「気づく」導線が広がった |
| seed reset | 主要業務データの復元はpass | 通知、通知設定、リマインダー、通知配送ログもreset対象に追加 | QAを繰り返しても通知系データが濁りにくくなった |
| 次タスク | 通知/証跡不足/期限超過表示、W-02残りdeep CRUD | 証跡不足表示、経営判断/資源配分/リスク受容、W-02残りdeep CRUD | 通知/期限超過は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 87% | W-03/W-05の期限/通知証跡をcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 84% | 2つのモデルテナントに加え、通知系のreset耐性を追加 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 52% | 内部監査入口、是正、フォローアップ、マネジメントレビュー、Homeタスク統計、期限超過、リマインダー通知、監査ログまでpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-111359.md` |
| surveillance overdue/reminder QA | `npm run qa:surveillance-overdue-reminder` pass |
| surveillance overdue/reminder QA結果 | `test-results/surveillance-overdue-reminder-run-2026-06-05T02-32-02-154Z.json`, firstBlocker `null` |
| seed復元 | `npm run seed:practical-verification -- --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| diff check | `git diff --check` pass |
| QA追加 | `tests/e2e/surveillance-overdue-reminder.spec.ts`, `scripts/qa-surveillance-overdue-reminder.js`, `package.json` |

## New Finding

リマインダーQAは、通知設定だけでなく、タスク期限、通知生成、送信記録、監査ログ、担当者通知一覧までを一連で見る必要がある。今回のQAでは、期限接近タスクをテスト内で作り、実行後にseed resetで戻す形にした。これにより、日付依存のQAでも固定seedを汚さず繰り返せる。

## Next Planned Work

1. `surveillance` で「証跡不足」がHome/タスク/監査/リスクのどこで見えるべきかを小さく確認する。
2. 経営判断、資源配分、リスク受容をマネジメントレビュー上でどこまで扱うかを、既存モデルに合わせて小さく設計する。
3. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
4. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 11:33:07 JST 時点:

- main作業ツリーには、通知一覧testid、seed reset通知系cleanup、surveillance overdue/reminder QA追加、DSL図解SVG/PNG、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
