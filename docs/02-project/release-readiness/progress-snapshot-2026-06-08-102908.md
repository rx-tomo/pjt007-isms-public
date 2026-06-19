---
title: Progress Snapshot 2026-06-08 10:29 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 10:29 JST
compare_with: progress-snapshot-2026-06-08-101820.md
status: in_progress
---

# Progress Snapshot 2026-06-08 10:29 JST

## Summary

前回 2026-06-08 10:18 JST 時点では、残留リスク受容の却下後修正/再申請まで確認済みだった。今回の差分は、`surveillance` の年次証跡を `/api/examination/submission-bundle` と `/ja/examination/submission-bundle` に接続し、継続運用側でも提出束のready/gapを見られる入口を作ったことである。

商用公開の完成度ではなく、実務検証版の観点では「継続運用の1年サイクルで、何が提出可能で何が詰まりか」を画面/API/ZIP/PDF/監査ログで説明できる状態に一歩進んだ。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 88% | 88% | 変更なし。次はSoA v2差分またはPDF体裁改善 |
| W-03 日常・月次運用 | 85% | 86% | 年次提出束に日常/残留リスク系gapが表示されるようになった |
| W-04 内部監査・是正 | 84% | 86% | 監査計画、監査報告書、不適合/是正、フォローアップが提出束項目として接続された |
| W-05 マネジメントレビュー | 78% | 79% | マネジメントレビューが提出束gapとして見えるようになった |
| CAP-18 エクスポート/ポータビリティ | 74% | 79% | 継続運用側でもZIP/PDF/manifest/CSVが取得できるようになった |
| CAP-30 外部審査証跡パッケージ | 63% | 70% | 初回登録準備だけでなく継続運用側の提出束入口も代表QA済みになった |
| Practical QA evidence | 92% | 93% | `qa:surveillance-submission-bundle` が追加でpass |

## New Evidence

- Command: `npm run qa:surveillance-submission-bundle`
- Result: `test-results/surveillance-submission-bundle-run-2026-06-08T01-28-48-017Z.json`
- firstBlocker: `null`
- Readiness: `ready_with_gaps`
- Ready: 2 / 7
- Ready items: `annual_audit_plans`, `annual_audit_evidence`
- Gap items: `audit_reports`, `nonconformity_corrective_actions`, `follow_up_records`, `management_reviews`, `residual_risk_acceptances`
- Output checks: manifest JSON, summary/items/gaps CSV, summary PDF in ZIP, single PDF, UI display, `examination.submission_bundle.generated` audit log

## What This Means

継続運用側の提出束は「完全ready」ではない。ただし、実務検証者が年次運用のどこで詰まっているかを見られるようになった。これは、次の作業を感覚ではなくgap項目から選べる状態である。

次に小さく直すなら、以下のいずれかを選ぶ。

1. 監査報告書を承認済みにして `audit_reports` をreadyへ近づける。
2. 不適合/是正/フォローアップを完了・検証済みにして `nonconformity_corrective_actions` と `follow_up_records` をreadyへ近づける。
3. マネジメントレビューを完了扱いにして `management_reviews` をreadyへ近づける。
4. seedまたはQA内で残留リスク受容承認済み状態を作り、`residual_risk_acceptances` をreadyへ近づける。

## Remaining Gaps

- 多段承認、承認者ルール細分化、再レビュー日は未確認。
- 提出束PDFは業務確認用の最小サマリーであり、審査提出物としての体裁改善は未着手。
- 認証取得保証と誤解されない表現、契約終了時ポータビリティ、SaaS復旧責任はowner decision待ち。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
