---
title: Progress Snapshot 2026-06-10 08:36 JST
snapshot_at: 2026-06-10 08:36:29 JST
compare_with: progress-snapshot-2026-06-10-0828.md
status: in_progress
---

# Progress Snapshot 2026-06-10 08:36 JST

## Summary

今回の前進は、Homeの日常運用ダッシュボードで `org_admin` / `system_operator` が見る管理者KPIを、固定サンプル値から実データ由来の値へ接続したことである。

教育・訓練フォローアップは既に実データへ接続済みだったが、承認待ち、有効ユーザー、オープンリスク、期限超過タスクのKPIが固定値のままだと、実務検証時に「今このテナントで何が起きているか」を誤認する。今回の修正で、Homeを実務確認の入口として少し信頼しやすくした。

## Progress Delta

| Part | Previous | Current | Delta |
| ---- | -------- | ------- | ----- |
| 実務検証版全体 | 約82% | 約82%+ | Homeの実データ接続を1点改善 |
| 日常運用ダッシュボード CAP-20 | 約partial | partial+ | 管理者KPIの固定サンプル値を解消 |
| role-actor usability | 教育/承認者Home中心 | 管理者Homeも追加 | org_admin/system_operatorのHomeシナリオを追記 |
| QA/テスト基盤 | `qa:education` pass | `home-phase-sync`へKPI契約追加 | 固定値回帰を検知しやすくした |

## Evidence To Verify

- `app/[locale]/home/page.tsx`: 管理者KPIを `DashboardStats` から表示。
- `tests/e2e/home-phase-sync.spec.ts`: 管理者KPIの表示を確認対象へ追加。
- `docs/01-business/spec-dsl/capabilities.md`: CAP-20へ反映。
- `docs/01-business/pr-faq-workshop/role-actor-usability-review-2026-06-09.md`: Admin Home Addendumを追加。

## Remaining

- KPIカードから該当一覧へ直接絞り込む導線。
- 今日/今週/月次の優先事項として並べ替える運用ビュー。
- Home上で教育、承認、リスク、監査、タスクを横断した「次にやること」リスト。
