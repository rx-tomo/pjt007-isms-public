---
title: Progress Snapshot 2026-06-05 20:44 JST
category: project
last_updated: 2026-06-05
status: snapshot
---

# Progress Snapshot 2026-06-05 20:44 JST

## Compared With Previous Snapshot

前回の `progress-snapshot-2026-06-05-191135.md` から、W-02初回登録準備の「正式SoAに向けた管理策単位の判断保存」が進んだ。これまではSoA準備状況としてリンク済み/未リンクや完了対応策数を見るところまでだったが、今回は管理策ごとに適用/適用除外、理由、判断者、判断日時、監査ログを残せるようにした。

## Progress By Area

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 82% | 85% | 管理策単位のSoA適用/除外判断と理由保存を追加 |
| リスク / 管理策 | 78% | 82% | SoA準備状況から正式判断の保存へ前進 |
| 文書 / 承認 | 66% | 66% | 変更なし |
| 継続運用 W-03〜W-05 | 70% | 70% | 変更なし |
| 外部審査提出束 | 22% | 24% | 提出束そのものは未実装だが、SoA判断材料が保存可能になった |

## Implemented In This Step

- `iso_controls` に `soa_status`、`soa_applicability_reason`、`soa_exclusion_reason`、`soa_reviewed_by`、`soa_reviewed_at` を追加した。
- `PATCH /api/controls` を追加し、管理策単位のSoA判断をAPI側の認証/組織アクセス確認つきで保存するようにした。
- 管理策ページのSoAパネルで、`not_reviewed` / `applicable` / `not_applicable` と理由を入力し保存できるようにした。
- `seed:practical-verification` で既存SQLite DBにSoA列を補完し、reset後も固定seedへ戻せるようにした。
- `qa:initial-w02-soa-readiness` を拡張し、適用理由、適用除外理由、判断者、判断日時、`control.soa_decision.updated` 監査ログ、API返却まで確認した。

## Remaining Main Gaps

- 承認済みSoAとして、承認申請、承認、却下、改訂履歴を持つこと。
- 審査提出束として、文書、リスク、管理策、監査、是正、マネジメントレビューの証跡を束ねること。
- 初回登録準備における正式承認、却下後の修正/再申請ループ。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。

## Verification

- `npm run typecheck` pass
- `npm run lint:messages` pass
- `npm run seed:practical-verification -- --reset --scenario all` pass
- `npm run qa:practical-seed` pass
- `npm run qa:initial-w02-soa-readiness` pass
  - result: `test-results/initial-w02-soa-readiness-run-2026-06-05T11-44-32-360Z.json`
  - first non-escalated run failed with Chromium macOS permission error and was classified as environment blocker.
  - escalated rerun passed and reset seed to the two-tenant baseline.

