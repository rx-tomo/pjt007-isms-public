---
title: Progress Snapshot 2026-06-05 19:11 JST
category: project
last_updated: 2026-06-05
status: snapshot
---

# Progress Snapshot 2026-06-05 19:11 JST

## Compared With Previous Snapshot

前回の `progress-snapshot-2026-06-05-185222.md` から、W-02初回登録準備の「新しく見つけたリスクを登録し、対応策と管理策へつなぐ」代表線が進んだ。SoA準備状況の可視化に続き、seed済みリスクの編集だけでなく、利用者が画面から新規リスクを作り、情報資産、対応策、管理策リンク、監査ログまで残せることを確認した。

## Progress By Area

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 78% | 82% | 新規リスク作成、情報資産リンク、対応策/管理策リンクの代表QAを追加 |
| リスク / 管理策 | 72% | 78% | seed編集だけでなく、新規リスクから管理策接続まで画面/API/DBで確認 |
| 文書 / 承認 | 66% | 66% | 変更なし |
| 継続運用 W-03〜W-05 | 70% | 70% | 変更なし |
| 外部審査提出束 | 22% | 22% | 変更なし。正式提出束は未実装 |

## Implemented In This Step

- `POST /api/risks` を追加し、API側で認証、組織アクセス、カテゴリ、責任者、リスク評価、情報資産リンク、監査ログを扱うようにした。
- `risks/new` 画面をAPI境界へ寄せ、新規作成後に詳細画面へ遷移するようにした。
- `PATCH /api/risks/[id]` と `RiskService` を調整し、情報資産リンク更新もAPI経由で扱えるようにした。
- `qa:initial-w02-risk-create` を追加し、新規リスク作成、情報資産リンク、対応策作成、管理策リンク、DB永続化、監査ログを確認した。
- spec-dsl と practical verification docs に、W-02の新規リスク/対応策作成は代表QA済み、正式SoA/審査提出束は未準備として反映した。

## Remaining Main Gaps

- 正式SoAとして、管理策ごとの適用/除外理由、承認状態、改訂履歴を持つこと。
- 審査提出束として、文書、リスク、管理策、監査、是正、マネジメントレビューの証跡を束ねること。
- 初回登録準備における正式承認、却下後の修正/再申請ループ。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。

## Verification

- `npm run qa:initial-w02-risk-create` pass
  - result: `test-results/initial-w02-risk-create-run-2026-06-05T10-11-13-742Z.json`
  - seed reset: pass

