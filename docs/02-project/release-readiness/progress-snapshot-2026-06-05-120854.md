---
title: ISMS Pilot Progress Snapshot 2026-06-05 12:08
category: project
created: 2026-06-05
snapshot_at: 2026-06-05 12:08:54 JST
author: Codex
status: active
previous_snapshot: docs/02-project/release-readiness/progress-snapshot-2026-06-05-115428.md
---

# ISMS Pilot Progress Snapshot 2026-06-05 12:08

## Purpose

このスナップショットは、2026-06-05 11:54時点の進捗記録と比較できるように、2026-06-05 12:08時点の状態を同じ粒度で記録する。

次回ユーザから「前回の進捗と比較して、現在の進行状況をレポートして」と依頼された場合は、このファイルを比較基準にして、進捗率、到達済みジャーニー、証跡、残課題の差分を提示する。

## Overall Progress

実務検証版としての全体進捗は、約62%前後。

11:54からの大きな差分は、`initial` のW-02初回登録準備で、方針文書を下書き作成し、文書一覧に表示し、CISOへ承認依頼し、承認済みへ進める代表QAが通ったこと。これにより、初回登録準備ストーリーは、文書の存在確認だけでなく、審査登録準備で重要な「方針文書の承認」まで実操作証跡を持つ状態へ進んだ。

## Comparison From Previous Snapshot

| 比較項目 | 前回 2026-06-05 11:54 | 現在 2026-06-05 12:08 | 差分 |
| --- | --- | --- | --- |
| 全体進捗 | 約61%前後 | 約62%前後 | W-02の文書作成/承認QAがpass |
| W-02 initial | 情報資産CRUDまでpass。文書作成/承認は次段 | 方針文書の下書き作成、一覧表示、CISO承認依頼、承認済み化までpass | 文書管理が代表表示から承認業務まで前進 |
| CAP-06 文書管理 | 文書一覧/既存QAはあるがW-02業務ジャーニー未検証 | `qa:initial-w02-document-approval` で初回登録準備の方針文書承認を確認 | CAP-06が実務検証寄りに前進 |
| CAP-07 承認 | approval資産はあるがW-02通し証跡不足 | `approval_requests` と監査ログまで確認 | 差戻し/期限/多段承認は残るが、代表承認は完了側へ |
| 次タスク | W-02残りdeep CRUD | リスク評価更新、管理策リンク編集、タスク進捗更新 | 文書作成/承認は完了側へ移動 |

## Progress By Area

| パート | 進捗感 | 状態 |
| --- | ---: | --- |
| 実務検証の方針整理 / spec-dsl | 90% | W-02文書承認QAをcapabilities/workflows/evidence-mapへ反映 |
| シードデータ | 84% | 2つのモデルテナントを維持。QA後にseed resetと `qa:practical-seed` がpass |
| フェーズ選択 | 80% | `initial` / `surveillance` の保存・履歴・ホーム反映をQA済み |
| 組織基本情報 | 75% | 業種、従業員数、認証ステータス保存をQA済み |
| ISMS適用範囲 | 70% | scope保存・再読込をQA済み |
| 体制ロール / 担当者 | 70% | 担当者割当、再読込、推奨ロールseedの代表QAがpass |
| 部門 / ユーザー管理 | 62% | 招待、受諾、membership、role、permission、audit log、画面表示の代表QAがpass |
| 文書テンプレート / 文書整備 | 62% | 方針文書の下書き作成、一覧表示、CISO承認依頼、承認済み化、DB/監査ログまでpass。改訂/多段承認/エクスポート提出束は次段 |
| 情報資産 | 65% | seed表示に加え、作成、編集、検索、削除、DB永続化がpass。CSV import/exportは未確認 |
| リスク / 管理策 | 58% | seedリスク、対応策、管理策、リンク、Evidence Vault不足表示、レビュー上の期限付き受容条件記録がpass。新規評価/リンク編集/正式承認は次段 |
| 初期タスク / 次アクション | 55% | seed初期タスクとHome次アクション表示はpass。作成/進捗更新は次段 |
| 継続運用 `surveillance` | 55% | 内部監査、是正、フォローアップ、レビュー、Home統計、期限超過、通知、Evidence Vault不足、経営判断/資源配分/リスク受容条件までpass |
| SaaS/課金/テナント提供 | 35〜40% | 今回の主目標では後回し。実務検証に必要な範囲だけ保留 |

## Evidence

| 項目 | 証跡 |
| --- | --- |
| 前回基準 | `docs/02-project/release-readiness/progress-snapshot-2026-06-05-115428.md` |
| W-02 document approval QA | `npm run qa:initial-w02-document-approval` pass |
| W-02 document approval QA結果 | `test-results/initial-w02-document-approval-run-2026-06-05T03-08-08-642Z.json`, firstBlocker `null` |
| seed復元 | `npm run seed:practical-verification -- --reset --scenario all` pass |
| practical seed QA | `npm run qa:practical-seed` pass |
| typecheck | `npm run typecheck` pass |
| messages lint | `npm run lint:messages` pass |
| diff check | `git diff --check` pass |
| QA追加 | `tests/e2e/initial-w02-document-approval.spec.ts`, `scripts/qa-initial-w02-document-approval.js`, `package.json` |
| API/UI修正 | `app/api/documents/[id]/approval/route.ts`, `app/api/documents/route.ts`, `components/documents/DocumentList.tsx`, `lib/services/document.ts` |

## New Finding

文書承認の業務ロジックは既にあったが、文書一覧UIは旧 `document_approvals` とブラウザ側サービス呼び出しに寄っていたため、実務検証QAでは承認進捗が安定して表示されなかった。今回、承認依頼/承認/却下を `/api/documents/[id]/approval` に寄せ、文書一覧APIが `approval_requests` ベースの承認進捗を返すようにして、初回登録準備の方針文書承認を通せた。

## Next Planned Work

1. W-02の残り深掘りとして、リスク評価更新、管理策リンク編集、タスク進捗更新を1本ずつQA化する。
2. 文書管理では、必要に応じて改訂、版履歴、エクスポート提出束、多段承認を別QAにする。
3. `mock:activities` / UC-03 activity feed QAのarchive/non-active判断をdocs側へ反映する。

## Known Worktree State

2026-06-05 12:08:54 JST 時点:

- main作業ツリーには、W-02 document approval QA、document approval API、document list progress修正、spec-dsl/release-readiness docs更新の未コミット変更がある。
- QA用dev serverは起動中。コミット前に停止予定。
- 未追跡の図解PNG `docs/01-business/ig_03bb2f28b0381cd9016a221e8c71cc8191860bb304eb6204b2.png` は今回の実装/QA差分とは別扱い。
