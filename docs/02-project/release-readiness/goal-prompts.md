---
title: Codex Goal Prompts
category: project
created: 2026-05-14
last_updated: 2026-06-04
author: Codex
---

# Codex Goal Prompts

この文書は、Codex CLI の `/goal` に渡す想定プロンプトです。

最初のゴールは、現状把握と採点だけを行います。実装修正は行いません。採点結果をユーザがレビューした後、最大2回の改善ループへ進みます。

2026-05-14の改善ループ後、release-readinessは43/100で、必須品質ゲートは未達です。以後は、単発の機能追加ではなく、ISMS実務・規格・市場ノウハウを補ったうえで、Plan / Do / Check / Act を分けて進めます。

## 初回ゴール: 現状把握と採点のみ

```text
/goal ISMS Pilotの現状リリース完成度を採点する。

目的:
- docs/01-business/spec-dsl/ と docs/02-project/release-readiness/ を読み、工程0〜9のチェックシートを更新する。
- コード、docs、package scripts、既存QA資料を確認し、release-readiness-scoreを実行できる範囲で実行する。
- 実装修正はしない。

必ず読むもの:
- AGENTS.md
- docs/01-business/spec-dsl/
- docs/02-project/release-readiness/README.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml
- docs/02-project/release-readiness/owner-decision-policy.md
- package.json
- docs/02-project/12_uc-checklist.md
- docs/05-quality/uc/uc-coverage-matrix.md
- docs/05-quality/testing-strategy.md

進め方:
1. 現行実装とdocsの正本差分を確認する。
2. 工程0〜9のチェックシートを、証跡・未確認事項・課題付きで更新する。
3. scripts/release-readiness-score.mjs を実行し、採点サマリーを作成する。
4. 必須品質ゲートを pass / fail / unknown で判定する。
5. P0/P1/P2課題と、次に修正すべき順序を整理する。

禁止事項:
- 実装修正をしない。
- 仕様を推測で補完しない。
- 事業判断が必要な項目を勝手に決めない。
- 90%未満でも改善ループに入らない。

最終出力:
- 総合点
- 領域別点数
- 必須品質ゲート合否
- 未確認事項
- P0/P1/P2課題
- 次に修正すべき順序
- 採点結果レビューでユーザに確認すべき事項

採点結果を出したら停止する。
```

## 再評価ゴール: 実務工程起点で補正

```text
/goal ISMS Pilotの初回リリース完成度評価を、ISMS新規導入・継続運用・内部監査・SaaS運営の実務工程を正として再評価する。

目的:
- 初回評価で不足していた工程2・3・5の観点を補正する。
- 必要であれば工程0・1・4・8・9も再評価対象に含める。
- 実装修正は行わず、必要な成果物、評価軸、ギャップ、次の実装修正候補を決定可能な形で整理する。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/assessment-2026-05-14.md
- docs/02-project/release-readiness/isms-operational-workflow-model.md
- docs/02-project/release-readiness/required-capability-matrix.md
- docs/02-project/release-readiness/capability-gap-assessment.md
- docs/02-project/release-readiness/operational-efficiency-review.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml

進め方:
1. 初回評価の工程2・3・5がUC/docs/実装資産ベースに寄っていないか確認する。
2. W-01〜W-06とCAP-01〜CAP-24を正として、必要能力と現行実装の差分を再整理する。
3. 工程0・1・4・8・9にも影響する場合は補正する。
4. 補正後のchecksheet.yamlとassessmentを更新する。
5. scripts/release-readiness-score.mjs を再実行する。

完了条件:
- 実務ワークフローモデルがある。
- 必要能力マトリクスがある。
- 現行実装との差分がP0/P1/P2/P3で分類されている。
- 初回評価の過大/過小評価が補正されている。
- 90%到達に必要な変更リストが出ている。
```

## レビュー後ゴール: 最大2回の改善ループ

