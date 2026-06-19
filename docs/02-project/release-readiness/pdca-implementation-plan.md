---
title: ISMS実用化PDCA実施計画
category: project
created: 2026-05-14
last_updated: 2026-05-14
author: Codex
---

# ISMS実用化PDCA実施計画

## 位置づけ

この文書は、Goal 4以降で実装・検証へ進むためのPDCA計画である。Goal 3では実装しない。1サイクル1テーマを原則にし、必ず検証結果とrelease-readinessへの影響を記録してから次へ進む。

## 推奨結論

Goal 4の最初の1テーマは `CAP-24 品質ゲート復旧` とする。ただし、目的はP0解除であるため、実行順は `CAP-23 セキュリティ`、`CAP-02 RBAC/テナント分離`、unit、E2E、documents QA、再採点の順にする。

P0そのものは `CAP-02` と `CAP-23` であり、CAP-24はそれらを解除するための証跡土台である。Goal 4では、品質ゲート復旧の範囲を広げすぎず、P0/P1ゲート確認に必要なコマンド復旧と証跡化に限定する。

## PDCAサイクル一覧

| Cycle | テーマ | 対象CAP | Plan | Do | Check | Act |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 品質ゲート復旧 | CAP-24, CAP-23, CAP-02 | P0解除に必要な検証コマンドと失敗分類を確定する | `qa:security`, `qa:rbac:matrix`, `test:unit`, `test:e2e:smoke`, `qa:documents` を復旧する | P0 gate、unit/E2E/QA、scoreの結果を確認 | passはchecksheetへ反映、failは次テーマへ分解 |
| 2 | テナント境界と権限否定系 | CAP-02, CAP-17 | ロール別許可/拒否、越境拒否、失敗ログ要件を確定する | API/UI guard、RBAC matrix、否定E2Eを整える | `qa:rbac:matrix`, RBAC E2E, audit log確認 | テナント越境が残る場合はリリース不可として停止 |
| 3 | セキュリティ脆弱性ゲート | CAP-23 | high/criticalを修正/到達性評価/受容へ分類する | 依存更新、設定修正、リスク受容記録を行う | `QA_SECURITY_FAIL_ON=high npm run qa:security` | 未処理high/criticalが残る場合はリリース不可 |
| 4 | 文書ライフサイクル | CAP-06, CAP-07, CAP-18, CAP-29 | 文書作成、版、承認、改訂、適用、出力の導線を確定する | documents QA timeoutを解消し、文書導線を復旧する | `qa:documents`, documents E2E, export確認 | 文書証跡をCAP-29/18へ接続する |
| 5 | リスク基準と残留リスク受容 | CAP-09, CAP-28, CAP-15 | リスク基準、受容基準、承認者、受容理由、レビュー履歴を定義する | リスク導線に残留リスク受容の証跡を統合する | `qa:risks:matrix`, `qa:risks:export` | マネジメントレビューへの接続を確認する |
| 6 | Evidence Vault最小版 | CAP-10, CAP-17, CAP-18, CAP-29 | 証跡メタデータ、管理策/リスク/文書紐づけ、提出用出力を定義する | 既存証跡資産を管理策別に追跡できる形へ整える | audit/document/export QA | 審査説明できる証跡チェーンを確認する |
| 7 | 内部監査・教育連携 | CAP-13, CAP-14, CAP-25 | 監査員力量、監査証拠、CAPAを内部監査導線へ統合する | 監査計画、実施、指摘、是正、効果確認をつなぐ | audit journey, `qa:audit-report` | フォローアップまで証跡化する |
| 8 | P2実務補強 | CAP-26, CAP-27, CAP-31 | 供給者、KPI、変更管理を軽量MVPへ分解する | 必要最小限だけ実装候補化し、過剰部分は後続化する | supplier/KPI/change QA案 | P2残リスクを明記する |
| 9 | 判断待ち分離 | CAP-22, CAP-30, CAP-32 | 保持/削除、保証表現、BCP責任をPO判断へ分ける | docsとbacklogへ判断待ちを分離する | PO判断有無を確認 | 判断済みならbacklog化、未判断なら後続/停止条件へ残す |

## Goal 4 初回テーマ詳細

| 項目 | 内容 |
| --- | --- |
| テーマ | CAP-24 品質ゲート復旧 |
| 目的 | P0解除に必要な検証コマンドを復旧し、CAP-02/CAP-23の判断を証跡化できる状態にする |
| 対象 | `qa:security`, `qa:rbac:matrix`, `test:unit`, `test:e2e:smoke`, `qa:documents`, `release-readiness:score` |
| 非対象 | CAP-28/29の機能実装、P2追加CAP実装、UI polish、外部連携高度化 |
| 完了条件 | P0 gateの実行結果が最新化され、unit/E2E/QAの失敗が修正済みまたは次テーマへ分解され、再採点できる |
| 停止条件 | high/critical未処理、テナント越境、重大認可欠陥が残る場合はリリース不可として停止 |

## 検証コマンド

| 目的 | コマンド | 合格条件 |
| --- | --- | --- |
| セキュリティ | `QA_SECURITY_FAIL_ON=high npm run qa:security` | high以上で失敗させ、0件または承認済み例外のみ |
| RBAC/テナント分離 | `npm run qa:rbac:matrix` | ロール拒否、権限拒否、越境拒否がpass |
| unit | `npm run test:unit` | pass。既知失敗は修正または根拠付き隔離 |
| E2E smoke | `npm run test:e2e:smoke` | Playwright環境込みでpass |
| documents | `npm run qa:documents` | documents routeがtimeoutなくHTTP 200、期待文言あり |
| 再採点 | `npm run release-readiness:score` | required gates全pass、unknown 0。90点以上でrelease candidate |

## 妥協禁止条件

- high/criticalのセキュリティ問題を未処理のままリリース候補にしない。
- テナント越境、権限不足操作、payload改ざんが通る状態を許容しない。
- UI非表示だけで認可済み扱いにしない。API拒否まで確認する。
- 権限変更、テナント操作、AI利用、export/delete/lockの監査ログを根拠なく省略しない。
- AI出力を人手確認なしで自動確定しない。

## Goal 4へ渡す推奨

Goal 4では `CAP-24 品質ゲート復旧` を最初の1テーマとして扱う。最初の実行対象は `QA_SECURITY_FAIL_ON=high npm run qa:security` とし、続けて `qa:rbac:matrix` の実行環境を整える。Goal 4の中で新機能を広げず、P0解除証跡の作成に集中する。
