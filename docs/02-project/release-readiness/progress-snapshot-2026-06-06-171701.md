---
title: Progress Snapshot 2026-06-06 17:17 JST
category: project
last_updated: 2026-06-06
status: snapshot
---

# Progress Snapshot 2026-06-06 17:17 JST

## Compared With Previous Snapshot

前回の `progress-snapshot-2026-06-06-170312.md` から、W-02初回登録準備のSoAを「個別管理策の判断/承認」から「SoA全体版として固定する」ところまで進めた。これで、審査提出束に入れるためのSoA v1スナップショットをDBと監査ログに残せる。

## Progress By Area

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 90% | 92% | SoA v1の版固定と画面表示を代表QA化 |
| リスク / 管理策 | 88% | 90% | 管理策判断を `soa_versions` のスナップショットに固定 |
| 文書 / 承認 | 66% | 66% | 変更なし |
| 継続運用 W-03〜W-05 | 70% | 70% | 変更なし |
| 外部審査提出束 | 27% | 30% | 提出束そのものは未実装だが、SoA v1を束ねる材料として固定できた |

## Implemented In This Step

- `soa_versions` テーブルを追加し、SoA全体の版番号、スナップショットJSON、管理策数、承認済み管理策数、発行者、発行日時を保存するようにした。
- 管理策ページにSoA版発行ボタンと最新版サマリーを追加した。
- `POST /api/controls` に `publish_soa_version` を追加し、未判断/申請中の管理策が残る場合は発行しないようにした。
- `qa:initial-w02-soa-readiness` を拡張し、SoA v1発行、DB永続化、スナップショット内容、画面表示、`control.soa.version_published` 監査ログまで確認した。

## Remaining Main Gaps

- 審査提出束として、文書、リスク、SoA、監査、是正、マネジメントレビューの証跡を束ねること。
- SoA v2以降の差分表示と改訂理由管理。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。
- 継続運用側の監査計画/監査報告書における却下後再申請は別途確認すること。

## Verification

- `npm run typecheck` pass
- `npm run lint:messages` pass
- `npm run seed:practical-verification -- --reset --scenario all` pass
- `npm run qa:initial-w02-soa-readiness` pass
  - result: `test-results/initial-w02-soa-readiness-run-2026-06-06T08-17-01-030Z.json`
  - seed reset: `test-results/practical-verification-seed-all-2026-06-06T08-17-28-247Z-4578.json`