```text
/goal 採点結果のP0/P1課題を優先して、最大2回の改善サイクルでrelease-readinessを改善する。

目的:
- 採点結果で見つかったP0/P1課題を優先し、最大2回の改善サイクルでリリース完成度を上げる。
- 90%以上かつ必須品質ゲート合格を目指す。
- 最大2回で未達の場合は、未達理由、残課題、次回推奨順序を出力して停止する。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml
- docs/02-project/release-readiness/owner-decision-policy.md
- docs/02-project/release-readiness/iteration-log.md
- 初回採点レポート

進め方:
1. P0/P1課題のうち、事業オーナー判断なしに修正でき、スコア改善効果が最も高いものを1つ選ぶ。
2. 1サイクルにつき焦点を1つに絞って修正する。
3. 関連する検証コマンドを実行する。
4. iteration-log.mdに、変更内容、検証結果、スコア変化、悪化点、残課題を記録する。
5. release-readiness-scoreを再実行する。
6. 90%以上かつ必須品質ゲート合格なら停止する。
7. 最大2サイクルに達したら、90%未達でも停止する。

事業判断:
- owner-decision-policy.md の既定方針に従う。
- 既定方針外の判断が必要な場合は実装せず、判断待ち項目として記録する。

禁止事項:
- 最大2サイクルを超えて続けない。
- P2/P3の見栄え改善をP0/P1より優先しない。
- 料金、データ削除、法務表現、規格認証範囲を勝手に決めない。
- テナント分離、認証、認可、監査ログの妥協をしない。

最終出力:
- 改善前後の総合点
- サイクルごとの変更内容
- 実行した検証コマンドと結果
- 必須品質ゲートの最終判定
- 90%達成または未達の理由
- 残課題と次回推奨順序
```

## 短縮版

初回採点だけを短く依頼する場合:

```text
/goal docs/02-project/release-readiness/ に従ってISMS Pilotの現状リリース完成度を採点する。実装修正はせず、チェックシート更新、採点、P0/P1/P2整理、次の修正順序の提示で停止する。
```

改善ループだけを短く依頼する場合:

```text
/goal 初回採点結果に基づき、P0/P1を優先して最大2回だけ改善する。各回で検証とiteration-log更新を行い、90%以上または2回到達で停止する。
```

## 旧推奨ゴール: W-01/W-02 Journey Gap Remediation

このゴールは2026-05-15時点の公開可能95%フレームで作成した履歴である。2026-06-04以降の当面の再開時は、下の「実務検証版への親目標再設定」を優先する。

```text
/goal Parent Objective: ISMS Pilotを公開可能95%完成度へ近づける。

Target CAP/Gate:
- W-01〜W-06 representative journey verification
- CAP-24 quality baseline
- no_critical_authz_gap
- core_journeys_work

Source of Truth:
- docs/01-business/spec-dsl/evidence-map.md
- docs/01-business/pr-faq-workshop/unknowns.md
- docs/02-project/release-readiness/journey-verification-report.md
- tests/e2e/journeys/
- Playwright trace/error-context under test-results/

Current Gap:
- Initial `npx playwright test tests/e2e/journeys --project=chromium --reporter=line` was 57/57 failed due shared JSON.parse failure.
- After `.next` cleanup and E2E dev-server restart, `/api/dev/login`, `/ja`, cookie付き`/api/auth/get-session`, W-01/W-02 representative pages return 200.
- Full Chromium journey suite now reaches business flows and reports 8 passed / 49 failed.
- W-01〜W-06 can be classified as individual implementation/test-contract gaps, but `core_journeys_work` is fail.

Scope:
- Pick one high-impact W-01/W-02 journey gap, preferably super-admin API/test-contract or org settings client/server boundary.
- Keep the fix limited to the selected journey gap.
- Re-run the affected representative journey and a targeted subset.
- Update spec-dsl and release-readiness docs with verified results.

Orchestration Plan:
- Main agent: inspect traces, error-context, failing journey expectations, route/API implementations, fixture/seed data, then implement the minimal fix.
- QA pass: run targeted dev-login/initial-route checks, the affected representative journey tests, and a relevant `tests/e2e/journeys` subset if stable.
- Readiness pass: update W-01〜W-06 and `core_journeys_work` evidence based on actual results.

Done When:
- The selected gap progresses further or passes in its representative journey.
- `/api/dev/login`, `/ja`, and representative route rendering remain non-500.
- `core_journeys_work` evidence is updated in scoring-model/checksheet/evidence-map.

Non-Goals:
- New business features.
- Contract termination/data retention/legal guarantee decisions.
- Secret value disclosure or recording.
- Broad UX polish unrelated to the shared blocker.
```

## 2026-06-04 推奨ゴール: 実務検証版への親目標再設定

