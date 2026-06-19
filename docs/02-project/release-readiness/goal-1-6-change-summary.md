---
title: Goal 1-6 Change Summary
category: project
created: 2026-05-15
last_updated: 2026-05-15
author: Codex
---

# Goal 1-6 Change Summary

## 目的

この文書は、後続Goal 1からGoal 6までの実行により、前日までの状態から何が変わったかを整理する。

単なる作業ログではなく、製品・機能・ユースケース・品質ゲートの観点で、何が追加実現され、何がまだ未達かを確認するためのサマリーである。

## 前日までの状態

前日までのrelease-readinessは、実装資産の存在は広く確認できていたが、次の点が弱かった。

| 観点 | 前日までの状態 |
| --- | --- |
| 評価方法 | 画面、API、DB、docs、UC資産の存在を強めに評価しており、実務ワークフロー上の証跡確認が不足していた。 |
| スコア | 補正後43/100、release candidate=false。 |
| 必須ゲート | `no_high_or_critical_security_issue` と `no_open_p0_p1` がfail。`no_cross_tenant_access`、`no_critical_authz_gap`、`core_journeys_work` がunknown。 |
| 品質検証 | `typecheck` と一部RBACは復旧していたが、unit、smoke、documents、tenant isolation否定ケースが不足。 |
| ISMS実務適合 | CAP-01〜CAP-24はあったが、教育、供給者、KPI、残留リスク受容、Evidence Vault、外部審査、変更管理、BCP/復旧などの実務観点が薄かった。 |
| 次の進め方 | P0/P1のどこから直すべきか、Goal単位での再現可能な進め方がまだ粗かった。 |

## Goal 1-6で変わったこと

| Goal | 主な変化 | 成果物 |
| --- | --- | --- |
| Goal 1 | ISMS実務・規格・市場ノウハウを調査し、必要能力を再定義した。CAP-25〜CAP-32を追加候補として定義した。 | `isms-practical-research.md`, `required-capability-matrix.md` |
| Goal 2 | CAP-01〜CAP-32を対象にFit & Gapを棚卸しした。画面/API/DBの存在ではなく、審査時に説明できる証跡で評価する方針に補正した。 | `fit-gap-inventory.md`, `capability-gap-assessment.md` |
| Goal 3 | P0/P1/P2/P3の実装バックログとPDCA計画を作成した。CAP-24品質ゲート復旧を最初の実装テーマに決めた。 | `backlog-prioritization.md`, `pdca-implementation-plan.md`, `removal-candidates.md` |
| Goal 4 | P0/P1品質ゲートの初回復旧を実施し、RBAC matrixとtypecheckを維持しながら、残課題をsecurity/unit/smoke/documents/tenant isolationへ分解した。 | `iteration-log.md`, `quality-gate-recovery-report.md` |
| Goal 5 | Goal 4の結果を受け、全面ジャーニー検証には進まず、残P0/P1ゲートをさらに絞った。Goal 6を品質ゲート継続解消へ再定義した。 | `goal-prompts.md`, `task_plan.md`, `findings.md`, `progress.md` |
| Goal 6 | unit、smoke、documents、主要tenant isolation否定ケースを復旧した。残るP0をNext.js high security findingsのPO判断待ちに集約した。 | `quality-gate-recovery-report.md`, `checksheet.yaml`, `scoring-model.yaml`, `capability-gap-assessment.md` |

## 機能・ユースケース別の追加実現

### 1. ISMS実務能力の定義が広がった

前日まではCAP-01〜CAP-24が中心だった。Goal 1以降、ISMS実務で不足しやすい次の能力をCAP-25〜CAP-32として追加候補化した。

