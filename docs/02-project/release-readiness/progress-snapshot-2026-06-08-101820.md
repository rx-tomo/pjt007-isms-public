---
title: Progress Snapshot 2026-06-08 10:18 JST
category: release-readiness
created_at: 2026-06-08 10:18:20 JST
compare_with: progress-snapshot-2026-06-08-100655.md
status: in_progress
---

# Progress Snapshot 2026-06-08 10:18 JST

前回 `progress-snapshot-2026-06-08-100655.md` では、残留リスク受容の承認申請、CISO承認、別申請の却下まで代表QA済みになった。今回の差分は、却下後にsystem_operatorがリスク詳細で管理策リンクを修正し、承認状態を `draft` へ戻して再申請できることを確認した点である。

## Progress By Part

| Part | Previous | Current | Delta |
| --- | ---: | ---: | --- |
| W-03 日常/月次運用 | 84% | 85% | 残留リスク受容の差戻し後ループが通った |
| W-05 マネジメントレビュー/継続改善 | 77% | 78% | 期限付きリスク受容条件の承認運用が少し実務寄りになった |
| CAP-07 承認基盤 | 85% | 86% | 却下後の再申請で新しい承認requestを作れることを確認 |
| CAP-28 残留リスク受容 | 72% | 78% | 承認/却下に加えて、修正、draft復帰、再申請、監査ログまで進展 |
| 実務検証QA基盤 | 91% | 92% | `qa:surveillance-residual-risk-acceptance` の証跡範囲を拡張 |

## Evidence

- Command: `npm run qa:surveillance-residual-risk-acceptance`
- Result: `test-results/surveillance-residual-risk-acceptance-run-2026-06-08T01-17-43-602Z.json`
- Result summary: `firstBlocker = null`
- New confirmed step:
  - `CISOが別の残留リスク受容申請を却下できる`
  - `却下後に修正して再申請できる`
  - 却下済み対応策の管理策リンク修正で `risk_treatments.residual_approval_status=draft`
  - `risk.residual_acceptance.revised` 監査ログ
  - 再申請で新しい `approval_requests(resource_type=risk_residual_acceptance)` と `approval_events=requested`

## Updated Source Of Truth

- `docs/01-business/spec-dsl/capabilities.md`
- `docs/01-business/spec-dsl/gates.md`
- `docs/01-business/spec-dsl/evidence-map.md`
- `docs/01-business/spec-dsl/process.md`
- `docs/01-business/spec-dsl/approval-responsibility-matrix.md`
- `docs/02-project/release-readiness/practical-verification-plan.md`

## Remaining Gaps

1. 残留リスク受容の多段承認、リスクオーナー/経営層を含む承認者ルール細分化。
2. 残留リスク受容の再レビュー日、期限後レビューの通知/証跡。
3. 継続運用側の審査提出束への接続。
4. W-01〜W-06 full journey suiteの旧test debt復旧。

## Next Step

次は、継続運用側で「監査計画、監査報告書、是正、残留リスク受容、マネジメントレビューを審査提出束へ束ねる」入口を確認する。初回登録準備側の提出束で作った仕組みを、継続運用の年次証跡へ接続できるかを見る。