```text
/goal Parent Objective: ISMS Pilotを、商用公開前の実務検証版として、未認証企業の初回審査登録準備と、認証済み企業の1年間の継続運用を、自分が利用者・テスターとして試せる状態に近づける。

目的:
- SaaS商用公開や課金運用の完成ではなく、自分が利用者・テスターとしてISMS運用に使えるかを検証する。
- 既存の `initial` / `surveillance` フェーズ選択を、初回審査登録準備ストーリーと1年間継続運用ストーリーの正本として扱う。
- docs/01-business/spec-dsl/ と現行コードを照合し、W-02〜W-05ごとに、使える部分、詰まる部分、未実装、過剰機能、事業判断待ちを整理する。

Source of Truth:
- AGENTS.md
- docs/01-business/spec-dsl/
- docs/02-project/release-readiness/
- docs/02-project/release-readiness/practical-verification-plan.md
- docs/handoff/2026-05-15_handoff.yaml
- task_plan.md
- findings.md
- progress.md
- package.json

進め方:
1. 現行の親目標を、商用公開95%ではなく実務検証版へ読み替える。
2. `initial`: 未認証企業の初回審査登録準備として、W-02を最初に検証する。
3. `surveillance`: 認証済み企業の1年間の継続運用として、W-03〜W-05を後続で検証する。
4. まずW-02について、UI操作、API、DB、監査ログ、出力物、テスト証跡を確認する。
5. 詰まった箇所は、仕様不足、実装不足、テスト契約ズレ、事業判断待ちに分類する。
6. 必要な最小実装だけ行い、検証結果をspec-dslとrelease-readiness docsへ反映する。

Done When:
- 次に検証すべき業務ジャーニーが明確になる。
- 選んだジャーニーについて、使える/使えない/直すべき箇所が証跡付きで整理される。
- 修正した場合は lint/typecheck/関連QAを実行し、結果を記録する。
- 商用公開・課金・契約責任・保証表現に関わる判断は勝手に決めず、判断待ちとして分離する。

Non-Goals:
- 本番公開
- Stripe/課金運用の完成
- 認証取得保証の表現作成
- 契約終了時の削除/復旧責任の確定
- W-02〜W-05全部を一気に完成させること
```

## 後続ゴール: ISMS実用化PDCA

以下は、改善ループ2回後に、ISMSの実世界運用に対する過不足をさらに精査し、必要機能の設計・実装・検証・整理へ進むための後続 `/goal` 群です。

大きな原則:

- 1つの巨大な `/goal` で全部を進めない。
- Plan / Do / Check / Act を分ける。
- 調査、実装、QA、レビューは subagent を適切に分ける。
- 実装前に、実務・規格・市場ノウハウを補う。
- 過剰機能は即削除せず、維持/非表示/feature flag/後続化/削除候補へ分類してから扱う。
- 各ゴールの最後に、成果物、検証結果、残課題、次アクションを記録する。

### 後続Goal 1: ISMS実務・規格・市場ノウハウ調査

```text
/goal ISMS Pilotを実世界のISMS運用で実用可能にするため、規格・公開ガイド・実務ノウハウを調査し、必要業務と必要能力を再定義する。

目的:
- 現行実装ありきではなく、ISMS新規導入・継続運用・内部監査・マネジメントレビュー・SaaS運営に必要な業務を洗い出す。
- ISO/IEC 27001, 27002, 27005, ISO 19011, NIST CSF, IPA, METI, ISMS-AC等の公開情報と実務ノウハウを参照する。
- 調査結果をW-01〜W-06とCAP-01〜CAP-24へ反映し、不足があればCAPを追加候補として整理する。
- 実装修正はしない。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/assessment-2026-05-14.md
- docs/02-project/release-readiness/iteration-log.md
- docs/02-project/release-readiness/isms-operational-workflow-model.md
- docs/02-project/release-readiness/required-capability-matrix.md
- docs/02-project/release-readiness/capability-gap-assessment.md
- docs/02-project/release-readiness/operational-efficiency-review.md
- docs/01-business/isms-process.md
- docs/01-business/isms-process-detailed.md

進め方:
1. planning-with-filesを使い、task_plan.md、findings.md、progress.mdを作成または更新する。
2. Research subagentをspawnし、規格・公開ガイド・実務ノウハウの調査を依頼する。
3. Product/ISMS analyst subagentをspawnし、調査結果をW-01〜W-06とCAP-01〜CAP-24へ落とし込ませる。
4. Main agentは結果を統合し、重複、過剰、不足、判断待ちを整理する。
5. 必要能力の追加候補、削除候補、根拠不足項目を明記する。

成果物:
- docs/02-project/release-readiness/isms-practical-research.md
- docs/02-project/release-readiness/required-capability-matrix.md の更新
- docs/02-project/release-readiness/capability-gap-assessment.md の更新
- task_plan.md / findings.md / progress.md の更新

停止条件:
- 実装に入らず、必要能力の再定義と根拠整理で停止する。
```

