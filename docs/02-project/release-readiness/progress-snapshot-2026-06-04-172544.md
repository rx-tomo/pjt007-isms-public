---
title: ISMS Pilot Progress Snapshot 2026-06-04 17:25
category: project
created: 2026-06-04
snapshot_at: 2026-06-04 17:25:44 JST
author: Codex
status: active
---

# ISMS Pilot Progress Snapshot 2026-06-04 17:25

## Purpose

このスナップショットは、実務検証版 goal の進捗を後日比較できるように記録する。

ユーザから「もう一度進捗を確認して報告して」と依頼された場合は、このファイルを基準に、同じ区分・同じ粒度で現在状態を再確認し、差分を提示する。

## Overall Progress

現時点の実務検証版としての全体進捗は、約35〜40%。

評価軸は、商用公開可否ではなく、ユーザ自身が利用者・テスターとして「初回登録準備」と「1年間の継続運用」を実務に近い形で試せるかどうか。

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 70% | 商用公開ではなく実務検証版、`initial` / `surveillance` の2ストーリーへ整理済み |
| シードデータ | 80% | 初回登録準備・継続運用の固定seedに、2テナント横断の実務検証用 `system_operator` を追加済み。今後の機能追加に合わせて拡張が必要 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 65% | API境界を修正し、担当者割当・再読込QAは成功。docs反映とコミット前 |
| 部門 / ユーザー管理 | 45% | 画面・データはあるが、初回登録準備ジャーニーとしての検証は未完 |
| 文書テンプレート / 文書整備 | 40% | 機能はあるが、初回審査準備の流れとして未検証 |
| 情報資産 | 35% | 基盤はあるが、W-02の一連手順としてはこれから |
| リスク / 管理策 | 35% | 部分機能はあるが、初回登録準備で「リスク→管理策→残課題」まで通す検証が必要 |
| 初期タスク / 次アクション | 40% | タスク機能はあるが、ホームやオンボーディングから自然につながるかは未確認 |
| 継続運用 `surveillance` | 20〜25% | 内部監査、是正、マネジメントレビューは機能片はあるが、1年運用ストーリーとして未検証 |
| SaaS/課金/テナント提供 | 35〜40% | Stripeやテナント管理の実現可能性確認は進んでいるが、今回の主目標では後回し |

## Current Position

`initial` の初回登録準備ストーリーを前から順番に検証している。

現在の到達点:

```text
フェーズ選択
→ 組織基本情報
→ ISMS適用範囲
→ 体制ロール/担当者
```

体制ロール周りでは、ブラウザからDB層を直接触っていた問題をAPI経由へ修正し、`qa:project-structure` は成功済み。

## Evidence

| 項目 | 証跡 |
| --- | --- |
| フェーズ選択 | `test-results/phase-selector-run-2026-06-04T07-43-25-385Z.json` |
| 組織基本情報 | `test-results/organization-profile-run-2026-06-04T07-56-02-212Z.json` |
| ISMS適用範囲 | `test-results/isms-scope-run-2026-06-04T08-01-15-985Z.json` |
| 体制ロール/担当者 | `test-results/project-structure-run-2026-06-04T08-15-45-677Z.json` |
| 実務検証seed | `npm run seed:practical-verification -- --reset` pass, `npm run qa:practical-seed` pass |
| 静的確認 | `npm run typecheck` pass, `npm run lint:messages` pass |

## Update Log

### 2026-06-04 18:09:24 JST

- 実務検証seedに `operator.practical@isms-practical.local` を追加した。
- 同一 `system_operator` が `initial` / `surveillance` の両テナントに active membership を持ち、両方で文書、リスク、タスク、監査、資産、管理策の全権限を持つことを `qa:practical-seed` で確認した。
- `seed:practical-verification -- --reset` は 2組織、11 user/account/profile、12 memberships、12 permission sets、文書、資産、リスク、管理策、タスク、内部監査、是正、マネジメントレビューを投入してpassした。
- 子レーンEの棚卸しにより、次のQA優先順位は `qa:initial-w02-journey`、`qa:initial-assets-risks-controls`、`qa:initial-documents-tasks-home`、`qa:surveillance-yearly-cycle`、`qa:practical-evidence-check` とした。
- 子レーンFのruntime smokeで、通知設定ページの `NotificationService.getPreferences()` がbrowserからDBへ直接アクセスして `fs.existsSync` を再発させることを確認した。親worktreeでpreferences取得/更新を `/api/notifications` 経由へ修正し、`PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_TEST_BASE_URL=http://localhost:3007 npx playwright test tests/e2e/notifications-settings.spec.ts --project=chromium --reporter=line` はpassした。
- `test-results/` はPlaywright実行で掃除されるため、seed scriptの出力JSONパスは永続証跡ではなく、次回比較ではコマンドpassと必要に応じた再実行を証跡にする。

## Planned Order

1. 体制ロール修正を仕上げる。
   - `qa:project-structure` の結果を `spec-dsl` / `practical-verification-plan` / `progress` に反映する。
   - `npm run typecheck`, `npm run lint:messages`, 体制QAを再実行する。
   - コミットする。

2. W-02 初回登録準備ストーリーを続ける。
   - ユーザー・招待・担当者配布。
   - 文書テンプレートの準備。
   - 情報資産登録。
   - リスク評価。
   - 管理策選定。
   - 初期タスクとホームの次アクション表示。

3. 初回登録準備の通し検証を作る。
   - `initial` を選んだ企業が審査準備まで進む通しテストを作る。
   - 詰まりを `仕様不足`、`実装不足`、`テスト契約ズレ`、`事業判断待ち` に分類する。

4. その後に `surveillance` へ進む。
   - 年間運用。
   - リスク見直し。
   - 内部監査。
   - 不適合・是正。
   - マネジメントレビュー。
   - 証跡と次アクション。

## Known Worktree State

2026-06-04 17:25:44 JST 時点:

- `main` は `origin/main` より6コミット ahead。
- 体制ロール/通知API周辺の未コミット変更あり。
- 既存の未追跡docs 2件は今回の進捗スナップショット対象外として触らない。

## Next Comparison Format

次回進捗確認時は、以下を比較する。

| 比較項目 | 確認方法 |
| --- | --- |
| 全体進捗 | このファイルの35〜40%から増減を説明する |
| パート別進捗 | `Progress By Area` と同じ表で差分を出す |
| 到達済みジャーニー | `Current Position` の矢印に追加/停滞を示す |
| 証跡 | 新しい `test-results/*`、docs、commitsを追記する |
| 次の段取り | `Planned Order` から完了済み/変更点を分ける |
