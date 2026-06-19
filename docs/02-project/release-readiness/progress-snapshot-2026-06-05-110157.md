---
title: ISMS Pilot Progress Snapshot 2026-06-05 11:06
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 11:06:20 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-104948.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 11:06

## Purpose

このスナップショットは、2026-06-05 10:49時点の進捗記録と比較できるように、2026-06-05 11:06時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約57%前後。

10:49からの大きな差分は、`surveillance` の年次運用出口に近いW-05で、マネジメントレビュー詳細を画面から更新し、改善アクションを追加し、DB永続化と監査ログまで確認できたこと。これにより、W-03〜W-05は内部監査入口、不適合/是正、フォローアップ、マネジメントレビュー入力まで代表QAが通った。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 10:49 | 現在 2026-06-05 11:06 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約56%前後 | 約57%前後 | surveillanceのマネジメントレビュー入力QAがpass |
| W-05 management review | seedあり、runtime QA未実施 | 議事録/結論/ステータス更新、改善アクション追加、DB永続化、監査ログまでpass | W-05 Step 3が `unverified` から `representative_ready` へ前進 |
| client/server境界 | 監査計画詳細とfollow-up更新はAPI境界へ移動済み | management review更新/アクション追加は既存APIを使い、監査ログを追加 | W-05の更新操作にも証跡が残る |
| シードデータ | QA後に `surveillance` seedを再reset済み | management review QA後も `surveillance` seedを再reset済み | 次回も同じ初期状態から試せる |
| 次タスク | management review、Home/タスクとの年次サイクル接続 | Home/タスクとの年次サイクル接続、W-02残りdeep CRUD | management reviewは完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 85% | W-05のマネジメントレビュー入力証跡をcapabilities/workflows/evidence-mapへ反映 |
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
| 継続運用 `surveillance` | 48% | 内部監査入口、期間集計、不適合/是正表示、不適合/是正更新、フォローアップ完了/検証済み更新、マネジメントレビュー入力、監査ログまでpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-104948.md` |
| surveillance management review input QA | `npm run qa:surveillance-management-review-input` pass |
| surveillance management review QA結果 | `test-results/surveillance-management-review-input-run-2026-06-05T02-05-24-867Z.json`, firstBlocker `null` |
| practical seed再復元 | `npm run seed:practical-verification -- --reset --scenario all` pass。結果: `test-results/practical-verification-seed-all-2026-06-05T02-06-07-328Z-63563.json` |
| practical seed QA | `npm run qa:practical-seed` pass。2テナント、shared operator cross-tenant membership/permission、management review seed件数を確認 |
| W-05 API証跡 | `app/api/management-reviews/[id]/route.ts`, `app/api/management-reviews/[id]/actions/route.ts` |
| W-05 UI test id | `app/[locale]/management-reviews/[id]/page.tsx` |
| QA追加 | `tests/e2e/surveillance-management-review-input.spec.ts`, `scripts/qa-surveillance-management-review-input.js`, `package.json` |

## New Finding

マネジメントレビュー更新と改善アクション追加のAPIは存在していたが、監査ログは残していなかった。今回、`management_review.updated` と `management_review.action_created` を追加し、レビュー入力が年次運用の証跡として追えるようになった。

## Next Planned Work

1. Home/タスクとの年次サイクル接続を確認し、是正完了・レビュー後の次アクション表示や期限・証跡不足の見え方を整理する。
2. W-02の残り深掘りとして、文書作成/承認、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
3. 経営判断、資源配分、リスク受容をマネジメントレビュー上でどこまで扱うかを、既存モデルに合わせて小さく設計する。
4. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 11:06:20 JST 時点:

- main作業ツリーには、management review監査ログ、UI testid、surveillance management review QA追加、seed reset監査ログ対応、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