### 後続Goal 2: 現行コードベースとのFit & Gap棚卸し

```text
/goal 再定義したISMS必要能力を基準に、現行コードベースのFit & Gapを棚卸しする。

目的:
- CAPごとに、実装済み・実装あり未検証・docsのみ・不足・判断待ち・過剰候補へ分類する。
- 画面/API/DB/テスト/docsの存在だけで達成扱いにせず、実務ワークフロー上の証跡有無で判定する。
- P0/P1/P2/P3に優先度分解する。
- 実装修正はしない。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/isms-practical-research.md
- docs/02-project/release-readiness/required-capability-matrix.md
- docs/02-project/release-readiness/capability-gap-assessment.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml
- package.json
- app/
- lib/
- tests/
- scripts/

進め方:
1. task_plan.md、findings.md、progress.mdを更新する。
2. CAP-01〜CAP-24に加え、Goal 1で追加されたCAP-25〜CAP-32を棚卸し対象に含める。
3. Codebase auditor subagentをspawnし、app/lib/tests/scriptsをCAP単位で調査させる。
4. QA/security subagentをspawnし、既存テスト、QAスクリプト、security gateの不足を整理させる。
5. Product/ISMS analyst subagentをspawnし、実務ワークフロー上の不足・過剰候補、事業判断待ち、証跡定義不足を整理させる。
6. Main agentはFit & Gap表を統合し、P0/P1/P2/P3へ分類する。
7. CAP-25〜CAP-32について、MVP必須/重要/後続/判断待ちを仮分類する。

成果物:
- docs/02-project/release-readiness/fit-gap-inventory.md
- docs/02-project/release-readiness/capability-gap-assessment.md の更新
- P0/P1/P2/P3の実装候補リスト
- CAP-25〜CAP-32の採用/統合/後続化/判断待ち分類
- task_plan.md / findings.md / progress.md の更新

停止条件:
- 実装に入らず、棚卸し、優先順位、追加調査/事業判断待ちを確定して停止する。
```

### 後続Goal 3: 実装バックログとPDCA計画作成

```text
/goal Fit & Gap結果をもとに、ISMS実用化に必要な実装バックログとPDCA実施計画を作成する。

目的:
- Goal 2のFit & Gap結果を正本として、不足機能をP0/P1/P2/P3の実装バックログへ分解する。
- P0はCAP-02 RBAC/テナント分離とCAP-23 セキュリティ検証を最優先ゲートとして扱う。
- P1は主要導線の最新証跡化、unit/E2E/QA復旧、CAP-28 リスク基準/残留リスク受容、CAP-29 Evidence Vaultを含める。
- 過剰機能は、削除・非表示・後続化・維持のいずれかに分類する。
- Goal 1で追加されGoal 2で棚卸しされたCAP-25〜CAP-32を、採用・既存CAP統合・後続化・判断待ちへ分ける。
- 1回の改善サイクルで扱う焦点を1つに絞る。
- 実装順序、検証方法、完了条件を決定する。
- 実装修正はしない。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/isms-practical-research.md
- docs/02-project/release-readiness/fit-gap-inventory.md
- docs/02-project/release-readiness/capability-gap-assessment.md
- docs/02-project/release-readiness/required-capability-matrix.md
- docs/02-project/release-readiness/iteration-log.md
- docs/02-project/release-readiness/owner-decision-policy.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml
- package.json

進め方:
1. task_plan.md、findings.md、progress.mdを更新する。
2. Architect subagentをspawnし、P0/P1不足機能の設計粒度、依存順序、1サイクル1テーマの分割案を提案させる。
3. QA subagentをspawnし、各バックログの受け入れ条件、検証コマンド、既存失敗の復旧順序を定義させる。
4. Security subagentをspawnし、CAP-02/CAP-23/CAP-17/CAP-21を中心に、認証・認可・テナント分離・監査ログ・AI責任境界の必須条件を定義させる。
5. Product/ISMS analyst subagentをspawnし、CAP-25〜CAP-32の採用/統合/後続化/判断待ちを実務ワークフロー基準で再確認させる。
6. Main agentは、各提案をPDCA単位の実装計画に統合する。
7. 認証取得支援という表現、審査提出パッケージ保証範囲、データ保持/削除/復旧、供給者管理の深さ、顧客BCPまで扱うかは事業判断待ちとして実装計画から分離する。
8. Goal 4へ進む場合の最初の1テーマを、P0解除への効果と検証可能性で推薦する。

成果物:
- docs/02-project/release-readiness/pdca-implementation-plan.md
- docs/02-project/release-readiness/backlog-prioritization.md
- docs/02-project/release-readiness/removal-candidates.md
- 事業判断待ちリスト
- Goal 4で最初に扱う推奨テーマ
- task_plan.md / findings.md / progress.md の更新

停止条件:
- 実装可能な粒度の計画を出して停止する。Goal 4の実装には入らない。
```