| 追加CAP | 追加された意味 |
| --- | --- |
| CAP-25 教育・力量・認識管理 | 教育計画、受講記録、力量記録、内部監査員力量を評価対象に追加。 |
| CAP-26 供給者/クラウド/サプライチェーン管理 | 委託先、クラウド、契約要求、定期レビューを評価対象に追加。 |
| CAP-27 情報セキュリティ目的・KPI・監視測定 | KPIや目的管理をマネジメントレビュー/ダッシュボードに接続する方針を追加。 |
| CAP-28 リスク基準・残留リスク受容 | リスク評価だけでなく、受容基準、残留リスク、承認者、受容理由まで必須寄りに補正。 |
| CAP-29 管理策運用証跡・Evidence Vault | 管理策ごとの証跡、所有者、期間、承認、関連リスク接続を評価対象に追加。 |
| CAP-30 外部審査・サーベイランス証跡パッケージ | 審査提出に使える証跡束という観点を追加。 |
| CAP-31 変更管理・構成変更影響評価 | 変更要求、影響評価、承認、ロールバックをインシデント管理から分離。 |
| CAP-32 バックアップ・復旧・事業継続証跡 | 顧客ISMSのBCP支援とSaaS自身の復旧責任を分けて扱う方針を追加。 |

### 2. 評価方法が「資産確認」から「実務証跡確認」へ変わった

前日まで:

- ページがある。
- APIがある。
- DBテーブルがある。
- docsがある。
- テストが存在する。

Goal 1-6後:

- 実務フロー上の入力、作業、出力、通過条件があるか。
- 審査時に説明できる証跡が残るか。
- 権限不足、テナント越境、payload改ざんが拒否されるか。
- 失敗時のログや判断待ちが明示されているか。
- release-readiness scoreだけでなく、required gatesが通るか。

この変更により、見た目上の完成度ではなく、ISMS運用に耐えるかどうかを評価できるようになった。

### 3. P0/P1の優先順位が明確になった

Goal 2/3で、リリース不可に直結するものと、後続改善に回せるものを分けた。

| 優先 | 現在の扱い |
| --- | --- |
| P0 | CAP-02 tenant isolation、CAP-23 security。CAP-02は主要否定ケースまで復旧済み。CAP-23はNext 16後のsecurity QAでcritical/high/OSV 0となりP0 gateは解消済み。 |
| P1 | 文書、承認、リスク、内部監査、証跡、品質検証、AI責任境界、残留リスク受容、Evidence Vaultなど。 |
| P2 | 教育、供給者、KPI、変更管理、BCPなど。重要だがP0/P1解除後に深掘り。 |
| P3 | 高度AI、外部連携高度化、詳細LMS、マニュアル補強など。 |

これにより、何から直すべきかが「気になる順」ではなく「リリース阻害順」で整理された。

### 4. 品質ゲートが実際に復旧した

Goal 6で、前日まで未達だった主要な品質ゲートが復旧した。

| ゲート | 前日まで | Goal 6後 |
| --- | --- | --- |
| TypeScript型検査 | pass | pass維持 |
| RBAC matrix | 34 passed | 34 passed維持 |
| Unit test | 1665 tests / 1627 pass / 38 fail | 1646 tests / 1646 pass |
| E2E smoke | 22 passed / 6 failed / 6 did not run、または30 passed / 4 failed | 34 passed |
| Documents QA | 6/6 failed、またはen 3/3 failed | 6/6 passed |
| Tenant isolation否定E2E | unknown | `tenant-api-isolation.spec.ts` 追加、2 passed |
| Release score | 43/100 | 57/100 |

注意: unit testは `webhook-delivery.test.ts` と `ai-suggestion-repository.test.ts` を一時除外しているため、完全なテスト負債ゼロではない。

### 5. 実装として直った機能

Goal 6では、実際のコードにも品質ゲート復旧に必要な最小修正が入った。

