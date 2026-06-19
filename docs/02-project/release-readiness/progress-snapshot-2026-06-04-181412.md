---
title: ISMS Pilot Progress Snapshot 2026-06-04 18:14
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 18:14:12 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-172544.md
---

# ISMS Pilot Progress Snapshot 2026-06-04 18:14

## Purpose

このスナップショットは、2026-06-04 17:25時点の進捗記録と比較できるように、18:14時点の状態を同じ粒度で記録する。

次回ユーザから「もう一度進捗を確認して報告して」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約40%前後。

前回の35〜40%から大きく飛躍したわけではないが、実務検証の開始準備として重要な「seedの使い始めやすさ」と「通知設定runtime blocker」が前進した。

## Comparison From Previous Snapshot

| 比較項目 | 前回 17:25 | 現在 18:14 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約35〜40% | 約40%前後 | seedと通知runtimeの足場が進み、実務検証開始準備が少し前進 |
| シードデータ | 75% | 80% | `operator.practical@isms-practical.local` を追加し、2テナント横断の system_operator としてQA済み |
| 体制ロール / 担当者 | 65% | 70% | `qa:project-structure` passを計画書へ反映。W-02 Step 4を `ready` に更新 |
| 通知設定 | runtime未確認、browser DB直アクセスの疑い | preferences取得/更新をAPI経由へ修正し、Chromium smoke pass | `fs.existsSync` 再発blockerを解消 |
| QA設計 | W-02後半の優先順位が未整理 | 子レーンEで次QA優先順位を整理 | 次は `qa:initial-w02-journey` が最優先 |
| 証跡管理 | `test-results/*` を参照 | `test-results/` はPlaywrightで掃除される前提を記録 | seed証跡はコマンドpassと再実行で確認する方針へ補正 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 70% | 商用公開ではなく実務検証版、`initial` / `surveillance` の2ストーリーへ整理済み |
| シードデータ | 80% | 2つのモデルテナント、各テナント内ユーザー、業務データ、横断system_operatorを投入・QA済み |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | API境界修正、担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 45% | データと画面はあるが、初回登録準備ジャーニーとしての検証は未完 |
| 文書テンプレート / 文書整備 | 40% | 機能はあるが、初回審査準備の流れとして未検証 |
| 情報資産 | 35% | seedはあるが、W-02の画面操作としてはこれから |
| リスク / 管理策 | 35% | seedはあるが、初回登録準備で「リスク→管理策→残課題」まで通す検証が必要 |
| 初期タスク / 次アクション | 40% | seedはあるが、ホームやオンボーディングから自然につながるかは未確認 |
| 継続運用 `surveillance` | 20〜25% | seedは強化済み。内部監査、是正、マネジメントレビューの年次ストーリー検証は未着手 |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Current Position

`initial` の初回登録準備ストーリーは、以下まで代表QAとdocs反映が進んだ。

```text
フェーズ選択
→ 組織基本情報
→ ISMS適用範囲
→ 体制ロール/担当者
```

次は、seedを前提に「文書テンプレート、情報資産、リスク、管理策、初期タスク、Home次アクション」を1本につなぐ。

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 実務検証seed | `npm run seed:practical-verification -- --reset` pass, `npm run qa:practical-seed` pass |
| 横断system_operator | `qa:practical-seed` で user_profile 1件、membership 2件、permission 2件、全権限を確認 |
| 通知設定runtime | `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://localhost:3007 npx playwright test tests/e2e/notifications-settings.spec.ts --project=chromium --reporter=line` pass |
| 静的確認 | `node --check scripts/qa-notifications-settings.js` pass, `npm run typecheck` pass, `npm run lint:messages` pass, `git diff --check` pass |

## Next Planned Work

1. `qa:initial-w02-journey` の足場を作る。
   - seed済みの `initial` テナントで、文書、資産、リスク、管理策、タスク、Home次アクションを一連で触る。
   - 最初のblockerを `仕様不足`、`実装不足`、`テスト契約ズレ`、`環境blocker`、`事業判断待ち` に分類する。

2. `qa:initial-assets-risks-controls` を優先する。
   - 情報資産、リスクカテゴリ/owner、対応策、管理策リンクの詰まりを先に見つける。

3. `surveillance` は後続に回す。
   - seedはできたが、年次運用の画面ジャーニー証跡はまだ薄い。

## Known Worktree State

2026-06-04 18:14:12 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール、通知API、実務検証seed、docs進捗ログ周辺の未コミット変更あり。
- `docs/05-quality/code-quality-scoring-summary-2026-05-22.md` と `docs/05-quality/saas-value-code-review-2026-05-22.md` は既存の未追跡docsとして今回対象外。
- active goalは未完了。次はW-02後半の一気通貫QAを進める。