### 後続Goal 4: P0/P1必須ゲート改善実装

```text
/goal pdca-implementation-plan.mdに従い、最初の1テーマとしてCAP-24 品質ゲート復旧を実装・検証する。

目的:
- P0解除に必要な検証土台を復旧し、CAP-23 セキュリティ検証とCAP-02 RBAC/テナント分離の判断を最新証跡化できる状態にする。
- 実行順は、`qa:security`、`qa:rbac:matrix`、`test:unit`、`test:e2e:smoke`、`qa:documents`、`release-readiness:score` を基本にする。
- high/critical脆弱性、テナント越境、重大認可欠陥は妥協せず、未処理ならリリース不可として記録する。
- 新機能実装へ広げず、品質ゲート復旧と証跡化に集中する。
- Goal 3でP1へ昇格したCAP-28/CAP-29は、このGoalでは設計参照に留め、実装対象にしない。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/isms-practical-research.md
- docs/02-project/release-readiness/pdca-implementation-plan.md
- docs/02-project/release-readiness/backlog-prioritization.md
- docs/02-project/release-readiness/fit-gap-inventory.md
- docs/02-project/release-readiness/iteration-log.md
- docs/02-project/release-readiness/owner-decision-policy.md
- docs/02-project/release-readiness/scoring-model.yaml
- docs/02-project/release-readiness/checksheet.yaml
- package.json
- tests/
- scripts/

進め方:
1. task_plan.md、findings.md、progress.mdを更新する。
2. 今回扱うテーマをCAP-24 品質ゲート復旧に固定する。
3. QA subagentをspawnし、`qa:security`、`qa:rbac:matrix`、`test:unit`、`test:e2e:smoke`、`qa:documents` の失敗原因と復旧順序を並行確認させる。
4. Security subagentをspawnし、CAP-23/CAP-02/CAP-17/CAP-21の妥協禁止条件と、リスク受容に回すべき項目を確認させる。
5. 必要に応じてWorker subagentをspawnし、検証土台復旧に必要な最小修正だけを担当させる。
6. Main agentは実装、検証、checksheet.yaml更新、iteration-log更新、再採点を行う。
7. P0解除に直結しないP2/P3改善、CAP-28/CAP-29の機能実装、UI polish、外部連携高度化は扱わない。

実施ルール:
- 1サイクルで1テーマのみ扱う。
- テナント分離、認証、認可、監査ログは妥協しない。
- high/criticalを受容する場合は、対象package、到達性、影響、期限、責任者、PO判断を記録し、勝手に受容しない。
- 事業判断が必要な場合は実装せず判断待ちとして記録する。
- P2/P3や見栄え改善をP0/P1より優先しない。
- このGoalではCAP-24品質ゲート復旧の1サイクルだけで停止する。

検証:
- QA_SECURITY_FAIL_ON=high npm run qa:security
- npm run qa:rbac:matrix
- npm run test:unit
- npm run test:e2e:smoke
- npm run qa:documents
- npm run release-readiness:score

成果物:
- 品質ゲート復旧の実装差分
- docs/02-project/release-readiness/iteration-log.md の更新
- docs/02-project/release-readiness/checksheet.yaml の更新
- release-readiness score更新
- P0解除済み/未解除の明確な判定
- 次に扱うべき1テーマの推薦
- task_plan.md / findings.md / progress.md の更新

停止条件:
- CAP-24品質ゲート復旧の検証結果、P0解除状況、残課題、次テーマを記録して停止する。90%未達でも停止する。
```

