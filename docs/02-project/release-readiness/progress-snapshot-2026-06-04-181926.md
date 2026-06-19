---
title: ISMS Pilot Progress Snapshot 2026-06-04 18:19
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 18:19:26 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-04-181412.md
---

# ISMS Pilot Progress Snapshot 2026-06-04 18:19

## Purpose

このスナップショットは、2026-06-04 18:14時点の進捗記録と比較できるように、18:19時点の状態を同じ粒度で記録する。

次回ユーザから「もう一度進捗を確認して報告して」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約40%前後。

18:14からの差分は、実装済みの完成範囲が大きく増えたというより、次の検証単位である `qa:initial-w02-journey` の実装が子スレッドで着手され、親スレッドで取り込み前確認に入ったこと。

## Comparison From Previous Snapshot

| 比較項目 | 前回 18:14 | 現在 18:19 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約40%前後 | 約40%前後 | 数値は据え置き。W-02後半QAの実装着手により次の進捗材料が見えた |
| シードデータ | 80% | 80% | 変更なし。2テナントと横断system_operatorはQA済み |
| 体制ロール / 担当者 | 70% | 70% | 変更なし。`qa:project-structure` passを維持 |
| 通知設定 | Chromium smoke pass | Chromium smoke pass | 変更なし。preferences API境界の修正済み状態を維持 |
| W-02後半QA | 次作業として未実装 | 子スレッドで `qa:initial-w02-journey` 追加作業中 | 文書、資産、リスク、管理策、タスク、Home導線を1本で見る足場を親側確認中 |
| 証跡管理 | seed証跡は再実行passを正とする方針 | 同方針を維持 | `test-results/` は揮発するため、docsには再実行可能なコマンドとpass結果を残す |

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
| 文書テンプレート / 文書整備 | 40% | seedはある。W-02後半QAで画面導線の代表確認へ進む |
| 情報資産 | 35% | seedはある。W-02後半QAで一覧表示と初期資産の見え方を確認する |
| リスク / 管理策 | 35% | seedはある。W-02後半QAでリスク、対応策、管理策リンクの存在を確認する |
| 初期タスク / 次アクション | 40% | seedはある。Home次アクションの実用性確認が次のblocker候補 |
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

現在は次の範囲を `qa:initial-w02-journey` として1本にまとめる作業中。

```text
文書テンプレート/文書
→ 情報資産
→ リスク
→ 管理策
→ 初期タスク
→ Home次アクション
```

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 実務検証seed | `npm run seed:practical-verification -- --reset` pass, `npm run qa:practical-seed` pass |
| 横断system_operator | `qa:practical-seed` で user_profile 1件、membership 2件、permission 2件、全権限を確認 |
| 通知設定runtime | `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://localhost:3007 npx playwright test tests/e2e/notifications-settings.spec.ts --project=chromium --reporter=line` pass |
| 静的確認 | `npm run typecheck` pass, `npm run lint:messages` pass, `git diff --check` pass |
| W-02後半QA | 子スレッドで実装着手。親側統合と検証はこれから |

## Next Planned Work

1. 子スレッドの `qa:initial-w02-journey` 成果を親ワークツリーへ統合する。
2. `node --check scripts/qa-initial-w02-journey.js`、`npm run typecheck`、`npm run lint:messages`、`git diff --check` を実行する。
3. 必要に応じてdev serverを起動し、`npm run qa:initial-w02-journey` をChromiumで実行する。
4. 失敗した場合は、最初のblockerを `仕様不足`、`実装不足`、`テスト契約ズレ`、`環境blocker`、`事業判断待ち` に分類して、計画書と次作業へ戻す。

## Known Worktree State

2026-06-04 18:19:26 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール、通知API、実務検証seed、docs進捗ログ周辺の未コミット変更あり。
- `docs/05-quality/code-quality-scoring-summary-2026-05-22.md` と `docs/05-quality/saas-value-code-review-2026-05-22.md` は既存の未追跡docsとして今回対象外。
- active goalは未完了。次はW-02後半の一気通貫QAを親側へ統合して検証する。
