---
title: Progress Snapshot
category: project
created: 2026-06-05
last_updated: 2026-06-05
author: Codex
---

# Progress Snapshot

記録日時: 2026-06-05 14:33:20 JST

## 前回スナップショットからの差分

前回の `progress-snapshot-2026-06-05-131336.md` では、次の重点が「監査報告書の正式承認ワークフロー」だった。今回、その候補を実装とQAで一段進め、保存、承認申請、承認キュー、CISO承認、却下、DB、承認イベント、監査ログまで代表確認できた。

## 進捗率の見立て

| 領域 | 前回 | 現在 | 差分 |
| --- | ---: | ---: | --- |
| 初回登録準備 `initial` | 70% | 70% | 今回は主に継続運用側を進めたため据え置き |
| 継続運用 `surveillance` | 55% | 60% | 監査報告書の正式承認/却下が代表QA済みになった |
| 承認・責任整理 | 45% | 52% | `approver` の抽象性を残しつつ、監査報告書はCISO承認者解決まで確認 |
| client/server境界 | 67% | 70% | 承認キュー一覧/承認/却下と監査報告書承認導線をAPI境界へ移動 |
| 審査提出/外部説明 | 20% | 20% | 未着手のまま。次の主なGap |

## 今回の実装

- `/api/approvals` を追加し、承認キューの一覧、承認、却下、差し戻しをAPI境界へ寄せた。
- 監査報告書ページは `/api/audit` 経由で保存/承認申請できる状態を維持し、承認者はCISO優先で解決する。
- `qa:surveillance-audit-report-approval` を、承認申請だけでなくCISO承認と却下まで確認するQAへ拡張した。

## 検証結果

- `npm run typecheck`: pass
- `npm run lint:messages`: pass
- `npm run qa:surveillance-audit-report-approval`: pass
- 結果: `test-results/surveillance-audit-report-approval-run-2026-06-05T05-35-52-450Z.json`
- 承認キュー表示時のサイドバーHydration mismatchは、`DashboardLayout` の保存状態読込をマウント後に移した後の再QAログでは再発なし

## 残課題

1. 監査計画承認の代表QAを作る。
2. 残留リスク受容の承認者、理由、期限、履歴を構造化する。
3. 承認済み監査報告書、リスク、管理策、是正、証跡を束ねる審査提出パッケージを確認する。
4. 却下後の修正/再申請フローを必要範囲で確認する。
5. 新規タスク、サブタスク、タグ、添付など未QA操作のAPI境界を必要時に確認する。
