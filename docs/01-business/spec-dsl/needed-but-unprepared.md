---
title: Needed But Unprepared
category: business
last_updated: 2026-06-19
status: no_active_items
---

# Needed But Unprepared

このファイルは、spec-dsl側から見た「まだ準備が必要なもの」の入口である。2026-06-19時点で、PR/FAQ docsスコープのActive Needed Itemはゼロである。

2026-06-19時点では、W-01〜W-06の代表業務ジャーニー、初回登録準備、継続運用、審査準備パッケージ、主要承認、公開文言境界の多くは代表QA済みである。PR/FAQ更新から発生した公開用リポジトリ、Build in Public、AI駆動開発、データ可搬性、課金境界の整備も、PR/FAQ docs内では完了または外部実行ゲートへ移管済みである。

正本:

- `docs/01-business/pr-faq-workshop/backlog.md`
- `docs/01-business/pr-faq-workshop/unknowns.md`
- `docs/01-business/pr-faq-workshop/pr-faq-public.md`
- `docs/01-business/pr-faq-workshop/pr-faq-internal.md`

## Active Needed Items: None

なし。

## Closed Items

| Item | Closure |
| --- | --- |
| 公開snapshot範囲確定 | 公開範囲・除外境界・source-available evaluation snapshot方針・同期手順はPR/FAQ docsと公開sync skillへ整理済み。実snapshot作成とCI確認は公開同期運用ゲート。 |
| 公開snapshot継続運用 | private原本で開発し、節目で公開snapshotを再作成し、公開PRで取り込む運用として整理済み。 |
| AI駆動開発の公開方針 | `docs/01-business/pr-faq-workshop/ai-driven-development.md` で公開/非公開境界と転用文を整理済み。 |
| コントリビューター/協業導線 | `docs/01-business/pr-faq-workshop/contribution-and-collaboration.md` で入口方針と転用文を整理済み。 |
| SaaS型と単一利用者型の整理 | 現行公開では深いSaaS型を主軸、単一利用者向け切り出しは将来の提供形態オプションとして整理済み。 |
| import/export公開約束範囲 | `docs/05-quality/import-export-coverage-matrix.md` で実装済み形式、未対応形式、公開説明上の注意を棚卸し済み。 |
| 課金/プラン/Stripe現在地整理 | `docs/06-operations/billing-and-data-operations.md` でStripe real/mock境界、商用課金開始ではないこと、商用前QAゲートを整理済み。 |
| preview / production auth設定証跡 | PR/FAQ docsスコープではblockerから除外し、deployment/release gateとして扱う。 |
| unit runner除外2テストの扱い | PR/FAQ docsスコープではblockerから除外し、品質改善ゲートとして扱う。 |
| `assessment_period` 表現 | 現行公開docsでは `YYYY-MM` 継続。FY/四半期表現は将来拡張。 |

## Legacy Notes

2026-06-08以前のこのファイルには、W-01〜W-06、CAP-22/28/29/30/32、client/server境界、release-readiness再評価などの古い未準備一覧が残っていた。2026-06-11〜17の実装・QA・PO判断で多くが代表確認済みまたはPR/FAQ Backlogへ移行済みである。

古い詳細履歴を確認する場合はGit履歴または `docs/handoff/` を参照する。現在の作業判断では、PR/FAQ台帳のBacklogゼロ状態と、このファイルのClosed Itemsを優先する。
