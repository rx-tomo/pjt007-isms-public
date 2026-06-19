---
title: Progress Snapshot 2026-06-06 22:18 JST
category: project
created: 2026-06-06 22:18 JST
status: active
---

# Progress Snapshot 2026-06-06 22:18 JST

前回の `progress-snapshot-2026-06-06-171701.md` から、W-02初回登録準備のSoA v1を「審査提出束マニフェスト/ZIP」へ束ねるところまで進めた。これで、スコープ、体制、承認済み文書、情報資産、リスク、SoA v1、初期タスクが提出準備として揃っているかをAPIで確認し、manifest/CSV入りZIPとして取得できる。

## Progress Delta

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 92% | 94% | 審査提出束マニフェストを代表QA化 |
| 外部審査提出束 | 30% | 42% | 束ねる対象と不足をAPIで確認し、manifest/CSV入りZIPとして取得可能にした |
| リスク / 管理策 | 90% | 91% | SoA v1を提出束の材料として利用可能にした |
| 実務検証QA基盤 | 86% | 87% | `qa:initial-w02-submission-bundle` を追加 |

## Implemented

- `GET /api/examination/submission-bundle` を追加し、提出束マニフェストを返すようにした。
- `format=zip` で `submission-bundle-manifest.json`、summary/items/gaps CSVを含むZIPを返すようにした。
- マニフェストは、ISMS適用範囲、体制・担当者、承認済み文書、情報資産、リスクアセスメント、SoA版、初期タスクの `ready` / `missing` を返す。
- `examination.submission_bundle.generated` 監査ログを残す。
- `qa:initial-w02-submission-bundle` を追加し、SoA未発行時のgap、承認済み代表文書、SoA v1発行、提出束ready、ZIP内容、監査ログまで確認した。

## Evidence

- `npm run typecheck`: pass
- `npm run qa:initial-w02-submission-bundle`: pass
- QA result: `test-results/initial-w02-submission-bundle-run-2026-06-06T13-18-42-928Z.json`

## Remaining

- PDFとして読める提出束への整形。
- 提出束を画面から確認・ダウンロードするUI。
- SoA v2以降の差分表示と改訂理由管理。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。
