---
title: ISMS Pilot 初回リリース完成度採点
category: project
created: 2026-05-14
last_updated: 2026-05-14
author: Codex
---

# ISMS Pilot 初回リリース完成度採点

## 結論

- 総合点: **41 / 100**（初回60点から補正）
- 改善ループ2回後: **43 / 100**
- リリース候補: **No**
- 判定理由: 90点未達に加え、必須品質ゲートで `no_high_or_critical_security_issue` と `no_open_p0_p1` が fail。さらに、初回採点はUC・既存docs・実装資産の存在確認に寄り、ISMS新規導入/継続運用/SaaS運営の実務工程起点の評価として不足があった。
- 初回採点後のレビュー後ゴールでは、Cycle 1でセキュリティ依存関係、Cycle 2でunit test型追従を実施した。ただし最大2回到達時点でも90%と必須ゲートは未達。

## 2026-05-14 改善ループ結果

| Cycle | 焦点 | 結果 | 残課題 |
| --- | --- | --- | --- |
| 1 | RR-012 セキュリティ依存関係 | `package-lock.json`更新により `qa:security` は critical 0 / high 12 / total 35、OSV findings 1へ低減 | high脆弱性が残るため `no_high_or_critical_security_issue` はfail |
| 2 | RR-004 unit test型追従 | AI settings、AI usage、SQLite document repositoryテストを現行型へ追従し、`test:unit:build` はpass | `test:unit` は実行段階で38件失敗 |

## 2026-05-14 補正

ユーザレビューにより、工程2・3・5の評価観点が当初意図とずれていることを確認した。補正として、工程2・3・5だけでなく、工程0・1・4・8・9も見直し対象に含めた。

追加した正本:

- `isms-operational-workflow-model.md`: ISMS新規導入、継続運用、内部監査、SaaS運営の入力/作業/出力/通過条件。
- `required-capability-matrix.md`: 実務ワークフローを成立させるCAP-01〜CAP-24。
- `capability-gap-assessment.md`: 必要能力と現行実装/docs/testsのギャップ分類。
- `operational-efficiency-review.md`: 工程5をページ/docs存在ではなく実務効率で評価する観点。

初回の `60/100` は「資産存在ベースの暫定評価」とし、補正後は `41/100`、改善ループ2回後は `43/100` を現時点のrelease-readinessスコアとして扱う。

## 領域別点数

| 領域 | 点数 | 主な根拠 |
| --- | ---: | --- |
| ISMS業務機能 | 18 / 30 | 実装資産は広いが、CAP-01〜CAP-24の必要能力起点では未検証が多い。 |
| SaaS運営 | 7 / 15 | Super Admin、テナント、Stripe、監査ログの資産はあるが、W-01/W-06の一気通貫確認が不足。 |
| UX・運用効率 | 3 / 15 | ページ/docs存在は確認済みだが、初回導入・月次運用・監査準備の操作効率は未確認。 |
| 品質・正確性 | 11 / 20 | typecheck/lint/buildとunit test TSビルドは通過。unit run、E2E smoke、代表QAが失敗または環境未整備。 |
| セキュリティ | 4 / 20 | 認証/認可/tenant guardのコード根拠はあり、改善後にcriticalは解消。ただしhigh脆弱性が残り、否定E2Eも未確認。 |

## 工程別点数

| 工程 | 名称 | 点数 | 判定 |
| ---: | --- | ---: | --- |
| 0 | 正本確定 | 3 / 5 | conditional_pass |
| 1 | 規格・運用ナレッジ整理 | 5 / 10 | conditional_pass |
| 2 | 利用者別ワークフロー定義 | 5 / 10 | conditional_pass |
| 3 | 機能充足ギャップ分析 | 6 / 15 | conditional_pass |
| 4 | 業務ルール検証 | 5 / 10 | conditional_pass |
| 5 | 効率性レビュー | 3 / 10 | fail |
| 6 | 品質検証 | 6 / 15 | fail |
| 7 | セキュリティ検証 | 5 / 15 | fail |
| 8 | リリース完成度採点 | 2 / 5 | fail |
| 9 | 終了判定 | 3 / 5 | fail |

## 初回評価の過不足

