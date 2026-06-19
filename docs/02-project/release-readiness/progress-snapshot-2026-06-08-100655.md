---
title: Progress Snapshot 2026-06-08 10:06 JST
category: release-readiness
created_at: 2026-06-08 10:06:55 JST
compare_with: progress-snapshot-2026-06-08-095631.md
status: in_progress
---

# Progress Snapshot 2026-06-08 10:06 JST

前回 `progress-snapshot-2026-06-08-095631.md` では、初回登録準備側の審査提出束PDFまで代表QA済みになった。今回の差分は、継続運用側の残留リスク受容について、受容理由/責任者/期限/完了状態だけでなく、承認申請、CISO承認、別申請の却下、承認イベント、監査ログまで通した点である。

## Progress By Part

| Part | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-02 初回登録準備 | 86% | 86% | 変更なし。提出束PDFまで代表QA済み |
| W-03 日常/月次運用 | 82% | 84% | 残留リスク受容が承認キューへ接続した |
| W-04 内部監査/是正 | 84% | 84% | 変更なし。監査計画/報告書承認は代表QA済み |
| W-05 マネジメントレビュー/継続改善 | 74% | 77% | リスク受容条件の正式承認証跡が一段進んだ |
| CAP-07 承認基盤 | 82% | 85% | `risk_residual_acceptance` の申請/承認/却下が代表QA済み |
| CAP-28 残留リスク受容 | 55% | 72% | 受容完了証跡から承認履歴/監査ログまで進展 |
| 実務検証QA基盤 | 90% | 91% | seed reset込みの代表QAが追加でpass |

## Evidence

- Command: `npm run qa:surveillance-residual-risk-acceptance`
- Result: `test-results/surveillance-residual-risk-acceptance-run-2026-06-08T01-06-17-360Z.json`
- Result summary: `firstBlocker = null`
- Confirmed steps:
  - `system_operator` がリスク詳細で残留リスク受容 `accept` 対応を作成
  - 完了済み受容対応を承認申請し、CISO承認者の `approval_requests` を作成
  - CISOが承認キューで承認し、`approval_events=approved` と `risk.residual_acceptance.approved` を確認
  - 別の残留リスク受容申請を却下し、却下理由、`approval_events=rejected`、`risk.residual_acceptance.rejected` を確認
  - 実行後にseed resetで2テナントseed状態へ復元

## Updated Source Of Truth

- `docs/01-business/spec-dsl/capabilities.md`
- `docs/01-business/spec-dsl/gates.md`
- `docs/01-business/spec-dsl/evidence-map.md`
- `docs/01-business/spec-dsl/process.md`
- `docs/01-business/spec-dsl/approval-responsibility-matrix.md`
- `docs/02-project/release-readiness/practical-verification-plan.md`

## Remaining Gaps

1. 残留リスク受容の却下後修正/再申請。
2. 多段承認、リスクオーナー/経営層を含む承認者ルール細分化。
3. 継続運用側の審査提出束への接続。
4. W-01〜W-06 full journey suiteの旧test debt復旧。

## Next Step

次は、継続運用ストーリーで「残留リスク受容が却下された後、内容を修正して再申請できるか」を1ステップ進める。これにより、承認が通る正常系だけでなく、実務で起こりやすい差戻し後の運用まで検証できる。
