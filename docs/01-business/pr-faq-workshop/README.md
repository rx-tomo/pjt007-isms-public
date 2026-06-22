---
title: PR/FAQ Workshop
category: business
created: 2026-06-09
last_updated: 2026-06-19
status: public_snapshot
---

# PR/FAQ Workshop

このディレクトリは、Riscala AI for ISMSをBuild in Publicとして説明するための公開向けPR/FAQを管理する。

公開版では、内部判断メモ、未決定事項台帳、作業進捗snapshotは含めず、外部読者がプロダクトの目的、現在地、AI駆動開発としての意味、協業余地を理解できる文書だけを残している。

## 読む順番

1. `pr-faq.md`
   - PR/FAQ関連文書の入口
   - 公開版に含める文書の入口
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

このため、公開版のPR/FAQでは、プロダクトの価値、現在地、未完成部分、協業余地を前面に出す。

内部ラベルの `initial` / `surveillance` は、外向きには「初回登録準備」「継続運用」と表現する。`SoA` は外向きには原則使わず、「適用管理策の判断」などの平易な言い方へ寄せる。

一方で、認証取得保証、審査合格保証、審査機関への受理保証は約束しない。保証はできないが、審査に通用するレベルの情報整理、証跡管理、出力支援を強く訴求する。

## 文言境界QA

外向きUIや翻訳に、内部開発プロセスや旧用語が混ざらないことを確認する軽量チェックとして、次を使う。

```bash
npm run qa:public-copy
```

このQAは `messages/`、`app/`、`components/`、`pr-faq-public.md` を対象に、内部語・旧語を検出する。

## 次アクション

- 公開候補文書と公開候補コードの文言境界を確認する。
- 公開前に lint、typecheck、build、translation check、public-copy check、secret scan を実施する。
- `ai-driven-development.md` と `contribution-and-collaboration.md` を public README / `CONTRIBUTING.md` / `SECURITY.md` へ転用する。
- 公開後も、最終商用SaaSに向けた追加実装と、Build in Public用snapshot更新を混同しない。