| 対象 | 初回評価 | 補正後の考察 |
| --- | --- | --- |
| 工程2 | UC-01〜UC-10、ロール別マニュアル、主要ページを根拠に8/10 | UCは素材として有効だが、SaaS運営者と顧客テナントの実務ワークフロー、入力、出力、通過条件の証跡としては不足。5/10へ補正。 |
| 工程3 | app/api、lib/services、tests資産の存在を根拠に10/15 | 必要機能を先に定義せず、実装資産から逆算していた。CAP-01〜CAP-24では未検証/不足/判断待ちが多い。6/15へ補正。 |
| 工程5 | docs、manual、build対象ページを根拠に6/10 | 効率性はページの有無ではなく、導入・月次運用・監査準備・SaaS運営の手数と迷いで評価すべき。実画面確認もtimeout。3/10へ補正。 |
| 工程8 | 採点・ゲート・課題分類が作成済みとしてpass | 採点前提が不十分だったため、採点自体を再評価対象に変更。 |
| 工程9 | 90点未達とP0/P1を出して終了 | 未達判定は正しいが、90%到達に必要な変更の洗い出しが粗かったため補正付き。 |

## 必須品質ゲート

| Gate | Status | 根拠 |
| --- | --- | --- |
| 高/重大セキュリティ問題がない | fail | 改善後 `npm run qa:security`: highestSeverity=high, npm audit critical=0/high=12/total=35, OSV findings=1 |
| テナント越境アクセスがない | unknown | guard実装は確認したが、RBAC/tenant isolation否定E2EはPlaywright browser未導入で未実行 |
| 認証・認可の重大不備がない | unknown | Better Auth / requireServiceRoleは確認。build中にdefault secret warningあり、本番設定と否定E2E未確認 |
| 主要業務ジャーニーが成立している | unknown | docs上の完了記録はあるが、今回E2E smoke未実行、documents QA timeout |
| P0/P1不具合が未処理で残っていない | fail | P0 high vulnerability残存、P1 unit test実行失敗、P1 E2E smoke環境未整備 |

## 実行コマンド

| コマンド | 結果 | メモ |
| --- | --- | --- |
| `npm run typecheck` | pass | `tsc --noEmit` 成功 |
| `npm run lint` | pass with warnings | react-hooks/exhaustive-deps warning 7件 |
| `npm run build` | pass with warnings | BetterAuth default secret、SQLite lock、dynamic server usage warningsあり |
| `npm run test:unit` | fail | TSビルドは通過。run phaseで1665 tests / 1627 pass / 38 fail |
| `npm run qa:security` | command pass, security gate fail | criticalは0へ低減。high 12件、OSV findings 1件が残存 |
| `npm run test:e2e:smoke` | fail | sandbox EPERM後、外部権限ではPlaywright browser binaries missingで28 failed / 6 did not run |
| `npm run qa:documents` | fail | 起動済みdev serverに対してdocuments route timeout |
| `npm run release-readiness:score` | pass | 改善ループ後スコア43/100、release_candidate=false |

## P0/P1/P2/P3課題

| 優先度 | ID | 課題 | 次アクション |
| --- | --- | --- | --- |
| P0 | RR-012 | `qa:security`のcriticalは解消したがhigh 12件が残存 | 対象package、到達性、修正可否を確認し、依存更新またはリスク受容判断へ進む |
| P1 | RR-004 | `npm run test:unit` はTSビルド通過後、実行段階で38件失敗 | webhook/Vitest、AI local LLM、AI settings page、AISuggestionRepository mockを順に修正 |
| P1 | RR-010 | Playwright browser binaries missingでE2E smoke不能 | `npx playwright install` またはCI/browser cache整備後にsmoke再実行 |
| P1 | RR-013 | build中に `BETTER_AUTH_SECRET` default secret warning | 本番/検証環境のsecret設定、dev fallbackの扱いを確認 |
| P1 | RR-014 | テナント越境・権限拒否の否定ケース未確認 | RBAC/tenant isolation E2Eを再実行し、必須ゲートをpass/failへ更新 |
| P2 | RR-001 | 古いdocsのMVP 95%/UC 100%と現行検証結果に差分 | project-review/plan trackingを現行採点結果に同期 |
| P2 | RR-002 | 外部標準要求と製品機能の詳細マッピング未作成 | ISO/NIST/IPA/METI/ISMS-AC対応表を追加 |
| P2 | RR-008 | localhost主要ページ/QAがtimeout | dev server応答性、DB lock、ページ初期化処理を切り分け |
| P2 | RR-009 | AI支援の人手確認・監査ログ前提の実動作未確認 | AI risk workflowのE2EまたはAPI/unit証跡を取得 |
| P1 | RR-015 | CAP-01〜CAP-24の多くが最新動作証跡未取得 | 必要能力マトリクスに沿って再評価し、P0/P1/P2へ分解 |
| P3 | RR-016 | マニュアルスクリーンショット、英語版、軽微なUX文言、外部連携/AI高度化 | P0/P1解消後に完成度を押し上げる改善として扱う |