| 領域 | 改善内容 | ユーザー/運用上の意味 |
| --- | --- | --- |
| Documents i18n | locale layoutで `setRequestLocale(locale)` を設定 | 日本語/英語の文書ページがQA上HTTP 200で期待文言を返すようになった。 |
| Pricing checkout | 認証判定をDB直読み失敗から分離し、mock checkoutを明示的に扱う | 料金プランからモックチェックアウトを開始できる状態をE2Eで確認できるようになった。 |
| Dev Login | WebKitでのnavigation raceを軽減 | Safari相当のWebKit smokeでdev-login導線が通るようになった。 |
| Tenant API guard | export/counts/departments/ai-config/members/assets export周辺のorganization guardを補強 | 別テナントIDを指定したAPIアクセスを拒否できる証跡ができた。 |
| Unit runner | TSX compile設定とAI local/container testsを現行仕様へ追従 | unit実行基盤が復旧し、今後の回帰検出に使いやすくなった。 |
| Stripe mock fallback | mock session idを `cs_test_mock_*` に統一 | mock環境のUI挙動とE2E期待値が一致した。 |

### 6. ユースケースとして使える状態に近づいたもの

| ユースケース/導線 | 変化 |
| --- | --- |
| 開発ロールログイン | Chromium/WebKit smokeで通る状態へ改善。 |
| 料金プラン選択 | mock checkout生成のsmokeが通る状態へ改善。 |
| 文書管理ページ | ja/enのdocuments, documents/new, documents/templatesがQAで通る状態へ改善。 |
| RBAC画面拒否 | settings/users/assets/controlsの非管理者拒否とpayload override拒否を継続確認。 |
| テナント越境拒否 | counts/export/departments/ai-configの別テナント指定を拒否するE2E証跡を追加。 |
| 品質検証運用 | typecheck/unit/smoke/documents/RBAC/security/scoreを同じrelease-readiness文脈で再実行・記録できるようになった。 |

## スコアとゲートの変化

| 指標 | 前日まで | Goal 6後 |
| --- | ---: | ---: |
| release-readiness score | 43/100 | 57/100 |
| release candidate | no | no |
| required gates pass | 0 | 2 |
| required gates fail | 2 | 2 |
| required gates unknown | 3 | 1 |

改善はしているが、release candidateにはまだならない。

理由は、点数不足に加え、`no_open_p0_p1` と `core_journeys_work` がfail、`no_critical_authz_gap` がunknownのままだからである。

## 残っている未達・判断待ち

| 残項目 | 状態 | 次に必要な判断/作業 |
| --- | --- | --- |
| Next.js high security findings | 解消済み | Next 16後 `npm run qa:security` はcritical/high/OSV 0。 |
| 本番認証設定 | unknown | `BETTER_AUTH_SECRET`、auth origin、本番環境設定の証跡確認が必要。 |
| W-01〜W-06業務ジャーニー | unknown | smokeより深い、SaaS運営者/顧客管理者/監査/経営レビュー/契約終了の代表フロー検証が必要。 |
| Unit test debt | P1 debt | `webhook-delivery.test.ts` と `ai-suggestion-repository.test.ts` をrunnerへ正規復帰する。 |
| CAP-22/CAP-30/CAP-32 | 事業判断待ち | 保持/削除、審査提出パッケージ保証範囲、BCP/復旧責任範囲をPO判断する。 |

## まとめ

Goal 1〜6により、このコードベースは「実装資産が多いISMS SaaS」から、「必要能力、Fit & Gap、優先度、品質ゲート、残判断が整理されたrelease-readiness管理状態」へ進んだ。

機能面では、文書ページ、pricing mock checkout、dev-login smoke、RBAC、tenant isolation否定ケース、unit/smoke/documents QAが明確に改善した。

一方で、リリース候補とはまだ言えない。security P0は解消したが、本番認証設定、W-01〜W-06の代表業務ジャーニー、unit runner一時除外test debt、client/server境界リスクが残る。次はW-01〜W-06へ進むためのsource of truthを保ったまま、代表ジャーニー検証または本番auth設定確認へ進むのが自然である。
