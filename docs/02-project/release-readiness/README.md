---
title: ISMS Pilot Release Readiness
category: project
created: 2026-05-14
last_updated: 2026-06-08
author: Codex
---

# ISMS Pilot Release Readiness

> 現行の作業正本は、商用公開や90%到達ではなく実務検証版です。`docs/01-business/spec-dsl/` と `practical-verification-plan.md` を優先し、旧 `release candidate` / 90% 評価は履歴評価として扱います。

このディレクトリは、ISMS Pilot を Agentic Engineering の進め方でリリース完成度 90% 以上へ近づけるための準備物です。

目的は、Codex が「現状把握、採点、改善候補整理」までを自律的に進められるように、評価基準、チェックシート、事業判断の既定方針、停止条件、実行プロンプトを先に固定することです。

最初の実行範囲は現状把握と採点までです。実装修正は、採点結果をユーザがレビューした後に開始します。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `checksheet.yaml` | 工程 0 から 9 までの進捗、証跡、判定、課題を記録するチェックシート |
| `scoring-model.yaml` | 100 点満点の採点ロジックと必須品質ゲート |
| `owner-decision-policy.md` | 事業オーナー判断が必要な項目の事前方針 |
| `goal-prompts.md` | Codex CLI の `/goal` に渡す想定プロンプト |
| `iteration-log.md` | 最大 2 回の改善ループを記録するログ |
| `capability-readiness-method.md` | 今回の進め方を再利用・検証・skill化するための方法論メモ |
| `isms-operational-workflow-model.md` | ISMS新規導入、継続運用、内部監査、SaaS運営の実務ワークフロー |
| `required-capability-matrix.md` | 実務ワークフローを成立させる必要能力一覧 |
| `capability-gap-assessment.md` | 必要能力に対する現行実装/docs/testsのギャップ分類 |
| `operational-efficiency-review.md` | 実務効率の評価観点と初回評価の補正 |
| `isms-practical-research.md` | 後続Goal 1で作成する、規格・公開ガイド・実務ノウハウ調査 |
| `fit-gap-inventory.md` | 後続Goal 2で作成する、CAP別の現行コードベースFit & Gap棚卸し |
| `pdca-implementation-plan.md` | 後続Goal 3で作成する、PDCA単位の実装計画 |
| `backlog-prioritization.md` | 後続Goal 3で作成する、P0/P1/P2/P3実装バックログ |
| `removal-candidates.md` | 後続Goal 3/6で作成・更新する、過剰/未成熟機能の安全整理候補 |
| `journey-verification-report.md` | 後続Goal 5で作成する、W-01〜W-06の業務ジャーニー検証結果 |
| `role-responsibility-snapshot-2026-06-05.md` | 現時点の実装ベースで整理した操作者ロール、代表操作、後続見直し観点 |
| `progress-snapshot-2026-06-05-143320.md` | 2026-06-05 14:33 JST時点の進捗比較ログ。監査報告書承認/却下QAの完了を記録 |
| `progress-snapshot-2026-06-05-144327.md` | 2026-06-05 14:43 JST時点の進捗比較ログ。監査計画承認/却下QAとロール整理の暫定固定を記録 |
| `progress-snapshot-2026-06-05-184156.md` | 2026-06-05 18:41 JST時点の進捗比較ログ。残留リスク受容の理由/責任者/完了証跡QAを記録 |
| `progress-snapshot-2026-06-05-185222.md` | 2026-06-05 18:52 JST時点の進捗比較ログ。SoA準備状況の画面/API/QAを記録 |
| `progress-snapshot-2026-06-05-191135.md` | 2026-06-05 19:11 JST時点の進捗比較ログ。新規リスク作成、情報資産リンク、対応策/管理策リンクQAを記録 |
| `progress-snapshot-2026-06-05-204432.md` | 2026-06-05 20:44 JST時点の進捗比較ログ。管理策単位のSoA適用/除外理由保存QAを記録 |
| `progress-snapshot-2026-06-06-165416.md` | 2026-06-06 16:54 JST時点の進捗比較ログ。SoA承認申請/CISO承認QAを記録 |
| `progress-snapshot-2026-06-06-170312.md` | 2026-06-06 17:03 JST時点の進捗比較ログ。SoA却下後修正/再申請QAを記録 |
| `progress-snapshot-2026-06-06-171701.md` | 2026-06-06 17:17 JST時点の進捗比較ログ。SoA v1固定QAを記録 |
| `progress-snapshot-2026-06-06-213831.md` | 2026-06-06 22:18 JST時点の進捗比較ログ。審査提出束マニフェスト/ZIP QAを記録 |
| `progress-snapshot-2026-06-08-094854.md` | 2026-06-08 09:48 JST時点の進捗比較ログ。審査提出束UI/ZIPダウンロードQAを記録 |
| `progress-snapshot-2026-06-08-095631.md` | 2026-06-08 09:56 JST時点の進捗比較ログ。審査提出束PDF QAを記録 |
| `progress-snapshot-2026-06-08-100655.md` | 2026-06-08 10:06 JST時点の進捗比較ログ。残留リスク受容の承認申請/CISO承認/却下QAを記録 |
| `progress-snapshot-2026-06-08-101820.md` | 2026-06-08 10:18 JST時点の進捗比較ログ。残留リスク受容の却下後修正/再申請QAを記録 |
| `progress-snapshot-2026-06-08-102908.md` | 2026-06-08 10:29 JST時点の進捗比較ログ。継続運用側の年次証跡提出束ready/gap QAを記録 |
| `progress-snapshot-2026-06-08-104215.md` | 2026-06-08 10:42 JST時点の進捗比較ログ。監査報告書承認による提出束3/7 ready化を記録 |
| `progress-snapshot-2026-06-08-104800.md` | 2026-06-08 10:48 JST時点の進捗比較ログ。不適合/是正/フォローアップによる提出束5/7 ready化を記録 |
| `progress-snapshot-2026-06-08-105400.md` | 2026-06-08 10:54 JST時点の進捗比較ログ。マネジメントレビュー完了による提出束6/7 ready化を記録 |
| `progress-snapshot-2026-06-08-105900.md` | 2026-06-08 10:59 JST時点の進捗比較ログ。残留リスク受容承認による提出束7/7 ready化を記録 |
| `progress-snapshot-2026-06-08-110500.md` | 2026-06-08 11:10 JST時点の進捗比較ログ。提出束の保証しない注意書き追加を記録 |
| `progress-snapshot-2026-06-08-124000.md` | 2026-06-08 12:40 JST時点の進捗比較ログ。提出束PDFの最小構造化を記録 |
| `progress-snapshot-2026-06-08-124800.md` | 2026-06-08 12:48 JST時点の進捗比較ログ。SoA v2差分表示を記録 |
| `progress-snapshot-2026-06-08-125700.md` | 2026-06-08 12:57 JST時点の進捗比較ログ。SoA版単位の改訂理由保存/表示を記録 |
| `progress-snapshot-2026-06-08-130600.md` | 2026-06-08 13:06 JST時点の進捗比較ログ。SoA版レビュー申請/CISO承認を記録 |
| `progress-snapshot-2026-06-08-131300.md` | 2026-06-08 13:13 JST時点の進捗比較ログ。SoA版レビュー却下後の修正版再発行/CISO承認を記録 |
| `progress-snapshot-2026-06-08-132200.md` | 2026-06-08 13:22 JST時点の進捗比較ログ。提出束PDFの複数ページ化と日本語見出しを記録 |
| `progress-snapshot-2026-06-08-132900.md` | 2026-06-08 13:29 JST時点の進捗比較ログ。残留リスク受容の責任者本人承認を記録 |
| `progress-snapshot-2026-06-08-134600.md` | 2026-06-08 13:46 JST時点の進捗比較ログ。残留リスク受容の再レビュー日を記録 |
| `progress-snapshot-2026-06-08-140100.md` | 2026-06-08 14:01 JST時点の進捗比較ログ。監査計画の新規作成/却下後修正再申請QAを記録 |
| `progress-snapshot-2026-06-08-141200.md` | 2026-06-08 14:12 JST時点の進捗比較ログ。監査報告書の却下後修正再申請QAを記録 |
| `progress-snapshot-2026-06-08-142424.md` | 2026-06-08 14:24 JST時点の進捗比較ログ。是正完了承認の申請/却下/再申請/CISO承認QAを記録 |
| `progress-snapshot-2026-06-08-143406.md` | 2026-06-08 14:34 JST時点の進捗比較ログ。承認済み監査計画の監査開始QAを記録 |
| `progress-snapshot-2026-06-08-144500.md` | 2026-06-08 14:45 JST時点の進捗比較ログ。提出束PDFの文書プロファイル/確認欄QAを記録 |
| `progress-snapshot-2026-06-08-145923.md` | 2026-06-08 14:59 JST時点の進捗比較ログ。昨日以前の提出束API/ZIP段階から今日の提出束/SoA/監査/是正/タスク導線の進捗を比較 |
| `progress-snapshot-2026-06-08-150133.md` | 2026-06-08 15:01 JST時点の進捗比較ログ。W-02初期タスクの新規作成/サブタスク完了QAを記録 |
| `progress-snapshot-2026-06-08-150716.md` | 2026-06-08 15:07 JST時点の進捗比較ログ。提出束の初期タスク進捗/親子構造evidenceを記録 |
| `progress-snapshot-2026-06-08-151513.md` | 2026-06-08 15:15 JST時点の進捗比較ログ。W-02初期タスクのコメント投稿/監査ログQAを記録 |
| `progress-snapshot-2026-06-08-152529.md` | 2026-06-08 15:25 JST時点の進捗比較ログ。W-02初期タスクのタグ作成/付与/監査ログQAを記録 |
| `progress-snapshot-2026-06-08-153110.md` | 2026-06-08 15:31 JST時点の進捗比較ログ。W-02初期タスクの添付アップロード/監査ログQAを記録 |
| `progress-snapshot-2026-06-08-153504.md` | 2026-06-08 15:35 JST時点の進捗比較ログ。W-02初期タスクの添付削除/監査ログQAを記録 |
| `progress-snapshot-2026-06-08-154150.md` | 2026-06-08 15:41 JST時点の進捗比較ログ。W-02初期タスクの担当者変更履歴QAを記録 |
| `progress-snapshot-2026-06-08-155000.md` | 2026-06-08 15:50 JST時点の進捗比較ログ。W-02初期タスクのコメント編集/削除QAを記録 |
| `progress-snapshot-2026-06-08-160000.md` | 2026-06-08 16:00 JST時点の進捗比較ログ。W-02初期タスクのコメントメンション通知QAを記録 |
| `progress-snapshot-2026-06-08-160518.md` | 2026-06-08 16:05 JST時点の進捗比較ログ。昨日以前の提出束API/ZIP段階から今日の提出束/SoA/監査/是正/タスク協働の進捗を比較 |
| `progress-snapshot-2026-06-08-160953.md` | 2026-06-08 16:09 JST時点の進捗比較ログ。監査不適合/CAPAと通常タスクの境界表示QAを記録 |
| `progress-snapshot-2026-06-08-161424.md` | 2026-06-08 16:14 JST時点の進捗比較ログ。CAPAの原因分析/再発防止/有効性確認更新QAを記録 |
| `progress-snapshot-2026-06-08-162050.md` | 2026-06-08 16:20 JST時点の進捗比較ログ。CAPAの有効性確認フォローアップ表示QAを記録 |
| `progress-snapshot-2026-06-08-162641.md` | 2026-06-08 16:26 JST時点の進捗比較ログ。CAPA画面からの有効性確認フォローアップ直接作成QAを記録 |
| `progress-snapshot-2026-06-08-163252.md` | 2026-06-08 16:32 JST時点の進捗比較ログ。CAPAフォローアップ担当者選択QAを記録 |
| `scripts/release-readiness-score.mjs` | チェックシートと採点モデルを読み、採点サマリーを出力する補助スクリプト |

