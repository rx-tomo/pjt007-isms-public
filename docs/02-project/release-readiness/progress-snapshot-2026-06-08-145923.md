---
title: Progress Snapshot 2026-06-08 14:59 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 14:59 JST
compare_with: progress-snapshot-2026-06-06-213831.md
status: in_progress
---

# Progress Snapshot 2026-06-08 14:59 JST

## Summary

直近の昨日以前ログである 2026-06-06 22:18 JST 時点では、W-02初回登録準備の提出束はAPI/ZIPマニフェストまでで、画面確認、PDF、継続運用側の年次提出束、SoA改訂レビュー、残留リスク承認、内部監査の開始/是正完了承認までは未確認だった。

2026-06-08 14:59 JST 時点では、初回登録準備と継続運用の両方で、提出束を画面/API/ZIP/PDFで確認でき、継続運用側は年次提出束7/7 readyまで代表QA済みになった。さらにSoA版の差分、改訂理由、レビュー申請、却下後再申請、残留リスク受容、内部監査計画/報告/是正の承認フローも代表QAで確認済みである。

現在進行中の差分として、初回登録準備のタスク導線を、既存seedタスク更新だけでなく、新規タスク作成とサブタスク作成/完了まで広げている。新規タスク作成まではQAでpassし、サブタスク完了確認はテスト契約を修正済みだが、最終QA再実行とdocs反映は未完了である。

## Compared Progress

| Area | Yesterday-or-earlier baseline | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 94% | 97% | 提出束UI/PDF、SoA差分/改訂理由/レビュー、PDF確認欄まで前進 |
| W-03 日常・月次運用 | 85%前後 | 87%前後 | 年次提出束のgap/ready表示と残留リスク再レビュー条件が前進 |
| W-04 内部監査・是正 | 84%前後 | 93% | 監査計画、報告書、是正完了承認、監査開始まで代表QA化 |
| W-05 マネジメントレビュー | 78%前後 | 87%前後 | レビュー完了が年次提出束ready条件へ接続 |
| CAP-10 管理策・SoA支援 | mostly_ready | mostly_ready+ | SoA v1固定後のv2/v3/v4、差分、改訂理由、レビュー却下/再承認まで確認 |
| CAP-11 タスク・是正管理 | partial | partial+ | タスク進捗更新に加え、新規タスク作成までpass。サブタスク完了QAは再実行待ち |
| CAP-13 内部監査 | mostly_ready | mostly_ready+ | 監査計画新規作成、却下後再申請、開始、報告書再申請まで前進 |
| CAP-14 不適合・是正 | mostly_ready | mostly_ready+ | 是正完了承認の申請/却下/再申請/CISO承認まで前進 |
| CAP-18/CAP-30 提出束・エクスポート | 42%〜70%相当 | 95% | 初回/継続の提出束を画面/API/ZIP/PDF/確認欄まで拡張 |
| Practical QA evidence | 87% | 99% | 代表QAと固定evidenceが大幅に増加。ただしcurrent task QAは未完了 |

## New Evidence Since Baseline

- `npm run qa:initial-w02-submission-bundle`: 初回登録準備の提出束UI/ZIP/PDF/文書プロファイル/確認欄までpass。
- `npm run qa:surveillance-submission-bundle`: 継続運用の年次提出束7/7 ready、ZIP/PDF/UI、確認欄までpass。
- `npm run qa:initial-w02-soa-readiness`: SoA差分、改訂理由、レビュー申請、却下後再申請、CISO承認までpass。
- `npm run qa:surveillance-residual-risk-acceptance`: 残留リスク受容の承認、却下後再申請、責任者承認、再レビュー日までpass。
- `npm run qa:surveillance-audit-plan-approval`: 監査計画新規作成、却下後修正再申請、承認、監査開始までpass。
- `npm run qa:surveillance-audit-report-approval`: 監査報告書の却下後修正再申請、承認までpass。
- `npm run qa:surveillance-corrective-action-update`: 是正完了承認の申請、却下、再申請、CISO承認までpass。

## Current In-progress Item

- Target: W-02初回登録準備の初期タスク導線。
- Implemented: タスク詳細でrole依存のサブタスクフォームが安定表示されるようにした。ブラウザ側のサブタスク作成をAPI境界経由に寄せた。
- Latest QA result: `test-results/initial-w02-task-progress-update-run-2026-06-08T05-57-44-016Z.json`
- Current status: 既存タスク更新、新規タスク作成はpass。サブタスク完了確認だけがテスト契約起因でfailし、テスト側を修正済み。QA再実行とevidence/docs反映が次の一手。

## What This Means

昨日以前は「初回登録準備の材料を提出束として束ねられる」段階だった。今日の現在地では、初回登録準備と継続運用の両ストーリーについて、業務操作、承認、証跡、提出前確認資料がかなりつながってきている。

商用公開品質ではまだないが、自分が利用者・テスターとして「どこまで回せるか」「どこで詰まるか」を見る実務検証版としては、単なる画面群から、業務ジャーニー単位の検証対象へ進んだ。

## Remaining Gaps

- W-02タスク新規作成/サブタスク完了QAの再実行と証跡固定。
- 多段承認、承認者責務分離、経営層承認の設計判断。
- 日本語フォント埋め込み、PDFの提出先向け体裁、改ページの視覚調整。
- W-01〜W-06 full journey suiteの復旧。
- SaaS課金、契約終了、保証表現、BCP責任範囲は後続判断。
