---
title: Progress Snapshot 2026-06-06 16:54 JST
category: project
last_updated: 2026-06-06
status: snapshot
---

# Progress Snapshot 2026-06-06 16:54 JST

## Compared With Previous Snapshot

前回の `progress-snapshot-2026-06-05-204432.md` から、W-02初回登録準備の「管理策単位のSoA判断」を承認ワークフローへ接続した。これまでは適用/除外理由を保存するところまでだったが、今回は承認申請、CISO承認、承認イベント、承認済み状態、監査ログまで代表QAで確認した。

## Progress By Area

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 85% | 88% | SoA判断を承認申請/CISO承認へ接続 |
| リスク / 管理策 | 82% | 86% | SoA準備状況、判断保存、承認済み化まで画面/API/DBで確認 |
| 文書 / 承認 | 66% | 66% | 変更なし |
| 継続運用 W-03〜W-05 | 70% | 70% | 変更なし |
| 外部審査提出束 | 24% | 26% | 提出束そのものは未実装だが、SoA承認済み証跡を束ねる材料が増えた |

## Implemented In This Step

- `approval_requests.resource_type=iso_control_soa` を追加し、SoA管理策判断を汎用承認キューで扱えるようにした。
- `POST /api/controls` の `submit_soa_approval` で、未判断、権限不足、対象なし、重複申請を検査し、CISO宛て承認依頼を作るようにした。
- `POST /api/approvals` で `iso_control_soa` の承認/却下を処理し、`iso_controls.soa_approval_status`、承認者、承認日時、却下理由、監査ログへ反映するようにした。
- 管理策ページからSoA承認申請でき、承認キューから `SoA管理策判断` として処理できるようにした。
- `qa:initial-w02-soa-readiness` を拡張し、SoA判断保存、承認申請、CISO承認、DB永続化、承認イベント、監査ログまで確認した。

## Remaining Main Gaps

- SoA全体としての版数、改訂履歴、差分履歴を持つこと。
- 審査提出束として、文書、リスク、管理策、監査、是正、マネジメントレビューの証跡を束ねること。
- SoA却下後の修正/再申請ループを確認すること。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。

## Verification

- `npm run typecheck` pass
- `npm run lint:messages` pass
- `npm run seed:practical-verification -- --reset --scenario all` pass
- `npm run qa:initial-w02-soa-readiness` pass
  - result: `test-results/initial-w02-soa-readiness-run-2026-06-06T07-54-16-237Z.json`
  - seed reset: `test-results/practical-verification-seed-all-2026-06-06T07-54-37-897Z-38576.json`
  - first non-escalated run failed with Chromium macOS permission error and was classified as environment blocker.
