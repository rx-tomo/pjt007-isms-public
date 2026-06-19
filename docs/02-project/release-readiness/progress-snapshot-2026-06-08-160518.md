---
title: Progress Snapshot 2026-06-08 16:05 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 16:05 JST
compare_with: progress-snapshot-2026-06-06-213831.md
status: in_progress
---

# Progress Snapshot 2026-06-08 16:05 JST

## Summary

昨日以前の直近ログである 2026-06-06 22:18 JST 時点では、W-02初回登録準備は審査提出束マニフェスト/API/ZIPまで進み、提出準備データを束ねられる状態だった。

2026-06-08 16:05 JST 時点では、初回登録準備と継続運用の両方で、提出束を画面/API/ZIP/PDFで確認できるようになった。さらに、SoA改訂、残留リスク受容、監査計画、監査報告書、是正完了承認、初期タスク協働の代表QAが増え、実務検証で「どこまで業務が回るか」を見る材料が大きく増えた。

## Compared Progress

| Area | Yesterday-or-earlier baseline | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 94% | 98% | 提出束UI/PDF、SoA差分/改訂理由/レビュー、初期タスク協働まで前進 |
| W-03 日常・月次運用 | 85%前後 | 87%前後 | 年次提出束gap/readyと残留リスク再レビュー条件が前進 |
| W-04 内部監査・是正 | 84%前後 | 93% | 監査計画、報告書、監査開始、是正完了承認を代表QA化 |
| W-05 マネジメントレビュー | 78%前後 | 87%前後 | レビュー完了が年次提出束ready条件へ接続 |
| CAP-10 管理策・SoA支援 | mostly_ready | mostly_ready+ | SoA v1固定後の差分、改訂理由、レビュー却下/再承認まで確認 |
| CAP-11 タスク・是正管理 | partial | mostly_ready | 新規タスク、サブタスク、コメント、タグ、添付、履歴、メンション通知まで確認 |
| CAP-13 内部監査 | mostly_ready | mostly_ready+ | 監査計画新規作成、却下後再申請、開始、報告書再申請まで前進 |
| CAP-14 不適合・是正 | mostly_ready | mostly_ready+ | 是正完了承認の申請/却下/再申請/CISO承認まで前進 |
| CAP-18/CAP-30 提出束・エクスポート | 42%〜70%相当 | 95% | 初回/継続の提出束を画面/API/ZIP/PDF/確認欄まで拡張 |
| Practical QA evidence | 87% | 99% | 代表QAと固定evidenceが大幅に増加 |

## New Evidence Since Baseline

- `npm run qa:initial-w02-submission-bundle`: 初回登録準備の提出束UI/ZIP/PDF/文書プロファイル/確認欄までpass。
- `npm run qa:surveillance-submission-bundle`: 継続運用の年次提出束7/7 ready、ZIP/PDF/UI、確認欄までpass。
- `npm run qa:initial-w02-soa-readiness`: SoA差分、改訂理由、レビュー申請、却下後再申請、CISO承認までpass。
- `npm run qa:surveillance-residual-risk-acceptance`: 残留リスク受容の承認、却下後再申請、責任者承認、再レビュー日までpass。
- `npm run qa:surveillance-audit-plan-approval`: 監査計画新規作成、却下後修正再申請、承認、監査開始までpass。
- `npm run qa:surveillance-audit-report-approval`: 監査報告書の却下後修正再申請、承認までpass。
- `npm run qa:surveillance-corrective-action-update`: 是正完了承認の申請、却下、再申請、CISO承認までpass。
- `npm run qa:initial-w02-task-progress-update`: タスク更新、新規作成、サブタスク、コメント、タグ、添付、履歴、メンション通知までpass。

## What This Means

昨日以前は、初回登録準備の材料を提出束として束ねられる段階だった。

今日の現在地では、初回登録準備と継続運用の両ストーリーについて、業務操作、承認、証跡、提出前確認資料、タスク上の協働がかなりつながってきている。商用公開品質ではまだないが、自分が利用者・テスターとして試し、詰まりを発見するための実務検証版としては、画面単位から業務ジャーニー単位へ進んだ。

## Remaining Gaps

- 監査不適合/CAPAと通常タスクの責務分離を、画面・QA・docsでさらに明確にする。
- 多段承認、承認者ルール細分化、経営層承認の設計判断。
- 日本語フォント埋め込み、PDFの提出先向け体裁、改ページの視覚調整。
- W-01〜W-06 full journey suiteの復旧。
- SaaS課金、契約終了、保証表現、BCP責任範囲は後続判断。