## 工程

| 工程 | 名称 | 目的 |
| --- | --- | --- |
| 0 | 正本確定 | 現行実装、DSL、古い docs の食い違いを整理する |
| 1 | 規格・運用ナレッジ整理 | ISO/NIST/IPA/METI などから必要能力を抽出する |
| 2 | 利用者別ワークフロー定義 | SaaS 運営者と顧客テナントの導線を分ける |
| 3 | 機能充足ギャップ分析 | 必要機能と実装済み機能を照合する |
| 4 | 業務ルール検証 | 判断条件、状態遷移、例外処理を確認する |
| 5 | 効率性レビュー | 実務運用で迷わず使えるか確認する |
| 6 | 品質検証 | 実装が正しく動くことを証跡で確認する |
| 7 | セキュリティ検証 | SaaS として致命的なリスクを排除する |
| 8 | リリース完成度採点 | 90% 到達可否を定量判定する |
| 9 | 終了判定 | 合格または未達を確定し、作業を閉じる |

## 実行の流れ

1. `goal-prompts.md` の「初回ゴール」を使い、現状把握と採点を実行する。
2. Codex は `checksheet.yaml` を工程ごとに更新し、証跡と未確認事項を残す。
3. `scripts/release-readiness-score.mjs` を使い、採点サマリーを出す。
4. ユーザが採点結果と P0/P1/P2 課題をレビューする。
5. 初回評価の観点不足が見つかった場合は、「再評価ゴール」で工程0/1/2/3/4/5/8/9を補正する。
6. ユーザが改善実行を承認した場合のみ、「改善ゴール」を使って最大 2 回の改善ループに進む。
7. 改善ループ後も90%未達または必須ゲート未達の場合は、`goal-prompts.md` の「後続ゴール: ISMS実用化PDCA」に進む。
8. 後続ゴールでは、実務・規格・市場ノウハウ調査、Fit & Gap、PDCA計画、P0/P1実装、業務ジャーニー検証、過剰機能整理を分けて実行する。
9. 複雑な後続ゴールでは、`task_plan.md`、`findings.md`、`progress.md` を作成または更新し、subagentを調査・実装・QA・レビューへ分担させる。

