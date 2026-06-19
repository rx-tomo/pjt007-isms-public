---
title: Progress Snapshot 2026-06-06 17:03 JST
category: project
last_updated: 2026-06-06
status: snapshot
---

# Progress Snapshot 2026-06-06 17:03 JST

## Compared With Previous Snapshot

前回の `progress-snapshot-2026-06-06-165416.md` から、W-02初回登録準備の「SoA承認」を却下後の修正/再申請ループまで広げた。これまでは承認済みになる代表線までだったが、今回はCISOが却下し、管理策画面で却下理由を見て、理由を修正し、再申請して承認済みに戻すところまで確認した。

## Progress By Area

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 88% | 90% | SoA却下後の修正/再申請ループを代表QA化 |
| リスク / 管理策 | 86% | 88% | SoA判断の却下、draft復帰、再申請、承認済み化まで画面/API/DBで確認 |
| 文書 / 承認 | 66% | 66% | 変更なし |
| 継続運用 W-03〜W-05 | 70% | 70% | 変更なし |
| 外部審査提出束 | 26% | 27% | 提出束そのものは未実装だが、SoA差戻し履歴を束ねる材料が増えた |

## Implemented In This Step

- 管理策ページでSoA却下理由を表示し、テストからも確認できるようにした。
- `qa:initial-w02-soa-readiness` を拡張し、SoA承認申請、CISO却下、却下理由表示、理由修正、`draft` 復帰、再申請、CISO承認まで一連で確認した。
- DBでは `approval_requests` の `rejected` / `approved`、`approval_events` の `requested` / `approved`、`iso_controls.soa_approval_status`、`soa_rejection_reason` のクリア、監査ログを確認した。
- spec-dsl と practical verification docs を更新し、W-02 SoAの却下後修正/再申請を代表QA済みに移した。

## Remaining Main Gaps

- SoA全体としての版数、改訂履歴、差分履歴を持つこと。
- 審査提出束として、文書、リスク、管理策、監査、是正、マネジメントレビューの証跡を束ねること。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。
- 継続運用側の監査計画/監査報告書における却下後再申請は別途確認すること。

## Verification

- `npm run typecheck` pass
- `npm run lint:messages` pass
- `npm run seed:practical-verification -- --reset --scenario all` pass
- `npm run qa:initial-w02-soa-readiness` pass
  - result: `test-results/initial-w02-soa-readiness-run-2026-06-06T08-03-12-646Z.json`
  - seed reset: `test-results/practical-verification-seed-all-2026-06-06T08-03-45-263Z-56349.json`