## 未確認事項

- `document_approvals` と `approval_requests` の利用境界。
- 課金プラン上限、自動アップグレード、契約終了時データ保持の実装完了範囲。
- データ削除方針: 2026-01-21 PO決定は論理削除のみ、古いsecurity-requirementsには物理削除記述があり、最終正本化が必要。
- AI入力の個人情報フィルタ、キャッシュ、ログ方針のE2E確認。
- 監査ログを全失敗系で残すか、通知チャネル失敗時の再試行/バックオフ仕様。

## 次に修正すべき順序

1. `qa:security` のhigh内訳を精査し、P0を解消または明示的にリスク受容する。
2. CAP-01〜CAP-24を、実装済み/docsのみ/未検証/不足/判断待ちへ分解し、P0/P1修正候補を確定する。
3. `npm run test:unit` の型不整合を修正し、unitをgreenに戻す。
4. Playwright browserを導入し、`npm run test:e2e:smoke` とRBAC/tenant isolation否定ケースを再実行する。
5. localhost timeoutの原因を切り分け、`qa:documents` と主要ページHTTP確認を通す。
6. 古いdocsのMVP 95%/UC 100%表記を現行採点結果へ同期する。

## 90%到達に必要な変更リスト

1. 必須ゲートを解除する: `qa:security` high、テナント越境否定ケース、認証認可否定ケース、P0/P1残件を解消する。
2. 品質ゲートを復旧する: unit test、E2E smoke、主要QA、documents QAをgreenまたは根拠付き判定にする。
3. W-01〜W-06を証跡化する: SaaS運営者の顧客設定、顧客テナント初期導入、月次運用、内部監査、経営レビュー、契約終了/データ保持の代表導線を確認する。
4. CAP-01〜CAP-24の未検証を減らす: P0/P1はリリース前対応、P2はMVP必須か後続かを決め、P3は後続改善に回す。
5. 正本差分を閉じる: 2026-01時点の95%/100%表記、削除方針、課金/契約終了、AI人手確認/監査ログ方針を現行評価へ同期する。

## ユーザレビューで確認すべき事項

- P0 high vulnerability は即時修正前提か、対象package/到達性確認後のリスク受容を許容するか。
- データ削除方針は2026-01-21 PO決定どおり「論理削除のみ」を正本にしてよいか。
- 初回改善ループは「P0 security -> unit/E2E復旧」の順で進めてよいか。
- ISO/NIST/IPA/METI/ISMS-AC対応表はMVP前必須か、release candidate後の補強でよいか。

## 外部参照

- ISO/IEC 27001:2022: https://www.iso.org/standard/27001
- ISO/IEC 27005:2022: https://www.iso.org/standard/80585.html
- ISO/IEC 27017:2015: https://www.iso.org/standard/43757.html
- ISO 19011:2018: https://www.iso.org/standard/70017.html
- ISO 22301:2019: https://www.iso.org/standard/75106.html
- NIST CSF 2.0: https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20
- IPA 情報セキュリティ10大脅威: https://www.ipa.go.jp/security/10threats/index.html
- METI サイバーセキュリティ経営ガイドライン: https://www.meti.go.jp/policy/netsecurity/mng_guide.html
- ISMS-AC 適合性評価制度: https://isms.jp/isms/about.html
