---
title: ISMS Pilot Progress Snapshot 2026-06-04 18:47
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 18:47:51 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-183756.md
---

# ISMS Pilot Progress Snapshot 2026-06-04 18:47

## Purpose

このスナップショットは、2026-06-04 18:37時点の進捗記録と比較できるように、18:47時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約46%前後。

18:37からの大きな差分は、W-02 Step 5のユーザー招待/受諾/ロール付与/権限変更/監査ログ確認を、独立したQAとして実行できる足場を追加したこと。ただし、この時点では新QAのruntime passはまだ取得前であるため、進捗率は小幅な前進にとどめる。

## Comparison From Previous Snapshot

| 比較項目 | 前回 18:37 | 現在 18:47 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約45%前後 | 約46%前後 | Step 5の実行QA足場を追加。runtime検証は未完了のため小幅前進 |
| W-02代表導線 | `qa:initial-w02-journey` pass | 変更なし | 文書、情報資産、リスク、管理策、タスク、Home次アクションまでは引き続き代表導線pass済み |
| ユーザー招待/ロール付与 | implementation_gap | QA実装中 | `qa:initial-user-lifecycle` を追加し、招待作成、受諾、membership、role、permission、audit logを検証対象化 |
| client/server境界 | W-02代表画面をAPI境界へ移動済み | ユーザー/権限系も追加整理 | browser側の `UserService.inviteUser` と `PermissionService` をAPI経由に寄せる変更を追加 |
| 証跡 | W-02後半QA結果あり | 新QAは実行待ち | 静的確認は一部済みだが、Playwright runtime証跡は未取得 |
| 次のblocker候補 | 招待/ロール付与 | 招待ライフサイクルQAのruntime結果 | 失敗すれば `仕様不足` / `実装不足` / `テスト契約ズレ` / `環境blocker` に分類する |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 75% | `initial` / `surveillance` の2ストーリーとW-02代表QA証跡を反映済み |
| シードデータ | 80% | 2つのモデルテナント、各テナント内ユーザー、業務データ、横断system_operatorを投入・QA済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | API境界修正、担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 50% | Step 5用QAとAPI境界修正を追加。招待から権限変更までのruntime passは未取得 |
| 文書テンプレート / 文書整備 | 55% | seed文書の一覧表示はW-02代表QAでpass。テンプレート作成/承認導線は次段 |
| 情報資産 | 55% | seed資産の一覧表示はW-02代表QAでpass。新規登録/CSVは次段 |
| リスク / 管理策 | 55% | seedリスク、対応策、管理策、リンクのDB存在と一覧表示はW-02代表QAでpass。新規評価/リンク編集は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はW-02代表QAでpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 20〜25% | seedは強化済み。内部監査、是正、マネジメントレビューの年次ストーリー検証は未着手 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Current Position

`initial` の初回登録準備ストーリーは、代表QAとして以下まで1本で確認済み。

```text
フェーズ選択
→ 組織基本情報
→ ISMS適用範囲
→ 体制ロール/担当者
→ 文書/情報資産/リスク/管理策/タスク/Home次アクション
```

現在は、その次の穴であるユーザー招待ライフサイクルへ着手している。

```text
ユーザー招待
→ 招待受諾
→ user profile / membership 作成
→ ロール変更
→ 権限変更
→ 監査ログ確認
```

ただし、18:47時点ではこのStep 5 QAのruntime passはまだ取れていない。現時点の分類は `implementation_gap` から `verification_in_progress` へ移動中。

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-04-183756.md` |
| W-02後半代表QA | `npm run qa:initial-w02-journey` pass。結果: `test-results/initial-w02-journey-run-2026-06-04T09-37-20-489Z.json`, firstBlocker `null` |
| 新規追加中QA | `package.json` の `qa:initial-user-lifecycle`, `scripts/qa-initial-user-lifecycle.js`, `tests/e2e/initial-user-lifecycle.spec.ts` |
| 新規API境界 | `app/api/invitations/route.ts`, `app/api/organizations/[organizationId]/members/permissions/route.ts`, `lib/services/user.ts`, `lib/services/permissions.ts` |
| 静的確認 | `node --check scripts/qa-initial-user-lifecycle.js`, `npm run typecheck`, `npm run lint:messages`, `git diff --check` は前段でpass済み。runtime QAは未完了 |

## Next Planned Work

1. `npm run qa:practical-seed` で実務検証seedの再確認を行う。
2. dev serverを起動し、`npm run qa:initial-user-lifecycle` を実行する。
3. 失敗した場合は、最初のblockerを `仕様不足` / `実装不足` / `テスト契約ズレ` / `環境blocker` / `事業判断待ち` へ分類して、最小修復する。
4. passした場合は、W-02 Step 5を `ready` または `representative_ready` に更新し、spec-dslとrelease-readinessへ証跡を戻す。
5. 次に、文書、情報資産、リスク、管理策、タスクの作成・編集・承認/リンク更新の深掘りQAへ進む。

## Known Worktree State

2026-06-04 18:47:51 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール、通知API、実務検証seed、W-02後半QA、browser data boundary、Step 5ユーザーライフサイクルQA、docs進捗ログ周辺の未コミット変更あり。
- active goalは未完了。W-02代表導線は進んだが、Step 5のruntime QA、作成/編集系の深掘り操作QA、`surveillance` 検証が残る。