### 後続Goal 5: 残P0/P1ゲート解消とISMS業務ジャーニー検証準備

```text
/goal Goal 4の結果を正本として、残P0/P1品質ゲートを解消し、W-01〜W-06のISMS業務ジャーニー検証へ進める状態を作る。

目的:
- Goal 4で復旧した `qa:rbac:matrix` 34 passed を維持する。
- CAP-23 security high、unit実行失敗、E2E smoke失敗、documents QA失敗をP0/P1として扱う。
- `no_high_or_critical_security_issue` はNext 16後にpass済み。残る `no_open_p0_p1` fail とunknown gateを解除できるか確認する。
- `no_cross_tenant_access` はRBAC画面拒否だけでpass扱いにせず、API/DBテナント越境否定ケースを追加または証跡化する。
- W-01〜W-06の全面ジャーニー検証は、security/unit/smoke/documentsの主要ゲートが通るか、未達理由が明確になってから着手する。
- 新機能追加やCAP-28/CAP-29実装へ広げない。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/isms-practical-research.md
- docs/02-project/release-readiness/isms-operational-workflow-model.md
- docs/02-project/release-readiness/required-capability-matrix.md
- docs/02-project/release-readiness/pdca-implementation-plan.md
- docs/02-project/release-readiness/backlog-prioritization.md
- docs/02-project/release-readiness/iteration-log.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml
- docs/05-quality/
- tests/e2e/
- tests/unit/
- scripts/qa-*.js
- package.json

進め方:
1. task_plan.md、findings.md、progress.mdを更新する。
2. Security subagentをspawnし、Next.js high/OSV 1の到達性、更新影響、受容不可/要PO判断を整理させる。
3. QA subagentをspawnし、`test:unit` 38 fail、`test:e2e:smoke` 6 fail、`qa:documents` 6 failの最小復旧順序を整理させる。
4. Tenant-isolation/RBAC subagentをspawnし、Goal 4のRBAC 34 passedを前提に、API/DB越境否定ケースの不足を定義させる。
5. Main agentは、P0/P1解除に直結する最小修正だけを実装・検証する。
6. `qa:rbac:matrix` を再実行し、Goal 4で得たCAP-02証跡が壊れていないことを確認する。
7. `QA_SECURITY_FAIL_ON=high npm run qa:security`, `npm run test:unit`, `npm run test:e2e:smoke`, `npm run qa:documents`, `npm run release-readiness:score` を実行できる範囲で再実行する。
8. 主要ゲートが通った場合のみ、W-01〜W-06の代表ジャーニー検証計画を作成する。未達の場合は全面ジャーニー検証へ進まず、残P0/P1を確定して停止する。

実施ルール:
- high脆弱性を勝手に受容しない。受容が必要な場合はpackage、vuln id、到達性、影響、期限、責任者、PO判断待ちを記録する。
- `qa:rbac:matrix` のpassを壊す変更を入れない。
- signup、user dashboard、Dev Login tenant selector、documents timeoutは、業務ジャーニー検証の前提障害として扱う。
- P2/P3、UI polish、過剰機能整理は扱わない。

成果物:
- docs/02-project/release-readiness/quality-gate-recovery-report.md
- 必要に応じて docs/02-project/release-readiness/journey-verification-report.md の準備版
- docs/02-project/release-readiness/checksheet.yaml の更新
- docs/02-project/release-readiness/capability-gap-assessment.md の更新
- 次のP0/P1/P2リスト
- task_plan.md / findings.md / progress.md の更新

停止条件:
- 残P0/P1ゲートの解除状況、W-01〜W-06ジャーニー検証へ進めるか、追加調査/事業判断待ちが必要かを記録して停止する。
```

### 後続Goal 6: 残P0/P1ゲート継続解消とジャーニー検証前提確定

