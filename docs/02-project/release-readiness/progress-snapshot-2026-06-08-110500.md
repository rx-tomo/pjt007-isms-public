---
title: Progress Snapshot 2026-06-08 11:10 JST
category: project
created: 2026-06-08
created_at_jst: 2026-06-08 11:10 JST
compare_with: progress-snapshot-2026-06-08-105900.md
status: in_progress
---

# Progress Snapshot 2026-06-08 11:10 JST

## Summary

前回 2026-06-08 10:59 JST 時点では、`surveillance` の年次証跡提出束が7/7 readyまで到達していた。今回の差分は、提出束PDF、manifest、画面に「内部確認用であり、ISO 27001認証取得、審査受理、商用サービス提供可否を保証しない」注意書きを追加し、`initial` と `surveillance` の両QAで確認したことである。

これにより、提出束が「審査合格保証」のように読まれるリスクを下げ、実務検証版としての位置づけが画面と成果物の両方に出るようになった。

## Compared Progress

| Area | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 93% | 94% | 提出束成果物に保証しない注意書きを追加 |
| W-05 継続運用レビュー | 86% | 87% | 年次提出束の位置づけが画面/PDFにも明示された |
| CAP-18 エクスポート/ポータビリティ | 90% | 91% | manifest/PDF/画面で注意書き確認 |
| CAP-30 外部審査証跡パッケージ | 90% | 92% | 審査合格保証に見えない表現を追加 |
| Practical QA evidence | 97% | 97% | 初回/継続提出束QAが注意書きまで確認 |

## New Evidence

- Command: `npm run qa:initial-w02-submission-bundle`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1109-initial-w02-submission-bundle-notice.json`
- Command: `npm run qa:surveillance-submission-bundle`
- Result: `docs/02-project/release-readiness/evidence/2026-06-08-1110-surveillance-submission-bundle-notice.json`
- Confirmed: manifest `reviewNotice`, PDF text `does not guarantee ISO 27001 certification`, UI notice `認証取得` / `保証するものではありません`

## What This Means

提出束は、実務検証で「何が揃っているか」を見るための道具としてかなり使いやすくなった。一方で、外部審査にそのまま提出する完成文書ではなく、内部確認用であることも明示できた。

次に小さく直すなら、以下の順が自然である。

1. PDFの組版、見出し、余白、項目の読みやすさを整える。
2. 監査計画新規作成、却下後再申請、多段承認など、残る業務ジャーニーを個別QAに切り出す。
3. 初回登録準備/継続運用の提出束を同じ比較ビューで見られるようにする。

## Remaining Gaps

- 多段承認、承認者ルール細分化、再レビュー日は未確認。
- 監査計画新規作成、却下後再申請は代表確認が不足。
- 提出束PDFはまだ最小サマリーであり、審査提出物としての組版品質は未着手。
- 契約終了時ポータビリティ、SaaS復旧責任はowner decision待ち。
- W-01〜W-06 full journey suiteは商用release gateとして未復旧。
