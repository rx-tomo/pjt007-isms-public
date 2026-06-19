---
title: PR/FAQ Workshop
category: business
created: 2026-06-09
last_updated: 2026-06-19
status: backlog_zero
---

# PR/FAQ Workshop

このディレクトリは、Riscala AI for ISMSのPR/FAQ正本候補を管理する。

現時点の草稿は、既存コード、`spec-dsl`、実務検証QA、release-readiness docsから逆算した初稿に、オーナー指摘を反映した「未来起点のPR/FAQ正本候補」である。

2026-06-19時点で、PR/FAQ workshop内のBacklogとActive Unknownはゼロ。公開snapshotの実行、public repo反映、preview/production環境確認、商用前hardeningは、Backlogではなく公開同期運用、deployment/release gate、または将来実装ゲートで扱う。

## 読む順番

1. `pr-faq.md`
   - PR/FAQ関連文書の入口
   - 顧客向け文書と内部向け文書の境界
2. `pr-faq-public.md`
   - プレスリリース草稿
   - 顧客向けFAQ
   - 公開資料やサービス紹介へ転用できる候補文
3. `pr-faq-internal.md`
   - 内部向けFAQ
   - 未決定事項
   - 競合・代替手段に対する勝ち筋
   - 開発上の中間ゴールや判断メモ
4. `ai-driven-development.md`
   - AI駆動開発として公開するもの/しないもの
   - 開発ログ、検証結果、失敗例、秘密情報の公開境界
   - 公開READMEや記事へ転用できる短文
5. `contribution-and-collaboration.md`
   - コントリビューター、協業、商用相談の入口方針
   - `CONTRIBUTING.md` や公開repo READMEへ転用できる受け入れ基準
   - security contact、commercial inquiry、Issue/Discussion運用の未決定点
6. `backlog.md`
   - PR/FAQで発生した課題の完了台帳
   - 2026-06-19時点ではOpen/Partialなし
7. `role-actor-usability-review-2026-06-09.md`
   - 審査準備パッケージのロール/アクター/次アクション観点レビュー
   - UI/PDF/ZIP表現の修正証跡と再テスト計画
8. `unknowns.md`
   - 事業判断、責任境界、競合成熟度などの横断Unknownの完了台帳
   - 2026-06-19時点ではActive Unknownなし

## 現在成熟度

最終ゴールは、初回審査登録準備と認証後1年間の継続運用を支援するSaaSサービスである。

ただし、2026-06-19時点の直近ゴールは商用サービス開始ではない。直近ゴールは、開発途上のプロダクトを source-available evaluation snapshot として公開用リポジトリへ配置し、Build in Publicとして現在地を示すことである。これは顧客向けSaaSの正式提供、課金開始、本番SLAの開始を意味しない。

今回のBuild in Publicには2つの軸がある。1つ目は、ISMS支援SaaSとして、初回登録準備と継続運用をどのように支援できるかを公開すること。2つ目は、オーナーがコードを直接書かず、AIエージェントと対話しながら業務アプリを開発するAI駆動開発の可能性を実証することである。

このため、PR/FAQは次の2層で読む。

- `pr-faq-public.md`: 公開用リポジトリや発信で使える、現在の公開snapshot向け説明。
- `pr-faq-internal.md`: 最終SaaS像、実務検証、公開snapshot運用、未決定事項を分けて扱う内部判断文書。

内部ラベルの `initial` / `surveillance` は、外向きには「初回登録準備」「継続運用」と表現する。`SoA` は外向きには原則使わず、「適用管理策の判断」などの平易な言い方へ寄せる。

一方で、認証取得保証、審査合格保証、審査機関への受理保証は約束しない。保証はできないが、審査に通用するレベルの情報整理、証跡管理、出力支援を強く訴求する。

## 最新実装照合（2026-06-19）

PR/FAQで語っている外向きの中核価値は、最新実装と大きく矛盾していない。初回登録準備と継続運用は代表seed/QAで確認可能であり、今回のseed整理により enterprise / suspended を含む4テナントの検証データへ広がった。

一方、今回の公開目的は「この完成度を商用提供として売り出すこと」ではなく、「開発途上の到達点、未完成部分、今後の計画、AI駆動開発の進め方を外部読者に分かる形で示すこと」である。public本文では、開発運用の舞台裏ではなく、プロダクトの価値、現在地、協業余地を前面に出す。

Dev Loginも、ロール先行ではなく「テナント選択 -> テナント内ユーザー選択 -> ログイン」へ更新済みで、PR/FAQの内部成功条件である「利用者の立場で主要業務を確認する」ための検証基盤として整った。古いPlaywright/E2E組織データは `seed:practical-verification -- --reset --scenario all` のcleanup対象になり、正本seedは4テナントだけを残す。

更新が必要だった主なズレは、内部FAQとBacklog側で、承認者ルール、競合比較、契約終了時エクスポートが未決定扱いのまま残っていた点である。2026-06-11のPO判断と最新実装に合わせて、単段承認、ワークフロー連結の優位性訴求、既存CSV/ZIP exportを実務検証版の完成形として反映した。

## 文言境界QA

外向きUIや翻訳に、内部開発プロセスや旧用語が混ざらないことを確認する軽量チェックとして、次を使う。

```bash
npm run qa:public-copy
```

このQAは `messages/`、`app/`、`components/`、`pr-faq-public.md` を対象に、`実務検証`、`spec-dsl`、`確認用パッケージ`、`Submission Bundle` などの内部語・旧語を検出する。内部docsや `pr-faq-internal.md` は別途レビュー対象とし、顧客向け一次UIや公開候補文には出さない。

## 次アクション

- 公開候補文書と公開候補コードの文言境界を確認する。
- 公開前に lint、typecheck、build、translation check、public-copy check、secret scan を実施する。
- `ai-driven-development.md` と `contribution-and-collaboration.md` を public README / `CONTRIBUTING.md` / `SECURITY.md` へ転用する。
- 公開後も、最終商用SaaSに向けた追加実装と、Build in Public用snapshot更新を混同しない。
