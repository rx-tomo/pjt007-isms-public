---
title: ISMS実用化バックログ優先順位
category: project
created: 2026-05-14
last_updated: 2026-05-14
author: Codex
---

# ISMS実用化バックログ優先順位

## 結論

Goal 3では、Goal 2のFit & Gapを正本として、実装バックログをP0/P1/P2/P3へ再整理した。リリース不可理由は `CAP-02 RBAC/テナント分離` と `CAP-23 セキュリティ検証` である。ただし、これらを解除する証跡を作るには `CAP-24 品質検証` の復旧が土台になる。

Goal 4の最初の1テーマは `CAP-24 品質ゲート復旧` を推奨する。テーマ内の実行順は、P0解除へ直結する `qa:security`、`qa:rbac:matrix`、`test:unit`、`test:e2e:smoke`、`qa:documents`、`release-readiness:score` とする。

## 優先度一覧

| 優先 | 対象CAP | バックログ | 完了条件 |
| --- | --- | --- | --- |
| P0 | CAP-23 | セキュリティhigh/critical解消 | `qa:security` でhigh/criticalが未処理で残らない。残す場合は到達性、影響、期限、責任者、受容判断が記録済み。 |
| P0 | CAP-02 | RBAC/テナント分離否定ケース | 許可ロールのみ到達でき、非許可ロール、payload改ざん、テナント越境が拒否される。 |
| P1 | CAP-24 | 品質基盤復旧 | unit、E2E、代表QA、release-readiness scoreが再実行可能で、失敗時の原因と復旧順が明示される。 |
| P1 | CAP-06, CAP-18 | 文書管理・証跡出力 | 文書作成、編集、承認依頼、版管理、テンプレート、エクスポート導線がtimeoutなく確認できる。 |
| P1 | CAP-17, CAP-21 | 監査ログ・AI責任境界 | 重要操作、権限変更、AI利用、export/delete/lockが記録され、AI出力は人手確認前提で採否ログが残る。 |
| P1 | CAP-09, CAP-28 | リスク基準・残留リスク受容 | 2026-05-15にリスク詳細へ受容件数/証跡あり件数/不足理由の可視化を追加。次は正式承認者、受容理由、レビュー履歴を保存/監査ログ化する。 |
| P1 | CAP-10, CAP-29 | 管理策運用証跡・Evidence Vault | 2026-05-15にリスク詳細へ対応策-管理策リンクのEvidence Vault準備状況を追加。次は管理策別の証跡、所有者、対象期間、承認、関連リスク、エクスポートを追跡する。 |
| P1 | CAP-01, CAP-03, CAP-05, CAP-22 | SaaS運営主要導線 | テナント作成、招待、契約状態、保持/削除境界、監査ログが一気通貫で確認される。判断待ちは分離する。 |
| P1 | CAP-13, CAP-14 | 内部監査・是正 | 監査計画、実施、指摘、報告、是正、効果確認、フォローアップが証跡化される。 |
| P1 | CAP-04, CAP-07, CAP-11, CAP-19 | 初期導入・日常運用 | 初期設定、承認、期限、タスク、次アクション可視化が実務フロー上で確認される。 |
| P2 | CAP-08, CAP-10, CAP-12, CAP-15, CAP-16, CAP-20 | MVP補強 | P0/P1解除後に、MVPに残す最小範囲と後続化する範囲を分ける。 |
| P2 | CAP-25, CAP-26, CAP-27, CAP-30, CAP-31, CAP-32 | Goal 1追加CAPの実務補強 | 教育、供給者、KPI、審査束、変更管理、BCPを軽量MVP/後続/判断待ちへ分ける。 |
| P3 | 高度AI、外部連携高度化、詳細LMS、詳細サプライチェーン分析、多言語/スクリーンショット補強 | 完成度向上 | P0/P1解除後に扱う。 |

## 復旧順序

| 順序 | 対象 | コマンド/確認 | 成功条件 | 既存課題 |
| ---: | --- | --- | --- | --- |
| 1 | CAP-23 security | `npm run qa:security` | high/critical/OSV findingsが0 | 2026-05-15 Next 16後にpass済み。以後は回帰確認として実行 |
| 2 | CAP-02 RBAC | `npm run qa:rbac:matrix` | ロール拒否、権限拒否、越境拒否がpass | Playwright browser missingにより否定E2E未確認 |
| 3 | CAP-24 unit | `npm run test:unit` | exit 0 | 38 fail。webhook/Vitest-CJS、AI local LLM、AI settings module、repository mock不整合 |
| 4 | CAP-24 E2E smoke | `npm run test:e2e:smoke` | smoke全件pass | Playwright browser missing、dev server/fixture未確認 |
| 5 | CAP-06 documents | `npm run qa:documents` | documents routesがtimeoutなくHTTP 200、期待文言あり | localhost timeout |
| 6 | scoring | `npm run release-readiness:score` | required gates全pass、unknown 0。90点以上でrelease candidate | 現状57/100、fail 1、unknown 2 |

## CAP-25〜CAP-32反映方針

| CAP | 優先 | 方針 | バックログ化する内容 |
| --- | --- | --- | --- |
| CAP-25 | P2、一部P1連動 | CAP-13へ一部統合 + 後続化 | 内部監査員力量は内部監査へ統合。教育計画/受講/力量記録は既存教育機能の検証対象。 |
| CAP-26 | P2 | 採用 | 供給者台帳、契約要求、評価日、関連リスク、定期レビューの軽量MVP。 |
| CAP-27 | P2 | CAP-15/CAP-20へ統合 | KPI/目的をマネジメントレビュー入力と日常ダッシュボードへ統合。 |
| CAP-28 | P1 | CAP-09へ統合 | リスク詳細の不足可視化は追加済み。次は正式承認履歴/レビュー履歴。 |
| CAP-29 | P1 | CAP-10/CAP-17/CAP-18と連携採用 | リスク詳細のEvidence Vault準備状況は追加済み。次は管理策別証跡束と提出出力。 |
| CAP-30 | P2/判断待ち | CAP-18へ統合 + 後続強化 | 審査向け証跡束エクスポート。保証表現は入れない。 |
| CAP-31 | P2 | CAP-16から分離採用 | 変更要求、影響評価、承認、実施記録、ロールバック/周知。 |
| CAP-32 | P2/判断待ち | 後続化 | 顧客BCP記録のテンプレート/記録欄。SaaS復旧保証は分離。 |

## 事業判断待ち

| 論点 | 質問 | 未決定時の扱い |
| --- | --- | --- |
| 製品表現 | 「認証取得支援」と言うか、「ISMS運用・証跡管理支援」に留めるか | 後者前提で計画し、保証表現は入れない。 |
| CAP-22/CAP-32 | バックアップ、復旧、契約終了後データ、サポート調査の責任範囲をどこまで明示するか | 実装計画から分離し、判断待ちにする。 |
| CAP-26 | 供給者管理MVPは軽量台帳までか、契約要求/定期レビューまで含めるか | 軽量台帳、評価日、関連リスクまでを暫定MVP。 |
| CAP-30 | 審査提出パッケージに保証ニュアンスを持たせるか | 証跡束エクスポートに留める。 |
| CAP-32 | 顧客のBCP/復旧証跡まで扱うか、テンプレート/記録欄に留めるか | テンプレート/記録欄までを暫定候補。 |
| P2未完成 | P2のCAP-25〜27/30〜32未完成をリリース阻害にするか | P0/P1解除を優先し、P2は残リスク明記で後続化。 |
