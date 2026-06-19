---
title: Progress Snapshot 2026-06-05 18:52 JST
category: project
last_updated: 2026-06-05
status: snapshot
---

# Progress Snapshot 2026-06-05 18:52 JST

## Compared With Previous Snapshot

前回の `progress-snapshot-2026-06-05-184156.md` から、W-02初回登録準備の「管理策・SoA支援」が一段進んだ。残留リスク受容の代表QAに続き、今回は初回登録企業側で、管理策ごとのリスク対応策リンクと完了対応策数をSoA準備状況として画面/APIで確認できるようにした。

## Progress By Area

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| 初回登録準備 W-02 | 76% | 78% | SoA準備状況の代表画面/API/QAを追加 |
| リスク / 管理策 | 69% | 72% | 管理策リンク編集に加え、リンク済み/未リンク/完了証跡数を管理策ページで確認可能にした |
| 文書 / 承認 | 66% | 66% | 変更なし |
| 継続運用 W-03〜W-05 | 70% | 70% | 変更なし |
| 外部審査提出束 | 20% | 22% | 正式提出束は未実装だが、提出前のSoA準備可視化が前進 |

## Implemented In This Step

- `GET /api/controls?action=soa&organizationId=...` を追加し、既存の `iso_controls` / `risk_control_links` / `risk_treatments` / `risks` からSoA準備状況を返すようにした。
- 管理策ライブラリ画面に「適用宣言の準備状況」パネルを追加した。
- `qa:initial-w02-soa-readiness` を追加し、画面操作で対応策を完了にした後、登録済み3件、リンク済み2件、完了証跡あり1件、未リンク1件が画面/APIに出ることを確認した。
- spec-dsl と practical verification docs に、SoA準備状況は代表QA済み、正式SoA/審査提出束は未準備として反映した。

## Remaining Main Gaps

- 正式SoAとして、管理策ごとの適用/除外理由、承認状態、改訂履歴を持つこと。
- 審査提出束として、文書、リスク、管理策、監査、是正、マネジメントレビューの証跡を束ねること。
- 新規リスク/対応策作成の代表QA。
- 却下後の修正/再申請ループ。
- 残留リスク受容の正式な承認者選定ルール、多段承認、履歴保全。

## Verification

- `npm run typecheck` pass
- `npm run lint:messages` pass
- `npm run qa:initial-w02-soa-readiness` pass
  - result: `test-results/initial-w02-soa-readiness-run-2026-06-05T09-51-58-232Z.json`
  - seed reset: pass