## 2026-05-14 補正

初回評価では UC、既存docs、実装資産の存在を重く見たため、工程2「利用者別ワークフロー定義」、工程3「機能充足ギャップ分析」、工程5「効率性レビュー」が当初意図より過大評価になった。

以後は、実務ワークフローと必要能力を先に定義し、それに対して現行実装がどこまで満たすかを評価する。

この進め方は、`docs/01-business/spec-dsl/` で現行仕様を固定し、`docs/02-project/release-readiness/` で必要能力、Fit & Gap、品質ゲート、PDCAをつなぐ「Capability-based Release Readiness Assessment」として整理し始めている。再利用可能な型として検証するため、方法論メモを `capability-readiness-method.md` に残す。

## 2026-05-14 改善ループ後の後続方針

2026-05-15 Next 16移行とspec-dsl同期後のrelease-readinessは57/100で、リリース候補ではない。必須ゲートは `no_high_or_critical_security_issue` と `no_cross_tenant_access` がpass、`no_open_p0_p1` と `core_journeys_work` がfail、`no_critical_authz_gap` がunknownである。`.next` cleanup後のjourney再実行では、dev login/初期routeのJSON blockerは解消したが、full suiteは8 passed / 49 failedで、主要業務ジャーニーは未成立である。

次の作業は、単発の機能追加ではなく、以下のPDCAで進める。

