---
title: ISMS Pilot Progress Snapshot 2026-06-05 12:50
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 12:50:49 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-123346.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 12:50

## Purpose

このスナップショットは、2026-06-05 12:33時点の進捗記録と比較できるように、2026-06-05 12:50時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約64%前後。

12:33からの大きな差分は、`initial` のW-02初回登録準備で、seed済みリスク対応策から管理策リンクを画面編集し、DB永続化と監査ログまで確認できたこと。これにより、リスク管理は「評価を見直す」段階から「対応策と管理策の接続を運用中に修正できる」段階へ前進した。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 12:33 | 現在 2026-06-05 12:50 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約63%前後 | 約64%前後 | W-02の管理策リンク編集QAがpass |
| W-02 initial | seedリスクの再評価、DB永続化、評価履歴、監査ログまでpass | seedリスク対応策の管理策リンク編集、DB永続化、監査ログまでpass | リスク対応と管理策の紐付けを実操作で確認 |
| CAP-10 管理策・SoA支援 | seed管理策表示とリンク存在は確認済み。編集は次段 | `qa:initial-w02-control-link-update` で画面編集と証跡保存を確認 | CAP-10が実務検証寄りに前進 |
| client/server境界 | リスク更新はAPI化済み。対応策/管理策リンク更新は未確認 | `POST /api/risks/[id]/treatments` と `PATCH /api/risk-treatments/[id]` を追加 | 対応策/管理策リンク更新系のbrowser direct DB accessを解消 |
| 次タスク | 管理策リンク編集、タスク進捗更新 | タスク進捗更新 | 管理策リンク編集は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 92% | W-02管理策リンク編集QAをworkflows/capabilities/evidence-map/unknownsへ反映 |
| シードデータ | 84% | QA後にseed resetと `qa:practical-seed` がpass。2つのモデルテナントを維持 |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 62% | 方針文書の下書き作成、一覧表示、CISO承認依頼、承認済み化、DB/監査ログまでpass。改訂/多段承認/エクスポート提出束は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 63% | seedリスク表示、評価更新、対応策/管理策リンク編集、DB永続化、評価履歴、監査ログまでpass。SoA、正式承認、残留リスク承認は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 55% | 内部監査、是正、フォローアップ、レビュー、Home統計、期限超過、通知、Evidence Vault不足、経営判断/資源配分/リスク受容条件までpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-123346.md` |
| W-02 control link update QA | `npm run qa:initial-w02-control-link-update` pass |
| W-02 control link update QA結果 | `test-results/initial-w02-control-link-update-run-2026-06-05T03-47-35-655Z.json`, firstBlocker `null` |
| seed復元 | `node scripts/seed-practical-verification.mjs --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| QA追加 | `tests/e2e/initial-w02-control-link-update.spec.ts`, `scripts/qa-initial-w02-control-link-update.js`, `package.json` |
| API/Service修正 | `app/api/risks/[id]/treatments/route.ts`, `app/api/risk-treatments/[id]/route.ts`, `app/[locale]/risks/[id]/page.tsx`, `lib/services/risk.ts` |

## New Finding

リスク対応策と管理策リンクは、seedで「存在する」だけでは実務検証として弱い。今回、既存対応策の管理策リンクを画面から増やし、DBと監査ログに残ることを確認したため、初回登録準備で「対応策に必要な管理策を後から補正する」動きが検証可能になった。

## Next Planned Work

1. W-02の残り深掘りとして、タスク進捗更新をQA化する。
2. リスク管理では、必要に応じて新規登録、対応策、残留リスク受容、SoA、正式承認ワークフローを別QAにする。
3. `surveillance` では、正式な承認ワークフロー、判断分類、受容理由/承認者/履歴の構造化へ進む。

## Known Worktree State

2026-06-05 12:50:49 JST 時点:

- main作業ツリーには、W-02 control link update API/UI/QA、spec-dsl/release-readiness docs更新、進捗スナップショット追加の未コミット変更がある。
- QA用dev serverは直近のQA後に停止確認予定。
- 未追跡の `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
