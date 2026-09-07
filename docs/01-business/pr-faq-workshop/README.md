---
title: PR/FAQ Workshop
category: business
created: 2026-06-09
last_updated: 2026-08-04
status: active_practical_verification_backlog
---

# PR/FAQ Workshop

このディレクトリは、Riscala AI for ISMSのPR/FAQ正本候補を管理する。

現時点の草稿は、既存コードとオーナー指摘をもとに、公開snapshotの価値と現在地を説明するPR/FAQ正本候補である。

2026-06-28時点で、PR/FAQ workshop内のActive Unknownはゼロ。ただしBacklogはゼロではない。6/26〜6/28のロール別UX更新により、ホーム、承認、監査、課金、審査準備パッケージは利用者の判断順へ寄った。一方で、承認行の業務対象解決、ホーム下部カードの圧縮、自然なUI文言の仕上げは実務検証Backlogとして残る。公開snapshotの実行、public repo反映、preview/production環境確認、商用前hardeningは、Backlogではなく公開同期運用、deployment/release gate、または将来実装ゲートで扱う。

## 読む順番

1. `pr-faq.md`
   - PR/FAQ関連文書の入口
   - 顧客向け文書と内部向け文書の境界
2. `pr-faq-public.md`
   - プレスリリース草稿
   - 顧客向けFAQ
   - 公開資料やサービス紹介へ転用できる候補文
3. `ai-driven-development.md`
   - AI駆動開発として公開するもの/しないもの
   - 開発ログ、検証結果、失敗例、秘密情報の公開境界
   - 公開READMEや記事へ転用できる短文
4. `contribution-and-collaboration.md`
   - コントリビューター、協業、商用相談の入口方針
   - `CONTRIBUTING.md` や公開repo READMEへ転用できる受け入れ基準
   - security contact、commercial inquiry、Issue/Discussion運用の未決定点

## 現在成熟度

最終ゴールは、初回審査登録準備と認証後1年間の継続運用を支援するSaaSサービスである。

ただし、2026-06-19時点の直近ゴールは商用サービス開始ではない。直近ゴールは、開発途上のプロダクトを source-available evaluation snapshot として公開用リポジトリへ配置し、Build in Publicとして現在地を示すことである。これは顧客向けSaaSの正式提供、課金開始、本番SLAの開始を意味しない。

今回のBuild in Publicには2つの軸がある。1つ目は、ISMS支援SaaSとして、初回登録準備と継続運用をどのように支援できるかを公開すること。2つ目は、オーナーがコードを直接書かず、AIエージェントと対話しながら業務アプリを開発するAI駆動開発の可能性を実証することである。

このため、PR/FAQは次の2層で読む。

- `pr-faq-public.md`: 公開用リポジトリや発信で使える、現在の公開snapshot向け説明。
外向きの文書では、初回登録準備、継続運用、適用管理策の判断など、利用者が理解しやすい表現を使う。

一方で、認証取得保証、審査合格保証、審査機関への受理保証は約束しない。保証はできないが、審査に通用するレベルの情報整理、証跡管理、出力支援を強く訴求する。

## 最新実装照合（2026-06-28）

PR/FAQで語っている外向きの中核価値は、最新実装と大きく矛盾していない。初回登録準備と継続運用は代表seed/QAで確認可能であり、enterprise / suspended を含む4テナントの検証データへ広がっている。

一方、今回の公開目的は「この完成度を商用提供として売り出すこと」ではなく、「開発途上の到達点、未完成部分、今後の計画、AI駆動開発の進め方を外部読者に分かる形で示すこと」である。public本文では、開発運用の舞台裏ではなく、プロダクトの価値、現在地、協業余地を前面に出す。

Dev Loginも、ロール先行ではなく「テナント選択 -> テナント内ユーザー選択 -> ログイン」へ更新済みで、PR/FAQの内部成功条件である「利用者の立場で主要業務を確認する」ための検証基盤として整った。古いPlaywright/E2E組織データは `seed:practical-verification -- --reset --scenario all` のcleanup対象になり、正本seedは4テナントだけを残す。

6/26〜6/28のUI更新では、ロール別ホームを「今日の確認事項」へ寄せ、承認画面を「承認待ちの確認」へ置換し、監査画面では計画、実施、指摘、是正、フォローアップの進捗を上部に統合した。課金画面は実請求なし/モック遷移の注意を主CTA直前へ移動し、審査準備パッケージは内部レビュー用出力であり認証保証ではないことを読込状態に依存せず表示するようになった。

承認キューの業務文脈とロールホームのファーストビューは2026-07-11に解消した。残るズレは、ホーム、承認、審査準備パッケージの一部文言と責任境界が自然な利用者語へ完全には寄り切っていないことであり、`PRFAQ-BL-33`〜`PRFAQ-BL-35` として継続する。

## 文言境界QA

外向きUIや翻訳に、内部開発プロセスや旧用語が混ざらないことを確認する軽量チェックとして、次を使う。

```bash
npm run qa:public-copy
```

このQAは `messages/`、`app/`、`components/`、`pr-faq-public.md` を対象に、内部語・旧語が公開候補文へ混ざっていないかを検出する。

## 次アクション

- 公開候補文書と公開候補コードの文言境界を確認する。
- 公開前に lint、typecheck、build、translation check、public-copy check、secret scan を実施する。
- `ai-driven-development.md` と `contribution-and-collaboration.md` を public README / `CONTRIBUTING.md` / `SECURITY.md` へ転用する。
- 公開後も、最終商用SaaSに向けた追加実装と、Build in Public用snapshot更新を混同しない。