| 段階 | 目的 | 対応するgoal |
| --- | --- | --- |
| Plan | ISMS実務・規格・市場ノウハウを補い、必要能力を再定義する | 後続Goal 1 |
| Check | 現行コードベースとのFit & Gapを棚卸しする | 後続Goal 2 |
| Plan | 不足機能・過剰機能を実装バックログとPDCA計画へ分解する | 後続Goal 3 |
| Do | P0/P1の必須ゲート改善を1テーマずつ実装する | 後続Goal 4 |
| Check | W-01〜W-06の業務ジャーニーを証跡で確認する | 後続Goal 5 |
| Act | 過剰・未成熟・後続回し機能を安全に整理する | 後続Goal 6 |

後続ゴールでは、Main agentが全作業を抱え込まず、調査、実装、QA、レビューをsubagentへ分ける。事業判断が必要な項目は `owner-decision-policy.md` に従い、方針外は判断待ちとして記録する。

## 採点とゲート

総合点は 100 点満点です。

| 領域 | 配点 |
| --- | ---: |
| ISMS 業務機能 | 30 |
| SaaS 運営 | 15 |
| UX・運用効率 | 15 |
| 品質・正確性 | 20 |
| セキュリティ | 20 |

ただし、必須品質ゲートに失敗した場合は、総合点が 90 点以上でもリリース候補にしません。

必須品質ゲート:

- 高/重大セキュリティ問題がない
- テナント越境アクセスがない
- 認証・認可の重大不備がない
- 主要業務ジャーニーが成立している
- P0/P1 不具合が未処理で残っていない

## 停止条件

初回ゴールは、採点レポート作成で停止します。

改善ゴールは、最大 2 改善サイクルで停止します。90% 以上かつ必須品質ゲート合格ならリリース候補として停止します。90% 未達の場合も、未達評価レポート、残課題、次回推奨順序を出して停止します。

事業判断が必要な内容は、都度停止ではなく `owner-decision-policy.md` の既定方針に従います。既定方針外の場合は、実装せず判断待ち項目として記録します。

## 推奨コマンド

Markdown 形式で採点サマリーを出力します。

```bash
node scripts/release-readiness-score.mjs
```

JSON 形式で出力します。

```bash
node scripts/release-readiness-score.mjs --json
```

検証コマンドを実際に実行せず、チェックシートと成果物の存在だけを集計するため、初回の現状把握でも安全に使えます。
