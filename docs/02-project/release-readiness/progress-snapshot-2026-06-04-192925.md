---
title: ISMS Pilot Progress Snapshot 2026-06-04 19:29
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 19:29:25 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-185855.md
---

# ISMS Pilot Progress Snapshot 2026-06-04 19:29

## Purpose

このスナップショットは、2026-06-04 18:58時点の進捗記録と比較できるように、19:29時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約50%前後。

18:58からの大きな差分は、`surveillance` 側の最初のruntime QAである `qa:surveillance-first-step` がpassし、認証済み企業の1年間継続運用ストーリーについて、内部監査入口、期間集計、不適合/是正表示まで代表証跡が取れたこと。

## Comparison From Previous Snapshot

| 比較項目 | 前回 18:58 | 現在 19:29 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約48%前後 | 約50%前後 | `surveillance` の初回runtime QAがpassし、2ストーリー構成の片側が初めて画面証跡化された |
| W-02 initial | Step 5まで代表QA pass | 変更なし | 次はdeep CRUD、特に情報資産CRUDが候補 |
| W-03〜W-05 surveillance | seedのみ、runtime未着手 | `qa:surveillance-first-step` pass | 内部監査計画、FY2026 Q2集計、監査画面、不適合/是正表示を確認 |
| client/server境界 | W-02代表GETと通知系を改善済み | 監査GET系も改善 | `AuditService` の監査一覧/統計/期間/不適合GETをAPI境界へ移動 |
| 次のblocker候補 | deep CRUD / surveillance first QA | assets CRUD / 是正更新 / management review | surveillance入口は通ったため、次は更新操作とW-02資産CRUD |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 78% | `initial` / `surveillance` の2ストーリーと代表QA証跡を反映済み |
| シードデータ | 80% | 2つのモデルテナント、各テナント内ユーザー、業務データ、横断system_operatorを投入・QA済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 60% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 55% | seed資産の一覧表示はpass。新規登録/編集/削除QAが次の有力候補 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 30% | 内部監査入口、期間集計、不適合/是正表示の代表QAがpass。更新操作とマネジメントレビューは未確認 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-04-185855.md` |
| surveillance first-step QA | `npm run qa:surveillance-first-step` pass |
| surveillance QA結果 | `test-results/surveillance-first-step-run-2026-06-04T10-27-49-625Z.json`, firstBlocker `null` |
| 監査API境界 | `app/api/audit/route.ts`, `lib/services/audit.ts` |
| 静的確認 | `node --check scripts/qa-surveillance-first-step.js`, `npm run typecheck`, `git diff --check` pass |

## Parallel Lanes

2026-06-04 19:29時点で、次の子スレッドをキューし、19:30台に結果を回収した。

| Lane | Type | Scope | Result |
| --- | --- | --- | --- |
| K: Initial W-02 Assets CRUD Implementation Scout | child-thread / read-only | 情報資産CRUDのAPI/Service/UI不足調査 | thread `019e9227-1f37-7753-a4b5-219cc24bcb70`。通常CRUD APIがGETのみで、画面のcreate/update/deleteがbrowserからRepositoryへ進む構造をP1候補として確認。次は `qa:initial-w02-assets-crud` |
| L: Progress Docs Integration Checker | child-thread / read-only | docs整合チェック | thread `019e9227-1f34-7200-b42a-a7bee2adcc24`。`Next Routed Goal` の古いW-02不足表現とseed guideの汎用デモseed見出しを修正対象として確認 |

## Next Planned Work

1. 子スレッドK/Lの実体化を確認し、結果を回収する。
2. `qa:initial-w02-assets-crud` を作り、情報資産の作成/編集/削除を確認する。
3. 情報資産CRUD APIに `POST` / `PATCH` / `DELETE` とservice browser branchを追加する。API側でorganization照合と `org_admin` / `system_operator` 制限を入れる。
4. `surveillance` の次段として、是正処置更新またはマネジメントレビュー入力確認のQAを1本追加する。
5. DashboardLayoutのhydration warningは別UI課題として扱う。

## Known Worktree State

2026-06-04 19:29:25 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール、通知API、実務検証seed、W-02 QA、Step 5 QA、surveillance first-step QA、browser data boundary、docs進捗ログ周辺の未コミット変更あり。
- active goalは未完了。initial代表導線とsurveillance入口は進んだが、deep CRUDと継続運用の更新操作が残る。