```text
/goal Goal 5の結果を正本として、残P0/P1品質ゲートを継続解消し、W-01〜W-06のISMS業務ジャーニー検証へ入れる前提を確定する。

目的:
- Goal 5で維持した `qa:rbac:matrix` 34 passed と `npm run typecheck` pass を壊さない。
- `next@14.2.35` のOSV highを、更新またはPOリスク受容判断待ちとして確定する。
- `npm run test:unit` の旧AI tests/runner混在を整理し、品質検証の土台を復旧する。
- `test:e2e:smoke` のpricing認証判定、WebKit dev-login/home不安定を解消または対象ブラウザ方針を判断待ちにする。
- `qa:documents` の英語文書ページ期待文言/i18n実装を修正する。
- API/DB tenant isolation否定ケースを追加または証跡化し、`no_cross_tenant_access` をunknownから判定可能にする。
- W-01〜W-06の全面検証にはまだ入らず、入れる/入れないの前提だけを確定する。

必ず読むもの:
- AGENTS.md
- docs/02-project/release-readiness/isms-practical-research.md
- docs/02-project/release-readiness/required-capability-matrix.md
- docs/02-project/release-readiness/fit-gap-inventory.md
- docs/02-project/release-readiness/capability-gap-assessment.md
- docs/02-project/release-readiness/quality-gate-recovery-report.md
- docs/02-project/release-readiness/checksheet.yaml
- docs/02-project/release-readiness/scoring-model.yaml
- docs/02-project/release-readiness/owner-decision-policy.md
- package.json
- tests/unit/
- tests/e2e/
- scripts/qa-*.js
- app/api/
- lib/auth/
- lib/server/auth/

進め方:
1. task_plan.md、findings.md、progress.mdを更新する。
2. Security subagentをspawnし、Next.js更新範囲、破壊的影響、代替緩和、PO判断待ち文面を整理させる。
3. Unit/QA subagentをspawnし、旧AI tests、Vitest混在、documents en、smoke pricing/WebKitの最小修正を整理させる。
4. Tenant API auditor subagentをspawnし、export/counts/departments/ai-config/members/assets exportの越境否定ケースを調査させる。
5. Main agentはP0/P1解除に直結する最小修正だけを実装する。
6. `npm run typecheck`, `npm run qa:rbac:matrix`, `npm run qa:security`, `npm run test:unit`, `npm run test:e2e:smoke`, `npm run qa:documents`, `npm run release-readiness:score` を実行できる範囲で再実行する。
7. 主要ゲートがpassした場合のみ、W-01〜W-06の代表ジャーニー検証計画を作成する。未達の場合は残P0/P1と事業判断待ちを確定して停止する。

禁止事項:
- high脆弱性を勝手にリスク受容しない。
- テナント分離、認証、認可、監査ログの妥協をしない。
- P2/P3や過剰機能整理へ広げない。
- W-01〜W-06全面ジャーニー検証へ、前提ゲート未達のまま進まない。
- 対象ブラウザ方針、Next major upgrade、リスク受容、保持/削除などの事業判断を勝手に決めない。

成果物:
- docs/02-project/release-readiness/quality-gate-recovery-report.md の更新
- 必要に応じて docs/02-project/release-readiness/journey-verification-report.md の準備版
- docs/02-project/release-readiness/checksheet.yaml の更新
- docs/02-project/release-readiness/capability-gap-assessment.md の更新
- 残P0/P1とPO判断待ちリスト
- 実行した検証コマンドと結果
- task_plan.md / findings.md / progress.md の更新

停止条件:
- W-01〜W-06ジャーニー検証へ進める状態か、Goal 6内で残P0/P1継続が必要か、事業判断待ちかを記録して停止する。
```

### 後続Goal 7: spec-dsl / release-readiness 正本同期後の代表ジャーニー検証

```text
/goal Parent Objective: ISMS Pilotを公開可能95%完成度へ近づける。Target CAP/Gate: W-01〜W-06 representative journey verification / core_journeys_work。Source of Truth: docs/01-business/spec-dsl/, docs/02-project/release-readiness/scoring-model.yaml, docs/02-project/release-readiness/checksheet.yaml, tests/e2e/journeys/. Current Gap: security high gateとdev-login/初期routeのJSON blockerは解消済みだが、core_journeys_work は8 passed / 49 failedでfail、no_critical_authz_gap はunknown、no_open_p0_p1 はfailのまま。Scope: W-01/W-02に影響が大きい個別journey gapを1つ選び、代表テストをさらに進める最小修復を行う。Done When: 選定した代表journeyが修復前より進むかpassし、`/api/dev/login`/`/ja`/代表routeのnon-500を維持し、Spec DSL/release-readiness docsへ反映される。Non-Goals: 新規業務機能の大幅追加、P2/P3 polish、データ保持/保証表現/BCP責任範囲の事業判断、secret値の取得や記録。
```
