---
title: Riscala AI for ISMS PR/FAQ Index
category: business
created: 2026-06-09
last_updated: 2026-06-28
status: split_index
---

# Riscala AI for ISMS PR/FAQ

このファイルはPR/FAQ関連文書の入口である。

顧客向けにそのまま見せる候補文と、内部の開発判断・未決定事項を混ぜないため、PR/FAQを次の2ファイルに分ける。

1. `pr-faq-public.md`
   - プレスリリース草稿
   - 顧客向けFAQ
   - 顧客向けに使える価値表現
2. `pr-faq-internal.md`
   - Draft Basis
   - 内部向けFAQ
   - 認識ズレ候補・未決定事項
   - 競合・代替手段に対する勝ち筋
   - 次にオーナーへ確認したいこと

顧客向け画面、公開資料、サービス紹介文、FAQへ転用する場合は、まず `pr-faq-public.md` を参照する。開発方針、実務検証上の中間ゴール、spec-dslとの関係、未決定事項を確認する場合は `pr-faq-internal.md` を参照する。

2026-06-18時点の直近ゴールは、最終商用サービス開始ではなく、開発途上の到達点を公開用リポジトリへ source-available evaluation snapshot として分離公開することである。このBuild in Public向け公開は、商用SaaS提供、課金開始、認証取得保証、SLA提供を意味しない。

今回の公開目的には、ISMS支援SaaSとしての方向性検証に加え、オーナーがコードを直接書かずAIエージェントと協働して業務アプリを作る「AI駆動開発」の実証も含める。public文書では、内部作業都合ではなく、開発途中で公開する理由、プロダクトの価値、現在地、未完成部分、協業余地を読者目線で説明する。

2026-06-28時点では、実務検証のUI更新により、主要画面は「機能一覧」より「ロールごとの今日の確認事項、判断材料、次アクション、安全境界」を優先する方向へ寄った。ホーム、承認、監査、課金、審査準備パッケージの表示順と文言は、`docs/05-quality/role-ux-quality-loop-2026-06-26.md` と `docs/05-quality/role-ux-branch-comparison-2026-06-27.md` を根拠に更新済みである。

ただし、承認キューの行レベルでは、業務名、変更概要、申請者、影響の解決がまだ不足している。ロール別ホームも、ファーストビューは改善したが下部カード群の圧縮余地が残る。これらは実装済み価値としてではなく、`backlog.md` の `PRFAQ-BL-27` / `PRFAQ-BL-28` / `PRFAQ-BL-33`〜`35` として扱う。
